import { createClient } from "@supabase/supabase-js";
const configuredUrl =
  process.env.NEXT_PUBLIC_SUPABASE_URL ||
  "https://rxiqubmkzqvspnzdasiz.supabase.co";
const configuredKey =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
  "sb_publishable_njEa_dFKOjPf886kpx-rQw_VJUhUk2q";
// This is a browser-safe publishable key. Privileged keys must never be used here.
export const googleSignInConfigured =
  configuredUrl === "https://rxiqubmkzqvspnzdasiz.supabase.co" &&
  !!configuredKey;
export const cloud = createClient(configuredUrl, configuredKey, {
  auth: { flowType: "pkce" },
});
export type RecordKind =
  | "application"
  | "submission"
  | "resource"
  | "task"
  | "payment"
  | "document"
  | "support";
export type CloudRecord = {
  id: string;
  kind: RecordKind;
  user_id: string | null;
  data: Record<string, string | number>;
  created_at: string;
};
export type Profile = {
  id: string;
  name: string;
  email: string;
  phone: string;
  city: string;
  linkedin: string;
  github: string;
  cohort: string;
  start_date: string | null;
};
export async function uploadFile(file: File, userId: string) {
  if (file.size > 10 * 1024 * 1024)
    throw new Error("Choose a file smaller than 10 MB.");
  if (!/\.(pdf|docx?|zip|txt|csv|json|xlsx|pptx|sql|sqlite|db|png|jpe?g|webp)$/i.test(file.name))
    throw new Error("Choose a document, spreadsheet, dataset, image or ZIP archive. Keep the file below 10 MB.");
  const path = `${userId}/${crypto.randomUUID()}/${file.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
  const { error } = await cloud.storage
    .from("pfsa-files")
    .upload(path, file, { upsert: false });
  if (error) throw error;
  return path;
}
export async function openFile(path: string) {
  const { data, error } = await cloud.storage
    .from("pfsa-files")
    .createSignedUrl(path, 120);
  if (error) throw error;
  window.open(data.signedUrl, "_blank", "noopener,noreferrer");
}
export async function addRecord(
  kind: RecordKind,
  userId: string | null,
  data: CloudRecord["data"],
) {
  const result = await cloud
    .from("pfsa_records")
    .insert({ kind, user_id: userId, data })
    .select()
    .single();
  if (result.error) throw result.error;
  return result.data as CloudRecord;
}
