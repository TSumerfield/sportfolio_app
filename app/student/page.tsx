"use client";

import { ChangeEvent, useEffect, useMemo, useState } from "react";
import {
  loadStudentReflectionTask,
  saveReflectionDraft,
  submitTextReflection,
  submitVoiceReflection,
  type StudentReflectionTask,
} from "../../lib/sportfolio/student";
import "./student.css";

type ReflectionMode = "text" | "voice";

type PageState = "loading" | "ready" | "saving" | "submitting" | "submitted" | "error";

export default function StudentReflectionPage() {
  const [task, setTask] = useState<StudentReflectionTask | null>(null);
  const [mode, setMode] = useState<ReflectionMode>("text");
  const [response, setResponse] = useState("");
  const [voiceFile, setVoiceFile] = useState<File | null>(null);
  const [voiceUrl, setVoiceUrl] = useState<string | null>(null);
  const [state, setState] = useState<PageState>("loading");
  const [message, setMessage] = useState("");

  useEffect(() => {
    loadStudentReflectionTask()
      .then((data) => {
        setTask(data);
        setResponse(data?.reflection.text_response ?? "");
        setState("ready");
      })
      .catch((error) => {
        setMessage(error instanceof Error ? error.message : "Unable to load your reflection.");
        setState("error");
      });
  }, []);

  useEffect(() => () => { if (voiceUrl) URL.revokeObjectURL(voiceUrl); }, [voiceUrl]);

  const initials = useMemo(() => {
    if (!task) return "SP";
    return `${task.student.first_name[0] ?? ""}${task.student.last_name?.[0] ?? ""}`;
  }, [task]);

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
    setState("saving");
    setMessage("");
    try {
      await saveReflectionDraft(task.reflection.id, response);
      setState("ready");
      setMessage("Draft saved securely.");
    } catch (error) {
      setState("error");
      setMessage(error instanceof Error ? error.message : "Could not save your draft.");
    }
  }

  async function submit() {
    if (!task || state === "submitting") return;
    setState("submitting");
    setMessage("");
    try {
      if (mode === "voice") {
        if (!voiceFile) throw new Error("Record or choose a voice reflection first.");
        await submitVoiceReflection(task.reflection.id, voiceFile);
      } else {
        await submitTextReflection(task.reflection.id, response);
      }
      setState("submitted");
      setMessage("Reflection submitted to your teacher.");
    } catch (error) {
      setState("error");
      setMessage(error instanceof Error ? error.message : "Could not submit your reflection.");
    }
  }

  if (state === "loading") return <main className="student-app"><div className="reflection-shell"><div className="empty-state">Loading your Sportfolio…</div></div></main>;
  if (!task) return <main className="student-app"><div className="reflection-shell"><div className="empty-state"><h2>{state === "error" ? "Sportfolio unavailable" : "You're all caught up"}</h2><p>{message || "There are no reflection requests waiting for you."}</p></div></div></main>;

  const evidence = task.item.media[0];
  const prompt = task.reflection.prompt || "What went well, and what would you improve next time?";
  const submitted = state === "submitted" || !!task.reflection.submitted_at;

  return (
    <main className="student-app">
      <header className="student-topbar">
        <div className="student-logo"><span className="student-mark" />SPORTFOLIO</div>
        <div className="student-profile"><span className="student-avatar">{initials}</span><span>{task.student.first_name}</span></div>
      </header>

      <section className="reflection-shell">
        <div className="reflection-progress"><span className="progress-active" /><span className="progress-active" /><span /></div>
        <div className="reflection-kicker">{new Date(task.item.occurred_at).toLocaleDateString()} · {(task.item.class_name ?? task.student.grade ?? "PE").toUpperCase()}</div>
        <h1>{prompt}</h1>
        <p className="reflection-intro">Use evidence from the lesson and explain what you noticed, what you chose, and what you want to improve next.</p>

        {evidence?.signed_url && evidence.media_type === "video" && <div className="prompt-media" style={{height:"auto",background:"#111"}}><video src={evidence.signed_url} controls playsInline preload="metadata" style={{display:"block",width:"100%",maxHeight:360}} /></div>}
        {evidence?.signed_url && evidence.media_type === "image" && <div className="prompt-media" style={{height:"auto",background:"#111"}}><img src={evidence.signed_url} alt="Your private Sportfolio evidence" style={{display:"block",width:"100%",maxHeight:360,objectFit:"contain"}} /></div>}
        {evidence?.signed_url && evidence.media_type === "audio" && <div className="prompt-media" style={{height:"auto",padding:24,background:"#111"}}><audio src={evidence.signed_url} controls style={{width:"100%"}} /></div>}
        {!evidence && task.item.teacher_note && <div className="reflection-tip"><span>✦</span><div><strong>Your teacher's observation</strong><p>{task.item.teacher_note}</p></div></div>}

        {!submitted && <>
          <div className="mode-tabs" role="tablist" aria-label="Reflection response type" style={{gridTemplateColumns:"1fr 1fr"}}>
            <button className={mode === "text" ? "active" : ""} onClick={() => setMode("text")}>Aa <span>Write</span></button>
            <button className={mode === "voice" ? "active" : ""} onClick={() => setMode("voice")}>● <span>Voice</span></button>
          </div>

          {mode === "text" && <div className="response-panel"><textarea value={response} onChange={(event) => setResponse(event.target.value)} placeholder="I noticed... Next time I will..." maxLength={2000} aria-label="Reflection response" /><span className="character-count">{response.length}/2000</span></div>}

          {mode === "voice" && <div className="voice-panel">
            <label className="voice-record" aria-label="Record or choose voice reflection"><span /><input type="file" accept="audio/*" capture style={{position:"absolute",inset:0,opacity:0,cursor:"pointer"}} onChange={chooseVoice} /></label>
            <strong>{voiceFile ? voiceFile.name : "Record or choose audio"}</strong>
            <p>Keep it short and specific. Around 20 to 40 seconds is ideal.</p>
            {voiceUrl && <audio src={voiceUrl} controls style={{width:"100%",marginTop:16}} />}
          </div>}

          <div className="reflection-tip"><span>✦</span><div><strong>Need a prompt?</strong><p>What did you notice? What choice did you make? Why did it work? What will you try next?</p></div></div>

          <button className="student-submit" disabled={state === "submitting" || (mode === "text" ? response.trim().length < 3 : !voiceFile)} onClick={submit}>{state === "submitting" ? "Submitting securely…" : "Submit reflection"}</button>
          {mode === "text" && <button className="student-skip" disabled={state === "saving"} onClick={saveDraft}>{state === "saving" ? "Saving…" : "Save and finish later"}</button>}
        </>}

        {submitted && <div className="reflection-tip" style={{marginTop:24}}><span>✓</span><div><strong>Reflection submitted</strong><p>Your teacher can now review this alongside your evidence.</p></div></div>}
        {message && <div className="reflection-tip" style={{marginTop:14}}><span>{state === "error" ? "!" : "✓"}</span><div><p>{message}</p></div></div>}
      </section>

      <nav className="student-nav">
        <button>⌂<span>Home</span></button>
        <button>▧<span>Portfolio</span></button>
        <button className="nav-active">✦<span>Reflect</span></button>
        <button>◎<span>Goals</span></button>
      </nav>
    </main>
  );
}
