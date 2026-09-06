import { saveCoverageEvidence, type NextStepDecision } from "./coverage-save";
import { putQueuedEvidence, removeQueuedEvidence, type QueuedEvidence } from "./offline-queue";

export type ResilientEvidenceInput = {
  queueId: string;
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
};

function queued(input: ResilientEvidenceInput, status: QueuedEvidence["status"], error?: string | null): QueuedEvidence {
  return { ...input, id: input.queueId, createdAt: new Date().toISOString(), status, error: error ?? null };
}

export async function persistEvidenceDraft(input: ResilientEvidenceInput) {
  await putQueuedEvidence(queued(input, "draft"));
}

export async function saveEvidenceResilient(input: ResilientEvidenceInput): Promise<{ kind: "saved"; itemId: string } | { kind: "queued" }> {
  if (typeof navigator !== "undefined" && !navigator.onLine) {
    await putQueuedEvidence(queued(input, "queued"));
    return { kind: "queued" };
  }
  try {
    const itemId = await saveCoverageEvidence(input);
    await removeQueuedEvidence(input.queueId);
    return { kind: "saved", itemId };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Save failed.";
    await putQueuedEvidence(queued(input, "failed", message));
    throw error;
  }
}

export async function retryQueuedEvidence(entry: QueuedEvidence) {
  if (typeof navigator !== "undefined" && !navigator.onLine) return null;
  const itemId = await saveCoverageEvidence(entry);
  await removeQueuedEvidence(entry.id);
  return itemId;
}
