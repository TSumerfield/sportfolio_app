import { supabase } from "../supabase/client";

export type LiveStudent = {
  id: string;
  first_name: string;
  last_name: string;
  grade: string | null;
};

export type LiveClass = {
  id: string;
  name: string;
  academic_year: string;
  activity: string | null;
};

export async function requireUser() {
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) throw new Error("Please sign in to Sportfolio first.");
  return data.user;
}

export async function loadTeacherWorkspace() {
  const user = await requireUser();

  const { data: classes, error: classesError } = await supabase
    .from("sportfolio_classes")
    .select("id,name,academic_year,activity")
    .eq("teacher_user_id", user.id)
    .order("name");

  if (classesError) throw classesError;

  const grade5 = classes?.find((item) => item.name === "Grade 5A") ?? classes?.[0];
  let students: LiveStudent[] = [];

  if (grade5) {
    const { data: memberships, error: membershipError } = await supabase
      .from("sportfolio_class_memberships")
      .select("student_id,sportfolio_students(id,first_name,last_name,grade)")
      .eq("class_id", grade5.id);

    if (membershipError) throw membershipError;

    students = (memberships ?? [])
      .map((row: any) => row.sportfolio_students)
      .filter(Boolean)
      .sort((a: LiveStudent, b: LiveStudent) => a.last_name.localeCompare(b.last_name));
  }

  const { data: tags, error: tagsError } = await supabase
    .from("sportfolio_tags")
    .select("id,name,category")
    .order("category")
    .order("name");

  if (tagsError) throw tagsError;

  return { user, classes: (classes ?? []) as LiveClass[], activeClass: grade5 as LiveClass | undefined, students, tags: tags ?? [] };
}

function mediaType(file: File) {
  if (file.type.startsWith("image/")) return "image";
  if (file.type.startsWith("video/")) return "video";
  if (file.type.startsWith("audio/")) return "audio";
  throw new Error("Unsupported media type.");
}

function safeFilename(name: string) {
  return name.toLowerCase().replace(/[^a-z0-9._-]+/g, "-").replace(/-+/g, "-").slice(-80) || "capture";
}

export async function saveLiveEvidence(input: {
  classId: string;
  studentIds: string[];
  tagIds: string[];
  title?: string;
  teacherNote?: string;
  nextStep?: string;
  requestReflection?: boolean;
  file?: File | null;
}) {
  const user = await requireUser();
  if (!input.studentIds.length) throw new Error("Select at least one pupil.");

  const { data: item, error: itemError } = await supabase
    .from("sportfolio_items")
    .insert({
      class_id: input.classId,
      author_user_id: user.id,
      title: input.title || "Quick capture",
      teacher_note: input.teacherNote || null,
      visibility: "student_visible",
      occurred_at: new Date().toISOString(),
    })
    .select("id")
    .single();

  if (itemError) throw itemError;

  let uploadedPath: string | null = null;

  try {
    const { error: pupilsError } = await supabase
      .from("sportfolio_item_students")
      .insert(input.studentIds.map((student_id) => ({ item_id: item.id, student_id })));
    if (pupilsError) throw pupilsError;

    if (input.tagIds.length) {
      const { error: tagError } = await supabase
        .from("sportfolio_item_tags")
        .insert(input.tagIds.map((tag_id) => ({ item_id: item.id, tag_id })));
      if (tagError) throw tagError;
    }

    if (input.file) {
      const type = mediaType(input.file);
      uploadedPath = `${user.id}/${item.id}/${crypto.randomUUID()}-${safeFilename(input.file.name)}`;
      const { error: uploadError } = await supabase.storage
        .from("sportfolio-media")
        .upload(uploadedPath, input.file, { contentType: input.file.type, upsert: false });
      if (uploadError) throw uploadError;

      const { error: mediaError } = await supabase.from("sportfolio_media").insert({
        item_id: item.id,
        storage_path: uploadedPath,
        media_type: type,
        uploaded_by: user.id,
      });
      if (mediaError) throw mediaError;
    }

    const nextStep = input.nextStep?.trim();
    if (nextStep) {
      const { error: nextStepError } = await supabase.from("sportfolio_next_steps").insert(
        input.studentIds.map((student_id) => ({
          student_id,
          source_item_id: item.id,
          final_body: nextStep,
          status: "accepted",
          created_by: user.id,
        }))
      );
      if (nextStepError) throw nextStepError;
    }

    if (input.requestReflection) {
      const prompt = nextStep
        ? `Your next step is: ${nextStep} What will you focus on next time?`
        : "What went well, and what would you improve next time?";
      const { error: reflectionError } = await supabase
        .from("sportfolio_reflections")
        .insert(input.studentIds.map((student_id) => ({ item_id: item.id, student_id, prompt })));
      if (reflectionError) throw reflectionError;
    }

    await supabase.from("sportfolio_audit_log").insert({
      actor_user_id: user.id,
      action: "portfolio_item_created",
      entity_type: "sportfolio_item",
      entity_id: item.id,
    });

    return item.id as string;
  } catch (error) {
    if (uploadedPath) await supabase.storage.from("sportfolio-media").remove([uploadedPath]);
    await supabase.from("sportfolio_items").delete().eq("id", item.id);
    throw error;
  }
}
