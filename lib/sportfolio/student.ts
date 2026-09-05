import { supabase } from "../supabase/client";

export type StudentMedia = { id: string; media_type: "image" | "video" | "audio"; signed_url: string | null };

export type StudentReflectionTask = {
  student: { id: string; first_name: string; last_name: string | null; grade: string | null };
  reflection: {
    id: string;
    prompt: string | null;
    text_response: string | null;
    voice_storage_path: string | null;
    requested_at: string;
    submitted_at: string | null;
  };
  item: {
    id: string;
    title: string | null;
    teacher_note: string | null;
    occurred_at: string;
    class_name: string | null;
    media: StudentMedia[];
  };
};

export type StudentPortfolioItem = {
  id: string;
  title: string | null;
  teacher_note: string | null;
  student_feedback: string | null;
  occurred_at: string;
  class_name: string | null;
  tags: string[];
  media: StudentMedia[];
  reflection_status: "none" | "requested" | "submitted" | "reviewed";
};

export type StudentGoal = {
  id: string;
  body: string;
  status: string;
  target_date: string | null;
};

export type StudentWorkspace = {
  student: { id: string; first_name: string; last_name: string | null; grade: string | null };
  items: StudentPortfolioItem[];
  goals: StudentGoal[];
  pendingReflections: number;
};

async function requireStudent() {
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData.user) throw new Error("Please sign in to Sportfolio first.");

  const { data: student, error: studentError } = await supabase
    .from("sportfolio_students")
    .select("id,first_name,last_name,grade")
    .eq("auth_user_id", userData.user.id)
    .single();

  if (studentError || !student) throw new Error("This account is not linked to a pupil Sportfolio yet.");
  return student;
}

async function signMedia(rows: { id: string; storage_path: string; media_type: string; item_id?: string }[]) {
  const signed = new Map<string, string | null>();
  if (!rows.length) return signed;
  const paths = rows.map((row) => row.storage_path);
  const { data, error } = await supabase.storage.from("sportfolio-media").createSignedUrls(paths, 60 * 30);
  if (error) throw error;
  rows.forEach((row, index) => signed.set(row.id, data?.[index]?.signedUrl ?? null));
  return signed;
}

export async function loadStudentWorkspace(): Promise<StudentWorkspace> {
  const student = await requireStudent();
  const { data: links, error: linksError } = await supabase
    .from("sportfolio_item_students")
    .select("item_id")
    .eq("student_id", student.id);
  if (linksError) throw linksError;

  const itemIds = (links ?? []).map((row) => row.item_id);
  const { data: goals, error: goalsError } = await supabase
    .from("sportfolio_goals")
    .select("id,body,status,target_date")
    .eq("student_id", student.id)
    .order("created_at", { ascending: false });
  if (goalsError) throw goalsError;

  if (!itemIds.length) return { student, items: [], goals: goals ?? [], pendingReflections: 0 };

  const [itemsResult, tagsResult, mediaResult, reflectionsResult] = await Promise.all([
    supabase
      .from("sportfolio_items")
      .select("id,title,teacher_note,student_feedback,occurred_at,visibility,sportfolio_classes(name)")
      .in("id", itemIds)
      .eq("visibility", "student_visible")
      .order("occurred_at", { ascending: false }),
    supabase.from("sportfolio_item_tags").select("item_id,sportfolio_tags(name)").in("item_id", itemIds),
    supabase.from("sportfolio_media").select("id,item_id,storage_path,media_type").in("item_id", itemIds),
    supabase
      .from("sportfolio_reflections")
      .select("item_id,submitted_at,reviewed_at")
      .eq("student_id", student.id)
      .in("item_id", itemIds),
  ]);

  if (itemsResult.error) throw itemsResult.error;
  if (tagsResult.error) throw tagsResult.error;
  if (mediaResult.error) throw mediaResult.error;
  if (reflectionsResult.error) throw reflectionsResult.error;

  const signed = await signMedia(mediaResult.data ?? []);
  const tagMap = new Map<string, string[]>();
  for (const row of tagsResult.data ?? []) {
    const name = (row as any).sportfolio_tags?.name;
    if (name) tagMap.set(row.item_id, [...(tagMap.get(row.item_id) ?? []), name]);
  }

  const mediaMap = new Map<string, StudentMedia[]>();
  for (const row of mediaResult.data ?? []) {
    mediaMap.set(row.item_id, [
      ...(mediaMap.get(row.item_id) ?? []),
      { id: row.id, media_type: row.media_type as StudentMedia["media_type"], signed_url: signed.get(row.id) ?? null },
    ]);
  }

  const reflectionMap = new Map<string, StudentPortfolioItem["reflection_status"]>();
  let pendingReflections = 0;
  for (const row of reflectionsResult.data ?? []) {
    const status = row.reviewed_at ? "reviewed" : row.submitted_at ? "submitted" : "requested";
    reflectionMap.set(row.item_id, status);
    if (!row.submitted_at) pendingReflections += 1;
  }

  return {
    student,
    goals: goals ?? [],
    pendingReflections,
    items: (itemsResult.data ?? []).map((item: any) => ({
      id: item.id,
      title: item.title,
      teacher_note: item.teacher_note,
      student_feedback: item.student_feedback,
      occurred_at: item.occurred_at,
      class_name: item.sportfolio_classes?.name ?? null,
      tags: tagMap.get(item.id) ?? [],
      media: mediaMap.get(item.id) ?? [],
      reflection_status: reflectionMap.get(item.id) ?? "none",
    })),
  };
}

