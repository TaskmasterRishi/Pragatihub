import { supabase } from "@/lib/Supabase";

export type Group = {
  id: string;
  name: string;
  description: string | null;
  banner_image: string | null;
  image: string | null;
  is_private: boolean | null;
  rules: string | null;
  tags: string[] | null;
  owner_id: string | null;
  member_count: number | null;
  updated_at: string | null;
  created_at: string | null;
};

export async function fetchGroups() {
  const { data, error } = await supabase
    .from("groups")
    .select(
      "id, name, description, banner_image, image, is_private, rules, tags, owner_id, member_count, updated_at, created_at",
    )
    .order("name", { ascending: true });

  return { data: data as Group[] | null, error };
}

export async function fetchGroupById(id: string) {
  const { data, error } = await supabase
    .from("groups")
    .select(
      "id, name, description, banner_image, image, is_private, rules, tags, owner_id, member_count, updated_at, created_at",
    )
    .eq("id", id)
    .single();

  return { data: data as Group | null, error };
}

export type CreateGroupInput = {
  id?: string;
  name: string;
  description?: string | null;
  banner_image?: string | null;
  image?: string | null;
  is_private?: boolean | null;
  rules?: string | null;
  tags?: string[] | null;
  member_count?: number | null;
  owner_id: string;
};

export type UpdateGroupInput = {
  name: string;
  description?: string | null;
  banner_image?: string | null;
  image?: string | null;
  is_private?: boolean | null;
  rules?: string | null;
  tags?: string[] | null;
};

const generateGroupId = () =>
  `group_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;

export async function createGroup(input: CreateGroupInput) {
  const now = new Date().toISOString();
  const normalizedTags = input.tags?.map((tag) => tag.trim()).filter(Boolean);
  const payload = {
    id: input.id ?? generateGroupId(),
    name: input.name,
    description: input.description ?? null,
    banner_image: input.banner_image ?? null,
    image: input.image ?? null,
    is_private: input.is_private ?? false,
    rules: input.rules ?? null,
    tags: normalizedTags && normalizedTags.length > 0 ? normalizedTags : null,
    member_count: input.member_count ?? 1,
    owner_id: input.owner_id,
    created_at: now,
    updated_at: now,
  };

  const { data, error } = await supabase
    .from("groups")
    .insert(payload)
    .select(
      "id, name, description, banner_image, image, is_private, rules, tags, owner_id, member_count, updated_at, created_at",
    )
    .single();

  if (!error && data?.id && input.owner_id) {
    const { error: membershipError } = await supabase.from("user_groups").upsert(
      {
        group_id: data.id,
        user_id: input.owner_id,
      },
      { onConflict: "group_id,user_id" },
    );

    if (membershipError) {
      console.log("Create group membership sync warning:", membershipError);
    }
  }

  return { data: data as Group | null, error };
}

export async function updateGroupById(id: string, input: UpdateGroupInput) {
  const payload = {
    name: input.name,
    description: input.description ?? null,
    banner_image: input.banner_image ?? null,
    image: input.image ?? null,
    is_private: input.is_private ?? false,
    rules: input.rules ?? null,
    tags: input.tags ?? null,
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await supabase
    .from("groups")
    .update(payload)
    .eq("id", id)
    .select(
      "id, name, description, banner_image, image, is_private, rules, tags, owner_id, member_count, updated_at, created_at",
    )
    .single();

  return { data: data as Group | null, error };
}
