"use client";

import { ChangeEvent, useEffect, useMemo, useState } from "react";
import {
  loadStudentReflectionTask,
  loadStudentWorkspace,
  saveReflectionDraft,
  submitTextReflection,
  submitVoiceReflection,
  type StudentPortfolioItem,
  type StudentReflectionTask,
  type StudentWorkspace,
} from "../../lib/sportfolio/student";
import "./student.css";

type ReflectionMode = "text" | "voice";
type PageState = "loading" | "ready" | "saving" | "submitting" | "submitted" | "error";
type StudentView = "home" | "portfolio" | "reflect" | "goals";

export default function StudentPage() {
  const [workspace, setWorkspace] = useState<StudentWorkspace | null>(null);
  const [task, setTask] = useState<StudentReflectionTask | null>(null);
  const [view, setView] = useState<StudentView>("home");
  const [mode, setMode] = useState<ReflectionMode>("text");
  const [response, setResponse] = useState("");
  const [voiceFile, setVoiceFile] = useState<File | null>(null);
  const [voiceUrl, setVoiceUrl] = useState<string | null>(null);
  const [state, setState] = useState<PageState>("loading");
  const [message, setMessage] = useState("");

  async function refresh() {
    const [workspaceData, reflectionData] = await Promise.all([loadStudentWorkspace(), loadStudentReflectionTask()]);
    setWorkspace(workspaceData);
    setTask(reflectionData);
    setResponse(reflectionData?.reflection.text_response ?? "");
  }

  useEffect(() => {
    refresh().then(() => setState("ready")).catch((error) => {
      setMessage(error instanceof Error ? error.message : "Unable to load Sportfolio.");
      setState("error");
    });
  }, []);

  useEffect(() => () => { if (voiceUrl) URL.revokeObjectURL(voiceUrl); }, [voiceUrl]);

  const student = workspace?.student ?? task?.student ?? null;
  const initials = useMemo(() => student ? `${student.first_name[0] ?? ""}${student.last_name?.[0] ?? ""}` : "SP", [student]);

  function chooseVoice(event: ChangeEvent<HTMLInputElement>) {
    const selected = event.target.files?.[0] ?? null;
    if (voiceUrl) URL.revokeObjectURL(voiceUrl);
    setVoiceFile(selected);
    setVoiceUrl(selected ? URL.createObjectURL(selected) : null);
    setMessage("");
    event.target.value = "";
  }

  async function saveDraft() {
    if (!task || state === "saving" || state === "submitting") return;
    setState("saving"); setMessage("");
    try {
      await saveReflectionDraft(task.reflection.id, response);
      setState("ready"); setMessage("Draft saved securely.");
    } catch (error) {
      setState("error"); setMessage(error instanceof Error ? error.message : "Could not save your draft.");
    }
  }

  async function submit() {
    if (!task || state === "submitting") return;
    setState("submitting"); setMessage("");
    try {
      if (mode === "voice") {
        if (!voiceFile) throw new Error("Record or choose a voice reflection first.");
        await submitVoiceReflection(task.reflection.id, voiceFile);
      } else {
        await submitTextReflection(task.reflection.id, response);
      }
      await refresh();
      setVoiceFile(null); setVoiceUrl(null); setResponse(""); setState("submitted");
      setMessage("Reflection submitted to your teacher.");
    } catch (error) {
      setState("error"); setMessage(error instanceof Error ? error.message : "Could not submit your reflection.");
    }
  }

  if (state === "loading") return <main className="student-app"><div className="reflection-shell"><div className="empty-state">Loading your Sportfolio…</div></div></main>;
  if (!workspace) return <main className="student-app"><div className="reflection-shell"><div className="empty-state"><h2>Sportfolio unavailable</h2><p>{message}</p></div></div></main>;

  return (
    <main className="student-app">
      <header className="student-topbar">
        <div className="student-logo"><span className="student-mark" />SPORTFOLIO</div>
        <div className="student-profile"><span className="student-avatar">{initials}</span><span>{workspace.student.first_name}</span></div>
      </header>

      {view === "home" && <HomeView workspace={workspace} onReflect={() => setView("reflect")} onPortfolio={() => setView("portfolio")} />}
      {view === "portfolio" && <PortfolioView items={workspace.items} />}
      {view === "goals" && <GoalsView workspace={workspace} />}
      {view === "reflect" && <ReflectionView task={task} mode={mode} setMode={setMode} response={response} setResponse={setResponse} voiceFile={voiceFile} voiceUrl={voiceUrl} chooseVoice={chooseVoice} state={state} message={message} saveDraft={saveDraft} submit={submit} />}

      <nav className="student-nav" aria-label="Student Sportfolio navigation">
        <button className={view === "home" ? "nav-active" : ""} onClick={() => setView("home")}>⌂<span>Home</span></button>
        <button className={view === "portfolio" ? "nav-active" : ""} onClick={() => setView("portfolio")}>▧<span>Portfolio</span></button>
        <button className={view === "reflect" ? "nav-active" : ""} onClick={() => setView("reflect")}>✦<span>Reflect{workspace.pendingReflections ? ` · ${workspace.pendingReflections}` : ""}</span></button>
        <button className={view === "goals" ? "nav-active" : ""} onClick={() => setView("goals")}>◎<span>Goals</span></button>
      </nav>
    </main>
  );
}

