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
  const { data, error } = await supabase
    .from("notifications")
    .select(
      `
      id,
      kind,
      created_at,
      title,
      body,
      path,
      actor:users!notifications_actor_user_id_fkey(id, name, image)
      `,
    )
    .eq("recipient_user_id", userId)
    .order("created_at", { ascending: false })
    .limit(300);

  if (error) throw error;

  return ((data ?? []) as any[]).map((row) => {
    const actor = (row.actor ?? null) as UserRow | null;
    const normalizedKind = normalizeText(row.kind).toLowerCase();
    const kind: InboxKind =
      normalizedKind === "comment" ||
      normalizedKind === "reply" ||
      normalizedKind === "moderation" ||
      normalizedKind === "community_post" ||
      normalizedKind === "chat"
        ? normalizedKind
        : "chat";

    return {
      id: String(row.id),
      kind,
      createdAt: String(row.created_at),
      title: normalizeText(row.title) || "New notification",
      preview: truncate(normalizeText(row.body) || "You have a new update."),
      actorName: actor?.name ?? "System",
      actorImage: actor?.image ?? null,
      path: normalizeText(row.path) || "/inbox",
    };
  });
}
