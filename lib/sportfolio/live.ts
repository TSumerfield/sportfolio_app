import { supabase } from "../supabase/client";

export type LiveStudent = { id: string; first_name: string; last_name: string | null; grade: string | null; };
export type LiveClass = { id: string; name: string; academic_year: string; activity: string | null; pupil_count?: number; };
export type PupilGoal = { id: string; body: string; status: "not_started" | "working_on_it" | "achieved"; target_date: string | null };
export type PupilLearningContext = {
  evidenceCount: number;
  recentEvidence: { id: string; title: string | null; teacher_note: string | null; occurred_at: string; tags: string[] }[];
  nextSteps: { id: string; final_body: string; status: string; created_at: string }[];
  activeGoals: PupilGoal[];
};
export type PupilPortfolioItem = {
  id: string;
  title: string | null;
  teacher_note: string | null;
  student_feedback: string | null;
  occurred_at: string;
  class_name: string | null;
  tags: string[];
  media: { id: string; media_type: "image" | "video" | "audio"; signed_url: string | null }[];
  reflection: {
    id: string;
    prompt: string | null;
    text_response: string | null;
    voice_storage_path: string | null;
    voice_signed_url: string | null;
    submitted_at: string | null;
    reviewed_at: string | null;
  } | null;
  next_step: string | null;
};
export type PupilPortfolio = {
  student: LiveStudent;
  evidenceCount: number;
  items: PupilPortfolioItem[];
  currentNextStep: string | null;
  currentGoal: string | null;
  goals: PupilGoal[];
};

export async function requireUser() {
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) throw new Error("Please sign in to Sportfolio first.");
  return data.user;
}

export async function loadTeacherWorkspace() {
  const user = await requireUser();
  const { data: classes, error: classesError } = await supabase.from("sportfolio_classes").select("id,name,academic_year,activity").eq("teacher_user_id", user.id).order("name");
  if (classesError) throw classesError;

  const classRows = (classes ?? []) as LiveClass[];
  if (!classRows.length) return { user, classes: [] as LiveClass[], activeClass: undefined, students: [] as LiveStudent[], tags: [] };

  const classIds = classRows.map((item) => item.id);
  const { data: memberships, error: membershipError } = await supabase.from("sportfolio_class_memberships").select("class_id,student_id").in("class_id", classIds);
  if (membershipError) throw membershipError;
  const counts = new Map<string, number>();
  for (const row of memberships ?? []) counts.set(row.class_id, (counts.get(row.class_id) ?? 0) + 1);
  const classesWithCounts = classRows.map((item) => ({ ...item, pupil_count: counts.get(item.id) ?? 0 }));

  const activeClass = classesWithCounts[0];
  const students = await loadClassStudents(activeClass.id);
  const { data: tags, error: tagsError } = await supabase.from("sportfolio_tags").select("id,name,category").order("category").order("name");
  if (tagsError) throw tagsError;
  return { user, classes: classesWithCounts, activeClass, students, tags: tags ?? [] };
}

export async function loadClassStudents(classId: string): Promise<LiveStudent[]> {
  await requireUser();
  const { data: memberships, error } = await supabase.from("sportfolio_class_memberships").select("student_id,sportfolio_students(id,first_name,last_name,grade)").eq("class_id", classId);
  if (error) throw error;
  return (memberships ?? []).map((row: any) => row.sportfolio_students).filter(Boolean).sort((a: LiveStudent, b: LiveStudent) => `${a.last_name ?? ""}${a.first_name}`.localeCompare(`${b.last_name ?? ""}${b.first_name}`));
}

