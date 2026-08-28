"use client";

import { useEffect, useMemo, useState } from "react";
import { loadTeacherWorkspace, saveLiveEvidence, type LiveClass, type LiveStudent } from "../../lib/sportfolio/live";
import { supabase } from "../../lib/supabase/client";
import "./live.css";

type Tag = { id: string; name: string; category: string };

type Workspace = {
  classes: LiveClass[];
  activeClass?: LiveClass;
  students: LiveStudent[];
  tags: Tag[];
};

export default function LiveWorkspace() {
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [selectedStudents, setSelectedStudents] = useState<string[]>([]);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [note, setNote] = useState("");
  const [requestReflection, setRequestReflection] = useState(false);
  const [status, setStatus] = useState<"loading" | "ready" | "saving" | "saved" | "error">("loading");
  const [message, setMessage] = useState("");

  useEffect(() => {
    loadTeacherWorkspace()
      .then((data) => { setWorkspace(data as Workspace); setStatus("ready"); })
      .catch((error) => {
        setMessage(error instanceof Error ? error.message : "Unable to load Sportfolio.");
        setStatus("error");
      });
  }, []);

  const selectedNames = useMemo(() => workspace?.students.filter((student) => selectedStudents.includes(student.id)) ?? [], [workspace, selectedStudents]);

  function toggleStudent(id: string) {
    setSelectedStudents((current) => current.includes(id) ? current.filter((value) => value !== id) : [...current, id]);
  }

  function toggleTag(id: string) {
    setSelectedTags((current) => current.includes(id) ? current.filter((value) => value !== id) : [...current, id]);
  }

  async function save() {
    if (!workspace?.activeClass) return;
    setStatus("saving");
    setMessage("");
    try {
      const id = await saveLiveEvidence({
        classId: workspace.activeClass.id,
        studentIds: selectedStudents,
        tagIds: selectedTags,
        title: "Quick capture",
        teacherNote: note,
        requestReflection,
      });
      setStatus("saved");
      setMessage(`Evidence saved securely · ${id.slice(0, 8)}`);
      setSelectedStudents([]);
      setSelectedTags([]);
      setNote("");
      setRequestReflection(false);
    } catch (error) {
      setStatus("error");
      setMessage(error instanceof Error ? error.message : "Could not save evidence.");
    }
  }

  async function signOut() {
    await supabase.auth.signOut();
    window.location.replace("/login");
  }

  if (status === "loading") return <main className="live-loading">Loading Sportfolio…</main>;
  if (!workspace) return <main className="live-loading"><div><h1>Sportfolio</h1><p>{message}</p><a href="/login">Sign in</a></div></main>;

  return <main className="live-shell">
    <aside className="live-sidebar">
      <div className="live-brand"><span>S</span><strong>SPORTFOLIO</strong></div>
      <nav><button className="active">⌂ Dashboard</button><button>◎ Students</button><button>▣ Classes</button><button className="capture-nav">● Capture</button><button>▤ Reflections</button></nav>
      <button className="signout" onClick={signOut}>Sign out</button>
    </aside>

    <section className="live-content">
      <header><div><small>LIVE PILOT WORKSPACE</small><strong>{workspace.activeClass?.name ?? "Your class"}</strong></div><div className="live-badge">● Connected</div></header>
      <div className="live-page">
        <div className="live-heading"><div><span className="eyebrow-orange">QUICK CAPTURE</span><h1>Capture the moment.</h1><p>Select the pupils, tag what you saw, and move on.</p></div><div className="class-chip">{workspace.activeClass?.activity ?? "PE"}<b>{workspace.activeClass?.academic_year}</b></div></div>

        <div className="live-grid">
          <section className="camera-card">
            <div className="camera-view"><span className="camera-label">VIDEO PREVIEW</span><div className="camera-focus">+</div><div className="camera-time">00:12</div></div>
            <div className="camera-controls"><button>▧ Photo</button><button className="record"><span></span></button><button className="selected-mode">▣ Video</button></div>
            <p>Media upload is the next integration. This capture currently saves the evidence record, pupils, tags and reflection request.</p>
          </section>

          <section className="live-panel">
            <div className="panel-block"><div className="panel-title"><h2>Who?</h2><span>{selectedStudents.length} selected</span></div><div className="student-picker">{workspace.students.map((student) => {
              const selected = selectedStudents.includes(student.id);
              const initials = `${student.first_name[0]}${student.last_name[0]}`;
              return <button key={student.id} className={selected ? "student-choice selected" : "student-choice"} onClick={() => toggleStudent(student.id)}><span>{initials}</span><strong>{student.first_name}</strong>{selected && <b>✓</b>}</button>;
            })}</div></div>

            <div className="panel-block"><div className="panel-title"><h2>What does it show?</h2><span>{selectedTags.length} tags</span></div><div className="live-tags">{workspace.tags.map((tag) => <button key={tag.id} className={selectedTags.includes(tag.id) ? "active" : ""} onClick={() => toggleTag(tag.id)}>{tag.name}</button>)}</div></div>

            <div className="panel-block"><label className="note-label">Quick note<textarea value={note} onChange={(event) => setNote(event.target.value)} placeholder="Optional teacher feedback…" /></label><label className="reflection-toggle"><input type="checkbox" checked={requestReflection} onChange={(event) => setRequestReflection(event.target.checked)} /><span><strong>Request pupil reflection</strong><small>Creates a reflection task for every selected pupil.</small></span></label></div>

            <div className="save-zone"><div className="selected-strip">{selectedNames.length ? selectedNames.map((student) => <span key={student.id}>{student.first_name}</span>) : <em>Select pupils to continue</em>}</div><button className="save-live" disabled={!selectedStudents.length || status === "saving"} onClick={save}>{status === "saving" ? "Saving securely…" : "Save evidence"}</button>{message && <div className={`live-message ${status}`}>{message}</div>}</div>
          </section>
        </div>
      </div>
    </section>
  </main>;
}
