import { supabase } from "@/lib/Supabase";

export type SyncUserInput = {
  id: string;
  email: string;
  name: string;
  image?: string | null;
};

export async function syncUserToSupabase(input: SyncUserInput) {
  const payload = {
    id: input.id,
    email: input.email,
    name: input.name,
    image: input.image ?? null,
  };

  const { data, error } = await supabase
    .from("users")
    .upsert(payload, { onConflict: "id" })
    .select()
    .single();

  return { data, error };
}

export type UpdateUserImageInput = {
  id: string;
  image: string | null;
};

export async function updateUserImage(input: UpdateUserImageInput) {
  const { data, error } = await supabase
    .from("users")
    .update({ image: input.image })
    .eq("id", input.id)
    .select()
    .single();

  return { data, error };
}
