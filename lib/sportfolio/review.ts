import { supabase } from "../supabase/client";
import { requireUser, type LiveClass, type LiveStudent } from "./live";

export type ReviewPupil = LiveStudent & { currentNextStep: string | null };
export type ReviewItem = {
  id: string;
  classId: string;
  className: string;
  title: string | null;
  teacherNote: string | null;
  occurredAt: string;
  tags: string[];
  pupils: ReviewPupil[];
  media: { id: string; mediaType: "image" | "video" | "audio"; signedUrl: string | null }[];
};

export type ReviewWorkspace = { classes: LiveClass[]; items: ReviewItem[] };
export type ReviewDecision = "keep" | "refine" | "complete" | "replace";

export async function loadPostLessonReview(classId?: string): Promise<ReviewWorkspace> {
  const user = await requireUser();
  const { data: classes, error: classError } = await supabase.from("sportfolio_classes").select("id,name,academic_year,activity").eq("teacher_user_id", user.id).order("name");
  if (classError) throw classError;
  const classRows = (classes ?? []) as LiveClass[];
  const targetIds = classId ? classRows.filter((row) => row.id === classId).map((row) => row.id) : classRows.map((row) => row.id);
  if (!targetIds.length) return { classes: classRows, items: [] };

  const since = new Date(Date.now() - 1000 * 60 * 60 * 36).toISOString();
  const { data: items, error: itemError } = await supabase.from("sportfolio_items").select("id,class_id,title,teacher_note,occurred_at,sportfolio_classes(name)").eq("author_user_id", user.id).in("class_id", targetIds).gte("occurred_at", since).order("occurred_at", { ascending: false }).limit(60);
  if (itemError) throw itemError;
  const ids = (items ?? []).map((item) => item.id);
  if (!ids.length) return { classes: classRows, items: [] };

  const [pupilLinks, tagLinks, mediaRows, decisionRows] = await Promise.all([
    supabase.from("sportfolio_item_students").select("item_id,student_id,sportfolio_students(id,first_name,last_name,grade)").in("item_id", ids),
    supabase.from("sportfolio_item_tags").select("item_id,sportfolio_tags(name)").in("item_id", ids),
    supabase.from("sportfolio_media").select("id,item_id,storage_path,media_type").in("item_id", ids),
    supabase.from("sportfolio_next_steps").select("source_item_id,student_id,status,final_body,created_at").in("source_item_id", ids).order("created_at", { ascending: false }),
  ]);
  if (pupilLinks.error) throw pupilLinks.error;
  if (tagLinks.error) throw tagLinks.error;
  if (mediaRows.error) throw mediaRows.error;
  if (decisionRows.error) throw decisionRows.error;

  const pupilIds = [...new Set((pupilLinks.data ?? []).map((row) => row.student_id))];
  const { data: latestSteps, error: latestError } = pupilIds.length ? await supabase.from("sportfolio_next_steps").select("student_id,final_body,status,created_at").in("student_id", pupilIds).neq("status", "ignored").order("created_at", { ascending: false }) : { data: [], error: null };
  if (latestError) throw latestError;
  const latestMap = new Map<string, string>();
  for (const step of latestSteps ?? []) if (!latestMap.has(step.student_id) && step.status !== "completed") latestMap.set(step.student_id, step.final_body);

  const reviewed = new Set((decisionRows.data ?? []).map((row) => `${row.source_item_id}:${row.student_id}`));
  const pupilMap = new Map<string, ReviewPupil[]>();
  for (const row of pupilLinks.data ?? []) {
    if (reviewed.has(`${row.item_id}:${row.student_id}`)) continue;
    const pupil = (row as any).sportfolio_students as LiveStudent | null;
    if (!pupil) continue;
    pupilMap.set(row.item_id, [...(pupilMap.get(row.item_id) ?? []), { ...pupil, currentNextStep: latestMap.get(pupil.id) ?? null }]);
  }
  const tagMap = new Map<string, string[]>();
  for (const row of tagLinks.data ?? []) {
    const name = (row as any).sportfolio_tags?.name;
    if (name) tagMap.set(row.item_id, [...(tagMap.get(row.item_id) ?? []), name]);
  }

  const media = mediaRows.data ?? [];
  const signedMap = new Map<string, string | null>();
  if (media.length) {
    const paths = media.map((row) => row.storage_path);
    const { data: signed, error } = await supabase.storage.from("sportfolio-media").createSignedUrls(paths, 60 * 20);
    if (error) throw error;
    signed?.forEach((entry, index) => signedMap.set(paths[index], entry.signedUrl ?? null));
  }
  const mediaMap = new Map<string, ReviewItem["media"]>();
  for (const row of media) mediaMap.set(row.item_id, [...(mediaMap.get(row.item_id) ?? []), { id: row.id, mediaType: row.media_type as ReviewItem["media"][number]["mediaType"], signedUrl: signedMap.get(row.storage_path) ?? null }]);

  return {
    classes: classRows,
    items: (items ?? []).map((item: any) => ({ id: item.id, classId: item.class_id, className: item.sportfolio_classes?.name ?? "Class", title: item.title, teacherNote: item.teacher_note, occurredAt: item.occurred_at, tags: tagMap.get(item.id) ?? [], pupils: pupilMap.get(item.id) ?? [], media: mediaMap.get(item.id) ?? [] })).filter((item) => item.pupils.length > 0),
  };
}

export async function saveReviewDecision(input: { itemId: string; studentId: string; previousNextStep: string | null; decision: ReviewDecision; finalBody?: string }) {
  const user = await requireUser();
  const previous = input.previousNextStep?.trim() || "";
  const finalBody = input.decision === "keep" ? previous : input.finalBody?.trim() || "";
  if (input.decision !== "complete" && finalBody.length < 3) throw new Error("Add a clear next learning step.");
  const status = input.decision === "keep" ? "accepted" : input.decision === "complete" ? "completed" : "edited";
  const body = input.decision === "complete" ? (previous || "Learning focus completed") : finalBody;
  const { data, error } = await supabase.from("sportfolio_next_steps").insert({ student_id: input.studentId, source_item_id: input.itemId, suggested_body: previous || null, final_body: body, status, created_by: user.id }).select("id").single();
  if (error) throw error;
  await supabase.from("sportfolio_audit_log").insert({ actor_user_id: user.id, action: `post_lesson_${input.decision}`, entity_type: "sportfolio_next_step", entity_id: data.id });
  return data.id as string;
}
