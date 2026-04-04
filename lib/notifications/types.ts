import type { Database } from "@/types/database.types";

export const NOTIFICATION_KINDS = [
  "comment",
  "reply",
  "moderation",
  "community_post",
  "chat",
  "chat_mention",
  "post_like",
  "comment_like",
  "badge_award",
  "moderator_vote",
  "community_join",
  "chat_reply",
  "dm",
] as const;

export type NotificationKind = (typeof NOTIFICATION_KINDS)[number];

export const NOTIFICATION_SOURCE_TABLES = [
  "comments",
  "post_upvotes",
  "community_chat_message_mentions",
  "post_reports",
  "post_badge_awards",
  "group_moderator_votes",
  "user_groups",
  "private_chat_messages",
  "community_chat_messages",
] as const;

export type NotificationSourceTable = (typeof NOTIFICATION_SOURCE_TABLES)[number];

export type NotificationRow = Database["public"]["Tables"]["notifications"]["Row"];
export type NotificationInsertBase =
  Database["public"]["Tables"]["notifications"]["Insert"];

export type NotificationInsert = Omit<NotificationInsertBase, "kind" | "source_table"> & {
  kind: NotificationKind;
  source_table?: NotificationSourceTable | null;
};
