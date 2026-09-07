"use client";

import { ChangeEvent, useEffect, useMemo, useState } from "react";
import {
  loadClassStudents,
  loadPupilLearningContext,
  loadTeacherWorkspace,
  saveLiveEvidence,
  type LiveClass,
  type LiveStudent,
} from "../../../lib/sportfolio/live";
import "./session.css";

type Tag = { id: string; name: string; category: string };
type Workspace = { classes: LiveClass[]; tags: Tag[] };
type Attention = { student: LiveStudent; score: number; reason: string };
type QueueEntry = {
  id: string;
  classId: string;
  studentIds: string[];
  tagIds: string[];
  teacherNote: string;
  file: File | null;
  createdAt: string;
};

const DB_NAME = "sportfolio-session-capture";
const STORE = "pending";
const DB_VERSION = 1;

function openQueue() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(STORE)) req.result.createObjectStore(STORE, { keyPath: "id" });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error("Could not open offline queue."));
  });
}

async function putQueue(entry: QueueEntry) {
  const db = await openQueue();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    const req = tx.objectStore(STORE).put(entry);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
    tx.oncomplete = () => db.close();
  });
}

async function listQueue() {
  const db = await openQueue();
  return new Promise<QueueEntry[]>((resolve, reject) => {
    const tx = db.transaction(STORE, "readonly");
    const req = tx.objectStore(STORE).getAll();
    req.onsuccess = () => resolve((req.result as QueueEntry[]) ?? []);
    req.onerror = () => reject(req.error);
    tx.oncomplete = () => db.close();
  });
}

async function removeQueue(id: string) {
  const db = await openQueue();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    const req = tx.objectStore(STORE).delete(id);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
    tx.oncomplete = () => db.close();
  });
}

