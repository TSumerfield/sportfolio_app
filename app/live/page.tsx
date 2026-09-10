"use client";

import { ChangeEvent, useEffect, useMemo, useState } from "react";
import {
  loadClassStudents,
  loadPupilLearningContext,
  loadPupilPortfolio,
  loadTeacherWorkspace,
  markReflectionReviewed,
  saveLiveEvidence,
  savePupilGoal,
  saveTeacherFeedback,
  updatePupilGoalStatus,
  type LiveClass,
  type LiveStudent,
  type PupilGoal,
  type PupilLearningContext,
  type PupilPortfolio,
  type PupilPortfolioItem,
} from "../../lib/sportfolio/live";
import { resetAnalytics, trackProductEvent } from "../../lib/analytics";
import { supabase } from "../../lib/supabase/client";
import "./live.css";

type Tag = { id: string; name: string; category: string };
type Workspace = { classes: LiveClass[]; activeClass?: LiveClass; students: LiveStudent[]; tags: Tag[] };
type View = "classes" | "classPortfolio" | "capture" | "pupilPortfolio";
type ClassEvidence = PupilPortfolioItem & { pupilNames: string[] };

export default function LiveWorkspace() {
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [activeClass, setActiveClass] = useState<LiveClass | null>(null);
  const [students, setStudents] = useState<LiveStudent[]>([]);
  const [view, setView] = useState<View>("classes");
  const [selectedStudents, setSelectedStudents] = useState<string[]>([]);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [note, setNote] = useState("");
  const [nextStep, setNextStep] = useState("");
  const [requestReflection, setRequestReflection] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "saving" | "saved" | "error">("loading");
  const [message, setMessage] = useState("");
  const [context, setContext] = useState<PupilLearningContext | null>(null);
  const [contextLoading, setContextLoading] = useState(false);
  const [portfolio, setPortfolio] = useState<PupilPortfolio | null>(null);
  const [portfolioLoading, setPortfolioLoading] = useState(false);
  const [classEvidence, setClassEvidence] = useState<ClassEvidence[]>([]);
  const [classPortfolioLoading, setClassPortfolioLoading] = useState(false);

  useEffect(() => {
    loadTeacherWorkspace()
      .then((data) => {
        const w = data as Workspace;
        setWorkspace(w);
        setActiveClass(w.activeClass ?? w.classes[0] ?? null);
        setStudents(w.students ?? []);
        setStatus("ready");
      })
      .catch((error) => {
        setMessage(error instanceof Error ? error.message : "Unable to load Sportfolio.");
        setStatus("error");
      });
  }, []);

  useEffect(() => () => { if (previewUrl) URL.revokeObjectURL(previewUrl); }, [previewUrl]);

  useEffect(() => {
    if (view !== "capture" || selectedStudents.length !== 1) { setContext(null); return; }
    setContextLoading(true);
    loadPupilLearningContext(selectedStudents[0]).then(setContext).catch(() => setContext(null)).finally(() => setContextLoading(false));
  }, [selectedStudents, view]);

  const selectedNames = useMemo(() => students.filter((s) => selectedStudents.includes(s.id)), [students, selectedStudents]);

  async function selectClass(item: LiveClass) {
    setActiveClass(item);
    setMessage("");
    setStatus("loading");
    try {
      const list = await loadClassStudents(item.id);
      setStudents(list);
      setSelectedStudents([]);
      setStatus("ready");
      return list;
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to load class.");
      setStatus("error");
      return [] as LiveStudent[];
    }
  }

  async function openCaptureForClass(item: LiveClass) {
    await selectClass(item);
    setSelectedTags([]);
    setView("capture");
    await trackProductEvent("evidence_capture_opened", { capture_mode: "quick" });
  }

  async function openClassPortfolio(item: LiveClass) {
    setView("classPortfolio");
    setClassPortfolioLoading(true);
    setClassEvidence([]);
    setMessage("");
    const list = await selectClass(item);
    try {
      const portfolios = await Promise.all(list.map((student) => loadPupilPortfolio(student.id)));
      const merged = new Map<string, ClassEvidence>();
      portfolios.forEach((p) => {
        const pupilName = `${p.student.first_name} ${p.student.last_name ?? ""}`.trim();
        p.items.forEach((evidenceItem) => {
          const existing = merged.get(evidenceItem.id);
          if (existing) {
            if (!existing.pupilNames.includes(pupilName)) existing.pupilNames.push(pupilName);
          } else {
            merged.set(evidenceItem.id, { ...evidenceItem, pupilNames: [pupilName] });
          }
        });
      });
      setClassEvidence([...merged.values()].sort((a, b) => +new Date(b.occurred_at) - +new Date(a.occurred_at)));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to load class Sportfolio.");
    } finally {
      setClassPortfolioLoading(false);
    }
  }

  async function openPupilPortfolio(student: LiveStudent) {
    setPortfolioLoading(true);
    setPortfolio(null);
    setMessage("");
    setView("pupilPortfolio");
    try { setPortfolio(await loadPupilPortfolio(student.id)); }
    catch (error) { setMessage(error instanceof Error ? error.message : "Unable to load pupil Sportfolio."); }
    finally { setPortfolioLoading(false); }
  }

  async function refreshPortfolio() {
    if (!portfolio) return;
    setPortfolio(await loadPupilPortfolio(portfolio.student.id));
  }

  async function reviewReflection(reflectionId: string) {
    if (!portfolio) return;
    setMessage("");
    try {
      await markReflectionReviewed(reflectionId);
      await refreshPortfolio();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to mark reflection reviewed.");
      throw error;
    }
  }

  async function updateFeedback(itemId: string, feedback: string) {
    if (!portfolio) return;
    setMessage("");
    try {
      await saveTeacherFeedback(itemId, feedback);
      await refreshPortfolio();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to save feedback.");
      throw error;
    }
  }

  async function addGoal(studentId: string, body: string, targetDate?: string) {
    setMessage("");
    try {
      await savePupilGoal(studentId, body, targetDate);
      await refreshPortfolio();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to save goal.");
      throw error;
    }
  }

  async function changeGoalStatus(goalId: string, goalStatus: PupilGoal["status"]) {
    setMessage("");
    try {
      await updatePupilGoalStatus(goalId, goalStatus);
      await refreshPortfolio();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to update goal.");
      throw error;
    }
  }

  function toggleStudent(id: string) { setSelectedStudents((c) => c.includes(id) ? c.filter((v) => v !== id) : [...c, id]); }
  function toggleTag(id: string) { setSelectedTags((c) => c.includes(id) ? c.filter((v) => v !== id) : [...c, id]); }

  function chooseFile(e: ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0] ?? null;
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setFile(f);
    setPreviewUrl(f ? URL.createObjectURL(f) : null);
    setMessage("");
    if (status === "saved" || status === "error") setStatus("ready");
    e.target.value = "";
  }

  function clearFile() {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setFile(null);
    setPreviewUrl(null);
  }

  async function save() {
    if (!activeClass) return;
    setStatus("saving");
    setMessage("");
    try {
      const id = await saveLiveEvidence({
        classId: activeClass.id,
        studentIds: selectedStudents,
        tagIds: selectedTags,
        title: file ? file.name.replace(/\.[^.]+$/, "") : "Quick capture",
        teacherNote: note,
        nextStep,
        requestReflection,
        file,
      });
      await trackProductEvent("evidence_published", {
        capture_mode: "quick",
        pupil_count: selectedStudents.length,
        tag_count: selectedTags.length,
        media_type: file?.type.startsWith("video/") ? "video" : file?.type.startsWith("image/") ? "photo" : file?.type.startsWith("audio/") ? "audio" : "observation",
        has_note: Boolean(note.trim()),
        has_next_step: Boolean(nextStep.trim()),
        reflection_requested: requestReflection,
      });
      setStatus("saved");
      setMessage(`Evidence saved securely · ${id.slice(0, 8)}`);
      setSelectedStudents([]);
      setSelectedTags([]);
      setNote("");
      setNextStep("");
      setRequestReflection(false);
      clearFile();
    } catch (error) {
      setStatus("error");
      setMessage(error instanceof Error ? error.message : "Could not save evidence.");
    }
  }

  async function signOut() {
    await resetAnalytics();
    await supabase.auth.signOut();
    window.location.replace("/");
  }

  if (status === "loading" && !workspace) return <main className="live-loading">Loading Sportfolio…</main>;
  if (!workspace) return <main className="live-loading"><div><h1>Sportfolio</h1><p>{message}</p><a href="/">Back to Sportfolio</a></div></main>;

  const isVideo = file?.type.startsWith("video/");
  const isImage = file?.type.startsWith("image/");
  const isAudio = file?.type.startsWith("audio/");
  const fileKind = isVideo ? "VIDEO" : isAudio ? "AUDIO" : "PHOTO";

  return <main className="live-shell">
    <aside className="live-sidebar">
      <div className="live-brand"><span>S</span><strong>SPORTFOLIO</strong></div>
      <nav>
        <button className={view === "classes" ? "active" : ""} onClick={() => setView("classes")}>▣ Classes</button>
        <button className={view === "classPortfolio" || view === "pupilPortfolio" ? "active" : ""} onClick={() => activeClass && openClassPortfolio(activeClass)}>◎ Sportfolios</button>
        <button className={view === "capture" ? "active capture-nav" : "capture-nav"} onClick={() => activeClass && openCaptureForClass(activeClass)}>● Capture</button>
      </nav>
      <button className="signout" onClick={signOut}>Exit build</button>
    </aside>

    <section className="live-content">
      <header><div><small>TEACHER PILOT</small><strong>{activeClass?.name ?? "My Sportfolio"}</strong></div><div className="live-badge">● Connected</div></header>

      {view === "classes" && <ClassesView classes={workspace.classes} onCapture={openCaptureForClass} onPortfolio={openClassPortfolio} />}
      {view === "classPortfolio" && activeClass && <ClassPortfolioView activeClass={activeClass} students={students} items={classEvidence} loading={classPortfolioLoading} error={message} onBack={() => setView("classes")} onCapture={() => openCaptureForClass(activeClass)} onPupil={openPupilPortfolio} />}
      {view === "pupilPortfolio" && <PupilPortfolioView portfolio={portfolio} loading={portfolioLoading} error={message} activeClass={activeClass} onBack={() => activeClass && openClassPortfolio(activeClass)} onCapture={() => activeClass && openCaptureForClass(activeClass)} onReview={reviewReflection} onFeedback={updateFeedback} onSaveGoal={addGoal} onGoalStatus={changeGoalStatus} />}

      {view === "capture" && activeClass && <div className="live-page">
        <div className="live-heading"><div><button className="back-link" onClick={() => openClassPortfolio(activeClass)}>← {activeClass.name} Sportfolio</button><span className="eyebrow-orange">QUICK CAPTURE</span><h1>Capture the moment.</h1><p>Select pupils, tag the learning and save.</p></div><div className="class-chip">{activeClass.activity ?? "PE"}<b>{activeClass.academic_year}</b></div></div>
        <div className="live-grid">
          <section className="camera-card">
            <div className={`camera-view ${previewUrl ? "has-preview" : ""}`}>
              {previewUrl && isVideo && <video src={previewUrl} controls playsInline preload="metadata" />}
              {previewUrl && isImage && <img src={previewUrl} alt="Selected evidence preview" />}
              {previewUrl && isAudio && <div className="audio-preview"><span>AUDIO EVIDENCE</span><audio src={previewUrl} controls /></div>}
              {!previewUrl && <><span className="camera-label">READY TO CAPTURE</span><div className="camera-focus">+</div><div className="camera-prompt">Add photo, video or audio</div></>}
              {file && <div className="file-pill"><span>{fileKind}</span>{file.name}<button onClick={clearFile} aria-label="Remove media">×</button></div>}
            </div>
            <div className="camera-controls capture-modes"><label className="capture-source">▧ Photo<input type="file" accept="image/*" capture="environment" onChange={chooseFile} /></label><label className="capture-source">▣ Video<input type="file" accept="video/*" capture="environment" onChange={chooseFile} /></label><label className="capture-source">◉ Audio<input type="file" accept="audio/*" capture onChange={chooseFile} /></label></div>
            <p>{file ? `${(file.size / 1024 / 1024).toFixed(1)} MB · stored privately in Sportfolio` : "Choose the exact capture type. Media stays selected if saving fails so you can retry."}</p>
          </section>

          <section className="live-panel">
            <div className="panel-block"><div className="panel-title"><h2>Who?</h2><span>{selectedStudents.length} selected</span></div>{students.length ? <div className="student-picker">{students.map((student) => { const selected = selectedStudents.includes(student.id); const initials = `${student.first_name[0] ?? ""}${student.last_name?.[0] ?? ""}`; return <button key={student.id} className={selected ? "student-choice selected" : "student-choice"} onClick={() => toggleStudent(student.id)}><span>{initials}</span><strong>{student.first_name}</strong>{selected && <b>✓</b>}</button>; })}</div> : <p className="empty-copy">No pupils are in this class yet.</p>}</div>
            {selectedStudents.length === 1 && <div className="learning-context"><div className="context-head"><div><small>LEARNING HISTORY</small><strong>{selectedNames[0]?.first_name}</strong></div>{context && <span>{context.evidenceCount} evidence</span>}</div>{contextLoading ? <p>Loading previous learning…</p> : context ? <><div className="context-next"><small>CURRENT NEXT STEP</small><strong>{context.nextSteps[0]?.final_body ?? context.activeGoals[0]?.body ?? "No next step recorded yet."}</strong></div>{context.recentEvidence[0] && <div className="context-last"><small>LAST OBSERVATION</small><span>{context.recentEvidence[0].teacher_note || context.recentEvidence[0].title || "Evidence captured"}</span></div>}</> : <p>No previous learning context yet.</p>}</div>}
            <div className="panel-block"><div className="panel-title"><h2>What does it show?</h2><span>{selectedTags.length} tags</span></div><div className="live-tags">{workspace.tags.map((tag) => <button key={tag.id} className={selectedTags.includes(tag.id) ? "active" : ""} onClick={() => toggleTag(tag.id)}>{tag.name}</button>)}</div></div>
            <div className="panel-block"><label className="note-label">Quick note<textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="Optional teacher observation…" /></label><label className="note-label">Next learning step<textarea value={nextStep} onChange={(e) => setNextStep(e.target.value)} placeholder="What should these pupils focus on next?" /></label><label className="reflection-toggle"><input type="checkbox" checked={requestReflection} onChange={(e) => setRequestReflection(e.target.checked)} /> Request pupil reflection</label></div>
            <button className="save-evidence" onClick={save} disabled={status === "saving" || !selectedStudents.length || (!file && !note.trim())}>{status === "saving" ? "Saving…" : "Save evidence"}</button>
            <p className={`status-copy ${status === "error" ? "error" : ""}`} role="status">{message}</p>
          </section>
        </div>
      </div>}
    </section>
  </main>;
}

