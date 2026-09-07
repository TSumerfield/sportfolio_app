"use client";

import { useEffect, useMemo, useState } from "react";
import { loadPostLessonReview, saveReviewDecision, type ReviewDecision, type ReviewItem, type ReviewPupil } from "../../../lib/sportfolio/review";
import "./review.css";

type Draft = { decision: ReviewDecision; body: string };

export default function PostLessonReviewPage() {
  const [items, setItems] = useState<ReviewItem[]>([]);
  const [classes, setClasses] = useState<{ id: string; name: string }[]>([]);
  const [classId, setClassId] = useState("");
  const [active, setActive] = useState(0);
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const [saving, setSaving] = useState<string | null>(null);
  const [status, setStatus] = useState("Loading recent evidence…");

  useEffect(() => { void load(); }, []);

  async function load(nextClassId?: string) {
    try {
      setStatus("Loading recent evidence…");
      const data = await loadPostLessonReview(nextClassId || undefined);
      setClasses(data.classes);
      setItems(data.items);
      setActive(0);
      setStatus(data.items.length ? "Ready for your judgement." : "Nothing needs review from the last 36 hours.");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Could not load the review queue.");
    }
  }

  const queue = useMemo(() => items.flatMap((item) => item.pupils.map((pupil) => ({ item, pupil }))), [items]);
  const current = queue[active] ?? null;
  const key = current ? `${current.item.id}:${current.pupil.id}` : "";
  const draft = current ? drafts[key] ?? { decision: current.pupil.currentNextStep ? "keep" : "replace", body: current.pupil.currentNextStep ?? "" } : null;

  function setDraft(next: Partial<Draft>) {
    if (!current || !draft) return;
    setDrafts((all) => ({ ...all, [key]: { ...draft, ...next } }));
  }

  function choose(decision: ReviewDecision) {
    if (!current) return;
    setDraft({ decision, body: decision === "keep" || decision === "complete" ? current.pupil.currentNextStep ?? "" : decision === "replace" ? "" : current.pupil.currentNextStep ?? "" });
  }

  async function save() {
    if (!current || !draft) return;
    setSaving(key);
    setStatus("Saving your learning decision…");
    try {
      await saveReviewDecision({ itemId: current.item.id, studentId: current.pupil.id, previousNextStep: current.pupil.currentNextStep, decision: draft.decision, finalBody: draft.body });
      const nextItems = items.map((item) => item.id !== current.item.id ? item : { ...item, pupils: item.pupils.filter((pupil) => pupil.id !== current.pupil.id) }).filter((item) => item.pupils.length);
      setItems(nextItems);
      setDrafts((all) => { const copy = { ...all }; delete copy[key]; return copy; });
      setActive(Math.min(active, Math.max(0, queue.length - 2)));
      setStatus(queue.length <= 1 ? "Review complete. Sportfolio now remembers the learning direction." : "Saved. Next pupil ready.");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Could not save this decision.");
    } finally { setSaving(null); }
  }

  return <main className="review-shell">
    <header className="review-top"><a href="/live">← Sportfolio</a><div><small>POST-LESSON REVIEW</small><strong>{queue.length} learning decision{queue.length === 1 ? "" : "s"} left</strong></div><a className="capture-link" href="/live/session">Session Capture</a></header>
    <section className="review-summary"><div><small>TURN EVIDENCE INTO MEMORY</small><h1>Your judgement is the valuable part.</h1><p>Confirm what the evidence means now, while the lesson is still fresh. Sportfolio carries it into the next lesson.</p></div><label>Class<select value={classId} onChange={(event) => { const id = event.target.value; setClassId(id); void load(id); }}><option value="">All recent classes</option>{classes.map((cls) => <option key={cls.id} value={cls.id}>{cls.name}</option>)}</select></label></section>
    {!current ? <section className="review-empty"><span>✓</span><h2>You're caught up.</h2><p>{status}</p><a href="/live/session">Start another capture session</a></section> : <div className="review-workspace">
      <Evidence item={current.item} pupil={current.pupil} />
      <section className="judgement-panel">
        <div className="pupil-heading"><span>{initials(current.pupil)}</span><div><small>{current.item.className}</small><h2>{current.pupil.first_name} {current.pupil.last_name ?? ""}</h2><p>{new Date(current.item.occurredAt).toLocaleString([], { weekday: "short", hour: "2-digit", minute: "2-digit" })}</p></div></div>
        <div className="current-direction"><small>CURRENT LEARNING DIRECTION</small><strong>{current.pupil.currentNextStep || "No direction set yet"}</strong></div>
        <div className="decision-block"><small>WHAT DOES THIS EVIDENCE TELL YOU?</small><div className="decision-grid"><button className={draft?.decision === "keep" ? "active" : ""} disabled={!current.pupil.currentNextStep} onClick={() => choose("keep")}><b>Keep</b><span>Still the right focus</span></button><button className={draft?.decision === "refine" ? "active" : ""} disabled={!current.pupil.currentNextStep} onClick={() => choose("refine")}><b>Refine</b><span>Make the focus sharper</span></button><button className={draft?.decision === "complete" ? "active" : ""} disabled={!current.pupil.currentNextStep} onClick={() => choose("complete")}><b>Complete</b><span>This learning is secure</span></button><button className={draft?.decision === "replace" ? "active" : ""} onClick={() => choose("replace")}><b>{current.pupil.currentNextStep ? "Replace" : "Set direction"}</b><span>Choose what comes next</span></button></div></div>
        {(draft?.decision === "refine" || draft?.decision === "replace") && <label className="next-input">NEXT LEARNING STEP<textarea autoFocus value={draft.body} onChange={(event) => setDraft({ body: event.target.value })} placeholder="What should this pupil focus on next?" /></label>}
        <div className="review-save"><div><b>{status}</b><span>{active + 1} of {queue.length} currently in queue</span></div><button disabled={saving === key || (draft?.decision !== "complete" && !draft?.body.trim())} onClick={() => void save()}>{saving === key ? "Saving…" : "Confirm & next →"}</button></div>
      </section>
    </div>}
  </main>;
}

function Evidence({ item, pupil }: { item: ReviewItem; pupil: ReviewPupil }) {
  const media = item.media[0];
  return <section className="evidence-panel"><div className="evidence-head"><div><small>EVIDENCE MOMENT</small><strong>{item.tags.join(" · ") || "PE learning"}</strong></div><span>{pupil.grade ?? ""}</span></div><div className="evidence-media">{media?.mediaType === "image" && media.signedUrl ? <img src={media.signedUrl} alt="Private pupil evidence" /> : media?.mediaType === "video" && media.signedUrl ? <video src={media.signedUrl} controls playsInline /> : media?.mediaType === "audio" && media.signedUrl ? <audio src={media.signedUrl} controls /> : <div><span>◎</span><strong>Observation evidence</strong></div>}</div><div className="evidence-note"><small>WHAT YOU NOTICED</small><p>{item.teacherNote || "No note added. Use the captured moment and your memory of the lesson."}</p></div></section>;
}

function initials(pupil: ReviewPupil) { return `${pupil.first_name[0] ?? ""}${pupil.last_name?.[0] ?? ""}`; }
