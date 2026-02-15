import { supabase } from "@/lib/Supabase";
import { Enums } from "@/types/database.types";

export type PostType = Enums<"post_type">;

export type CreatePostPollInput = {
  options: string[];
  durationHours: number;
  allowsMultiple?: boolean;
};

export type CreatePostInput = {
  title: string;
  description?: string | null;
  image?: string | null;
  linkUrl?: string | null;
  postType?: PostType;
  nsfw?: boolean;
  spoiler?: boolean;
  mediaUrl?: string | null;
  poll?: CreatePostPollInput;
  groupId: string;
  userId: string;
  createdAt?: string;
  id?: string;
};

const generatePostId = () =>
  `post_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;

const generateId = (prefix: string) =>
  `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;

export async function createPost(input: CreatePostInput) {
  const postType = input.postType ?? "text";
  const nowIso = input.createdAt ?? new Date().toISOString();
  const postId = input.id ?? generatePostId();
  const payload = {
    id: postId,
    title: input.title,
    description: input.description ?? null,
    image: input.image ?? null,
    post_type: postType,
    link_url: input.linkUrl ?? null,
    nsfw: input.nsfw ?? false,
    spoiler: input.spoiler ?? false,
    group_id: input.groupId,
    user_id: input.userId,
    created_at: nowIso,
  };

  const { data: postData, error: postError } = await supabase
    .from("posts")
    .insert(payload)
    .select()
    .single();

  if (postError || !postData) {
    return { data: null, error: postError };
  }

  if ((postType === "photo" || postType === "video") && input.mediaUrl) {
    const { error: mediaError } = await supabase.from("post_media").insert({
      id: generateId("media"),
      post_id: postId,
      media_type: postType,
      media_url: input.mediaUrl,
      media_order: 0,
      created_at: nowIso,
    });

    if (mediaError) {
      await supabase.from("posts").delete().eq("id", postId);
      return { data: null, error: mediaError };
    }
  }

  if (postType === "poll" && input.poll) {
    const cleanedOptions = input.poll.options
      .map((option) => option.trim())
      .filter((option) => option.length > 0);

    if (cleanedOptions.length < 2) {
      await supabase.from("posts").delete().eq("id", postId);
      return {
        data: null,
        error: { message: "A poll needs at least two options." },
      };
    }

    const pollId = generateId("poll");
    const endsAt = new Date(
      Date.now() + input.poll.durationHours * 60 * 60 * 1000,
    ).toISOString();

    const { error: pollError } = await supabase.from("post_polls").insert({
      id: pollId,
      post_id: postId,
      allows_multiple: input.poll.allowsMultiple ?? false,
      ends_at: endsAt,
      created_at: nowIso,
    });

    if (pollError) {
      await supabase.from("posts").delete().eq("id", postId);
      return { data: null, error: pollError };
    }

    const optionRows = cleanedOptions.map((option, index) => ({
      id: generateId("opt"),
      poll_id: pollId,
      option_text: option,
      option_order: index,
      created_at: nowIso,
    }));

    const { error: optionError } = await supabase
      .from("post_poll_options")
      .insert(optionRows);

    if (optionError) {
      await supabase.from("posts").delete().eq("id", postId);
      return { data: null, error: optionError };
    }
  }

  return { data: postData, error: null };
}
