"use client";

import { useState } from "react";
import "./student.css";

type ReflectionMode = "text" | "voice" | "photo";

export default function StudentReflectionPage() {
  const [mode, setMode] = useState<ReflectionMode>("text");
  const [response, setResponse] = useState("");
  const [submitted, setSubmitted] = useState(false);

  return (
    <main className="student-app">
      <header className="student-topbar">
        <div className="student-logo"><span className="student-mark" />SPORTFOLIO</div>
        <div className="student-profile"><span className="student-avatar">MC</span><span>Mia</span></div>
      </header>

      <section className="reflection-shell">
        <div className="reflection-progress">
          <span className="progress-active" />
          <span />
          <span />
        </div>

        <button className="student-back">‹ Back to my portfolio</button>
        <div className="reflection-kicker">TODAY · GRADE 5A BASKETBALL</div>
        <h1>What went well in today&apos;s lesson?</h1>
        <p className="reflection-intro">Think about one moment you were proud of. You can type, record your voice, or add a photo.</p>

        <div className="prompt-media">
          <div className="prompt-badge">▶ 00:12</div>
          <div className="prompt-caption"><strong>Your teacher shared this moment</strong><span>Fast-break decision making</span></div>
        </div>

        <div className="mode-tabs" role="tablist" aria-label="Reflection response type">
          <button className={mode === "text" ? "active" : ""} onClick={() => setMode("text")}>Aa <span>Write</span></button>
          <button className={mode === "voice" ? "active" : ""} onClick={() => setMode("voice")}>● <span>Voice</span></button>
          <button className={mode === "photo" ? "active" : ""} onClick={() => setMode("photo")}>▧ <span>Photo</span></button>
        </div>

        {mode === "text" && (
          <div className="response-panel">
            <textarea
              value={response}
              onChange={(event) => setResponse(event.target.value)}
              placeholder="I was proud when..."
              maxLength={400}
              aria-label="Reflection response"
            />
            <span className="character-count">{response.length}/400</span>
          </div>
        )}

        {mode === "voice" && (
          <div className="voice-panel">
            <button className="voice-record" aria-label="Record voice reflection"><span /></button>
            <strong>Tap to record</strong>
            <p>Keep it short. Around 20 to 40 seconds is perfect.</p>
          </div>
        )}

        {mode === "photo" && (
          <div className="photo-panel">
            <div className="photo-icon">＋</div>
            <strong>Add a photo</strong>
            <p>Choose a photo that helps explain your reflection.</p>
          </div>
        )}

        <div className="reflection-tip"><span>✦</span><div><strong>Need a prompt?</strong><p>What did you notice? What choice did you make? Why did it work?</p></div></div>

        <button
          className="student-submit"
          disabled={mode === "text" && response.trim().length < 3}
          onClick={() => setSubmitted(true)}
        >
          {submitted ? "✓ Reflection submitted" : "Submit reflection"}
        </button>
        <button className="student-skip">Save and finish later</button>
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
