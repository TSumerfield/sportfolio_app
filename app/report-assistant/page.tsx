"use client";

import "./report-assistant.css";
import { useState } from "react";

// Acquisition surface: deliberately deterministic and zero-login. Teacher judgement remains the source data.

function clean(v:string){return v.trim().replace(/[.]+$/,"");}

export default function ReportAssistant(){
 const [out,setOut]=useState("");
 function submit(e:React.FormEvent<HTMLFormElement>){
  e.preventDefault();
  const f=new FormData(e.currentTarget);
  const unit=clean(String(f.get("unit")||"PE"));
  const level=String(f.get("level")||"secure");
  const strength=clean(String(f.get("strength")||""));
  const next=clean(String(f.get("next")||""));
  const map:{[k:string]:string}={emerging:"is beginning to develop",developing:"is developing",secure:"demonstrates secure",advanced:"demonstrates confident and increasingly sophisticated"};
  const text="In "+unit+", the pupil "+map[level]+" understanding and performance. "+(strength ? "A particular strength is "+strength.charAt(0).toLowerCase()+strength.slice(1)+". " : "")+(next ? "The next step is to "+next.charAt(0).toLowerCase()+next.slice(1)+". " : "")+"Continued practice and reflection should help transfer this learning into increasingly challenging situations.";
  setOut(text);
  try{(window as any).posthog?.capture?.("report_assistant_generated",{unit,level});}catch{}
 }
 return <main className="tool-page"><div className="tool-wrap">
  <div className="tool-brand"><a href="/">SPORTFOLIO</a> · Free PE teacher tool</div>
  <section className="tool-hero"><div className="tool-kicker">PE REPORT ASSISTANT</div><h1>Turn teacher judgement into a clear PE report comment.</h1><p className="tool-lead">Add the learning context, attainment and the evidence you have already observed. Get a concise draft you can edit. No pupil name required and nothing entered here is saved by this tool.</p></section>
  <form className="report-form" onSubmit={submit}>
   <div className="field"><label>Unit or learning context</label><input name="unit" placeholder="e.g. Volleyball, invasion games, swimming" required /></div>
   <div className="field"><label>Current attainment</label><select name="level" defaultValue="secure"><option value="emerging">Emerging</option><option value="developing">Developing</option><option value="secure">Secure</option><option value="advanced">Advanced</option></select></div>
   <div className="field"><label>Observed strength</label><textarea name="strength" placeholder="e.g. selecting space well and communicating effectively in small-sided games" required /></div>
   <div className="field"><label>Next learning step</label><textarea name="next" placeholder="e.g. make earlier decisions when pressure increases" required /></div>
   <button className="tool-button" type="submit">Draft my comment →</button>
   <p className="tool-note">Use professional judgement before placing any generated wording into a school report. This tool structures your observation; it does not assess the pupil.</p>
  </form>
  <section className={"report-output "+(out?"show":"")} aria-live="polite"><div className="tool-kicker">DRAFT</div><p className="report-copy">{out}</p><div className="tool-next"><strong>Doing this across a whole class?</strong><p>Sportfolio is being built to turn evidence captured during PE into usable progress and reporting context, without recreating observations later.</p><a href="/login?signin=1" onClick={()=>{try{(window as any).posthog?.capture?.("report_assistant_handoff");}catch{}}}>Explore Sportfolio →</a></div></section>
 </div></main>
}