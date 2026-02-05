import { supabase } from "@/lib/Supabase";

export type Group = {
  id: string;
  name: string;
  image: string | null;
};

export async function fetchGroups() {
  const { data, error } = await supabase
    .from("groups")
    .select("id, name, image")
    .order("name", { ascending: true });

  return { data: data as Group[] | null, error };
}

export async function fetchGroupById(id: string) {
  const { data, error } = await supabase
    .from("groups")
    .select("id, name, image")
    .eq("id", id)
    .single();

  return { data: data as Group | null, error };
}
