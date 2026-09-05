import { supabase } from "../supabase/client";
import { loadPupilPortfolio, requireUser, type LiveStudent } from "./live";

export type LearningTrajectoryEntry = {
  id: string;
  source_item_id: string;
  suggested_body: string | null;
  final_body: string;
  status: "accepted" | "edited" | "ignored" | "completed";
  created_at: string;
  evidence: {
    title: string | null;
    teacher_note: string | null;
    occurred_at: string;
    class_name: string | null;
    tags: string[];
  } | null;
};

export type LearningTrajectory = {
  student: LiveStudent;
  currentNextStep: string | null;
  currentGoal: string | null;
  evidenceCount: number;
  entries: LearningTrajectoryEntry[];
};

export async function loadLearningTrajectory(studentId: string): Promise<LearningTrajectory> {
  await requireUser();
  const portfolio = await loadPupilPortfolio(studentId);

  const { data: steps, error: stepsError } = await supabase
    .from("sportfolio_next_steps")
    .select("id,source_item_id,suggested_body,final_body,status,created_at")
    .eq("student_id", studentId)
    .order("created_at", { ascending: false });
  if (stepsError) throw stepsError;

  const sourceIds = [...new Set((steps ?? []).map((step) => step.source_item_id).filter(Boolean))];
  const evidenceMap = new Map<string, LearningTrajectoryEntry["evidence"]>();

  if (sourceIds.length) {
    const { data: items, error: itemsError } = await supabase
      .from("sportfolio_items")
      .select("id,title,teacher_note,occurred_at,sportfolio_classes(name)")
      .in("id", sourceIds);
    if (itemsError) throw itemsError;

    const { data: tagLinks, error: tagError } = await supabase
      .from("sportfolio_item_tags")
      .select("item_id,sportfolio_tags(name)")
      .in("item_id", sourceIds);
    if (tagError) throw tagError;

    const tagMap = new Map<string, string[]>();
    for (const row of tagLinks ?? []) {
      const name = (row as any).sportfolio_tags?.name;
      if (name) tagMap.set(row.item_id, [...(tagMap.get(row.item_id) ?? []), name]);
    }

    for (const item of items ?? []) {
      evidenceMap.set(item.id, {
        title: item.title,
        teacher_note: item.teacher_note,
        occurred_at: item.occurred_at,
        class_name: (item as any).sportfolio_classes?.name ?? null,
        tags: tagMap.get(item.id) ?? [],
      });
    }
  }

  return {
    student: portfolio.student,
    currentNextStep: portfolio.currentNextStep,
    currentGoal: portfolio.currentGoal,
    evidenceCount: portfolio.evidenceCount,
    entries: (steps ?? []).map((step) => ({
      id: step.id,
      source_item_id: step.source_item_id,
      suggested_body: step.suggested_body,
      final_body: step.final_body,
      status: step.status as LearningTrajectoryEntry["status"],
      created_at: step.created_at,
      evidence: evidenceMap.get(step.source_item_id) ?? null,
    })),
  };
}