export async function loadPupilLearningContext(studentId: string): Promise<PupilLearningContext> {
  await requireUser();
  const { data: links, error: linksError } = await supabase.from("sportfolio_item_students").select("item_id").eq("student_id", studentId);
  if (linksError) throw linksError;
  const itemIds = (links ?? []).map((row) => row.item_id);
  let recentEvidence: PupilLearningContext["recentEvidence"] = [];
  if (itemIds.length) {
    const { data: items, error: itemsError } = await supabase.from("sportfolio_items").select("id,title,teacher_note,occurred_at").in("id", itemIds).order("occurred_at", { ascending: false }).limit(5);
    if (itemsError) throw itemsError;
    const recentIds = (items ?? []).map((item) => item.id);
    const tagMap = new Map<string, string[]>();
    if (recentIds.length) {
      const { data: tagLinks, error: tagLinksError } = await supabase.from("sportfolio_item_tags").select("item_id,sportfolio_tags(name)").in("item_id", recentIds);
      if (tagLinksError) throw tagLinksError;
      for (const row of tagLinks ?? []) {
        const tag = (row as any).sportfolio_tags?.name;
        if (!tag) continue;
        tagMap.set(row.item_id, [...(tagMap.get(row.item_id) ?? []), tag]);
      }
    }
    recentEvidence = (items ?? []).map((item) => ({ ...item, tags: tagMap.get(item.id) ?? [] }));
  }
  const { data: nextSteps, error: nextStepsError } = await supabase.from("sportfolio_next_steps").select("id,final_body,status,created_at").eq("student_id", studentId).neq("status", "ignored").order("created_at", { ascending: false }).limit(5);
  if (nextStepsError) throw nextStepsError;
  const { data: goals, error: goalsError } = await supabase.from("sportfolio_goals").select("id,body,status,target_date").eq("student_id", studentId).neq("status", "achieved").order("created_at", { ascending: false }).limit(5);
  if (goalsError) throw goalsError;
  return { evidenceCount: itemIds.length, recentEvidence, nextSteps: nextSteps ?? [], activeGoals: (goals ?? []) as PupilGoal[] };
}