function ClassesView({ classes, onCapture, onPortfolio }: { classes: LiveClass[]; onCapture: (item: LiveClass) => void; onPortfolio: (item: LiveClass) => void }) {
  return <div className="live-page"><div className="live-heading"><div><span className="eyebrow-orange">CLASSES</span><h1>Your classes.</h1><p>Open a class to capture evidence or review its Sportfolio.</p></div><a className="setup-inline" href="/live/setup">Set up classes →</a></div><div className="class-list">{classes.map((item) => <article key={item.id} className="class-card"><div><span>{item.activity ?? "PE"}</span><h2>{item.name}</h2><p>{item.academic_year}</p></div><div><button onClick={() => onCapture(item)}>Capture</button><button onClick={() => onPortfolio(item)}>Sportfolio</button></div></article>)}</div></div>;
}

function ClassPortfolioView({ activeClass, students, items, loading, error, onBack, onCapture, onPupil }: { activeClass: LiveClass; students: LiveStudent[]; items: ClassEvidence[]; loading: boolean; error: string; onBack: () => void; onCapture: () => void; onPupil: (student: LiveStudent) => void }) {
  return <div className="live-page"><div className="live-heading"><div><button className="back-link" onClick={onBack}>← Classes</button><span className="eyebrow-orange">CLASS SPORTFOLIO</span><h1>{activeClass.name}</h1><p>{students.length} pupils · {items.length} evidence items</p></div><button className="capture-inline" onClick={onCapture}>Capture evidence</button></div>{loading ? <p>Loading evidence…</p> : error ? <p className="status-copy error">{error}</p> : <><div className="pupil-list">{students.map((student) => <button key={student.id} onClick={() => onPupil(student)}><span>{student.first_name[0]}{student.last_name?.[0] ?? ""}</span><strong>{student.first_name} {student.last_name ?? ""}</strong><b>Open →</b></button>)}</div><div className="evidence-list">{items.length ? items.map((item) => <article key={item.id}><div><small>{new Date(item.occurred_at).toLocaleDateString()}</small><strong>{item.title || "Evidence"}</strong><span>{item.pupilNames.join(", ")}</span></div>{item.teacher_note && <p>{item.teacher_note}</p>}</article>) : <p>No evidence captured for this class yet.</p>}</div></> }</div>;
}