export default function SessionCapturePage() {
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [activeClass, setActiveClass] = useState<LiveClass | null>(null);
  const [students, setStudents] = useState<LiveStudent[]>([]);
  const [focusTags, setFocusTags] = useState<string[]>([]);
  const [activeTag, setActiveTag] = useState<string>("");
  const [selectedStudents, setSelectedStudents] = useState<string[]>([]);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [attention, setAttention] = useState<Attention[]>([]);
  const [online, setOnline] = useState(true);
  const [status, setStatus] = useState("Opening session…");
  const [saving, setSaving] = useState(false);
  const [queuedCount, setQueuedCount] = useState(0);
  const [savedCount, setSavedCount] = useState(0);

  useEffect(() => {
    setOnline(navigator.onLine);
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    loadTeacherWorkspace()
      .then(async (data) => {
        const w = data as Workspace;
        setWorkspace(w);
        const cls = w.classes[0] ?? null;
        setActiveClass(cls);
        if (!cls) {
          setStatus("Create a class before starting Session Capture.");
          return;
        }
        const list = await loadClassStudents(cls.id);
        setStudents(list);
        const remembered = localStorage.getItem(`sportfolio:session-focus:${cls.id}`);
        const ids = remembered ? JSON.parse(remembered) as string[] : w.tags.slice(0, 3).map((tag) => tag.id);
        setFocusTags(ids);
        setActiveTag(ids[0] ?? "");
        setStatus("Ready to capture.");
        void refreshAttention(list);
        setQueuedCount((await listQueue()).length);
      })
      .catch((error) => setStatus(error instanceof Error ? error.message : "Unable to open Session Capture."));
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, []);

  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);

  useEffect(() => {
    if (!online) return;
    void flushQueue();
  }, [online]);

  async function refreshAttention(list = students) {
    const rows = await Promise.all(list.map(async (student) => {
      try {
        const context = await loadPupilLearningContext(student.id);
        const latest = context.recentEvidence[0]?.occurred_at;
        const age = latest ? Math.floor((Date.now() - +new Date(latest)) / 86400000) : 999;
        const noDirection = !context.nextSteps.length && !context.activeGoals.length;
        const score = (context.evidenceCount === 0 ? 1000 : Math.min(age, 90) * 10) + (noDirection ? 25 : 0) - context.evidenceCount;
        const reason = context.evidenceCount === 0 ? "No evidence yet" : age > 21 ? `${age} days since evidence` : noDirection ? "No current learning direction" : `${age} days since evidence`;
        return { student, score, reason };
      } catch {
        return { student, score: 0, reason: "Needs review" };
      }
    }));
    setAttention(rows.sort((a, b) => b.score - a.score).slice(0, 4));
  }

  async function switchClass(classId: string) {
    const cls = workspace?.classes.find((item) => item.id === classId) ?? null;
    if (!cls || !workspace) return;
    setActiveClass(cls);
    setStatus("Loading class…");
    const list = await loadClassStudents(cls.id);
    setStudents(list);
    setSelectedStudents([]);
    const remembered = localStorage.getItem(`sportfolio:session-focus:${cls.id}`);
    const ids = remembered ? JSON.parse(remembered) as string[] : workspace.tags.slice(0, 3).map((tag) => tag.id);
    setFocusTags(ids);
    setActiveTag(ids[0] ?? "");
    setStatus("Ready to capture.");
    void refreshAttention(list);
  }

  function toggleFocus(id: string) {
    if (!activeClass) return;
    setFocusTags((current) => {
      const next = current.includes(id) ? current.filter((item) => item !== id) : current.length >= 5 ? current : [...current, id];
      localStorage.setItem(`sportfolio:session-focus:${activeClass.id}`, JSON.stringify(next));
      if (!next.includes(activeTag)) setActiveTag(next[0] ?? "");
      return next;
    });
  }

  function toggleStudent(id: string) {
    setSelectedStudents((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);
  }

  function chooseFile(event: ChangeEvent<HTMLInputElement>) {
    const next = event.target.files?.[0] ?? null;
    if (preview) URL.revokeObjectURL(preview);
    setFile(next);
    setPreview(next ? URL.createObjectURL(next) : null);
    event.target.value = "";
  }

  async function saveCapture() {
    if (!activeClass) return;
    if (!selectedStudents.length) {
      setStatus("Tap at least one pupil before saving.");
      return;
    }
    if (!activeTag) {
      setStatus("Choose one learning focus for this moment.");
      return;
    }
    setSaving(true);
    const id = `session:${activeClass.id}:${crypto.randomUUID()}`;
    const entry: QueueEntry = {
      id,
      classId: activeClass.id,
      studentIds: selectedStudents,
      tagIds: [activeTag],
      teacherNote: note.trim(),
      file,
      createdAt: new Date().toISOString(),
    };
    try {
      if (!navigator.onLine) {
        await putQueue(entry);
        setQueuedCount((count) => count + 1);
        setStatus("Saved safely on this iPad. It will upload when connection returns.");
      } else {
        await saveLiveEvidence({
          classId: entry.classId,
          studentIds: entry.studentIds,
          tagIds: entry.tagIds,
          teacherNote: entry.teacherNote,
          file: entry.file,
          title: "Session capture",
        });
        setSavedCount((count) => count + 1);
        setStatus("Saved privately. Keep teaching.");
      }
      if (navigator.vibrate) navigator.vibrate(35);
      clearMoment();
      void refreshAttention();
    } catch (error) {
      await putQueue(entry);
      setQueuedCount((await listQueue()).length);
      setStatus(`Upload failed, but this moment is safe on this iPad. ${error instanceof Error ? error.message : ""}`);
    } finally {
      setSaving(false);
    }
  }

  function clearMoment() {
    if (preview) URL.revokeObjectURL(preview);
    setPreview(null);
    setFile(null);
    setSelectedStudents([]);
    setNote("");
  }

  async function flushQueue() {
    const entries = await listQueue();
    if (!entries.length) return;
    setStatus(`Connection restored. Uploading ${entries.length} saved moment${entries.length === 1 ? "" : "s"}…`);
    for (const entry of entries) {
      try {
        await saveLiveEvidence({
          classId: entry.classId,
          studentIds: entry.studentIds,
          tagIds: entry.tagIds,
          teacherNote: entry.teacherNote,
          file: entry.file,
          title: "Session capture",
        });
        await removeQueue(entry.id);
      } catch {
        break;
      }
    }
    const remaining = await listQueue();
    setQueuedCount(remaining.length);
    setStatus(remaining.length ? `${remaining.length} moment${remaining.length === 1 ? "" : "s"} still queued safely.` : "All queued evidence uploaded securely.");
    if (!remaining.length) void refreshAttention();
  }

  const focus = useMemo(() => workspace?.tags.filter((tag) => focusTags.includes(tag.id)) ?? [], [workspace, focusTags]);
  const others = useMemo(() => workspace?.tags.filter((tag) => !focusTags.includes(tag.id)) ?? [], [workspace, focusTags]);

  if (!workspace) return <main className="session-loading">{status}</main>;

  return <main className="session-shell">
    <header className="session-topbar">
      <a href="/live">← Sportfolio</a>
      <div className="session-title"><small>SESSION CAPTURE</small><strong>{activeClass?.name ?? "No class"}</strong></div>
      <div className="session-state"><span className={online ? "online" : "offline"}>{online ? "● Online" : "● Offline"}</span><span>{queuedCount ? `${queuedCount} queued` : `${savedCount} saved`}</span></div>
    </header>

    <section className="session-context">
      <label>Class<select value={activeClass?.id ?? ""} onChange={(e) => void switchClass(e.target.value)}>{workspace.classes.map((cls) => <option key={cls.id} value={cls.id}>{cls.name}</option>)}</select></label>
      <div><small>ACTIVITY</small><strong>{activeClass?.activity || "General PE"}</strong></div>
      <div className="focus-strip"><small>TODAY'S FOCUS</small><div>{focus.map((tag) => <button key={tag.id} className={activeTag === tag.id ? "active" : ""} onClick={() => setActiveTag(tag.id)}>{tag.name}</button>)}</div></div>
      <details><summary>Edit focuses</summary><div className="focus-picker">{[...focus, ...others].map((tag) => <button key={tag.id} className={focusTags.includes(tag.id) ? "selected" : ""} onClick={() => toggleFocus(tag.id)}>{tag.name}</button>)}</div></details>
    </section>

    <div className="session-workspace">
      <section className="capture-stage">
        <div className={`capture-viewport ${preview ? "has-media" : ""}`}>
          {preview && file?.type.startsWith("image/") && <img src={preview} alt="Evidence preview" />}
          {preview && file?.type.startsWith("video/") && <video src={preview} controls playsInline />}
          {!preview && <div className="capture-empty"><span>◎</span><h1>Notice the moment.</h1><p>Capture only what helps you remember the learning.</p></div>}
        </div>
        <div className="capture-actions">
          <label className="capture-primary">Photo<input type="file" accept="image/*" capture="environment" onChange={chooseFile} /></label>
          <label>5–10s clip<input type="file" accept="video/*" capture="environment" onChange={chooseFile} /></label>
          <button onClick={() => { if (preview) URL.revokeObjectURL(preview); setPreview(null); setFile(null); }}>Observation only</button>
        </div>
        <label className="quick-note">Optional quick note<input value={note} onChange={(e) => setNote(e.target.value)} placeholder="What did you notice?" /></label>
        <div className="attention-card">
          <div><small>ATTENTION ENGINE</small><strong>Who deserves a look next?</strong></div>
          <div className="attention-list">{attention.map((item) => <button key={item.student.id} onClick={() => toggleStudent(item.student.id)}><b>{item.student.first_name}</b><span>{item.reason}</span></button>)}</div>
        </div>
      </section>

      <section className="pupil-stage">
        <div className="pupil-head"><div><small>2. PUPILS</small><h2>Tap who was involved</h2></div><span>{selectedStudents.length} selected</span></div>
        <div className="pupil-grid">{students.map((student) => <button key={student.id} className={selectedStudents.includes(student.id) ? "selected" : ""} onClick={() => toggleStudent(student.id)}><span>{student.first_name.slice(0, 1)}{student.last_name?.slice(0, 1) ?? ""}</span><strong>{student.first_name}</strong><small>{student.last_name ?? student.grade ?? ""}</small></button>)}</div>
        <div className="save-dock">
          <div><small>LEARNING</small><strong>{focus.find((tag) => tag.id === activeTag)?.name ?? "Choose focus"}</strong><p>{status}</p></div>
          <button disabled={saving || !selectedStudents.length || !activeTag} onClick={() => void saveCapture()}>{saving ? "Saving…" : online ? "Save evidence" : "Save offline"}</button>
        </div>
      </section>
    </div>
  </main>;
}
