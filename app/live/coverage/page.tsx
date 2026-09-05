"use client";

import { useEffect, useMemo, useState } from "react";
import { loadClassStudents, loadPupilPortfolio, loadTeacherWorkspace, type LiveClass, type PupilPortfolio } from "../../../lib/sportfolio/live";
import "../live.css";
import "./coverage.css";

type Tag = { id: string; name: string; category: string };
type Workspace = { classes: LiveClass[]; tags: Tag[] };
type PupilCoverage = { id: string; name: string; evidence: number; tags: Set<string>; latest: string | null; nextStep: string | null; goal: string | null; ageDays: number | null };

const FRESH_DAYS = 14;
const OVERDUE_DAYS = 21;

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
      if (first) await loadCoverage(first, w); else setLoading(false);
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
  const recentlyObserved = pupils.filter((p) => p.ageDays !== null && p.ageDays <= FRESH_DAYS);
  const overdue = pupils.filter((p) => p.evidence > 0 && p.ageDays !== null && p.ageDays > OVERDUE_DAYS);
  const needsNextStep = pupils.filter((p) => p.evidence > 0 && !p.nextStep && !p.goal);
  const maxEvidence = Math.max(1, ...pupils.map((p) => p.evidence));
  const ranked = [...pupils].sort(priorityCompare);
  const priority = ranked[0] ?? null;

  return <main className="coverage-shell">
    <header className="coverage-top"><a href="/live">← Sportfolio</a><div><small>CLASS INTELLIGENCE</small><strong>{activeClass?.name ?? "Learning coverage"}</strong></div>{priority && activeClass ? <a className="coverage-capture" href={captureHref(activeClass.id, priority.id)}>Capture next</a> : <a className="coverage-capture" href="/live">Capture evidence</a>}</header>
    <div className="coverage-page">
      <div className="coverage-heading"><div><span>LEARNING COVERAGE</span><h1>Who needs your attention next?</h1><p>Coverage now considers both how much evidence exists and how recently each pupil has been observed, so nobody quietly disappears from the learning record.</p></div><select value={activeClass?.id ?? ""} onChange={(e) => { const item = workspace?.classes.find((c) => c.id === e.target.value); if (item) loadCoverage(item); }} aria-label="Choose class">{workspace?.classes.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></div>
      {message && <div className="coverage-error">{message}</div>}
      {loading ? <div className="coverage-empty">Reading class evidence…</div> : <>
        {priority && activeClass && <section className="coverage-priority-banner"><div><small>CAPTURE NEXT</small><strong>{priority.name}</strong><p>{priorityReason(priority)}</p></div><div className="coverage-priority-actions"><a href={trajectoryHref(activeClass.id, priority.id)}>View trajectory</a><a className="primary" href={captureHref(activeClass.id, priority.id)}>Open focused capture →</a></div></section>}

        <section className="coverage-signal-grid rhythm-grid">
          <article><small>OBSERVED RECENTLY</small><strong>{recentlyObserved.length}<span>/{pupils.length}</span></strong><p>Seen in the last {FRESH_DAYS} days.</p></article>
          <article className={overdue.length ? "attention" : ""}><small>OBSERVATION OVERDUE</small><strong>{overdue.length}</strong><p>Last evidence is more than {OVERDUE_DAYS} days old.</p></article>
          <article className={needsCapture.length ? "attention" : ""}><small>NO EVIDENCE YET</small><strong>{needsCapture.length}</strong><p>{needsCapture.length ? "Pupils still missing from the record." : "Every pupil has evidence."}</p></article>
          <article className={needsNextStep.length ? "attention" : ""}><small>LEARNING GAP</small><strong>{needsNextStep.length}</strong><p>Evidence exists, but no next step or active goal is set.</p></article>
        </section>

        <section className="coverage-panel"><div className="coverage-panel-head"><div><h2>Observation rhythm</h2><p>Priority order combines zero coverage, staleness, low evidence count and missing learning direction.</p></div></div>{pupils.length ? <div className="coverage-pupils">{ranked.map((p) => <article key={p.id} className={p.evidence === 0 ? "gap" : p.ageDays !== null && p.ageDays > OVERDUE_DAYS ? "stale" : ""}><div className="coverage-avatar">{initials(p.name)}</div><div className="coverage-pupil-main"><strong>{p.name}</strong><div className="coverage-bar"><i style={{width:`${Math.max(p.evidence ? 12 : 0, p.evidence / maxEvidence * 100)}%`}} /></div><small>{p.evidence} evidence {p.evidence === 1 ? "item" : "items"} · {freshnessLabel(p)}</small></div><div className="coverage-priority">{priorityBadge(p)}{activeClass && <><a href={trajectoryHref(activeClass.id, p.id)}>Trajectory</a><a href={captureHref(activeClass.id, p.id)}>Capture →</a></>}</div></article>)}</div> : <div className="coverage-empty">No pupils in this class yet.</div>}</section>

        <section className="coverage-panel"><div className="coverage-panel-head"><div><h2>Learning tags</h2><p>How broadly the current class evidence represents your learning language.</p></div></div><div className="tag-coverage">{tagCoverage.map((tag) => <div key={tag.id}><div><strong>{tag.name}</strong><small>{tag.category}</small></div><div className="tag-meter"><i style={{width:`${pupils.length ? tag.count / pupils.length * 100 : 0}%`}} /></div><b>{tag.count}/{pupils.length}</b></div>)}</div></section>
        <div className="coverage-footnote">{evidenced}/{pupils.length} pupils currently have evidence. Freshness is a teaching prompt, not an attainment judgement.</div>
      </>}
    </div>
  </main>;
}

