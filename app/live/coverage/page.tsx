"use client";

import { useEffect, useMemo, useState } from "react";
import { loadClassStudents, loadPupilPortfolio, loadTeacherWorkspace, type LiveClass, type PupilPortfolio } from "../../../lib/sportfolio/live";
import "../live.css";
import "./coverage.css";

type Tag = { id: string; name: string; category: string };
type Workspace = { classes: LiveClass[]; tags: Tag[] };
type PupilCoverage = { id: string; name: string; evidence: number; tags: Set<string>; latest: string | null; nextStep: string | null; goal: string | null };

export default function CoveragePage() {
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [activeClass, setActiveClass] = useState<LiveClass | null>(null);
  const [pupils, setPupils] = useState<PupilCoverage[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  useEffect(() => {
    const requestedClass = new URLSearchParams(window.location.search).get("class");
    loadTeacherWorkspace().then(async (data) => {
      const w = data as Workspace & { activeClass?: LiveClass };
      setWorkspace(w);
      const first = w.classes.find((item) => item.id === requestedClass) ?? w.activeClass ?? w.classes[0] ?? null;
      setActiveClass(first);
      if (first) await loadCoverage(first, w);
      else setLoading(false);
    }).catch((error) => { setMessage(error instanceof Error ? error.message : "Unable to load coverage."); setLoading(false); });
  }, []);

  async function loadCoverage(item: LiveClass, w = workspace) {
    if (!w) return;
    setLoading(true); setMessage(""); setActiveClass(item);
    try {
      const students = await loadClassStudents(item.id);
      const portfolios = await Promise.all(students.map((student) => loadPupilPortfolio(student.id)));
      setPupils(portfolios.map(toCoverage));
      window.history.replaceState(null, "", `/live/coverage?class=${item.id}`);
    } catch (error) { setMessage(error instanceof Error ? error.message : "Unable to load coverage."); }
    finally { setLoading(false); }
  }

  const tagCoverage = useMemo(() => {
    if (!workspace) return [];
    return workspace.tags.map((tag) => ({ ...tag, count: pupils.filter((p) => p.tags.has(tag.name)).length })).sort((a,b) => b.count - a.count);
  }, [workspace, pupils]);
  const evidenced = pupils.filter((p) => p.evidence > 0).length;
  const needsCapture = pupils.filter((p) => p.evidence === 0);
  const needsNextStep = pupils.filter((p) => p.evidence > 0 && !p.nextStep && !p.goal);
  const maxEvidence = Math.max(1, ...pupils.map((p) => p.evidence));
  const priority = [...pupils].sort((a,b) => a.evidence - b.evidence || Number(!!a.nextStep || !!a.goal) - Number(!!b.nextStep || !!b.goal))[0] ?? null;

  return <main className="coverage-shell">
    <header className="coverage-top"><a href="/live">← Sportfolio</a><div><small>CLASS INTELLIGENCE</small><strong>{activeClass?.name ?? "Learning coverage"}</strong></div>{priority && activeClass ? <a className="coverage-capture" href={captureHref(activeClass.id, priority.id)}>Capture next</a> : <a className="coverage-capture" href="/live">Capture evidence</a>}</header>
    <div className="coverage-page">
      <div className="coverage-heading"><div><span>LEARNING COVERAGE</span><h1>Who needs your attention next?</h1><p>Live evidence coverage from the class Sportfolio — designed to guide the next useful capture, not create another dashboard.</p></div><select value={activeClass?.id ?? ""} onChange={(e) => { const item = workspace?.classes.find((c) => c.id === e.target.value); if (item) loadCoverage(item); }} aria-label="Choose class">{workspace?.classes.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></div>
      {message && <div className="coverage-error">{message}</div>}
      {loading ? <div className="coverage-empty">Reading class evidence…</div> : <>
        {priority && activeClass && <section className="coverage-priority-banner"><div><small>CAPTURE NEXT</small><strong>{priority.name}</strong><p>{priority.evidence === 0 ? "No evidence yet — this pupil is currently invisible in the class record." : !priority.nextStep && !priority.goal ? "Evidence exists, but there is no learning direction recorded yet." : `${priority.evidence} evidence ${priority.evidence === 1 ? "item" : "items"} — lowest current coverage in the class.`}</p></div><a href={captureHref(activeClass.id, priority.id)}>Open focused capture →</a></section>}
        <section className="coverage-signal-grid">
          <article><small>PUPILS EVIDENCED</small><strong>{evidenced}<span>/{pupils.length}</span></strong><p>{pupils.length ? Math.round(evidenced / pupils.length * 100) : 0}% of this class has evidence.</p></article>
          <article className={needsCapture.length ? "attention" : ""}><small>CAPTURE GAP</small><strong>{needsCapture.length}</strong><p>{needsCapture.length ? "Pupils with no evidence yet." : "Every pupil has evidence."}</p></article>
          <article className={needsNextStep.length ? "attention" : ""}><small>LEARNING GAP</small><strong>{needsNextStep.length}</strong><p>Have evidence but no next step or active goal.</p></article>
        </section>
        <section className="coverage-panel"><div className="coverage-panel-head"><div><h2>Pupil coverage</h2><p>Low evidence first. The aim is equitable observation, not maximum uploads.</p></div></div>{pupils.length ? <div className="coverage-pupils">{[...pupils].sort((a,b) => a.evidence-b.evidence).map((p) => <article key={p.id} className={p.evidence === 0 ? "gap" : ""}><div className="coverage-avatar">{initials(p.name)}</div><div className="coverage-pupil-main"><strong>{p.name}</strong><div className="coverage-bar"><i style={{width:`${Math.max(p.evidence ? 12 : 0, p.evidence / maxEvidence * 100)}%`}} /></div><small>{p.evidence} evidence {p.evidence === 1 ? "item" : "items"}{p.latest ? ` · latest ${new Date(p.latest).toLocaleDateString()}` : " · none yet"}</small></div><div className="coverage-priority">{p.evidence === 0 ? <b>Capture gap</b> : p.nextStep || p.goal ? <span>Direction set</span> : <b>Needs next step</b>}{activeClass && <a href={captureHref(activeClass.id, p.id)}>Capture →</a>}</div></article>)}</div> : <div className="coverage-empty">No pupils in this class yet.</div>}</section>
        <section className="coverage-panel"><div className="coverage-panel-head"><div><h2>Learning tags</h2><p>How broadly the current class evidence represents your learning language.</p></div></div><div className="tag-coverage">{tagCoverage.map((tag) => <div key={tag.id}><div><strong>{tag.name}</strong><small>{tag.category}</small></div><div className="tag-meter"><i style={{width:`${pupils.length ? tag.count / pupils.length * 100 : 0}%`}} /></div><b>{tag.count}/{pupils.length}</b></div>)}</div></section>
      </>}
    </div>
  </main>;
}

function captureHref(classId: string, studentId: string) { return `/live/coverage/capture?class=${encodeURIComponent(classId)}&student=${encodeURIComponent(studentId)}`; }
function toCoverage(portfolio: PupilPortfolio): PupilCoverage {
  const tags = new Set<string>();
  portfolio.items.forEach((item) => item.tags.forEach((tag) => tags.add(tag)));
  return { id: portfolio.student.id, name: `${portfolio.student.first_name} ${portfolio.student.last_name ?? ""}`.trim(), evidence: portfolio.evidenceCount, tags, latest: portfolio.items[0]?.occurred_at ?? null, nextStep: portfolio.currentNextStep, goal: portfolio.currentGoal };
}
function initials(name: string) { return name.split(/\s+/).slice(0,2).map((part) => part[0] ?? "").join("").toUpperCase(); }
