"use client";

import { ChangeEvent, useEffect, useMemo, useState } from "react";
import {
  loadClassStudents,
  loadPupilLearningContext,
  loadPupilPortfolio,
  loadTeacherWorkspace,
  type LiveClass,
  type LiveStudent,
  type PupilLearningContext,
} from "../../../../lib/sportfolio/live";
import { saveCoverageEvidence, type NextStepDecision } from "../../../../lib/sportfolio/coverage-save";
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
  const [learningContext, setLearningContext] = useState<PupilLearningContext | null>(null);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [note, setNote] = useState("");
  const [nextStep, setNextStep] = useState("");
  const [nextStepDecision, setNextStepDecision] = useState<NextStepDecision>("new");
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
      const context = await loadPupilLearningContext(pupil.id);
      setLearningContext(context);
      const existingNextStep = context.nextSteps[0]?.final_body ?? "";
      setNextStep(existingNextStep || context.activeGoals[0]?.body || "");
      setNextStepDecision(existingNextStep ? "accept" : "new");
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
  const latestEvidence = learningContext?.recentEvidence[0] ?? null;
  const previousNextStep = learningContext?.nextSteps[0]?.final_body ?? null;
  const daysSinceLatest = latestEvidence ? Math.max(0, Math.floor((Date.now() - +new Date(latestEvidence.occurred_at)) / 86400000)) : null;
  const priorityReason = !learningContext?.evidenceCount
    ? "No evidence yet"
    : daysSinceLatest !== null && daysSinceLatest > 21
      ? `${daysSinceLatest} days since last observation`
      : daysSinceLatest !== null && daysSinceLatest > 14
        ? `Observation rhythm due · ${daysSinceLatest} days`
        : !learningContext.nextSteps.length && !learningContext.activeGoals.length
          ? "Evidence exists, but no learning direction is set"
          : "Lowest current coverage in this class";

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

  function chooseDecision(decision: NextStepDecision) {
    setNextStepDecision(decision);
    if (decision === "accept" && previousNextStep) setNextStep(previousNextStep);
    if (decision === "edit" && previousNextStep) setNextStep(previousNextStep);
    if (decision === "replace") setNextStep("");
    setMessage("");
  }

  function changeNextStep(value: string) {
    setNextStep(value);
    if (previousNextStep && nextStepDecision === "accept" && value.trim() !== previousNextStep.trim()) setNextStepDecision("edit");
    if (!previousNextStep && nextStepDecision === "none" && value.trim()) setNextStepDecision("new");
  }

  async function findNextPupil(classId: string, currentStudentId: string) {
    const pupils = await loadClassStudents(classId);
    if (pupils.length <= 1) return null;
    const portfolios = await Promise.all(pupils.map((pupil) => loadPupilPortfolio(pupil.id)));
    const now = Date.now();
    const ranked = portfolios
      .filter((portfolio) => portfolio.student.id !== currentStudentId)
      .map((portfolio) => {
        const latest = portfolio.items[0]?.occurred_at ? +new Date(portfolio.items[0].occurred_at) : 0;
        const ageDays = latest ? Math.floor((now - latest) / 86400000) : 99999;
        return {
          student: portfolio.student,
          evidence: portfolio.evidenceCount,
          hasDirection: !!(portfolio.currentNextStep || portfolio.currentGoal),
          ageDays,
        };
      })
      .sort((a, b) => Number(b.ageDays > 21) - Number(a.ageDays > 21) || b.ageDays - a.ageDays || a.evidence - b.evidence || Number(a.hasDirection) - Number(b.hasDirection));
    return ranked[0]?.student ?? null;
  }

  async function save(intent: SaveIntent = "stay") {
    if (!activeClass || !student) return;
    setSaveIntent(intent);
    setState("saving"); setMessage("");
    try {
      const finalDecision: NextStepDecision = nextStep.trim() ? nextStepDecision : "none";
      const id = await saveCoverageEvidence({
        classId: activeClass.id,
        studentId: student.id,
        tagIds: selectedTags,
        title: file ? file.name.replace(/\.[^.]+$/, "") : "Coverage capture",
        teacherNote: note,
        previousNextStep,
        nextStep,
        nextStepDecision: finalDecision,
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
      setSelectedTags([]); setNote(""); setNextStep(""); setNextStepDecision("none"); setRequestReflection(false);
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
        <div className="queue-priority-context">
          <div><small>WHY NOW</small><strong>{priorityReason}</strong></div>
          <span>{learningContext?.evidenceCount ?? 0} evidence {(learningContext?.evidenceCount ?? 0) === 1 ? "item" : "items"}</span>
        </div>
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
        <div className="queue-learning-history">
          <div className="queue-title"><h2>Before you capture</h2><span>Learning history</span></div>
          {latestEvidence ? <>
            <div className="queue-history-row"><small>LAST OBSERVATION</small><strong>{latestEvidence.teacher_note || latestEvidence.title || "Evidence captured"}</strong><span>{new Date(latestEvidence.occurred_at).toLocaleDateString()}</span></div>
            {!!latestEvidence.tags.length && <div className="queue-history-tags">{latestEvidence.tags.map((tag) => <span key={tag}>{tag}</span>)}</div>}
          </> : <div className="queue-history-empty"><strong>No previous evidence yet.</strong><span>This capture starts the pupil's learning record.</span></div>}
          <div className="queue-history-row next"><small>CURRENT DIRECTION</small><strong>{previousNextStep ?? learningContext?.activeGoals[0]?.body ?? "No next step or goal recorded yet."}</strong></div>
        </div>
        <div className="queue-block"><div className="queue-title"><h2>Tag the learning</h2><span>{selectedTags.length} selected</span></div><div className="queue-tags">{workspace.tags.map((tag) => <button key={tag.id} className={selectedTags.includes(tag.id) ? "active" : ""} onClick={() => toggleTag(tag.id)}>{tag.name}</button>)}</div></div>
        <div className="queue-block">
          <label>Quick observation<textarea value={note} onChange={(event) => setNote(event.target.value)} placeholder="What did you notice?" /></label>
          <div className="next-step-decision">
            <div className="queue-title"><h2>Next learning step</h2><span>Teacher confirmed</span></div>
            {previousNextStep ? <div className="decision-actions" role="group" aria-label="Next step decision">
              <button className={nextStepDecision === "accept" ? "active" : ""} onClick={() => chooseDecision("accept")}>✓ Keep</button>
              <button className={nextStepDecision === "edit" ? "active" : ""} onClick={() => chooseDecision("edit")}>Refine</button>
              <button className={nextStepDecision === "replace" ? "active" : ""} onClick={() => chooseDecision("replace")}>Replace</button>
            </div> : <p className="decision-new">No previous next step. Add one from what you see now.</p>}
            <textarea value={nextStep} onChange={(event) => changeNextStep(event.target.value)} placeholder="What should this pupil focus on next?" />
            <div className={`decision-status ${nextStepDecision}`}><strong>{decisionLabel(nextStepDecision)}</strong><span>{decisionHelp(nextStepDecision, !!previousNextStep)}</span></div>
          </div>
          <label className="queue-reflect"><input type="checkbox" checked={requestReflection} onChange={(event) => setRequestReflection(event.target.checked)} /><span><strong>Request reflection</strong><small>Creates a private pupil reflection task using the teacher-confirmed next step.</small></span></label>
        </div>
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

function decisionLabel(decision: NextStepDecision) {
  if (decision === "accept") return "Keep current direction";
  if (decision === "edit") return "Teacher refinement";
  if (decision === "replace") return "Teacher replacement";
  if (decision === "new") return "New teacher next step";
  return "No next step saved";
}

function decisionHelp(decision: NextStepDecision, hadPrevious: boolean) {
  if (decision === "accept") return "The previous next step remains right after reviewing this evidence.";
  if (decision === "edit") return "Your change will be stored against the previous wording so Sportfolio can learn from the correction.";
  if (decision === "replace") return "The previous direction is being superseded by a materially different next step.";
  if (decision === "new") return hadPrevious ? "Add the next direction." : "This becomes the first structured next step for this pupil.";
  return "This evidence will save without creating a new next step.";
}