function PupilPortfolioView({ portfolio, loading, error, activeClass, onBack, onCapture, onReview, onFeedback, onSaveGoal, onGoalStatus }: { portfolio: PupilPortfolio | null; loading: boolean; error: string; activeClass: LiveClass | null; onBack: () => void; onCapture: () => void; onReview: (reflectionId: string) => Promise<void>; onFeedback: (itemId: string, feedback: string) => Promise<void>; onSaveGoal: (studentId: string, body: string, targetDate?: string) => Promise<void>; onGoalStatus: (goalId: string, status: PupilGoal["status"]) => Promise<void> }) {
  if (loading) return <div className="live-page"><p>Loading pupil Sportfolio…</p></div>;
  if (!portfolio) return <div className="live-page"><button className="back-link" onClick={onBack}>← Back</button><p className="status-copy error">{error || "Unable to load pupil Sportfolio."}</p></div>;
  return <div className="live-page"><div className="live-heading"><div><button className="back-link" onClick={onBack}>← {activeClass?.name ?? "Class"}</button><span className="eyebrow-orange">PUPIL SPORTFOLIO</span><h1>{portfolio.student.first_name} {portfolio.student.last_name ?? ""}</h1><p>{portfolio.items.length} evidence items</p></div><button className="capture-inline" onClick={onCapture}>Capture evidence</button></div><div className="evidence-list">{portfolio.items.map((item) => <article key={item.id}><div><small>{new Date(item.occurred_at).toLocaleDateString()}</small><strong>{item.title || "Evidence"}</strong></div>{item.teacher_note && <p>{item.teacher_note}</p>}</article>)}</div></div>;
}
