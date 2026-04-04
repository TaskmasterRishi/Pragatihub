import { format, formatDistanceToNow } from "date-fns";

import type { NotificationKind } from "@/lib/notifications/types";
import { supabase } from "@/lib/Supabase";

export type InboxKind = NotificationKind;
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

type PostRow = {
  id: string;
  title: string | null;
  user_id: string | null;
};

type GroupRow = {
  id: string;
  name: string | null;
  owner_id?: string | null;
};

type ParentCommentRow = {
  id: string;
  user_id: string | null;
  comment: string | null;
};

type ChatRefRow = {
  id: string;
  user_id: string | null;
  content: string | null;
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

export function formatInboxCreatedAt(iso: string) {
  try {
    return format(new Date(iso), "dd MMM yyyy, hh:mm a");
  } catch {
    return iso;
  }
}

export async function fetchInboxItems(userId: string): Promise<InboxItem[]> {
  const [likesRes, commentsRes, mentionsRes, commentLikesRes, badgesRes, modVotesRes, joinsRes, reportsRes, communityMsgsRes, privateMsgsRes] = await Promise.allSettled([
    supabase
      .from("post_upvotes")
      .select(
        `
        post_id,
        user_id,
        created_at,
        post:posts!post_upvotes_post_id_fkey(id, title, user_id),
        actor:users!post_upvotes_user_id_fkey(id, name, image)
        `,
      )
      .order("created_at", { ascending: false })
      .limit(220),
    supabase
      .from("comments")
      .select(
        `
        id,
        post_id,
        user_id,
        parent_id,
        comment,
        created_at,
        post:posts!comments_post_id_fkey(id, title, user_id),
        parent:comments!comments_parent_id_fkey(id, user_id, comment),
        actor:users!comments_user_id_fkey(id, name, image)
        `,
      )
      .order("created_at", { ascending: false })
      .limit(260),
    supabase
      .from("community_chat_message_mentions")
      .select(
        `
        id,
        group_id,
        mention_text,
        created_at,
        mentioned_user_id,
        actor:users!community_chat_message_mentions_mentioned_by_user_id_fkey(id, name, image),
        group:groups!community_chat_message_mentions_group_id_fkey(id, name)
        `,
      )
      .eq("mentioned_user_id", userId)
      .order("created_at", { ascending: false })
      .limit(120),
    supabase
      .from("comment_upvotes")
      .select(
        `
        comment_id,
        user_id,
        created_at,
        comment:comments!comment_upvotes_comment_id_fkey(id, post_id, user_id, comment),
        actor:users!comment_upvotes_user_id_fkey(id, name, image)
        `,
      )
      .order("created_at", { ascending: false })
      .limit(220),
    supabase
      .from("post_badge_awards")
      .select(
        `
        id,
        badge_key,
        post_id,
        created_at,
        awarded_to_user_id,
        actor:users!post_badge_awards_awarded_by_user_id_fkey(id, name, image),
        post:posts!post_badge_awards_post_id_fkey(id, title)
        `,
      )
      .eq("awarded_to_user_id", userId)
      .order("created_at", { ascending: false })
      .limit(120),
    supabase
      .from("group_moderator_votes")
      .select(
        `
        group_id,
        candidate_user_id,
        voter_user_id,
        created_at,
        actor:users!group_moderator_votes_voter_user_id_fkey(id, name, image),
        group:groups!group_moderator_votes_group_id_fkey(id, name)
        `,
      )
      .eq("candidate_user_id", userId)
      .order("created_at", { ascending: false })
      .limit(120),
    supabase
      .from("user_groups")
      .select(
        `
        group_id,
        user_id,
        joined_at,
        actor:users!user_groups_user_id_fkey(id, name, image),
        group:groups!user_groups_group_id_fkey(id, name, owner_id)
        `,
      )
      .order("joined_at", { ascending: false })
      .limit(220),
    supabase
      .from("post_reports")
      .select(
        `
        id,
        post_id,
        reporter_id,
        reason,
        status,
        created_at,
        resolved_at,
        resolved_by,
        post:posts!post_reports_post_id_fkey(id, title, user_id),
        reporter:users!post_reports_reporter_id_fkey(id, name, image),
        resolver:users!post_reports_resolved_by_fkey(id, name, image)
        `,
      )
      .order("created_at", { ascending: false })
      .limit(180),
    supabase
      .from("community_chat_messages")
      .select(
        `
        id,
        group_id,
        user_id,
        content,
        created_at,
        reply_to_message_id,
        is_deleted,
        actor:users!community_chat_messages_user_id_fkey(id, name, image),
        group:groups!community_chat_messages_group_id_fkey(id, name),
        reply_to:community_chat_messages!community_chat_messages_reply_to_message_id_fkey(id, user_id, content)
        `,
      )
      .not("reply_to_message_id", "is", null)
      .eq("is_deleted", false)
      .order("created_at", { ascending: false })
      .limit(180),
    supabase
      .from("private_chat_messages")
      .select(
        `
        id,
        chat_id,
        user_id,
        content,
        created_at,
        reply_to_message_id,
        is_deleted,
        actor:users!private_chat_messages_user_id_fkey(id, name, image),
        reply_to:private_chat_messages!private_chat_messages_reply_to_message_id_fkey(id, user_id, content)
        `,
      )
      .eq("is_deleted", false)
      .order("created_at", { ascending: false })
      .limit(220),
  ]);

  const items: InboxItem[] = [];

  if (likesRes.status === "fulfilled" && !likesRes.value.error) {
    for (const row of (likesRes.value.data ?? []) as any[]) {
      const post = (row.post ?? null) as PostRow | null;
      const actor = (row.actor ?? null) as UserRow | null;
      const actorId = normalizeText(row.user_id);
      const recipientId = normalizeText(post?.user_id ?? "");
      if (!post?.id || !recipientId || recipientId !== userId || actorId === userId) {
        continue;
      }

      const actorName = normalizeText(actor?.name) || "Someone";
      const postTitle = normalizeText(post.title);
      items.push({
        id: `post_like:${String(row.post_id)}:${actorId}:${String(row.created_at ?? "")}`,
        kind: "post_like",
        createdAt: String(row.created_at ?? new Date().toISOString()),
        title: `${actorName} liked your post`,
        preview: truncate(postTitle ? `Post: ${postTitle}` : "Someone liked your post."),
        actorName,
        actorImage: actor?.image ?? null,
        path: `/post/${String(post.id)}`,
      });
    }
  }

  if (commentsRes.status === "fulfilled" && !commentsRes.value.error) {
    for (const row of (commentsRes.value.data ?? []) as any[]) {
      const post = (row.post ?? null) as PostRow | null;
      const actor = (row.actor ?? null) as UserRow | null;
      const parent = (row.parent ?? null) as ParentCommentRow | null;
      const actorId = normalizeText(row.user_id);
      if (actorId === userId) continue;

      const isReply = Boolean(row.parent_id);
      const actorName = normalizeText(actor?.name) || "Someone";
      const postTitle = normalizeText(post?.title);
      const commentBody = truncate(
        normalizeText(row.comment) ||
          (isReply ? "Replied to your comment." : "Commented on your post."),
      );

      if (!isReply) {
        const postOwnerId = normalizeText(post?.user_id ?? "");
        if (!post?.id || postOwnerId !== userId) continue;
        items.push({
          id: `comment:${String(row.id)}`,
          kind: "comment",
          createdAt: String(row.created_at ?? new Date().toISOString()),
          title: `${actorName} commented on your post`,
          preview: truncate(postTitle ? `${commentBody} · ${postTitle}` : commentBody),
          actorName,
          actorImage: actor?.image ?? null,
          path: `/post/${String(post.id)}`,
        });
        continue;
      }

      const parentOwnerId = normalizeText(parent?.user_id ?? "");
      if (parentOwnerId !== userId || !row.post_id) continue;
      items.push({
        id: `reply:${String(row.id)}`,
        kind: "reply",
        createdAt: String(row.created_at ?? new Date().toISOString()),
        title: `${actorName} replied to your comment`,
        preview: commentBody,
        actorName,
        actorImage: actor?.image ?? null,
        path: `/post/${String(row.post_id)}`,
      });
    }
  }

  if (mentionsRes.status === "fulfilled" && !mentionsRes.value.error) {
    for (const row of (mentionsRes.value.data ?? []) as any[]) {
      const actor = (row.actor ?? null) as UserRow | null;
      const group = (row.group ?? null) as GroupRow | null;
      const actorName = normalizeText(actor?.name) || "Someone";
      const groupName = normalizeText(group?.name) || "community chat";
      items.push({
        id: `chat_mention:${String(row.id)}`,
        kind: "chat_mention",
        createdAt: String(row.created_at ?? new Date().toISOString()),
        title: `${actorName} mentioned you in ${groupName}`,
        preview: truncate(normalizeText(row.mention_text) || "You were mentioned in chat."),
        actorName,
        actorImage: actor?.image ?? null,
        path: `/community/${String(row.group_id)}/chat`,
      });
    }
  }

  if (commentLikesRes.status === "fulfilled" && !commentLikesRes.value.error) {
    for (const row of (commentLikesRes.value.data ?? []) as any[]) {
      const comment = row.comment as any;
      const actor = (row.actor ?? null) as UserRow | null;
      if (!comment?.id || normalizeText(comment.user_id) !== userId) continue;
      const actorId = normalizeText(row.user_id);
      if (!actorId || actorId === userId) continue;
      const actorName = normalizeText(actor?.name) || "Someone";
      const commentText = truncate(normalizeText(comment.comment) || "your comment");
      items.push({
        id: `comment_like:${String(row.comment_id)}:${actorId}:${String(row.created_at ?? "")}`,
        kind: "comment_like",
        createdAt: String(row.created_at ?? new Date().toISOString()),
        title: `${actorName} liked your comment`,
        preview: commentText,
        actorName,
        actorImage: actor?.image ?? null,
        path: `/post/${String(comment.post_id)}`,
      });
    }
  }

  if (badgesRes.status === "fulfilled" && !badgesRes.value.error) {
    for (const row of (badgesRes.value.data ?? []) as any[]) {
      const actor = (row.actor ?? null) as UserRow | null;
      const post = (row.post ?? null) as PostRow | null;
      const actorName = normalizeText(actor?.name) || "Someone";
      const badgeKey = normalizeText(row.badge_key).replace(/_/g, " ");
      items.push({
        id: `badge_award:${String(row.id)}`,
        kind: "badge_award",
        createdAt: String(row.created_at ?? new Date().toISOString()),
        title: `${actorName} awarded you a badge`,
        preview: truncate(
          `${badgeKey || "Community"}${post?.title ? ` · ${normalizeText(post.title)}` : ""}`,
        ),
        actorName,
        actorImage: actor?.image ?? null,
        path: post?.id ? `/post/${String(post.id)}` : "/inbox",
      });
    }
  }

  if (modVotesRes.status === "fulfilled" && !modVotesRes.value.error) {
    for (const row of (modVotesRes.value.data ?? []) as any[]) {
      const actor = (row.actor ?? null) as UserRow | null;
      const group = (row.group ?? null) as GroupRow | null;
      const actorName = normalizeText(actor?.name) || "Someone";
      const groupName = normalizeText(group?.name) || "your community";
      items.push({
        id: `moderator_vote:${String(row.group_id)}:${normalizeText(row.voter_user_id)}:${String(row.created_at ?? "")}`,
        kind: "moderator_vote",
        createdAt: String(row.created_at ?? new Date().toISOString()),
        title: `${actorName} voted for you as moderator`,
        preview: truncate(groupName),
        actorName,
        actorImage: actor?.image ?? null,
        path: `/community/${String(row.group_id)}/members`,
      });
    }
  }

  if (joinsRes.status === "fulfilled" && !joinsRes.value.error) {
    for (const row of (joinsRes.value.data ?? []) as any[]) {
      const group = (row.group ?? null) as GroupRow | null;
      const actor = (row.actor ?? null) as UserRow | null;
      const ownerId = normalizeText(group?.owner_id ?? "");
      const actorId = normalizeText(row.user_id);
      if (!group?.id || ownerId !== userId || !actorId || actorId === userId) continue;
      const actorName = normalizeText(actor?.name) || "Someone";
      const groupName = normalizeText(group.name) || "your community";
      items.push({
        id: `community_join:${String(group.id)}:${actorId}:${String(row.joined_at ?? "")}`,
        kind: "community_join",
        createdAt: String(row.joined_at ?? new Date().toISOString()),
        title: `${actorName} joined your community`,
        preview: truncate(groupName),
        actorName,
        actorImage: actor?.image ?? null,
        path: `/community/${String(group.id)}/members`,
      });
    }
  }

  if (reportsRes.status === "fulfilled" && !reportsRes.value.error) {
    for (const row of (reportsRes.value.data ?? []) as any[]) {
      const post = (row.post ?? null) as PostRow | null;
      if (!post?.id) continue;

      const reporter = (row.reporter ?? null) as UserRow | null;
      const resolver = (row.resolver ?? null) as UserRow | null;
      const reporterId = normalizeText(row.reporter_id);
      const postOwnerId = normalizeText(post.user_id ?? "");
      const status = normalizeText(row.status).toLowerCase();

      if (postOwnerId === userId && reporterId && reporterId !== userId) {
        const actorName = normalizeText(reporter?.name) || "Someone";
        items.push({
          id: `report_on_post:${String(row.id)}`,
          kind: "moderation",
          createdAt: String(row.created_at ?? new Date().toISOString()),
          title: `${actorName} reported your post`,
          preview: truncate(
            `${normalizeText(row.reason) || "Reported"}${post.title ? ` · ${normalizeText(post.title)}` : ""}`,
          ),
          actorName,
          actorImage: reporter?.image ?? null,
          path: `/post/${String(post.id)}`,
        });
      }

      if (reporterId === userId && row.resolved_by && status && status !== "pending") {
        const actorName = normalizeText(resolver?.name) || "Moderator";
        items.push({
          id: `report_update:${String(row.id)}`,
          kind: "moderation",
          createdAt: String(row.resolved_at ?? row.created_at ?? new Date().toISOString()),
          title: `Your report was ${status}`,
          preview: truncate(post.title ? normalizeText(post.title) : "Moderation update"),
          actorName,
          actorImage: resolver?.image ?? null,
          path: `/post/${String(post.id)}`,
        });
      }
    }
  }

  if (communityMsgsRes.status === "fulfilled" && !communityMsgsRes.value.error) {
    for (const row of (communityMsgsRes.value.data ?? []) as any[]) {
      const actor = (row.actor ?? null) as UserRow | null;
      const group = (row.group ?? null) as GroupRow | null;
      const replyTo = (row.reply_to ?? null) as ChatRefRow | null;
      const actorId = normalizeText(row.user_id);
      const replyTargetId = normalizeText(replyTo?.user_id ?? "");
      if (!replyTargetId || replyTargetId !== userId || actorId === userId) continue;
      const actorName = normalizeText(actor?.name) || "Someone";
      const groupName = normalizeText(group?.name) || "community chat";
      items.push({
        id: `chat_reply:${String(row.id)}`,
        kind: "chat_reply",
        createdAt: String(row.created_at ?? new Date().toISOString()),
        title: `${actorName} replied to you in ${groupName}`,
        preview: truncate(normalizeText(row.content) || "Replied in chat."),
        actorName,
        actorImage: actor?.image ?? null,
        path: `/community/${String(row.group_id)}/chat`,
      });
    }
  }

  let privateParticipantsByChat = new Map<string, string[]>();
  if (privateMsgsRes.status === "fulfilled" && !privateMsgsRes.value.error) {
    const chatIds = Array.from(
      new Set(
        ((privateMsgsRes.value.data ?? []) as any[])
          .map((row) => normalizeText(row.chat_id))
          .filter(Boolean),
      ),
    );
    if (chatIds.length > 0) {
      const participantsRes = await supabase
        .from("private_chat_participants")
        .select("chat_id, user_id")
        .in("chat_id", chatIds);
      if (!participantsRes.error) {
        privateParticipantsByChat = new Map<string, string[]>();
        for (const row of participantsRes.data ?? []) {
          const chatId = normalizeText((row as any).chat_id);
          const participantId = normalizeText((row as any).user_id);
          if (!chatId || !participantId) continue;
          const current = privateParticipantsByChat.get(chatId) ?? [];
          current.push(participantId);
          privateParticipantsByChat.set(chatId, current);
        }
      }
    }
  }

  if (privateMsgsRes.status === "fulfilled" && !privateMsgsRes.value.error) {
    for (const row of (privateMsgsRes.value.data ?? []) as any[]) {
      const actor = (row.actor ?? null) as UserRow | null;
      const actorId = normalizeText(row.user_id);
      const chatId = normalizeText(row.chat_id);
      if (!chatId || !actorId || actorId === userId) continue;
      const participants = privateParticipantsByChat.get(chatId) ?? [];
      if (!participants.includes(userId)) continue;

      const replyTo = (row.reply_to ?? null) as ChatRefRow | null;
      const isReplyToMe = normalizeText(replyTo?.user_id ?? "") === userId;
      const actorName = normalizeText(actor?.name) || "Someone";
      items.push({
        id: `dm:${String(row.id)}`,
        kind: isReplyToMe ? "chat_reply" : "dm",
        createdAt: String(row.created_at ?? new Date().toISOString()),
        title: isReplyToMe ? `${actorName} replied to you in DM` : `New message from ${actorName}`,
        preview: truncate(normalizeText(row.content) || "Sent you a message."),
        actorName,
        actorImage: actor?.image ?? null,
        path: `/dm/${actorId}`,
      });
    }
  }

  return items
    .sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    )
    .slice(0, 300);
}