export async function loadStudentReflectionTask(): Promise<StudentReflectionTask | null> {
  const student = await requireStudent();
  const { data: reflections, error: reflectionError } = await supabase
    .from("sportfolio_reflections")
    .select("id,item_id,prompt,text_response,voice_storage_path,requested_at,submitted_at")
    .eq("student_id", student.id)
    .order("submitted_at", { ascending: true, nullsFirst: true })
    .order("requested_at", { ascending: false });

  if (reflectionError) throw reflectionError;
  const reflection = reflections?.find((row) => !row.submitted_at) ?? reflections?.[0];
  if (!reflection) return null;

  const { data: item, error: itemError } = await supabase
    .from("sportfolio_items")
    .select("id,title,teacher_note,occurred_at,sportfolio_classes(name)")
    .eq("id", reflection.item_id)
    .single();
  if (itemError) throw itemError;

  const { data: mediaRows, error: mediaError } = await supabase
    .from("sportfolio_media")
    .select("id,storage_path,media_type")
    .eq("item_id", reflection.item_id);
  if (mediaError) throw mediaError;

  const media: StudentReflectionTask["item"]["media"] = [];
  if (mediaRows?.length) {
    const signed = await signMedia(mediaRows.map((row) => ({ ...row })));
    mediaRows.forEach((row) => media.push({
      id: row.id,
      media_type: row.media_type as StudentMedia["media_type"],
      signed_url: signed.get(row.id) ?? null,
    }));
  }

  return {
    student,
    reflection: {
      id: reflection.id,
      prompt: reflection.prompt,
      text_response: reflection.text_response,
      voice_storage_path: reflection.voice_storage_path,
      requested_at: reflection.requested_at,
      submitted_at: reflection.submitted_at,
    },
    item: {
      id: item.id,
      title: item.title,
      teacher_note: item.teacher_note,
      occurred_at: item.occurred_at,
      class_name: (item as any).sportfolio_classes?.name ?? null,
      media,
    },
  };
}

export async function saveReflectionDraft(reflectionId: string, text: string) {
  await requireStudent();
  const { error } = await supabase
    .from("sportfolio_reflections")
    .update({ text_response: text.trim() || null })
    .eq("id", reflectionId);
  if (error) throw error;
}

export async function submitTextReflection(reflectionId: string, text: string) {
  await requireStudent();
  const body = text.trim();
  if (body.length < 3) throw new Error("Write a short reflection before submitting.");
  const { error } = await supabase
    .from("sportfolio_reflections")
    .update({ text_response: body, voice_storage_path: null, submitted_at: new Date().toISOString() })
    .eq("id", reflectionId);
  if (error) throw error;
}

export async function submitVoiceReflection(reflectionId: string, file: File) {
  const student = await requireStudent();
  if (!file.type.startsWith("audio/")) throw new Error("Choose an audio recording.");
  if (file.size > 15 * 1024 * 1024) throw new Error("Voice reflection must be under 15 MB.");

  const safeName = file.name.toLowerCase().replace(/[^a-z0-9._-]+/g, "-").replace(/-+/g, "-").slice(-80) || "reflection-audio";
  const user = (await supabase.auth.getUser()).data.user;
  if (!user) throw new Error("Please sign in to Sportfolio first.");
  const path = `${user.id}/reflections/${reflectionId}/${crypto.randomUUID()}-${safeName}`;
  const { error: uploadError } = await supabase.storage.from("sportfolio-media").upload(path, file, { contentType: file.type, upsert: false });
  if (uploadError) throw uploadError;

  const { error: updateError } = await supabase
    .from("sportfolio_reflections")
    .update({ text_response: null, voice_storage_path: path, submitted_at: new Date().toISOString() })
    .eq("id", reflectionId)
    .eq("student_id", student.id);

  if (updateError) {
    await supabase.storage.from("sportfolio-media").remove([path]);
    throw updateError;
  }
}
