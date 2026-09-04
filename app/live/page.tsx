"use client";

import { ChangeEvent, useEffect, useMemo, useState } from "react";
import {
  loadClassStudents,
  loadPupilLearningContext,
  loadPupilPortfolio,
  loadTeacherWorkspace,
  saveLiveEvidence,
  type LiveClass,
  type LiveStudent,
  type PupilLearningContext,
  type PupilPortfolio,
  type PupilPortfolioItem,
} from "../../lib/sportfolio/live";
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

  async function signOut() { await supabase.auth.signOut(); window.location.replace("/login"); }

  if (status === "loading" && !workspace) return <main className="live-loading">Loading Sportfolio…</main>;
  if (!workspace) return <main className="live-loading"><div><h1>Sportfolio</h1><p>{message}</p><a href="/login">Sign in</a></div></main>;

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
      <button className="signout" onClick={signOut}>Sign out</button>
    </aside>

    <section className="live-content">
      <header><div><small>TEACHER PILOT</small><strong>{activeClass?.name ?? "My Sportfolio"}</strong></div><div className="live-badge">● Connected</div></header>

      {view === "classes" && <ClassesView classes={workspace.classes} onCapture={openCaptureForClass} onPortfolio={openClassPortfolio} />}

      {view === "classPortfolio" && activeClass && <ClassPortfolioView
        activeClass={activeClass}
        students={students}
        items={classEvidence}
        loading={classPortfolioLoading}
        error={message}
        onBack={() => setView("classes")}
        onCapture={() => openCaptureForClass(activeClass)}
        onPupil={openPupilPortfolio}
      />}

      {view === "pupilPortfolio" && <PupilPortfolioView
        portfolio={portfolio}
        loading={portfolioLoading}
        error={message}
        activeClass={activeClass}
        onBack={() => activeClass && openClassPortfolio(activeClass)}
        onCapture={() => activeClass && openCaptureForClass(activeClass)}
      />}

      {view === "capture" && activeClass && <div className="live-page">
        <div className="live-heading">
          <div><button className="back-link" onClick={() => openClassPortfolio(activeClass)}>← {activeClass.name} Sportfolio</button><span className="eyebrow-orange">QUICK CAPTURE</span><h1>Capture the moment.</h1><p>Select pupils, tag the learning and save.</p></div>
          <div className="class-chip">{activeClass.activity ?? "PE"}<b>{activeClass.academic_year}</b></div>
        </div>
        <div className="live-grid">
          <section className="camera-card">
            <div className={`camera-view ${previewUrl ? "has-preview" : ""}`}>
              {previewUrl && isVideo && <video src={previewUrl} controls playsInline preload="metadata" />}
              {previewUrl && isImage && <img src={previewUrl} alt="Selected evidence preview" />}
              {previewUrl && isAudio && <div className="audio-preview"><span>AUDIO EVIDENCE</span><audio src={previewUrl} controls /></div>}
              {!previewUrl && <><span className="camera-label">READY TO CAPTURE</span><div className="camera-focus">+</div><div className="camera-prompt">Add photo, video or audio</div></>}
              {file && <div className="file-pill"><span>{fileKind}</span>{file.name}<button onClick={clearFile} aria-label="Remove media">×</button></div>}
            </div>
            <div className="camera-controls capture-modes">
              <label className="capture-source">▧ Photo<input type="file" accept="image/*" capture="environment" onChange={chooseFile} /></label>
              <label className="capture-source">▣ Video<input type="file" accept="video/*" capture="environment" onChange={chooseFile} /></label>
              <label className="capture-source">◉ Audio<input type="file" accept="audio/*" capture onChange={chooseFile} /></label>
            </div>
            <p>{file ? `${(file.size / 1024 / 1024).toFixed(1)} MB · stored privately in Sportfolio` : "Choose the exact capture type. Media stays selected if saving fails so you can retry."}</p>
          </section>

          <section className="live-panel">
            <div className="panel-block"><div className="panel-title"><h2>Who?</h2><span>{selectedStudents.length} selected</span></div>
              {students.length ? <div className="student-picker">{students.map((student) => {
                const selected = selectedStudents.includes(student.id);
                const initials = `${student.first_name[0] ?? ""}${student.last_name?.[0] ?? ""}`;
                return <button key={student.id} className={selected ? "student-choice selected" : "student-choice"} onClick={() => toggleStudent(student.id)}><span>{initials}</span><strong>{student.first_name}</strong>{selected && <b>✓</b>}</button>;
              })}</div> : <p className="empty-copy">No pupils are in this class yet.</p>}
            </div>

            {selectedStudents.length === 1 && <div className="learning-context"><div className="context-head"><div><small>LEARNING HISTORY</small><strong>{selectedNames[0]?.first_name}</strong></div>{context && <span>{context.evidenceCount} evidence</span>}</div>{contextLoading ? <p>Loading previous learning…</p> : context ? <><div className="context-next"><small>CURRENT NEXT STEP</small><strong>{context.nextSteps[0]?.final_body ?? context.activeGoals[0]?.body ?? "No next step recorded yet."}</strong></div>{context.recentEvidence[0] && <div className="context-last"><small>LAST OBSERVATION</small><span>{context.recentEvidence[0].teacher_note || context.recentEvidence[0].title || "Evidence captured"}</span></div>}</> : <p>No previous learning context yet.</p>}</div>}

            <div className="panel-block"><div className="panel-title"><h2>What does it show?</h2><span>{selectedTags.length} tags</span></div><div className="live-tags">{workspace.tags.map((tag) => <button key={tag.id} className={selectedTags.includes(tag.id) ? "active" : ""} onClick={() => toggleTag(tag.id)}>{tag.name}</button>)}</div></div>
            <div className="panel-block"><label className="note-label">Quick note<textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="Optional teacher observation…" /></label><label className="note-label">Next learning step<textarea value={nextStep} onChange={(e) => setNextStep(e.target.value)} placeholder="What should these pupils focus on next?" /></label><label className="reflection-toggle"><input type="checkbox" checked={requestReflection} onChange={(e) => setRequestReflection(e.target.checked)} /><span><strong>Request pupil reflection</strong><small>Creates a reflection task for each selected pupil.</small></span></label></div>
            <div className="save-zone"><div className="selected-strip">{selectedNames.length ? selectedNames.map((s) => <span key={s.id}>{s.first_name}</span>) : <em>Select pupils to continue</em>}</div><button className="save-live" disabled={!selectedStudents.length || status === "saving"} onClick={save}>{status === "saving" ? (file ? "Uploading + saving…" : "Saving securely…") : "Save evidence"}</button>{message && <div className={`live-message ${status}`}>{message}</div>}{status === "saved" && <button className="review-after-save" onClick={() => openClassPortfolio(activeClass)}>View class Sportfolio</button>}</div>
          </section>
        </div>
      </div>}
    </section>
  </main>;
}

