"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { trackProductEvent } from "../../../lib/analytics";
import { supabase } from "../../../lib/supabase/client";
import "./setup.css";

type PilotClass = { id: string; name: string; academic_year: string; activity: string | null };
type RosterRow = { id: string; firstName: string; lastName: string; grade: string };
type FocusTag = { id: string; name: string; category: string; created_by: string };

const MAX_CLASSES = 5;
const MAX_CUSTOM_FOCUSES = 10;

function emptyPupil(): RosterRow {
  return { id: crypto.randomUUID(), firstName: "", lastName: "", grade: "" };
}

function isJwtClockError(error: unknown) {
  const message = error instanceof Error ? error.message : String((error as { message?: string } | null)?.message ?? error ?? "");
  const normalized = message.toLowerCase();
  return normalized.includes("jwt") && (normalized.includes("issued at future") || normalized.includes("issued in the future"));
}

function friendlyError(error: unknown, fallback: string) {
  if (isJwtClockError(error)) {
    return "Your secure session is out of sync. Reload the page first. If it returns, sign out and back in. On iPad, also check Settings → General → Date & Time → Set Automatically.";
  }
  const message = error instanceof Error ? error.message : String((error as { message?: string } | null)?.message ?? "");
  return message || fallback;
}

function csvCells(line: string) {
  const cells: string[] = [];
  let current = "";
  let quoted = false;
  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    if (char === '"') {
      if (quoted && line[index + 1] === '"') { current += '"'; index += 1; }
      else quoted = !quoted;
    } else if (char === "," && !quoted) {
      cells.push(current.trim());
      current = "";
    } else current += char;
  }
  cells.push(current.trim());
  return cells;
}

function splitFullName(value: string) {
  const parts = value.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return { firstName: "", lastName: "" };
  if (parts.length === 1) return { firstName: parts[0], lastName: "" };
  return { firstName: parts[0], lastName: parts.slice(1).join(" ") };
}

function looksLikeGrade(value: string) {
  return /^(?:grade\s*|year\s*|y\s*)?\d{1,2}[a-z]?$/i.test(value.trim());
}

function parseRosterPaste(text: string): RosterRow[] {
  const lines = text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  if (!lines.length) return [];

  const delimiter = lines.some((line) => line.includes("\t")) ? "tab" : lines.some((line) => line.includes(",")) ? "csv" : "plain";
  const tokenise = (line: string) => delimiter === "tab" ? line.split("\t").map((cell) => cell.trim()) : delimiter === "csv" ? csvCells(line) : [line.trim()];
  const first = tokenise(lines[0]).map((cell) => cell.toLowerCase());
  const hasHeader = first.some((cell) => /first|given|last|surname|family|grade|year|student|pupil|full.?name/.test(cell));
  const source = hasHeader ? lines.slice(1) : lines;

  let firstIndex = -1;
  let lastIndex = -1;
  let gradeIndex = -1;
  let fullNameIndex = -1;
  if (hasHeader) {
    firstIndex = first.findIndex((cell) => /first|given/.test(cell));
    lastIndex = first.findIndex((cell) => /last|surname|family/.test(cell));
    gradeIndex = first.findIndex((cell) => /grade|year|class/.test(cell));
    fullNameIndex = first.findIndex((cell) => /student|pupil|full.?name|^name$/.test(cell));
  }

  return source.map((line) => {
    const cells = tokenise(line);
    let firstName = "";
    let lastName = "";
    let grade = "";

    if (hasHeader) {
      if (firstIndex >= 0) firstName = cells[firstIndex] ?? "";
      if (lastIndex >= 0) lastName = cells[lastIndex] ?? "";
      if (gradeIndex >= 0) grade = cells[gradeIndex] ?? "";
      if (!firstName && fullNameIndex >= 0) ({ firstName, lastName } = splitFullName(cells[fullNameIndex] ?? ""));
    } else if (cells.length >= 3) {
      [firstName, lastName, grade] = cells;
    } else if (cells.length === 2) {
      if (looksLikeGrade(cells[1])) {
        ({ firstName, lastName } = splitFullName(cells[0]));
        grade = cells[1];
      } else {
        [firstName, lastName] = cells;
      }
    } else {
      const parts = cells[0].split(/\s+/).filter(Boolean);
      if (parts.length >= 3 && looksLikeGrade(parts[parts.length - 1])) {
        grade = parts.pop() ?? "";
      }
      ({ firstName, lastName } = splitFullName(parts.join(" ")));
    }

    return { id: crypto.randomUUID(), firstName: firstName.trim(), lastName: lastName.trim(), grade: grade.trim() };
  }).filter((row) => row.firstName);
}

