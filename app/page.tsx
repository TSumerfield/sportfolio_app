"use client";

import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase/client";
import "./landing.css";

export default function Home() {
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function routeExistingSession() {
      const { data } = await supabase.auth.getSession();
      const user = data.session?.user;
      if (!user) {
        if (!cancelled) setChecking(false);
        return;
      }

      const [{ data: student }, { data: teacherClass }] = await Promise.all([
        supabase.from("sportfolio_students").select("id").eq("auth_user_id", user.id).maybeSingle(),
        supabase.from("sportfolio_classes").select("id").eq("teacher_user_id", user.id).limit(1).maybeSingle(),
      ]);
      if (cancelled) return;

      if (student) window.location.replace("/student");
      else if (teacherClass) window.location.replace("/live");
      else setChecking(false);
    }
    routeExistingSession();
    return () => { cancelled = true; };
  }, []);

  if (checking) {
    return <main style={{minHeight:"100vh",display:"grid",placeItems:"center",background:"#f5f2e8",color:"#123f32",fontFamily:"Manrope,Arial"}}>Opening Sportfolio…</main>;
  }

  const strip = ["Capture courtside","Tag pupils fast","Map learning","Save privately","Request reflection","Build progress history"];

  return (
    <main className="landing">
      <nav className="land-nav" aria-label="Main navigation">
        <a href="#top" className="land-brand" aria-label="Sportfolio home">
          <span className="land-mark">S</span>
          SPORTFOLIO
        </a>
        <div className="land-navlinks">
          <a href="#how">How it works</a>
          <a href="#privacy">Privacy</a>
          <a href="#why">Why Sportfolio</a>
          <a href="#how" className="land-nav-cta">Explore the build</a>
        </div>
      </nav>

      <section className="land-hero" id="top">
        <div>
          <div className="land-kicker">Built for PE, not adapted to it</div>
          <h1>Make learning in movement <em>visible.</em></h1>
          <p className="land-lead">Capture the moment. Tag the pupils. Connect it to learning. Build a private evidence record that gets more useful every lesson.</p>
          <div className="land-actions">
            <a className="land-primary" href="#how">Explore the build <span>↓</span></a>
            <a className="land-secondary" href="#why">Why Sportfolio</a>
          </div>
          <div className="land-proof">
            <span><b>Private</b> by default</span>
            <span><b>iPad</b> first</span>
            <span><b>10s</b> pilot video</span>
          </div>
        </div>

        <div className="product-scene" aria-label="Sportfolio Capture Studio preview">
          <div className="device">
            <div className="device-screen">
              <div className="demo-top">
                <div className="demo-brand"><span className="demo-dot">S</span> SPORTFOLIO</div>
                <div className="demo-status">CAPTURE STUDIO · YEAR 7 PE</div>
              </div>
              <div className="demo-workspace">
                <div className="demo-media">
                  <div className="demo-frame">
                    <div className="demo-live"><i/> LIVE CAPTURE</div>
                    <div className="demo-time">00:07 / 00:10</div>
                  </div>
                  <div className="demo-controls"><span className="demo-control">PHOTO</span><span className="demo-record"/><span className="demo-control">VIDEO</span></div>
                </div>
                <div className="demo-panel">
                  <div className="demo-section">
                    <div className="demo-label">1. Pupils <span>3 selected</span></div>
                    <div className="demo-pupils">
                      <span className="demo-pupil selected">Maya</span><span className="demo-pupil">Leo</span><span className="demo-pupil selected">Aria</span><span className="demo-pupil">Noah</span><span className="demo-pupil selected">Iris</span><span className="demo-pupil">Max</span>
                    </div>
                  </div>
                  <div className="demo-section">
                    <div className="demo-label">2. Learning <span>2 tags</span></div>
                    <div className="demo-tags"><span className="demo-tag on">Decision making</span><span className="demo-tag">Technique</span><span className="demo-tag on">Movement</span><span className="demo-tag">Teamwork</span></div>
                  </div>
                  <div className="demo-save">SAVE EVIDENCE</div>
                </div>
              </div>
            </div>
          </div>
          <div className="scene-note one"><b>Designed for &lt;30 sec</b>capture → pupils → learning → save</div>
          <div className="scene-note two"><b>1 moment</b>can belong to multiple pupils</div>
        </div>
      </section>

      <div className="land-strip" aria-hidden="true"><div className="land-strip-inner">{[...strip,...strip].map((x,i)=><span key={i}>{x} <b>✦</b></span>)}</div></div>

      <section className="land-section" id="why">
        <div className="land-section-head">
          <div><div className="land-kicker">The problem</div><h2>PE creates evidence everywhere. Most of it disappears.</h2></div>
          <p>Great learning happens quickly, physically and away from a desk. Generic portfolio tools force teachers to slow the lesson down, upload later, or lose the moment entirely.</p>
        </div>
        <div className="problem-grid">
          <article className="problem"><div className="problem-num">01 / COURTSIDE</div><h3>Capture without leaving the lesson.</h3><p>Sportfolio is designed around an 11-inch iPad in landscape, large touch targets and a flow a teacher can complete while pupils keep moving.</p></article>
          <article className="problem"><div className="problem-num">02 / OWNERSHIP</div><h3>One clip. The right pupils.</h3><p>Tag several pupils to the same moment instead of duplicating uploads, then connect evidence to the learning that actually matters.</p></article>
          <article className="problem"><div className="problem-num">03 / PROGRESS</div><h3>Stop collecting. Start building history.</h3><p>Every saved observation adds to a pupil's learning trajectory, reflection history and future next-step context rather than becoming another forgotten file.</p></article>
        </div>
      </section>

      <section className="flow-wrap" id="how">
        <div className="land-section">
          <div className="land-section-head">
            <div><div className="land-kicker">The courtside loop</div><h2>Five actions. One useful learning record.</h2></div>
            <p>The workflow is intentionally narrow. No dashboard detour, no folder hunting, no post-lesson admin ritual.</p>
          </div>
          <div className="flow">
            <article className="flow-step"><div className="flow-icon">01</div><h3>Capture</h3><p>Take a photo, short video, audio note or observation at the moment learning happens.</p><span className="flow-time">In lesson</span></article>
            <article className="flow-step"><div className="flow-icon">02</div><h3>Tag pupils</h3><p>Select everyone the evidence belongs to with fast multi-pupil touch selection.</p><span className="flow-time">One tap each</span></article>
            <article className="flow-step"><div className="flow-icon">03</div><h3>Tag learning</h3><p>Connect the moment to outcomes, behaviours or curriculum learning tags.</p><span className="flow-time">Structured</span></article>
            <article className="flow-step"><div className="flow-icon">04</div><h3>Save privately</h3><p>Evidence is stored against the right pupil records with private media access.</p><span className="flow-time">Secure</span></article>
            <article className="flow-step"><div className="flow-icon">05</div><h3>Reflect & improve</h3><p>Request pupil reflection, review the evidence and build the next learning step.</p><span className="flow-time">Compounds</span></article>
          </div>
        </div>
      </section>

      <section className="land-section privacy" id="privacy">
        <div className="privacy-art" aria-hidden="true"><div className="vault"><div className="vault-ring"><div className="vault-core">S</div></div></div></div>
        <div className="privacy-copy">
          <div className="land-kicker">Safeguarding first</div>
          <h2>A pupil portfolio should not behave like social media.</h2>
          <p>Sportfolio starts from the opposite assumption: pupil evidence is private unless an authorised school workflow needs it. The product is being built around secure authentication, row-level access controls and private media storage.</p>
          <div className="privacy-list">
            <div className="privacy-item"><b>✓</b><span><strong>Private media.</strong> No public pupil gallery or open media URLs.</span></div>
            <div className="privacy-item"><b>✓</b><span><strong>Scoped access.</strong> Teachers and pupils see the records their role permits.</span></div>
            <div className="privacy-item"><b>✓</b><span><strong>No pupil-to-pupil browsing.</strong> A portfolio is evidence for learning, not a social feed.</span></div>
            <div className="privacy-item"><b>✓</b><span><strong>Pilot constraints are deliberate.</strong> Short video and limited classes keep the first release controlled while the workflow is proven.</span></div>
          </div>
        </div>
      </section>

      <section className="intelligence">
        <div>
          <div className="land-kicker">Where this compounds</div>
          <h2>Evidence becomes useful when it remembers.</h2>
          <p>Sportfolio is not being built as a camera roll with pupil names. Over time, structured evidence can reveal outcome coverage, reflection patterns, progress trajectories and teacher-confirmed next steps, giving each new lesson more context than the last.</p>
        </div>
        <div className="trajectory" aria-label="Illustrative pupil progress trajectory">
          <div className="trajectory-top"><h3>Maya · Movement confidence</h3><span>6 EVIDENCE POINTS</span></div>
          <div className="trajectory-chart"/>
          <div className="next-step"><small>Teacher-confirmed next step</small><strong>Apply the same movement quality under greater defensive pressure.</strong></div>
        </div>
      </section>

      <section className="pilot">
        <div><div className="land-kicker">Sportfolio build</div><h2>Built by a PE teacher for the reality of PE.</h2><p>Sportfolio is still in active build. This public page shows the direction and workflow while pupil data remains behind the private product layer.</p></div>
        <a href="#top" className="land-primary">Back to top</a>
      </section>

      <footer className="land-footer"><span><strong>SPORTFOLIO</strong> · Private PE evidence portfolios</span><span>Build phase · 2026</span></footer>
    </main>
  );
}