export async function loadPupilPortfolio(studentId: string): Promise<PupilPortfolio> {
  await requireUser();
  const { data: student, error: studentError } = await supabase.from("sportfolio_students").select("id,first_name,last_name,grade").eq("id", studentId).single();
  if (studentError) throw studentError;

  const { data: links, error: linksError } = await supabase.from("sportfolio_item_students").select("item_id").eq("student_id", studentId);
  if (linksError) throw linksError;
  const itemIds = (links ?? []).map((row) => row.item_id);
  const context = await loadPupilLearningContext(studentId);
  if (!itemIds.length) return { student: student as LiveStudent, evidenceCount: 0, items: [], currentNextStep: context.nextSteps[0]?.final_body ?? null, currentGoal: context.activeGoals[0]?.body ?? null, goals: context.activeGoals };

  const { data: items, error: itemsError } = await supabase.from("sportfolio_items").select("id,title,teacher_note,student_feedback,occurred_at,class_id,sportfolio_classes(name)").in("id", itemIds).order("occurred_at", { ascending: false });
  if (itemsError) throw itemsError;

  const ids = (items ?? []).map((item) => item.id);
  const [tagResult, mediaResult, reflectionResult, nextStepResult] = await Promise.all([
    supabase.from("sportfolio_item_tags").select("item_id,sportfolio_tags(name)").in("item_id", ids),
    supabase.from("sportfolio_media").select("id,item_id,storage_path,media_type").in("item_id", ids),
    supabase.from("sportfolio_reflections").select("id,item_id,prompt,text_response,voice_storage_path,submitted_at,reviewed_at").eq("student_id", studentId).in("item_id", ids),
    supabase.from("sportfolio_next_steps").select("source_item_id,final_body,status,created_at").eq("student_id", studentId).in("source_item_id", ids).neq("status", "ignored").order("created_at", { ascending: false })
  ]);
  if (tagResult.error) throw tagResult.error;
  if (mediaResult.error) throw mediaResult.error;
  if (reflectionResult.error) throw reflectionResult.error;
  if (nextStepResult.error) throw nextStepResult.error;

  const tagMap = new Map<string, string[]>();
  for (const row of tagResult.data ?? []) {
    const tag = (row as any).sportfolio_tags?.name;
    if (tag) tagMap.set(row.item_id, [...(tagMap.get(row.item_id) ?? []), tag]);
  }

  const signedMap = new Map<string, string | null>();
  const mediaRows = mediaResult.data ?? [];
  if (mediaRows.length) {
    const paths = mediaRows.map((row) => row.storage_path);
    const { data: signed, error: signedError } = await supabase.storage.from("sportfolio-media").createSignedUrls(paths, 60 * 30);
    if (signedError) throw signedError;
    signed?.forEach((entry, index) => signedMap.set(paths[index], entry.signedUrl ?? null));
  }

  const voiceSignedMap = new Map<string, string | null>();
  const voicePaths = (reflectionResult.data ?? []).map((row) => row.voice_storage_path).filter((path): path is string => !!path);
  if (voicePaths.length) {
    const { data: signedVoices, error: voiceError } = await supabase.storage.from("sportfolio-media").createSignedUrls(voicePaths, 60 * 30);
    if (voiceError) throw voiceError;
    signedVoices?.forEach((entry, index) => voiceSignedMap.set(voicePaths[index], entry.signedUrl ?? null));
  }

  const mediaMap = new Map<string, PupilPortfolioItem["media"]>();
  for (const row of mediaRows) {
    mediaMap.set(row.item_id, [...(mediaMap.get(row.item_id) ?? []), { id: row.id, media_type: row.media_type as "image" | "video" | "audio", signed_url: signedMap.get(row.storage_path) ?? null }]);
  }

  const reflectionMap = new Map<string, PupilPortfolioItem["reflection"]>();
  for (const row of reflectionResult.data ?? []) {
    reflectionMap.set(row.item_id, {
      id: row.id,
      prompt: row.prompt,
      text_response: row.text_response,
      voice_storage_path: row.voice_storage_path,
      voice_signed_url: row.voice_storage_path ? voiceSignedMap.get(row.voice_storage_path) ?? null : null,
      submitted_at: row.submitted_at,
      reviewed_at: row.reviewed_at,
    });
  }

  const nextStepMap = new Map<string, string>();
  for (const row of nextStepResult.data ?? []) if (!nextStepMap.has(row.source_item_id)) nextStepMap.set(row.source_item_id, row.final_body);

  return {
    student: student as LiveStudent,
    evidenceCount: itemIds.length,
    currentNextStep: context.nextSteps[0]?.final_body ?? null,
    currentGoal: context.activeGoals[0]?.body ?? null,
    goals: context.activeGoals,
    items: (items ?? []).map((item: any) => ({
      id: item.id,
      title: item.title,
      teacher_note: item.teacher_note,
      student_feedback: item.student_feedback,
      occurred_at: item.occurred_at,
      class_name: item.sportfolio_classes?.name ?? null,
      tags: tagMap.get(item.id) ?? [],
      media: mediaMap.get(item.id) ?? [],
      reflection: reflectionMap.get(item.id) ?? null,
      next_step: nextStepMap.get(item.id) ?? null
    }))
  };
}

export async function savePupilGoal(studentId: string, body: string, targetDate?: string) {
  const user = await requireUser();
  const trimmed = body.trim();
  if (trimmed.length < 3) throw new Error("Add a clear goal before saving.");
  const { data, error } = await supabase.from("sportfolio_goals").insert({ student_id: studentId, body: trimmed, target_date: targetDate || null, status: "not_started", created_by: user.id }).select("id").single();
  if (error) throw error;
  await supabase.from("sportfolio_audit_log").insert({ actor_user_id: user.id, action: "pupil_goal_created", entity_type: "sportfolio_goal", entity_id: data.id });
  return data.id as string;
}

export async function updatePupilGoalStatus(goalId: string, status: PupilGoal["status"]) {
  const user = await requireUser();
  const { error } = await supabase.from("sportfolio_goals").update({ status }).eq("id", goalId).eq("created_by", user.id);
  if (error) throw error;
  await supabase.from("sportfolio_audit_log").insert({ actor_user_id: user.id, action: `pupil_goal_${status}`, entity_type: "sportfolio_goal", entity_id: goalId });
}

