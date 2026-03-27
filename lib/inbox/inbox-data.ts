import { formatDistanceToNow } from "date-fns";

import { supabase } from "@/lib/Supabase";

export type InboxKind =
  | "comment"
  | "reply"
  | "moderation"
  | "community_post"
  | "chat";
export type InboxFilter = "all" | "unread";

export type InboxItem = {
  id: string;
  kind: InboxKind;
  createdAt: string;
  title: string;
  preview: string;
  actorName: string;
  actorImage: string | null;
  path: string;
};

type UserRow = {
  id: string;
  name: string;
  image: string | null;
};

function normalizeText(value: string | null | undefined) {
  return (value ?? "").replace(/\s+/g, " ").trim();
}

function truncate(value: string, max = 110) {
  return value.length <= max ? value : `${value.slice(0, max - 1)}…`;
}

export function formatInboxTime(iso: string) {
  try {
    return formatDistanceToNow(new Date(iso), { addSuffix: true });
  } catch {
    return "just now";
  }
}

export async function fetchInboxItems(userId: string): Promise<InboxItem[]> {
  const membershipsResult = await supabase
    .from("user_groups")
    .select("group_id")
    .eq("user_id", userId)
    .limit(300);

  if (membershipsResult.error) throw membershipsResult.error;
  const memberGroupIds = (membershipsResult.data ?? []).map(
    (row) => row.group_id,
  );

  const ownPostsResult = await supabase
    .from("posts")
    .select("id, title")
    .eq("user_id", userId)
    .limit(300);

  if (ownPostsResult.error) throw ownPostsResult.error;
  const ownPosts = ownPostsResult.data ?? [];
  const ownPostIds = ownPosts.map((post) => post.id);
  const ownPostTitleMap = new Map(ownPosts.map((post) => [post.id, post.title]));

  const [commentsResult, reportsResult, communityPostsResult, chatResult] =
    await Promise.all([
      ownPostIds.length > 0
        ? supabase
            .from("comments")
            .select("id, comment, post_id, user_id, created_at, parent_id")
            .in("post_id", ownPostIds)
            .neq("user_id", userId)
            .order("created_at", { ascending: false })
            .limit(200)
        : Promise.resolve({ data: [], error: null }),
      supabase
        .from("post_reports")
        .select(
          "id, post_id, status, reason, created_at, resolved_at, resolved_by",
        )
        .eq("reporter_id", userId)
        .neq("status", "pending")
        .order("resolved_at", { ascending: false })
        .limit(100),
      memberGroupIds.length > 0
        ? supabase
            .from("posts")
            .select("id, title, description, created_at, group_id, user_id")
            .in("group_id", memberGroupIds)
            .neq("user_id", userId)
            .order("created_at", { ascending: false })
            .limit(200)
        : Promise.resolve({ data: [], error: null }),
      memberGroupIds.length > 0
        ? supabase
            .from("community_chat_messages")
            .select("id, content, created_at, group_id, user_id")
            .in("group_id", memberGroupIds)
            .neq("user_id", userId)
            .order("created_at", { ascending: false })
            .limit(200)
        : Promise.resolve({ data: [], error: null }),
    ]);

  if (commentsResult.error) throw commentsResult.error;
  if (reportsResult.error) throw reportsResult.error;
  if (communityPostsResult.error) throw communityPostsResult.error;
  if (chatResult.error) throw chatResult.error;

  const comments = commentsResult.data ?? [];
  const reports = reportsResult.data ?? [];
  const communityPosts = communityPostsResult.data ?? [];
  const chatMessages = chatResult.data ?? [];

  const actorIds = new Set<string>();
  const missingPostIds = new Set<string>();
  const communityGroupIds = new Set<string>();
  for (const comment of comments) {
    actorIds.add(comment.user_id);
    if (!ownPostTitleMap.has(comment.post_id)) {
      missingPostIds.add(comment.post_id);
    }
  }
  for (const report of reports) {
    if (report.resolved_by) actorIds.add(report.resolved_by);
    if (report.post_id) missingPostIds.add(report.post_id);
  }
  for (const post of communityPosts) {
    actorIds.add(post.user_id);
    communityGroupIds.add(post.group_id);
  }
  for (const chat of chatMessages) {
    actorIds.add(chat.user_id);
    communityGroupIds.add(chat.group_id);
  }

  const [actorsResult, postsResult, groupsResult] = await Promise.all([
    actorIds.size > 0
      ? supabase
          .from("users")
          .select("id, name, image")
          .in("id", Array.from(actorIds))
      : Promise.resolve({ data: [], error: null }),
    missingPostIds.size > 0
      ? supabase
          .from("posts")
          .select("id, title")
          .in("id", Array.from(missingPostIds))
      : Promise.resolve({ data: [], error: null }),
    communityGroupIds.size > 0
      ? supabase
          .from("groups")
          .select("id, name")
          .in("id", Array.from(communityGroupIds))
      : Promise.resolve({ data: [], error: null }),
  ]);

  if (actorsResult.error) throw actorsResult.error;
  if (postsResult.error) throw postsResult.error;
  if (groupsResult.error) throw groupsResult.error;

  const actorMap = new Map(
    ((actorsResult.data ?? []) as UserRow[]).map((user) => [user.id, user]),
  );
  for (const post of postsResult.data ?? []) {
    ownPostTitleMap.set(post.id, post.title);
  }
  const groupNameMap = new Map(
    (groupsResult.data ?? []).map((group) => [group.id, group.name ?? "your community"]),
  );

  const commentItems: InboxItem[] = comments.map((comment) => {
    const actor = actorMap.get(comment.user_id);
    const postTitle = ownPostTitleMap.get(comment.post_id) ?? "your post";
    const body = truncate(normalizeText(comment.comment) || "New activity");
    const isReply = Boolean(comment.parent_id);

    return {
      id: `comment:${comment.id}`,
      kind: isReply ? "reply" : "comment",
      createdAt: comment.created_at,
      title: isReply
        ? `${actor?.name ?? "Someone"} replied on ${postTitle}`
        : `${actor?.name ?? "Someone"} commented on ${postTitle}`,
      preview: body,
      actorName: actor?.name ?? "Unknown user",
      actorImage: actor?.image ?? null,
      path: `/post/${comment.post_id}`,
    };
  });

  const reportItems: InboxItem[] = reports.map((report) => {
    const resolver = report.resolved_by ? actorMap.get(report.resolved_by) : null;
    const postTitle = ownPostTitleMap.get(report.post_id) ?? "a post";
    const status = normalizeText(report.status).toLowerCase();
    const title =
      status === "removed"
        ? `A reported post was removed`
        : `A report was reviewed`;
    const preview =
      status === "removed"
        ? `Moderators removed ${postTitle}.`
        : `Moderators dismissed your report on ${postTitle}.`;

    return {
      id: `report:${report.id}:${report.resolved_at ?? report.created_at}:${status}`,
      kind: "moderation",
      createdAt: report.resolved_at ?? report.created_at,
      title,
      preview,
      actorName: resolver?.name ?? "Moderator team",
      actorImage: resolver?.image ?? null,
      path: `/post/${report.post_id}`,
    };
  });

  const communityPostItems: InboxItem[] = communityPosts.map((post) => {
    const actor = actorMap.get(post.user_id);
    const groupName = groupNameMap.get(post.group_id) ?? "your community";
    const previewSource =
      normalizeText(post.description) || normalizeText(post.title) || "New post";
    return {
      id: `community-post:${post.id}`,
      kind: "community_post",
      createdAt: post.created_at,
      title: `${actor?.name ?? "Someone"} posted in ${groupName}`,
      preview: truncate(previewSource, 110),
      actorName: actor?.name ?? "Unknown user",
      actorImage: actor?.image ?? null,
      path: `/post/${post.id}`,
    };
  });

  const chatItems: InboxItem[] = chatMessages.map((chat) => {
    const actor = actorMap.get(chat.user_id);
    const groupName = groupNameMap.get(chat.group_id) ?? "your community";
    const preview = truncate(normalizeText(chat.content) || "Sent a message", 110);
    return {
      id: `chat:${chat.id}`,
      kind: "chat",
      createdAt: chat.created_at,
      title: `${actor?.name ?? "Someone"} messaged in ${groupName}`,
      preview,
      actorName: actor?.name ?? "Unknown user",
      actorImage: actor?.image ?? null,
      path: `/community/${chat.group_id}/chat`,
    };
  });

  return [...commentItems, ...reportItems, ...communityPostItems, ...chatItems].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );
}
