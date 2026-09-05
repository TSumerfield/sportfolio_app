import { supabase } from "../supabase/client";
import { requireUser } from "./live";

export type NextStepDecision = "accept" | "edit" | "replace" | "new" | "none";

function mediaType(file: File) {
  if (file.type.startsWith("image/")) return "image";
  if (file.type.startsWith("video/")) return "video";
  if (file.type.startsWith("audio/")) return "audio";
  throw new Error("Unsupported media type.");
}

function safeFilename(name: string) {
  return name.toLowerCase().replace(/[^a-z0-9._-]+/g, "-").replace(/-+/g, "-").slice(-80) || "capture";
}

export async function saveCoverageEvidence(input: {
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
}) {
  const user = await requireUser();
  const { data: item, error: itemError } = await supabase
    .from("sportfolio_items")
    .insert({
      class_id: input.classId,
      author_user_id: user.id,
      title: input.title || "Coverage capture",
      teacher_note: input.teacherNote?.trim() || null,
      visibility: "student_visible",
      occurred_at: new Date().toISOString(),
    })
    .select("id")
    .single();
  if (itemError) throw itemError;

  let uploadedPath: string | null = null;
  try {
    const { error: pupilError } = await supabase
      .from("sportfolio_item_students")
      .insert({ item_id: item.id, student_id: input.studentId });
    if (pupilError) throw pupilError;

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

    const finalBody = input.nextStep?.trim() || "";
    const previous = input.previousNextStep?.trim() || "";
    if (input.nextStepDecision !== "none" && finalBody) {
      const status = input.nextStepDecision === "accept" ? "accepted" : "edited";
      const { data: nextStepRow, error: nextStepError } = await supabase
        .from("sportfolio_next_steps")
        .insert({
          student_id: input.studentId,
          source_item_id: item.id,
          suggested_body: previous || null,
          final_body: finalBody,
          status,
          created_by: user.id,
        })
        .select("id")
        .single();
      if (nextStepError) throw nextStepError;

      await supabase.from("sportfolio_audit_log").insert({
        actor_user_id: user.id,
        action: `next_step_${input.nextStepDecision}`,
        entity_type: "sportfolio_next_step",
        entity_id: nextStepRow.id,
      });
    }

    if (input.requestReflection) {
      const prompt = finalBody
        ? `Your next step is: ${finalBody} What will you focus on next time?`
        : "What went well, and what would you improve next time?";
      const { error: reflectionError } = await supabase.from("sportfolio_reflections").insert({
        item_id: item.id,
        student_id: input.studentId,
        prompt,
      });
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