function priorityCompare(a: PupilCoverage, b: PupilCoverage) {
  const zero = Number(a.evidence > 0) - Number(b.evidence > 0);
  if (zero) return zero;
  const aAge = a.ageDays ?? Number.MAX_SAFE_INTEGER;
  const bAge = b.ageDays ?? Number.MAX_SAFE_INTEGER;
  if (aAge !== bAge) return bAge - aAge;
  if (a.evidence !== b.evidence) return a.evidence - b.evidence;
  return Number(!!a.nextStep || !!a.goal) - Number(!!b.nextStep || !!b.goal);
}
function priorityReason(p: PupilCoverage) {
  if (p.evidence === 0) return "No evidence yet — this pupil is currently invisible in the class record.";
  if (p.ageDays !== null && p.ageDays > OVERDUE_DAYS) return `Last observed ${p.ageDays} days ago — refresh the learning picture.`;
  if (!p.nextStep && !p.goal) return "Evidence exists, but there is no learning direction recorded yet.";
  return `${p.evidence} evidence ${p.evidence === 1 ? "item" : "items"} — currently the next best pupil to observe.`;
}
function priorityBadge(p: PupilCoverage) {
  if (p.evidence === 0) return <b>Capture gap</b>;
  if (p.ageDays !== null && p.ageDays > OVERDUE_DAYS) return <b>Overdue</b>;
  if (!p.nextStep && !p.goal) return <b>Needs next step</b>;
  return <span>In rhythm</span>;
}
function freshnessLabel(p: PupilCoverage) {
  if (!p.latest || p.ageDays === null) return "never observed";
  if (p.ageDays === 0) return "observed today";
  if (p.ageDays === 1) return "observed yesterday";
  if (p.ageDays <= FRESH_DAYS) return `observed ${p.ageDays} days ago`;
  if (p.ageDays > OVERDUE_DAYS) return `overdue · ${p.ageDays} days since last evidence`;
  return `${p.ageDays} days since last evidence`;
}
function captureHref(classId: string, studentId: string) { return `/live/coverage/capture?class=${encodeURIComponent(classId)}&student=${encodeURIComponent(studentId)}`; }
function trajectoryHref(classId: string, studentId: string) { return `/live/trajectory?class=${encodeURIComponent(classId)}&student=${encodeURIComponent(studentId)}`; }
function toCoverage(portfolio: PupilPortfolio): PupilCoverage {
  const tags = new Set<string>();
  portfolio.items.forEach((item) => item.tags.forEach((tag) => tags.add(tag)));
  const latest = portfolio.items[0]?.occurred_at ?? null;
  return { id: portfolio.student.id, name: `${portfolio.student.first_name} ${portfolio.student.last_name ?? ""}`.trim(), evidence: portfolio.evidenceCount, tags, latest, nextStep: portfolio.currentNextStep, goal: portfolio.currentGoal, ageDays: latest ? Math.max(0, Math.floor((Date.now() - new Date(latest).getTime()) / 86400000)) : null };
}
function initials(name: string) { return name.split(/\s+/).slice(0,2).map((part) => part[0] ?? "").join("").toUpperCase(); }