function ClassesView({ classes, onCapture, onPortfolio }: { classes: LiveClass[]; onCapture: (item: LiveClass) => void; onPortfolio: (item: LiveClass) => void }) {
  return <div className="live-page classes-page"><div className="live-heading"><div><span className="eyebrow-orange">MY SPORTFOLIO</span><h1>Your classes</h1><p>Every class has two clear actions: capture new evidence or review the Sportfolio.</p></div></div>{classes.length ? <div className="class-grid">{classes.map((item) => <div key={item.id} className="class-card" style={{display:"grid",gap:14}}><div><h2>{item.name}</h2><p>{item.activity ?? "PE"}</p></div><span>{item.pupil_count ?? 0} pupil{item.pupil_count === 1 ? "" : "s"}</span><div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}><button className="primary-capture" style={{padding:10}} onClick={() => onCapture(item)}>● Capture</button><button className="review-after-save" style={{margin:0}} onClick={() => onPortfolio(item)}>View Sportfolio</button></div></div>)}</div> : <div className="empty-state"><h3>No classes yet</h3><p>Create or assign a class before capturing evidence.</p></div>}</div>;
}

function ClassPortfolioView({ activeClass, students, items, loading, error, onBack, onCapture, onPupil }: { activeClass: LiveClass; students: LiveStudent[]; items: ClassEvidence[]; loading: boolean; error: string; onBack: () => void; onCapture: () => void; onPupil: (student: LiveStudent) => void }) {
  return <div className="live-page class-workspace"><div className="workspace-top"><div><button className="back-link" onClick={onBack}>← Your classes</button><span className="eyebrow-orange">CLASS SPORTFOLIO</span><h1>{activeClass.name}</h1><p>{activeClass.activity ?? "PE"} · {students.length} pupil{students.length === 1 ? "" : "s"} · {items.length} evidence item{items.length === 1 ? "" : "s"}</p></div><button className="primary-capture" onClick={onCapture}>● Capture evidence</button></div>
    <div className="workspace-section"><div className="section-head"><div><h2>Pupil Sportfolios</h2><p>Tap any pupil to see only their evidence.</p></div></div>{students.length ? <div className="pupil-review-grid">{students.map((student) => <button className="pupil-review-card" key={student.id} onClick={() => onPupil(student)}><span className="pupil-avatar">{student.first_name[0]}{student.last_name?.[0] ?? ""}</span><div><strong>{student.first_name} {student.last_name ?? ""}</strong><small>{student.grade ?? activeClass.name}</small></div><b>View Sportfolio →</b></button>)}</div> : <div className="empty-state"><h3>No pupils yet</h3></div>}</div>
    <div className="workspace-section"><div className="section-head"><div><h2>All class evidence</h2><p>Every saved photo, video, audio clip and observation in this class.</p></div></div>{loading ? <div className="empty-state"><p>Loading class Sportfolio…</p></div> : error && !items.length ? <div className="empty-state"><h3>Could not load evidence</h3><p>{error}</p><button className="primary-capture" onClick={onCapture}>Capture new evidence</button></div> : items.length ? <EvidenceList items={items} fallbackClass={activeClass.name} /> : <div className="empty-state"><h3>No evidence yet</h3><p>Capture the first piece of evidence for this class.</p><button className="primary-capture" onClick={onCapture}>● Capture evidence</button></div>}</div>
  </div>;
}