export async function markReflectionReviewed(reflectionId: string) {
  const user = await requireUser();
  const { error } = await supabase.from("sportfolio_reflections").update({ reviewed_at: new Date().toISOString(), reviewed_by: user.id }).eq("id", reflectionId);
  if (error) throw error;
  await supabase.from("sportfolio_audit_log").insert({ actor_user_id: user.id, action: "reflection_reviewed", entity_type: "sportfolio_reflection", entity_id: reflectionId });
}

export async function saveTeacherFeedback(itemId: string, feedback: string) {
  const user = await requireUser();
  const body = feedback.trim();
  const { error } = await supabase.from("sportfolio_items").update({ student_feedback: body || null }).eq("id", itemId).eq("author_user_id", user.id);
  if (error) throw error;
  await supabase.from("sportfolio_audit_log").insert({ actor_user_id: user.id, action: "teacher_feedback_updated", entity_type: "sportfolio_item", entity_id: itemId });
}

function mediaType(file: File) { if (file.type.startsWith("image/")) return "image"; if (file.type.startsWith("video/")) return "video"; if (file.type.startsWith("audio/")) return "audio"; throw new Error("Unsupported media type."); }
function safeFilename(name: string) { return name.toLowerCase().replace(/[^a-z0-9._-]+/g, "-").replace(/-+/g, "-").slice(-80) || "capture"; }

export async function saveLiveEvidence(input: { classId: string; studentIds: string[]; tagIds: string[]; title?: string; teacherNote?: string; nextStep?: string; requestReflection?: boolean; file?: File | null; }) {
  const user = await requireUser();
  if (!input.studentIds.length) throw new Error("Select at least one pupil.");
  const { data: item, error: itemError } = await supabase.from("sportfolio_items").insert({ class_id: input.classId, author_user_id: user.id, title: input.title || "Quick capture", teacher_note: input.teacherNote || null, visibility: "student_visible", occurred_at: new Date().toISOString() }).select("id").single();
  if (itemError) throw itemError;
  let uploadedPath: string | null = null;
  try {
    const { error: pupilsError } = await supabase.from("sportfolio_item_students").insert(input.studentIds.map((student_id) => ({ item_id: item.id, student_id }))); if (pupilsError) throw pupilsError;
    if (input.tagIds.length) { const { error: tagError } = await supabase.from("sportfolio_item_tags").insert(input.tagIds.map((tag_id) => ({ item_id: item.id, tag_id }))); if (tagError) throw tagError; }
    if (input.file) { const type = mediaType(input.file); uploadedPath = `${user.id}/${item.id}/${crypto.randomUUID()}-${safeFilename(input.file.name)}`; const { error: uploadError } = await supabase.storage.from("sportfolio-media").upload(uploadedPath, input.file, { contentType: input.file.type, upsert: false }); if (uploadError) throw uploadError; const { error: mediaError } = await supabase.from("sportfolio_media").insert({ item_id: item.id, storage_path: uploadedPath, media_type: type, uploaded_by: user.id }); if (mediaError) throw mediaError; }
    const nextStep = input.nextStep?.trim();
    if (nextStep) { const { error: nextStepError } = await supabase.from("sportfolio_next_steps").insert(input.studentIds.map((student_id) => ({ student_id, source_item_id: item.id, final_body: nextStep, status: "accepted", created_by: user.id }))); if (nextStepError) throw nextStepError; }
    if (input.requestReflection) { const prompt = nextStep ? `Your next step is: ${nextStep} What will you focus on next time?` : "What went well, and what would you improve next time?"; const { error: reflectionError } = await supabase.from("sportfolio_reflections").insert(input.studentIds.map((student_id) => ({ item_id: item.id, student_id, prompt }))); if (reflectionError) throw reflectionError; }
    await supabase.from("sportfolio_audit_log").insert({ actor_user_id: user.id, action: "portfolio_item_created", entity_type: "sportfolio_item", entity_id: item.id });
    return item.id as string;
  } catch (error) { if (uploadedPath) await supabase.storage.from("sportfolio-media").remove([uploadedPath]); await supabase.from("sportfolio_items").delete().eq("id", item.id); throw error; }
}
