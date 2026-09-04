import { supabase } from "../supabase/client";

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
    media: { id: string; media_type: "image" | "video" | "audio"; signed_url: string | null }[];
  };
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
    const paths = mediaRows.map((row) => row.storage_path);
    const { data: signed, error: signedError } = await supabase.storage.from("sportfolio-media").createSignedUrls(paths, 60 * 30);
    if (signedError) throw signedError;
    mediaRows.forEach((row, index) => media.push({
      id: row.id,
      media_type: row.media_type as "image" | "video" | "audio",
      signed_url: signed?.[index]?.signedUrl ?? null,
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
  const path = `${(await supabase.auth.getUser()).data.user!.id}/reflections/${reflectionId}/${crypto.randomUUID()}-${safeName}`;
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