function PupilPortfolioView({ portfolio, loading, error, activeClass, onBack, onCapture }: { portfolio: PupilPortfolio | null; loading: boolean; error: string; activeClass: LiveClass | null; onBack: () => void; onCapture: () => void }) {
  if (loading) return <div className="live-page portfolio-page"><button className="back-link" onClick={onBack}>← Class Sportfolio</button><div className="empty-state"><p>Loading pupil Sportfolio…</p></div></div>;
  if (!portfolio) return <div className="live-page portfolio-page"><button className="back-link" onClick={onBack}>← Class Sportfolio</button><div className="empty-state"><h3>Could not load this Sportfolio</h3><p>{error}</p></div></div>;
  const s = portfolio.student;
  const pupilItems: ClassEvidence[] = portfolio.items.map((item) => ({ ...item, pupilNames: [`${s.first_name} ${s.last_name ?? ""}`.trim()] }));
  return <div className="live-page portfolio-page"><div className="workspace-top"><div><button className="back-link" onClick={onBack}>← {activeClass?.name ?? "Class"} Sportfolio</button><span className="eyebrow-orange">PUPIL SPORTFOLIO</span><div className="portfolio-title"><span className="pupil-avatar large">{s.first_name[0]}{s.last_name?.[0] ?? ""}</span><div><h1>{s.first_name} {s.last_name ?? ""}</h1><p>{s.grade ?? activeClass?.name} · {portfolio.evidenceCount} evidence item{portfolio.evidenceCount === 1 ? "" : "s"}</p></div></div></div><button className="primary-capture" onClick={onCapture}>● Capture for class</button></div>{(portfolio.currentNextStep || portfolio.currentGoal) && <div className="next-step-banner"><small>CURRENT LEARNING PRIORITY</small><strong>{portfolio.currentNextStep ?? portfolio.currentGoal}</strong></div>}{pupilItems.length ? <EvidenceList items={pupilItems} fallbackClass={activeClass?.name ?? "Class"} /> : <div className="empty-state"><h3>No evidence yet</h3><p>Nothing has been saved to this pupil's Sportfolio yet.</p></div>}</div>;
}

function EvidenceList({ items, fallbackClass }: { items: ClassEvidence[]; fallbackClass: string }) {
  return <div className="timeline-list">{items.map((item) => <article className="portfolio-item" key={item.id}>{item.media.length ? item.media.map((media) => media.signed_url && (media.media_type === "image" ? <img className="portfolio-media" src={media.signed_url} alt="Private Sportfolio evidence" key={media.id} /> : media.media_type === "video" ? <video className="portfolio-media" src={media.signed_url} controls playsInline preload="metadata" key={media.id} /> : <audio src={media.signed_url} controls key={media.id} />)) : <div className="empty-copy" style={{padding:16}}>Observation only</div>}<div className="portfolio-copy"><div className="portfolio-meta">{new Date(item.occurred_at).toLocaleDateString()} · {item.class_name ?? fallbackClass}</div><h2>{item.title || "Evidence"}</h2><p style={{fontWeight:700}}>{item.pupilNames.join(", ")}</p>{item.tags.length > 0 && <div className="portfolio-tags">{item.tags.map((tag) => <span key={tag}>{tag}</span>)}</div>}{item.teacher_note && <p>{item.teacher_note}</p>}{item.next_step && <div className="item-next"><small>NEXT STEP</small><strong>{item.next_step}</strong></div>}{item.reflection && <div className="reflection-card"><small>PUPIL REFLECTION</small><p>{item.reflection.text_response ?? item.reflection.prompt ?? "Reflection requested"}</p></div>}{item.student_feedback && <div className="reflection-card"><small>FEEDBACK</small><p>{item.student_feedback}</p></div>}</div></article>)}</div>;
}
