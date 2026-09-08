"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { supabase } from "../../../lib/supabase/client";
import "./setup.css";

type PilotClass = { id: string; name: string; academic_year: string; activity: string | null };

type RosterRow = { id: string; firstName: string; lastName: string; grade: string };

function emptyPupil(): RosterRow {
  return { id: crypto.randomUUID(), firstName: "", lastName: "", grade: "" };
}

export default function PilotSetupPage() {
  const [classes, setClasses] = useState<PilotClass[]>([]);
  const [className, setClassName] = useState("");
  const [activity, setActivity] = useState("PE");
  const [academicYear, setAcademicYear] = useState("2026/27");
  const [roster, setRoster] = useState<RosterRow[]>([emptyPupil()]);
  const [status, setStatus] = useState("Checking pilot access…");
  const [saving, setSaving] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) {
        window.location.replace("/login");
        return;
      }
      const { data: access, error: accessError } = await supabase.from("sportfolio_pilot_access").select("id").limit(1).maybeSingle();
      if (cancelled) return;
      if (accessError || !access) {
        await supabase.auth.signOut();
        window.location.replace("/login?access=required");
        return;
      }
      const { data, error } = await supabase.from("sportfolio_classes").select("id,name,academic_year,activity").eq("teacher_user_id", auth.user.id).order("created_at");
      if (cancelled) return;
      if (error) {
        setStatus(error.message);
        return;
      }
      setClasses((data ?? []) as PilotClass[]);
      setStatus("Ready.");
      setReady(true);
    }
    void load();
    return () => { cancelled = true; };
  }, []);

  const pupilRows = useMemo(() => roster.filter((row) => row.firstName.trim()), [roster]);
  const atLimit = classes.length >= 5;

  function updatePupil(id: string, field: keyof Omit<RosterRow, "id">, value: string) {
    setRoster((current) => current.map((row) => row.id === id ? { ...row, [field]: value } : row));
  }

  async function createClass(event: FormEvent) {
    event.preventDefault();
    if (saving || atLimit) return;
    const name = className.trim();
    if (name.length < 2) {
      setStatus("Add a class name before saving.");
      return;
    }
    setSaving(true);
    setStatus("Creating class securely…");
    let newClassId: string | null = null;
    const createdStudentIds: string[] = [];
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

      for (const pupil of pupilRows) {
        const studentId = crypto.randomUUID();
        const { error: studentError } = await supabase.from("sportfolio_students").insert({
          id: studentId,
          first_name: pupil.firstName.trim(),
          last_name: pupil.lastName.trim() || null,
          grade: pupil.grade.trim() || null,
          created_by: auth.user.id,
          auth_user_id: null,
        });
        if (studentError) throw studentError;
        createdStudentIds.push(studentId);
        const { error: membershipError } = await supabase.from("sportfolio_class_memberships").insert({ class_id: newClass.id, student_id: studentId });
        if (membershipError) throw membershipError;
      }

      setClasses((current) => [...current, newClass as PilotClass]);
      setClassName("");
      setRoster([emptyPupil()]);
      setStatus(`${newClass.name} created with ${pupilRows.length} pupil${pupilRows.length === 1 ? "" : "s"}.`);
    } catch (error) {
      if (newClassId) await supabase.from("sportfolio_classes").delete().eq("id", newClassId);
      if (createdStudentIds.length) await supabase.from("sportfolio_students").delete().in("id", createdStudentIds);
      setStatus(error instanceof Error ? error.message : "Could not create class.");
    } finally {
      setSaving(false);
    }
  }

  if (!ready) return <main className="setup-loading">{status}</main>;

  return <main className="setup-shell">
    <header className="setup-topbar"><a href="/live">← Sportfolio</a><strong>SET UP CLASSES</strong><span>{classes.length}/5 classes</span></header>
    <section className="setup-intro"><div><small>PILOT SETUP</small><h1>Build your first class.</h1><p>Create up to five classes. Add pupils now or start with an empty class and add another class later.</p></div><a href="/live/session">Go to Session Capture →</a></section>

    <div className="setup-grid">
      <form className="setup-card" onSubmit={createClass}>
        <div className="setup-card-head"><div><small>NEW CLASS</small><h2>{atLimit ? "Pilot class limit reached" : "Class details"}</h2></div><span>{5 - classes.length} remaining</span></div>
        <label>Class name<input value={className} onChange={(e) => setClassName(e.target.value)} placeholder="Year 7 PE · 7A" disabled={atLimit || saving} /></label>
        <div className="setup-pair"><label>Activity<input value={activity} onChange={(e) => setActivity(e.target.value)} placeholder="PE, Football, Athletics…" disabled={atLimit || saving} /></label><label>Academic year<input value={academicYear} onChange={(e) => setAcademicYear(e.target.value)} disabled={atLimit || saving} /></label></div>

        <div className="roster-head"><div><small>OPTIONAL ROSTER</small><h3>Add pupils</h3></div><button type="button" onClick={() => setRoster((rows) => [...rows, emptyPupil()])} disabled={atLimit || saving}>+ Add pupil</button></div>
        <div className="roster-list">{roster.map((pupil, index) => <div className="roster-row" key={pupil.id}><span>{index + 1}</span><input aria-label={`Pupil ${index + 1} first name`} value={pupil.firstName} onChange={(e) => updatePupil(pupil.id, "firstName", e.target.value)} placeholder="First name" disabled={atLimit || saving} /><input aria-label={`Pupil ${index + 1} last name`} value={pupil.lastName} onChange={(e) => updatePupil(pupil.id, "lastName", e.target.value)} placeholder="Last name" disabled={atLimit || saving} /><input aria-label={`Pupil ${index + 1} grade`} value={pupil.grade} onChange={(e) => updatePupil(pupil.id, "grade", e.target.value)} placeholder="Grade" disabled={atLimit || saving} /><button type="button" aria-label={`Remove pupil ${index + 1}`} onClick={() => setRoster((rows) => rows.length === 1 ? [emptyPupil()] : rows.filter((row) => row.id !== pupil.id))} disabled={saving}>×</button></div>)}</div>
        <p className="setup-status" role="status">{status}</p>
        <button className="setup-save" disabled={saving || atLimit}>{saving ? "Creating…" : atLimit ? "5 class pilot limit" : "Create class"}</button>
      </form>

      <section className="setup-card classes-summary"><div className="setup-card-head"><div><small>YOUR SPORTFOLIO</small><h2>Classes</h2></div></div>{classes.length ? <div className="setup-classes">{classes.map((item) => <article key={item.id}><div><strong>{item.name}</strong><span>{item.activity || "PE"} · {item.academic_year}</span></div><a href="/live">Open →</a></article>)}</div> : <div className="setup-empty"><strong>No classes yet.</strong><p>Create your first one here. The five-class pilot limit is enforced securely.</p></div>}</section>
    </div>
  </main>;
}
