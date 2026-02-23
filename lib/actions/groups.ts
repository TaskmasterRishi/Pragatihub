import { supabase } from "@/lib/Supabase";

export type Group = {
  id: string;
  name: string;
  image: string | null;
  created_at: string | null;
};

export async function fetchGroups() {
  const { data, error } = await supabase
    .from("groups")
    .select("id, name, image, created_at")
    .order("name", { ascending: true });

  return { data: data as Group[] | null, error };
}

export async function fetchGroupById(id: string) {
  const { data, error } = await supabase
    .from("groups")
    .select("id, name, image, created_at")
    .eq("id", id)
    .single();

  return { data: data as Group | null, error };
}

export type CreateGroupInput = {
  id?: string;
  name: string;
  image?: string | null;
};

const generateGroupId = () =>
  `group_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;

export async function createGroup(input: CreateGroupInput) {
  const payload = {
    id: input.id ?? generateGroupId(),
    name: input.name,
    image: input.image ?? null,
  };

  const { data, error } = await supabase
    .from("groups")
    .insert(payload)
    .select()
    .single();

  return { data, error };
}
