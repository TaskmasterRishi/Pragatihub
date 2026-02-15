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

type StorageObject = {
  bucket: string;
  path: string;
};

const POST_MEDIA_BUCKET =
  process.env.EXPO_PUBLIC_SUPABASE_POST_MEDIA_BUCKET ?? "post-media";

const STORAGE_URL_PATTERNS = [
  /\/storage\/v1\/object\/public\/([^/]+)\/(.+)/,
  /\/storage\/v1\/object\/authenticated\/([^/]+)\/(.+)/,
  /\/storage\/v1\/object\/sign\/([^/]+)\/(.+)/,
  /\/storage\/v1\/object\/([^/]+)\/(.+)/,
];

function extractStorageObject(urlOrPath: string): StorageObject | null {
  if (!urlOrPath) return null;

  // Handle raw object paths directly, e.g. "posts/user/file.jpg"
  if (!/^https?:\/\//i.test(urlOrPath)) {
    const rawPath = urlOrPath.replace(/^\/+/, "");
    if (rawPath.length > 0) {
      return { bucket: POST_MEDIA_BUCKET, path: rawPath };
    }
    return null;
  }

  try {
    const parsed = new URL(urlOrPath);
    const pathname = parsed.pathname;
    for (const pattern of STORAGE_URL_PATTERNS) {
      const match = pathname.match(pattern);
      if (!match) continue;
      const bucket = decodeURIComponent(match[1] ?? "");
      const path = decodeURIComponent(match[2] ?? "");
      if (!bucket || !path) return null;
      // Strip leading slash if present after decoding
      const cleanedPath = path.replace(/^\/+/, "");
      if (!cleanedPath) return null;
      return { bucket, path: cleanedPath };
    }

    // Fallback for uncommon URL shapes that still contain "/<bucket>/<objectPath>"
    const marker = `/${POST_MEDIA_BUCKET}/`;
    const markerIndex = pathname.indexOf(marker);
    if (markerIndex >= 0) {
      const inferredPath = decodeURIComponent(
        pathname.slice(markerIndex + marker.length),
      ).replace(/^\/+/, "");
      if (inferredPath) {
        return { bucket: POST_MEDIA_BUCKET, path: inferredPath };
      }
    }
  } catch {
    // ignore URL parse failures; caller handles null
  }

  return null;
}

function collectStorageObjects(urls: Iterable<string>) {
  const objectsByBucket = new Map<string, Set<string>>();
  const unresolved: string[] = [];

  for (const url of urls) {
    const object = extractStorageObject(url);
    if (!object) {
      unresolved.push(url);
      continue;
    }
    if (!objectsByBucket.has(object.bucket)) {
      objectsByBucket.set(object.bucket, new Set<string>());
    }
    objectsByBucket.get(object.bucket)?.add(object.path);
  }

  return { objectsByBucket, unresolved };
}

export async function deletePost(postId: string, userId: string) {
  const { data: post, error: postError } = await supabase
    .from("posts")
    .select(
      `
      id,
      image,
      post_media:post_media(media_url)
    `,
    )
    .eq("id", postId)
    .eq("user_id", userId)
    .maybeSingle();

  if (postError) {
    return { error: postError, storageWarning: null };
  }

  if (!post) {
    return { error: { message: "Post not found." }, storageWarning: null };
  }

  const mediaUrls = new Set<string>();
  if (typeof post.image === "string" && post.image.length > 0) {
    mediaUrls.add(post.image);
  }
  (post.post_media ?? []).forEach((media) => {
    if (typeof media?.media_url === "string" && media.media_url.length > 0) {
      mediaUrls.add(media.media_url);
    }
  });

  const { objectsByBucket, unresolved } = collectStorageObjects(mediaUrls);

  let storageWarning: string | null = null;
  for (const [bucket, paths] of objectsByBucket.entries()) {
    const removePaths = Array.from(paths);
    if (removePaths.length === 0) continue;
    const { error: removeError } = await supabase.storage
      .from(bucket)
      .remove(removePaths);
    if (removeError) {
      storageWarning = removeError.message ?? "Failed to delete media from storage.";
    }
  }

  if (!storageWarning && unresolved.length > 0) {
    storageWarning = `Could not resolve storage path for ${unresolved.length} file(s).`;
  }

  const { error: deleteError } = await supabase
    .from("posts")
    .delete()
    .eq("id", postId)
    .eq("user_id", userId);

  if (deleteError) {
    return { error: deleteError, storageWarning };
  }

  return { error: null, storageWarning };
}

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
