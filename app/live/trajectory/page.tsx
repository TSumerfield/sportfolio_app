"use client";

import { useEffect, useMemo, useState } from "react";
import { loadLearningTrajectory, type LearningTrajectory } from "../../../lib/sportfolio/trajectory";
import "../live.css";
import "./trajectory.css";

export default function LearningTrajectoryPage() {
  const [trajectory, setTrajectory] = useState<LearningTrajectory | null>(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [classId, setClassId] = useState<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const studentId = params.get("student");
    setClassId(params.get("class"));
    if (!studentId) {
      setMessage("No pupil was selected.");
      setLoading(false);
      return;
    }
    loadLearningTrajectory(studentId)
      .then(setTrajectory)
      .catch((error) => setMessage(error instanceof Error ? error.message : "Unable to load learning trajectory."))
      .finally(() => setLoading(false));
  }, []);

  const counts = useMemo(() => {
    const entries = trajectory?.entries ?? [];
    return {
      kept: entries.filter((entry) => entry.status === "accepted" && entry.suggested_body).length,
      changed: entries.filter((entry) => entry.status === "edited").length,
      total: entries.length,
    };
  }, [trajectory]);

  if (loading) return <main className="trajectory-loading">Reading learning trajectory…</main>;
  if (!trajectory) return <main className="trajectory-loading"><div><h1>Learning trajectory unavailable</h1><p>{message}</p><a href={classId ? `/live/coverage?class=${classId}` : "/live/coverage"}>Back to coverage</a></div></main>;

  const s = trajectory.student;
  const backHref = classId ? `/live/coverage?class=${encodeURIComponent(classId)}` : "/live/coverage";
  const captureHref = classId ? `/live/coverage/capture?class=${encodeURIComponent(classId)}&student=${encodeURIComponent(s.id)}` : null;

  return <main className="trajectory-shell">
    <header className="trajectory-top"><a href={backHref}>← Coverage</a><div><small>LEARNING TRAJECTORY</small><strong>{s.first_name} {s.last_name ?? ""}</strong></div>{captureHref ? <a className="trajectory-capture" href={captureHref}>Capture evidence</a> : <span />}</header>
    <div className="trajectory-page">
      <section className="trajectory-heading">
        <div><span>PROGRESS OVER TIME</span><h1>How the learning direction has changed.</h1><p>Each step is linked to the evidence that informed it, including whether the teacher kept, refined or replaced the previous direction.</p></div>
        <div className="trajectory-pupil"><strong>{s.first_name[0]}{s.last_name?.[0] ?? ""}</strong><div><b>{s.first_name} {s.last_name ?? ""}</b><small>{s.grade ?? "Pupil Sportfolio"}</small></div></div>
      </section>

      <section className="trajectory-summary">
        <article><small>CURRENT NEXT STEP</small><strong>{trajectory.currentNextStep ?? "No next step set"}</strong></article>
        <article><small>EVIDENCE ITEMS</small><strong>{trajectory.evidenceCount}</strong></article>
        <article><small>DIRECTION CHANGES</small><strong>{counts.changed}</strong><span>{counts.kept} kept</span></article>
      </section>

      {trajectory.currentGoal && <section className="trajectory-goal"><small>ACTIVE GOAL</small><strong>{trajectory.currentGoal}</strong></section>}

      <section className="trajectory-panel">
        <div className="trajectory-panel-head"><div><h2>Learning direction history</h2><p>Newest first. Teacher judgement is preserved rather than overwritten.</p></div><span>{counts.total} recorded step{counts.total === 1 ? "" : "s"}</span></div>
        {trajectory.entries.length ? <div className="trajectory-list">{trajectory.entries.map((entry) => {
          const decision = decisionMeta(entry.status, entry.suggested_body, entry.final_body);
          return <article key={entry.id} className={`trajectory-entry ${decision.tone}`}>
            <div className="trajectory-line"><i /></div>
            <div className="trajectory-entry-body">
              <div className="trajectory-entry-top"><span className={`trajectory-decision ${decision.tone}`}>{decision.label}</span><time>{new Date(entry.created_at).toLocaleDateString()}</time></div>
              {entry.suggested_body && <div className="trajectory-previous"><small>PREVIOUS DIRECTION</small><p>{entry.suggested_body}</p></div>}
              <div className="trajectory-final"><small>TEACHER-CONFIRMED DIRECTION</small><strong>{entry.final_body}</strong></div>
              {entry.evidence && <div className="trajectory-evidence"><div><small>EVIDENCE THAT INFORMED THIS</small><strong>{entry.evidence.teacher_note || entry.evidence.title || "Evidence captured"}</strong><span>{entry.evidence.class_name ? `${entry.evidence.class_name} · ` : ""}{new Date(entry.evidence.occurred_at).toLocaleDateString()}</span></div>{entry.evidence.tags.length ? <div className="trajectory-tags">{entry.evidence.tags.map((tag) => <span key={tag}>{tag}</span>)}</div> : null}</div>}
            </div>
          </article>;
        })}</div> : <div className="trajectory-empty"><h3>No next-step history yet</h3><p>Once evidence is used to confirm or change a learning direction, it will appear here.</p>{captureHref && <a href={captureHref}>Capture first learning step →</a>}</div>}
      </section>
    </div>
  </main>;
}

function decisionMeta(status: string, suggested: string | null, finalBody: string) {
  if (status === "edited" && suggested) {
    const substantial = suggested.trim().toLowerCase() !== finalBody.trim().toLowerCase();
    return { label: substantial ? "Teacher changed direction" : "Teacher refined direction", tone: "changed" };
  }
  if (status === "accepted" && suggested) return { label: "Teacher kept direction", tone: "kept" };
  if (status === "completed") return { label: "Step completed", tone: "complete" };
  if (status === "ignored") return { label: "Direction not used", tone: "ignored" };
  return { label: "New teacher direction", tone: "new" };
}
