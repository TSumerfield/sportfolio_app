import type { NextStepDecision } from "./coverage-save";

const DB_NAME = "sportfolio-courtside";
const DB_VERSION = 1;
const STORE = "evidence-queue";

export type QueuedEvidence = {
  id: string;
  classId: string;
  studentId: string;
  tagIds: string[];
  title?: string;
  teacherNote?: string;
  previousNextStep?: string | null;
  nextStep?: string;
  nextStepDecision: NextStepDecision;
  requestReflection?: boolean;
  file?: File | null;
  createdAt: string;
  status: "draft" | "queued" | "failed";
  error?: string | null;
};

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE, { keyPath: "id" });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("Could not open the local evidence queue."));
  });
}

async function transact<T>(mode: IDBTransactionMode, work: (store: IDBObjectStore, resolve: (value: T) => void, reject: (reason?: unknown) => void) => void): Promise<T> {
  const db = await openDb();
  return new Promise<T>((resolve, reject) => {
    const tx = db.transaction(STORE, mode);
    work(tx.objectStore(STORE), resolve, reject);
    tx.oncomplete = () => db.close();
    tx.onerror = () => { db.close(); reject(tx.error ?? new Error("Local evidence queue failed.")); };
  });
}

export async function putQueuedEvidence(entry: QueuedEvidence) {
  return transact<void>("readwrite", (store, resolve, reject) => {
    const request = store.put(entry);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

export async function getQueuedEvidence(id: string) {
  return transact<QueuedEvidence | null>("readonly", (store, resolve, reject) => {
    const request = store.get(id);
    request.onsuccess = () => resolve((request.result as QueuedEvidence | undefined) ?? null);
    request.onerror = () => reject(request.error);
  });
}

export async function listQueuedEvidence() {
  return transact<QueuedEvidence[]>("readonly", (store, resolve, reject) => {
    const request = store.getAll();
    request.onsuccess = () => resolve((request.result as QueuedEvidence[]).sort((a, b) => a.createdAt.localeCompare(b.createdAt)));
    request.onerror = () => reject(request.error);
  });
}

export async function removeQueuedEvidence(id: string) {
  return transact<void>("readwrite", (store, resolve, reject) => {
    const request = store.delete(id);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

export function queueKey(classId: string, studentId: string) {
  return `capture:${classId}:${studentId}`;
}
