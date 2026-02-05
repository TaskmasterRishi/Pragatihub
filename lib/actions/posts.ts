import { supabase } from "@/lib/Supabase";

export type CreatePostInput = {
  title: string;
  description?: string | null;
  image?: string | null;
  groupId: string;
  userId: string;
  createdAt?: string;
  id?: string;
};

const generatePostId = () =>
  `post_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;

export async function createPost(input: CreatePostInput) {
  const payload = {
    id: input.id ?? generatePostId(),
    title: input.title,
    description: input.description ?? null,
    image: input.image ?? null,
    group_id: input.groupId,
    user_id: input.userId,
    created_at: input.createdAt ?? new Date().toISOString(),
  };

  const { data, error } = await supabase
    .from("posts")
    .insert(payload)
    .select()
    .single();

  return { data, error };
}
