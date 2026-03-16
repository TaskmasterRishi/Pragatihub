import { supabase } from "@/lib/Supabase";
import type { Tables } from "@/types/database.types";

export type ReportReason =
  | "spam"
  | "harassment"
  | "misinformation"
  | "nsfw"
  | "off_topic"
  | "other";

export type ReportStatus = "pending" | "dismissed" | "removed";

export type PostReport = Tables<"post_reports"> & {
  post: {
    id: string;
    title: string;
    description: string | null;
    user_id: string;
  } | null;
  reporter: {
    id: string;
    name: string;
    image: string | null;
  } | null;
  resolver: {
    id: string;
    name: string;
  } | null;
};

export const REPORT_REASONS: {
  value: ReportReason;
  label: string;
  color: string;
}[] = [
  { value: "spam", label: "Spam", color: "#F59E0B" },
  { value: "harassment", label: "Harassment", color: "#EF4444" },
  { value: "misinformation", label: "Misinformation", color: "#8B5CF6" },
  { value: "nsfw", label: "NSFW", color: "#EC4899" },
  { value: "off_topic", label: "Off Topic", color: "#6B7280" },
  { value: "other", label: "Other", color: "#3B82F6" },
];

/**
 * Check if the current authenticated user is a moderator or owner of a group.
 */
export async function checkIsModerator(
  groupId: string,
  requestingUserId?: string | null,
): Promise<boolean> {
  let userId = requestingUserId ?? null;
  if (!userId) {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    userId = user?.id ?? null;
  }
  if (!userId) return false;

  const [modRes, groupRes] = await Promise.all([
    supabase
      .from("group_moderators")
      .select("user_id")
      .eq("group_id", groupId)
      .eq("user_id", userId)
      .eq("is_active", true)
      .maybeSingle(),
    supabase
      .from("groups")
      .select("owner_id")
      .eq("id", groupId)
      .maybeSingle(),
  ]);

  if (!modRes.error && modRes.data) return true;
  if (!groupRes.error && groupRes.data?.owner_id === userId) return true;
  return false;
}

/**
 * Fetch reports for a given group with post + reporter data.
 */
export async function fetchReports(
  groupId: string,
  status: ReportStatus = "pending",
): Promise<{ data: PostReport[] | null; error: unknown }> {
  const { data, error } = await supabase
    .from("post_reports")
    .select(
      `*,
      post:posts(id, title, description, user_id),
      reporter:users!post_reports_reporter_id_fkey(id, name, image),
      resolver:users!post_reports_resolved_by_fkey(id, name)`,
    )
    .eq("group_id", groupId)
    .eq("status", status)
    .order("created_at", { ascending: false });

  return { data: data as PostReport[] | null, error };
}

/**
 * Submit a report for a post.
 */
export async function submitReport(
  postId: string,
  groupId: string,
  reason: ReportReason,
  reporterId: string,
  details?: string,
): Promise<{ error: unknown }> {
  const normalizedPostId = postId?.trim();
  const normalizedGroupId = groupId?.trim();
  const normalizedReporterId = reporterId?.trim();

  if (!normalizedReporterId) return { error: new Error("Not authenticated") };
  if (!normalizedPostId) return { error: new Error("Invalid post id") };

  const { data: postRow, error: postError } = await supabase
    .from("posts")
    .select("id, group_id")
    .eq("id", normalizedPostId)
    .maybeSingle();

  if (postError) return { error: postError };
  if (!postRow) {
    return {
      error: new Error("This post no longer exists. Refresh and try again."),
    };
  }

  const { error } = await supabase.from("post_reports").insert({
    post_id: postRow.id,
    group_id: postRow.group_id || normalizedGroupId,
    reporter_id: normalizedReporterId,
    reason,
    details: details?.trim() || null,
  });

  return { error };
}

/**
 * Resolve a report — dismiss it or remove the post.
 * If action === 'removed', the post itself is also deleted.
 */
export async function resolveReport(
  reportId: string,
  postId: string,
  action: "dismissed" | "removed",
  resolverUserId?: string | null,
): Promise<{ error: unknown }> {
  let actorId = resolverUserId ?? null;
  if (!actorId) {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    actorId = user?.id ?? null;
  }
  if (!actorId) return { error: new Error("Not authenticated") };

  const { error: updateError } = await supabase
    .from("post_reports")
    .update({
      status: action,
      resolved_by: actorId,
      resolved_at: new Date().toISOString(),
    })
    .eq("id", reportId);

  if (updateError) return { error: updateError };

  if (action === "removed") {
    const { error: deleteError } = await supabase
      .from("posts")
      .delete()
      .eq("id", postId);
    if (deleteError) return { error: deleteError };
  }

  return { error: null };
}

/**
 * Notify a post author to update content and mark the report as resolved.
 * This creates a moderator comment on the post so the author can see guidance.
 */
export async function notifyAuthorToChangeContent(
  reportId: string,
  postId: string,
  message: string,
  moderatorUserId?: string | null,
): Promise<{ error: unknown }> {
  const trimmed = message.trim();
  if (!trimmed) return { error: new Error("Notification message is required") };

  let actorId = moderatorUserId ?? null;
  if (!actorId) {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    actorId = user?.id ?? null;
  }
  if (!actorId) return { error: new Error("Not authenticated") };

  const moderatorComment = `[Moderator Notice] ${trimmed}`;
  const now = new Date().toISOString();
  const commentId = `comment_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;

  const { error: commentError } = await supabase.from("comments").insert({
    id: commentId,
    post_id: postId,
    user_id: actorId,
    comment: moderatorComment,
    parent_id: null,
    created_at: now,
  });

  if (commentError) return { error: commentError };

  const { error: updateError } = await supabase
    .from("post_reports")
    .update({
      status: "dismissed",
      resolved_by: actorId,
      resolved_at: now,
    })
    .eq("id", reportId);

  if (updateError) return { error: updateError };
  return { error: null };
}

/**
 * Get count of pending reports for a group (for badge display).
 */
export async function fetchPendingReportCount(
  groupId: string,
): Promise<number> {
  const { count } = await supabase
    .from("post_reports")
    .select("*", { count: "exact", head: true })
    .eq("group_id", groupId)
    .eq("status", "pending");

  return count ?? 0;
}