export default function PilotSetupPage() {
  const [classes, setClasses] = useState<PilotClass[]>([]);
  const [className, setClassName] = useState("");
  const [activity, setActivity] = useState("PE");
  const [academicYear, setAcademicYear] = useState("2026/27");
  const [roster, setRoster] = useState<RosterRow[]>([emptyPupil()]);
  const [bulkRoster, setBulkRoster] = useState("");
  const [existingClassId, setExistingClassId] = useState("");
  const [existingRoster, setExistingRoster] = useState<RosterRow[]>([emptyPupil()]);
  const [existingBulkRoster, setExistingBulkRoster] = useState("");
  const [focuses, setFocuses] = useState<FocusTag[]>([]);
  const [newFocus, setNewFocus] = useState("");
  const [userId, setUserId] = useState("");
  const [status, setStatus] = useState("Opening your classes…");
  const [saving, setSaving] = useState(false);
  const [ready, setReady] = useState(false);
  const [loadFailed, setLoadFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const { data: auth, error: authError } = await supabase.auth.getUser();
      let currentUser = auth.user;
      if (authError && isJwtClockError(authError)) {
        const refreshed = await supabase.auth.refreshSession();
        if (refreshed.error || !refreshed.data.user) {
          if (!cancelled) { setStatus(friendlyError(refreshed.error ?? authError, "Could not refresh your session.")); setLoadFailed(true); }
          return;
        }
        currentUser = refreshed.data.user;
      }
      if (!currentUser) {
        window.location.replace("/login?signin=1");
        return;
      }
      setUserId(currentUser.id);

      async function fetchSetup() {
        return Promise.all([
          supabase.from("sportfolio_classes").select("id,name,academic_year,activity").eq("teacher_user_id", currentUser!.id).order("created_at"),
          supabase.from("sportfolio_tags").select("id,name,category,created_by").eq("created_by", currentUser!.id).eq("category", "focus").order("name"),
        ]);
      }

      let [classResult, focusResult] = await fetchSetup();
      if (isJwtClockError(classResult.error) || isJwtClockError(focusResult.error)) {
        const refreshed = await supabase.auth.refreshSession();
        if (!refreshed.error) [classResult, focusResult] = await fetchSetup();
      }
      if (cancelled) return;
      if (classResult.error || focusResult.error) {
        setStatus(friendlyError(classResult.error ?? focusResult.error, "Could not open your classes."));
        setLoadFailed(true);
        return;
      }

      const rows = (classResult.data ?? []) as PilotClass[];
      setClasses(rows);
      setExistingClassId(rows[0]?.id ?? "");
      setFocuses((focusResult.data ?? []) as FocusTag[]);
      setStatus("Ready.");
      setReady(true);
    }
    void load();
    return () => { cancelled = true; };
  }, []);

  const pupilRows = useMemo(() => roster.filter((row) => row.firstName.trim()), [roster]);
  const existingPupilRows = useMemo(() => existingRoster.filter((row) => row.firstName.trim()), [existingRoster]);
  const atLimit = classes.length >= MAX_CLASSES;

  function updateRows(setter: React.Dispatch<React.SetStateAction<RosterRow[]>>, id: string, field: keyof Omit<RosterRow, "id">, value: string) {
    setter((current) => current.map((row) => row.id === id ? { ...row, [field]: value } : row));
  }

  function importRoster(text: string, setter: React.Dispatch<React.SetStateAction<RosterRow[]>>, clear: () => void) {
    const imported = parseRosterPaste(text);
    if (!imported.length) {
      setStatus("Paste a class list first. You can use Excel/CSV columns or one full name per line.");
      return;
    }
    setter((current) => {
      const existing = current.filter((row) => row.firstName.trim() || row.lastName.trim() || row.grade.trim());
      return [...existing, ...imported];
    });
    clear();
    setStatus(`${imported.length} pupil${imported.length === 1 ? "" : "s"} added to the roster. Check the names, then save.`);
  }

  async function addStudentsToClass(classId: string, rows: RosterRow[], ownerId: string) {
    const students = rows.map((pupil) => ({
      id: crypto.randomUUID(),
      first_name: pupil.firstName.trim(),
      last_name: pupil.lastName.trim() || null,
      grade: pupil.grade.trim() || null,
      created_by: ownerId,
      auth_user_id: null,
    }));
    const ids = students.map((student) => student.id);
    const { error: studentError } = await supabase.from("sportfolio_students").insert(students);
    if (studentError) throw studentError;
    const { error: membershipError } = await supabase.from("sportfolio_class_memberships").insert(ids.map((studentId) => ({ class_id: classId, student_id: studentId })));
    if (membershipError) {
      await supabase.from("sportfolio_students").delete().in("id", ids);
      throw membershipError;
    }
  }

  async function createClass(event: FormEvent) {
    event.preventDefault();
    if (saving || atLimit) return;
    const name = className.trim();
    if (name.length < 2) { setStatus("Add a class name before saving."); return; }
    setSaving(true);
    setStatus("Creating class…");
    let newClassId: string | null = null;
    try {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) throw new Error("Your session expired. Sign in again.");
      const { data: newClass, error: classError } = await supabase.from("sportfolio_classes").insert({
        name,
        academic_year: academicYear.trim() || "2026/27",
        activity: activity.trim() || null,
        teacher_user_id: auth.user.id,
      }).select("id,name,academic_year,activity").single();
      if (classError) throw classError;
      newClassId = newClass.id;
      if (pupilRows.length) await addStudentsToClass(newClass.id, pupilRows, auth.user.id);
      setClasses((current) => [...current, newClass as PilotClass]);
      setExistingClassId((current) => current || newClass.id);
      await trackProductEvent("class_created", { pupil_count: pupilRows.length, class_number: classes.length + 1, has_activity: Boolean(activity.trim()) });
      setClassName("");
      setRoster([emptyPupil()]);
      setStatus(`${newClass.name} created with ${pupilRows.length} pupil${pupilRows.length === 1 ? "" : "s"}.`);
    } catch (error) {
      if (newClassId) await supabase.from("sportfolio_classes").delete().eq("id", newClassId);
      setStatus(friendlyError(error, "Could not create class."));
    } finally { setSaving(false); }
  }

  async function deleteClass(item: PilotClass) {
    const ok = window.confirm(`Delete ${item.name}?\n\nThe class and its roster links will be removed. Existing evidence is preserved.`);
    if (!ok) return;
    setSaving(true);
    setStatus(`Deleting ${item.name}…`);
    const { error } = await supabase.from("sportfolio_classes").delete().eq("id", item.id);
    if (error) {
      setStatus(friendlyError(error, "Could not delete class."));
      setSaving(false);
      return;
    }
    const next = classes.filter((row) => row.id !== item.id);
    setClasses(next);
    setExistingClassId((current) => current === item.id ? (next[0]?.id ?? "") : current);
    setStatus(`${item.name} deleted. Existing evidence was kept.`);
    setSaving(false);
  }

  async function addExistingPupils(event: FormEvent) {
    event.preventDefault();
    if (saving || !existingClassId || !existingPupilRows.length) {
      if (!existingPupilRows.length) setStatus("Add at least one pupil name.");
      return;
    }
    setSaving(true);
    setStatus("Adding pupils…");
    try {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) throw new Error("Your session expired. Sign in again.");
      await addStudentsToClass(existingClassId, existingPupilRows, auth.user.id);
      const target = classes.find((item) => item.id === existingClassId);
      setExistingRoster([emptyPupil()]);
      setStatus(`${existingPupilRows.length} pupil${existingPupilRows.length === 1 ? "" : "s"} added to ${target?.name ?? "class"}.`);
    } catch (error) { setStatus(friendlyError(error, "Could not add pupils.")); }
    finally { setSaving(false); }
  }

  async function createFocus(event: FormEvent) {
    event.preventDefault();
    const name = newFocus.trim();
    if (!name) return;
    if (focuses.length >= MAX_CUSTOM_FOCUSES) { setStatus(`You can keep up to ${MAX_CUSTOM_FOCUSES} custom focuses.`); return; }
    if (focuses.some((focus) => focus.name.toLowerCase() === name.toLowerCase())) { setStatus("That focus already exists."); return; }
    if (!userId) return;
    setSaving(true);
    const { data, error } = await supabase.from("sportfolio_tags").insert({ name, category: "focus", created_by: userId }).select("id,name,category,created_by").single();
    if (error) setStatus(friendlyError(error, "Could not add focus."));
    else {
      setFocuses((current) => [...current, data as FocusTag].sort((a, b) => a.name.localeCompare(b.name)));
      setNewFocus("");
      setStatus(`${name} added to your focus library.`);
    }
    setSaving(false);
  }

  async function renameFocus(focus: FocusTag) {
    const proposed = window.prompt("Rename focus", focus.name)?.trim();
    if (!proposed || proposed === focus.name) return;
    if (focuses.some((item) => item.id !== focus.id && item.name.toLowerCase() === proposed.toLowerCase())) { setStatus("That focus already exists."); return; }
    const { error } = await supabase.from("sportfolio_tags").update({ name: proposed }).eq("id", focus.id).eq("created_by", userId);
    if (error) { setStatus(friendlyError(error, "Could not rename focus.")); return; }
    setFocuses((current) => current.map((item) => item.id === focus.id ? { ...item, name: proposed } : item).sort((a, b) => a.name.localeCompare(b.name)));
    setStatus(`Focus renamed to ${proposed}.`);
  }

  async function deleteFocus(focus: FocusTag) {
    if (!window.confirm(`Delete the focus “${focus.name}”?`)) return;
    const { error } = await supabase.from("sportfolio_tags").delete().eq("id", focus.id).eq("created_by", userId);
    if (error) {
      setStatus(error.code === "23503" ? "That focus has already been used in evidence, so it is being kept to protect the learning record." : friendlyError(error, "Could not delete focus."));
      return;
    }
    setFocuses((current) => current.filter((item) => item.id !== focus.id));
    setStatus(`${focus.name} deleted.`);
  }

  function rosterFields(rows: RosterRow[], setter: React.Dispatch<React.SetStateAction<RosterRow[]>>, disabled = false) {
    return <div className="roster-list">{rows.map((pupil, index) => <div className="roster-row" key={pupil.id}><span>{index + 1}</span><input aria-label={`Pupil ${index + 1} first name`} value={pupil.firstName} onChange={(e) => updateRows(setter, pupil.id, "firstName", e.target.value)} placeholder="First name" disabled={disabled || saving} /><input aria-label={`Pupil ${index + 1} last name`} value={pupil.lastName} onChange={(e) => updateRows(setter, pupil.id, "lastName", e.target.value)} placeholder="Last name" disabled={disabled || saving} /><input aria-label={`Pupil ${index + 1} grade`} value={pupil.grade} onChange={(e) => updateRows(setter, pupil.id, "grade", e.target.value)} placeholder="Grade" disabled={disabled || saving} /><button type="button" aria-label={`Remove pupil ${index + 1}`} onClick={() => setter((current) => current.length === 1 ? [emptyPupil()] : current.filter((row) => row.id !== pupil.id))} disabled={saving}>×</button></div>)}</div>;
  }

  function bulkRosterFields(value: string, setValue: React.Dispatch<React.SetStateAction<string>>, setter: React.Dispatch<React.SetStateAction<RosterRow[]>>, disabled = false) {
    return <div className="roster-import"><label>Paste a class list<textarea value={value} onChange={(e) => setValue(e.target.value)} placeholder={"Paste from Excel / CSV, or one pupil per line\n\nExample:\nAmira Khan 7A\nLeo Martin 7A"} disabled={disabled || saving} /></label><div><p>Accepts First name / Last name / Grade columns, CSV, Excel, or full names one per line.</p><button type="button" onClick={() => importRoster(value, setter, () => setValue(""))} disabled={disabled || saving || !value.trim()}>Add pasted list</button></div></div>;
  }

  if (!ready) {
    if (loadFailed) return <main className="setup-loading"><div className="setup-recovery"><small>SECURE SESSION</small><h1>We couldn’t open Sportfolio.</h1><p>{status}</p><div><button type="button" onClick={() => window.location.reload()}>Reload</button><a href="/login?signin=1">Sign in again</a></div></div></main>;
    return <main className="setup-loading">{status}</main>;
  }

  return <main className="setup-shell">
    <header className="setup-topbar"><a href="/live">← Sportfolio</a><strong>CLASSES & FOCUSES</strong><span>{classes.length}/{MAX_CLASSES} classes</span></header>
    <section className="setup-intro"><div><small>TEACHER SETUP</small><h1>Set up your teaching.</h1><p>Create classes, manage pupils and build your own learning-focus library.</p></div><a href="/live/session">Go to Session Capture →</a></section>

    <div className="setup-grid">
      <form className="setup-card" onSubmit={createClass}>
        <div className="setup-card-head"><div><small>NEW CLASS</small><h2>{atLimit ? "Class limit reached" : "Class details"}</h2></div><span>{MAX_CLASSES - classes.length} remaining</span></div>
        <label>Class name<input value={className} onChange={(e) => setClassName(e.target.value)} placeholder="Year 7 PE · 7A" disabled={atLimit || saving} /></label>
        <div className="setup-pair"><label>Activity<input value={activity} onChange={(e) => setActivity(e.target.value)} placeholder="PE, Football, Athletics…" disabled={atLimit || saving} /></label><label>Academic year<input value={academicYear} onChange={(e) => setAcademicYear(e.target.value)} disabled={atLimit || saving} /></label></div>
        <div className="roster-head"><div><small>OPTIONAL ROSTER</small><h3>Add pupils</h3></div><button type="button" onClick={() => setRoster((rows) => [...rows, emptyPupil()])} disabled={atLimit || saving}>+ Add pupil</button></div>
        {bulkRosterFields(bulkRoster, setBulkRoster, setRoster, atLimit)}
        {rosterFields(roster, setRoster, atLimit)}
        <p className="setup-status" role="status">{status}</p>
        <button className="setup-save" disabled={saving || atLimit}>{saving ? "Working…" : atLimit ? `${MAX_CLASSES} class limit` : "Create class"}</button>
      </form>

      <div className="setup-side-stack">
        <section className="setup-card classes-summary"><div className="setup-card-head"><div><small>YOUR SPORTFOLIO</small><h2>Classes</h2></div></div>{classes.length ? <div className="setup-classes">{classes.map((item) => <article key={item.id}><div><strong>{item.name}</strong><span>{item.activity || "PE"} · {item.academic_year}</span></div><div className="class-actions"><a href="/live">Open</a><button type="button" onClick={() => void deleteClass(item)} disabled={saving}>Delete</button></div></article>)}</div> : <div className="setup-empty"><strong>No classes yet.</strong><p>Create your first class here.</p></div>}</section>

        <section className="setup-card focus-manager"><div className="setup-card-head"><div><small>YOUR LEARNING LANGUAGE</small><h2>Focus library</h2></div><span>{focuses.length}/{MAX_CUSTOM_FOCUSES}</span></div><p className="focus-help">Write the focuses you actually use in lessons. They will appear under Today’s Focus in Session Capture.</p><form className="focus-add" onSubmit={createFocus}><input value={newFocus} onChange={(e) => setNewFocus(e.target.value)} placeholder="e.g. Creating space" maxLength={60} disabled={saving || focuses.length >= MAX_CUSTOM_FOCUSES} /><button disabled={saving || !newFocus.trim() || focuses.length >= MAX_CUSTOM_FOCUSES}>Add</button></form>{focuses.length ? <div className="focus-list">{focuses.map((focus) => <div key={focus.id}><strong>{focus.name}</strong><span><button type="button" onClick={() => void renameFocus(focus)}>Rename</button><button type="button" onClick={() => void deleteFocus(focus)}>Delete</button></span></div>)}</div> : <div className="setup-empty"><strong>No custom focuses yet.</strong><p>Add up to ten. Examples: Creating space, First touch, Communication, Decision making.</p></div>}</section>

        {classes.length > 0 && <form className="setup-card" onSubmit={addExistingPupils}><div className="setup-card-head"><div><small>EXISTING CLASS</small><h2>Add pupils later</h2></div></div><label>Class<select value={existingClassId} onChange={(e) => setExistingClassId(e.target.value)} disabled={saving}>{classes.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label><div className="roster-head"><div><small>ROSTER</small><h3>New pupils</h3></div><button type="button" onClick={() => setExistingRoster((rows) => [...rows, emptyPupil()])} disabled={saving}>+ Add pupil</button></div>{bulkRosterFields(existingBulkRoster, setExistingBulkRoster, setExistingRoster)}{rosterFields(existingRoster, setExistingRoster)}<button className="setup-save" disabled={saving || !existingPupilRows.length}>{saving ? "Saving…" : "Add pupils to class"}</button></form>}
      </div>
    </div>
  </main>;
}