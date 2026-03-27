import { supabase } from "@/lib/Supabase";

export type SyncUserInput = {
  id: string;
  email: string;
  name: string;
  image?: string | null;
};

export async function syncUserToSupabase(input: SyncUserInput) {
  const existingUser = await supabase
    .from("users")
    .select("id")
    .eq("id", input.id)
    .maybeSingle();

  if (existingUser.error) {
    return { data: null, error: existingUser.error };
  }

  if (existingUser.data?.id) {
    const { data, error } = await supabase
      .from("users")
      .update({
        email: input.email,
        image: input.image ?? null,
      })
      .eq("id", input.id)
      .select()
      .single();

    return { data, error };
  }

  const { data, error } = await supabase
    .from("users")
    .insert({
      id: input.id,
      email: input.email,
      name: input.name,
      image: input.image ?? null,
    })
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

export type UpdateUserNameInput = {
  id: string;
  name: string;
};

export async function updateUserName(input: UpdateUserNameInput) {
  const { data, error } = await supabase
    .from("users")
    .update({ name: input.name })
    .eq("id", input.id)
    .select()
    .single();

  return { data, error };
}

export async function getUserDisplayName(id: string) {
  const { data, error } = await supabase
    .from("users")
    .select("name")
    .eq("id", id)
    .maybeSingle();

  return { data, error };
}