function HomeView({ workspace, onReflect, onPortfolio }: { workspace: StudentWorkspace; onReflect: () => void; onPortfolio: () => void }) {
  const latest = workspace.items[0];
  return <section className="student-dashboard">
    <div className="student-eyebrow">MY SPORTFOLIO</div>
    <h1>Hi {workspace.student.first_name}. Keep building your story.</h1>
    <p className="student-intro">Your evidence, reflections and goals in one private place.</p>
    <div className="student-stats">
      <div><strong>{workspace.items.length}</strong><span>Evidence moments</span></div>
      <div><strong>{workspace.pendingReflections}</strong><span>Reflections waiting</span></div>
      <div><strong>{workspace.goals.filter((goal) => goal.status !== "achieved").length}</strong><span>Active goals</span></div>
    </div>
    {workspace.pendingReflections > 0 && <button className="student-focus" onClick={onReflect}><span>✦ Reflection waiting</span><strong>Turn today’s evidence into your next step →</strong></button>}
    <div className="student-section-title"><h2>Latest evidence</h2><button onClick={onPortfolio}>View all</button></div>
    {latest ? <EvidenceCard item={latest} /> : <div className="empty-state"><h2>Your portfolio starts here</h2><p>Your teacher has not added evidence yet.</p></div>}
  </section>;
}

function PortfolioView({ items }: { items: StudentPortfolioItem[] }) {
  return <section className="student-dashboard">
    <div className="student-eyebrow">PRIVATE TIMELINE</div>
    <h1>My progress.</h1>
    <p className="student-intro">Every evidence moment your teacher has shared with you, newest first.</p>
    <div className="portfolio-list">{items.length ? items.map((item) => <EvidenceCard key={item.id} item={item} />) : <div className="empty-state"><h2>No evidence yet</h2><p>Your saved learning moments will appear here.</p></div>}</div>
  </section>;
}

function EvidenceCard({ item }: { item: StudentPortfolioItem }) {
  const media = item.media[0];
  return <article className="student-evidence-card">
    {media?.signed_url && media.media_type === "image" && <img src={media.signed_url} alt="Private Sportfolio evidence" />}
    {media?.signed_url && media.media_type === "video" && <video src={media.signed_url} controls playsInline preload="metadata" />}
    {media?.signed_url && media.media_type === "audio" && <div className="student-audio"><audio src={media.signed_url} controls /></div>}
    <div className="student-evidence-body">
      <div className="reflection-kicker">{new Date(item.occurred_at).toLocaleDateString()} · {(item.class_name ?? "PE").toUpperCase()}</div>
      <h3>{item.title || "Learning evidence"}</h3>
      {item.teacher_note && <p>{item.teacher_note}</p>}
      {!!item.tags.length && <div className="student-tags">{item.tags.map((tag) => <span key={tag}>{tag}</span>)}</div>}
      {item.student_feedback && <div className="teacher-feedback"><strong>Teacher feedback</strong><span>{item.student_feedback}</span></div>}
      {item.reflection_status !== "none" && <div className={`reflection-status ${item.reflection_status}`}>{item.reflection_status === "requested" ? "Reflection requested" : item.reflection_status === "reviewed" ? "Reflection reviewed" : "Reflection submitted"}</div>}
    </div>
  </article>;
}

