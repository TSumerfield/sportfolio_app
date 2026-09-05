"use client";

import { ChangeEvent, useEffect, useMemo, useState } from "react";
import { loadClassStudents, loadPupilPortfolio, loadTeacherWorkspace, saveLiveEvidence, type LiveClass, type LiveStudent } from "../../../../lib/sportfolio/live";
import "../../live.css";
import "./capture.css";

type Tag = { id: string; name: string; category: string };
type Workspace = { classes: LiveClass[]; tags: Tag[] };
type SaveState = "loading" | "ready" | "saving" | "saved" | "error";
type SaveIntent = "stay" | "next";

export default function CoverageCapturePage() {
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [activeClass, setActiveClass] = useState<LiveClass | null>(null);
  const [student, setStudent] = useState<LiveStudent | null>(null);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [note, setNote] = useState("");
  const [nextStep, setNextStep] = useState("");
  const [requestReflection, setRequestReflection] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [state, setState] = useState<SaveState>("loading");
  const [saveIntent, setSaveIntent] = useState<SaveIntent>("stay");
  const [message, setMessage] = useState("");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const classId = params.get("class");
    const studentId = params.get("student");
    loadTeacherWorkspace().then(async (data) => {
      const w = data as Workspace;
      setWorkspace(w);
      const cls = w.classes.find((item) => item.id === classId) ?? w.classes[0] ?? null;
      if (!cls) throw new Error("No class is available for capture.");
      setActiveClass(cls);
      const pupils = await loadClassStudents(cls.id);
      const pupil = pupils.find((item) => item.id === studentId) ?? null;
      if (!pupil) throw new Error("This pupil is not available in the selected class.");
      setStudent(pupil);
      setState("ready");
    }).catch((error) => {
      setMessage(error instanceof Error ? error.message : "Unable to open capture queue.");
      setState("error");
    });
  }, []);

  useEffect(() => () => { if (previewUrl) URL.revokeObjectURL(previewUrl); }, [previewUrl]);

  const initials = useMemo(() => student ? `${student.first_name[0] ?? ""}${student.last_name?.[0] ?? ""}` : "SP", [student]);
  const isImage = file?.type.startsWith("image/");
  const isVideo = file?.type.startsWith("video/");
  const isAudio = file?.type.startsWith("audio/");

  function chooseFile(event: ChangeEvent<HTMLInputElement>) {
    const selected = event.target.files?.[0] ?? null;
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setFile(selected);
    setPreviewUrl(selected ? URL.createObjectURL(selected) : null);
    setMessage("");
    if (state === "error" || state === "saved") setState("ready");
    event.target.value = "";
  }

  function toggleTag(id: string) {
    setSelectedTags((current) => current.includes(id) ? current.filter((value) => value !== id) : [...current, id]);
  }

  async function findNextPupil(classId: string, currentStudentId: string) {
    const pupils = await loadClassStudents(classId);
    if (pupils.length <= 1) return null;
    const portfolios = await Promise.all(pupils.map((pupil) => loadPupilPortfolio(pupil.id)));
    const ranked = portfolios
      .filter((portfolio) => portfolio.student.id !== currentStudentId)
      .map((portfolio) => ({
        student: portfolio.student,
        evidence: portfolio.evidenceCount,
        hasDirection: !!(portfolio.currentNextStep || portfolio.currentGoal),
        latest: portfolio.items[0]?.occurred_at ? +new Date(portfolio.items[0].occurred_at) : 0,
      }))
      .sort((a, b) => a.evidence - b.evidence || Number(a.hasDirection) - Number(b.hasDirection) || a.latest - b.latest);
    return ranked[0]?.student ?? null;
  }

  async function save(intent: SaveIntent = "stay") {
    if (!activeClass || !student) return;
    setSaveIntent(intent);
    setState("saving"); setMessage("");
    try {
      const id = await saveLiveEvidence({
        classId: activeClass.id,
        studentIds: [student.id],
        tagIds: selectedTags,
        title: file ? file.name.replace(/\.[^.]+$/, "") : "Coverage capture",
        teacherNote: note,
        nextStep,
        requestReflection,
        file,
      });

      if (intent === "next") {
        setMessage("Saved securely. Finding the next pupil…");
        const next = await findNextPupil(activeClass.id, student.id);
        if (next) {
          window.location.replace(`/live/coverage/capture?class=${activeClass.id}&student=${next.id}`);
          return;
        }
      }

      setState("saved");
      setMessage(intent === "next" ? `Evidence saved securely · ${id.slice(0, 8)} · queue complete` : `Evidence saved securely · ${id.slice(0, 8)}`);
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      setFile(null); setPreviewUrl(null);
      setSelectedTags([]); setNote(""); setNextStep(""); setRequestReflection(false);
    } catch (error) {
      setState("error");
      setMessage(error instanceof Error ? error.message : "Could not save evidence. Your selected media is still here — retry when ready.");
    }
  }

  if (state === "loading") return <main className="queue-loading">Opening capture queue…</main>;
  if (!workspace || !activeClass || !student) return <main className="queue-loading"><div><h1>Capture unavailable</h1><p>{message}</p><a href="/live/coverage">Back to coverage</a></div></main>;

  return <main className="queue-shell">
    <header className="queue-top"><a href={`/live/coverage?class=${activeClass.id}`}>← Coverage</a><div><small>CAPTURE NEXT</small><strong>{activeClass.name}</strong></div><span>Private evidence</span></header>
    <div className="queue-page">
      <section className="queue-focus">
        <div className="queue-pupil"><span>{initials}</span><div><small>PRIORITY PUPIL</small><h1>{student.first_name} {student.last_name ?? ""}</h1><p>{student.grade ?? activeClass.name} · one focused capture</p></div></div>
        <div className={`queue-media ${previewUrl ? "has-preview" : ""}`}>
          {previewUrl && isImage && <img src={previewUrl} alt="Selected evidence preview" />}
          {previewUrl && isVideo && <video src={previewUrl} controls playsInline preload="metadata" />}
          {previewUrl && isAudio && <div className="queue-audio"><strong>Audio evidence</strong><audio src={previewUrl} controls /></div>}
          {!previewUrl && <div className="queue-empty-media"><span>+</span><strong>Add the evidence moment</strong><p>Photo, video, audio — or save an observation only.</p></div>}
        </div>
        <div className="queue-capture-modes">
          <label>Photo<input type="file" accept="image/*" capture="environment" onChange={chooseFile} /></label>
          <label>Video<input type="file" accept="video/*" capture="environment" onChange={chooseFile} /></label>
          <label>Audio<input type="file" accept="audio/*" capture onChange={chooseFile} /></label>
        </div>
        {file && <div className="queue-file"><span>{file.name}</span><button onClick={() => { if (previewUrl) URL.revokeObjectURL(previewUrl); setFile(null); setPreviewUrl(null); }}>Remove</button></div>}
      </section>

      <section className="queue-panel">
        <div className="queue-block"><div className="queue-title"><h2>Tag the learning</h2><span>{selectedTags.length} selected</span></div><div className="queue-tags">{workspace.tags.map((tag) => <button key={tag.id} className={selectedTags.includes(tag.id) ? "active" : ""} onClick={() => toggleTag(tag.id)}>{tag.name}</button>)}</div></div>
        <div className="queue-block"><label>Quick observation<textarea value={note} onChange={(event) => setNote(event.target.value)} placeholder="What did you notice?" /></label><label>Next learning step<textarea value={nextStep} onChange={(event) => setNextStep(event.target.value)} placeholder="What should this pupil focus on next?" /></label><label className="queue-reflect"><input type="checkbox" checked={requestReflection} onChange={(event) => setRequestReflection(event.target.checked)} /><span><strong>Request reflection</strong><small>Creates a private pupil reflection task.</small></span></label></div>
        <div className="queue-save">
          <div className="queue-save-actions"><button disabled={state === "saving" || state === "saved"} onClick={() => save("stay")}>{state === "saving" && saveIntent === "stay" ? "Saving…" : state === "saved" ? "✓ Evidence saved" : "Save evidence"}</button><button className="queue-save-next" disabled={state === "saving" || state === "saved"} onClick={() => save("next")}>{state === "saving" && saveIntent === "next" ? "Saving + finding next…" : "Save & next →"}</button></div>
          {message && <div className={`queue-message ${state}`}>{message}</div>}
          {state === "error" && <button className="queue-retry" onClick={() => save(saveIntent)}>Retry save</button>}
          {state === "saved" && <><a className="queue-next" href={`/live/coverage?class=${activeClass.id}`}>Return to coverage</a><a className="queue-secondary" href="/live">Back to Sportfolio</a></>}
        </div>
      </section>
    </div>
  </main>;
}