function GoalsView({ workspace }: { workspace: StudentWorkspace }) {
  const active = workspace.goals.filter((goal) => goal.status !== "achieved");
  const achieved = workspace.goals.filter((goal) => goal.status === "achieved");
  return <section className="student-dashboard">
    <div className="student-eyebrow">WHAT I’M WORKING ON</div>
    <h1>My goals.</h1>
    <p className="student-intro">Clear next targets connected to the evidence in your portfolio.</p>
    <div className="goal-list">
      {active.map((goal) => <article className="goal-card" key={goal.id}><span>ACTIVE</span><h3>{goal.body}</h3>{goal.target_date && <p>Target · {new Date(goal.target_date).toLocaleDateString()}</p>}</article>)}
      {!active.length && <div className="empty-state"><h2>No active goal yet</h2><p>Your teacher can add a goal from your evidence and next steps.</p></div>}
      {!!achieved.length && <><div className="student-section-title"><h2>Achieved</h2></div>{achieved.map((goal) => <article className="goal-card achieved" key={goal.id}><span>ACHIEVED</span><h3>{goal.body}</h3></article>)}</>}
    </div>
  </section>;
}

function ReflectionView(props: {
  task: StudentReflectionTask | null; mode: ReflectionMode; setMode: (mode: ReflectionMode) => void;
  response: string; setResponse: (value: string) => void; voiceFile: File | null; voiceUrl: string | null;
  chooseVoice: (event: ChangeEvent<HTMLInputElement>) => void; state: PageState; message: string;
  saveDraft: () => void; submit: () => void;
}) {
  const { task, mode, setMode, response, setResponse, voiceFile, voiceUrl, chooseVoice, state, message, saveDraft, submit } = props;
  if (!task || task.reflection.submitted_at) return <section className="reflection-shell"><div className="empty-state"><h2>You’re all caught up</h2><p>{message || "There are no reflection requests waiting for you."}</p></div></section>;
  const evidence = task.item.media[0];
  const prompt = task.reflection.prompt || "What went well, and what would you improve next time?";
  return <section className="reflection-shell">
    <div className="reflection-progress"><span className="progress-active" /><span className="progress-active" /><span /></div>
    <div className="reflection-kicker">{new Date(task.item.occurred_at).toLocaleDateString()} · {(task.item.class_name ?? task.student.grade ?? "PE").toUpperCase()}</div>
    <h1>{prompt}</h1>
    <p className="reflection-intro">Use evidence from the lesson and explain what you noticed, what you chose, and what you want to improve next.</p>
    {evidence?.signed_url && evidence.media_type === "video" && <div className="prompt-media media-real"><video src={evidence.signed_url} controls playsInline preload="metadata" /></div>}
    {evidence?.signed_url && evidence.media_type === "image" && <div className="prompt-media media-real"><img src={evidence.signed_url} alt="Your private Sportfolio evidence" /></div>}
    {evidence?.signed_url && evidence.media_type === "audio" && <div className="prompt-media media-real audio-real"><audio src={evidence.signed_url} controls /></div>}
    {!evidence && task.item.teacher_note && <div className="reflection-tip"><span>✦</span><div><strong>Your teacher’s observation</strong><p>{task.item.teacher_note}</p></div></div>}
    <div className="mode-tabs" role="tablist" aria-label="Reflection response type">
      <button className={mode === "text" ? "active" : ""} onClick={() => setMode("text")}>Aa <span>Write</span></button>
      <button className={mode === "voice" ? "active" : ""} onClick={() => setMode("voice")}>● <span>Voice</span></button>
    </div>
    {mode === "text" && <div className="response-panel"><textarea value={response} onChange={(event) => setResponse(event.target.value)} placeholder="I noticed... Next time I will..." maxLength={2000} aria-label="Reflection response" /><span className="character-count">{response.length}/2000</span></div>}
    {mode === "voice" && <div className="voice-panel"><label className="voice-record" aria-label="Record or choose voice reflection"><span /><input type="file" accept="audio/*" capture style={{position:"absolute",inset:0,opacity:0,cursor:"pointer"}} onChange={chooseVoice} /></label><strong>{voiceFile ? voiceFile.name : "Record or choose audio"}</strong><p>Keep it short and specific. Around 20 to 40 seconds is ideal.</p>{voiceUrl && <audio src={voiceUrl} controls />}</div>}
    <div className="reflection-tip"><span>✦</span><div><strong>Need a prompt?</strong><p>What did you notice? What choice did you make? Why did it work? What will you try next?</p></div></div>
    <button className="student-submit" disabled={state === "submitting" || (mode === "text" ? response.trim().length < 3 : !voiceFile)} onClick={submit}>{state === "submitting" ? "Submitting securely…" : "Submit reflection"}</button>
    {mode === "text" && <button className="student-skip" disabled={state === "saving"} onClick={saveDraft}>{state === "saving" ? "Saving…" : "Save and finish later"}</button>}
    {message && <div className="reflection-tip"><span>{state === "error" ? "!" : "✓"}</span><div><p>{message}</p></div></div>}
  </section>;
}
