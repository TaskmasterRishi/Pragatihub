import { supabase } from "@/lib/Supabase";
import type {
  ChatMediaType,
  ChatUser,
  CommunityChatMessage,
  PrivateChatMessage,
  PrivateChatOverview,
} from "@/types/chat";

function mapUser(row: any): ChatUser | null {
  if (!row) return null;
  return {
    id: String(row.id),
    name: String(row.name ?? "Unknown"),
    image: (row.image as string | null) ?? null,
  };
}

function mapCommunityMessage(row: any): CommunityChatMessage {
  return {
    id: String(row.id),
    group_id: String(row.group_id),
    user_id: String(row.user_id),
    content: String(row.content ?? ""),
    media_type: (row.media_type as ChatMediaType | null) ?? "text",
    media_url: (row.media_url as string | null) ?? null,
    created_at: String(row.created_at),
    clientStatus: "sent",
    user: mapUser(row.user),
  };
}

function mapPrivateMessage(row: any): PrivateChatMessage {
  return {
    id: String(row.id),
    chat_id: String(row.chat_id),
    user_id: String(row.user_id),
    content: String(row.content ?? ""),
    media_type: (row.media_type as ChatMediaType | null) ?? "text",
    media_url: (row.media_url as string | null) ?? null,
    created_at: String(row.created_at),
    clientStatus: "sent",
    user: mapUser(row.user),
  };
}

export async function fetchCommunityMeta(communityId: string, currentUserId: string) {
  const membershipRes = await supabase
    .from("user_groups")
    .select("group_id", { count: "exact", head: true })
    .eq("group_id", communityId)
    .eq("user_id", currentUserId);

  if (membershipRes.error) {
    return { isMember: false, error: membershipRes.error.message };
  }

  return { isMember: (membershipRes.count ?? 0) > 0, error: null };
}

export async function fetchCommunityMessages(communityId: string) {
  const { data, error } = await supabase
    .from("community_chat_messages")
    .select(
      "id, group_id, user_id, content, media_type, media_url, created_at, user:users(id, name, image)",
    )
    .eq("group_id", communityId)
    .order("created_at", { ascending: true })
    .limit(200);

  if (error) {
    return { data: [] as CommunityChatMessage[], error: error.message };
  }

  return {
    data: ((data ?? []) as any[]).map(mapCommunityMessage),
    error: null,
  };
}

export async function sendCommunityChatMessage(input: {
  groupId: string;
  userId: string;
  content: string;
  mediaType?: ChatMediaType;
  mediaUrl?: string | null;
  mentionUserIds?: string[];
  mentionHandles?: string[];
}) {
  const { data, error } = await supabase
    .from("community_chat_messages")
    .insert({
      group_id: input.groupId,
      user_id: input.userId,
      content: input.content,
      media_type: input.mediaType ?? "text",
      media_url: input.mediaUrl ?? null,
    })
    .select("id, group_id, user_id, content, media_type, media_url, created_at")
    .single();

  if (!error && data?.id && input.mentionUserIds?.length) {
    const mentionHandleByUserId = new Map<string, string | null>();
    input.mentionUserIds.forEach((mentionedUserId, index) => {
      if (!mentionedUserId || mentionedUserId === input.userId) return;
      if (mentionHandleByUserId.has(mentionedUserId)) return;
      mentionHandleByUserId.set(
        mentionedUserId,
        input.mentionHandles?.[index] ?? null,
      );
    });

    const uniqueMentionIds = Array.from(mentionHandleByUserId.keys());

    if (uniqueMentionIds.length > 0) {
      const rows = uniqueMentionIds.map((mentionedUserId) => ({
        message_id: data.id,
        group_id: input.groupId,
        mentioned_user_id: mentionedUserId,
        mentioned_by_user_id: input.userId,
        mention_text: mentionHandleByUserId.get(mentionedUserId) ?? null,
      }));

      await supabase.from("community_chat_message_mentions").insert(rows);
    }
  }

  return { data, error };
}

export async function searchUsersForPrivateChat(query: string, currentUserId: string) {
  const q = query.trim();
  if (q.length < 2) return { data: [] as ChatUser[], error: null };

  const like = `%${q}%`;
  const { data, error } = await supabase
    .from("users")
    .select("id, name, image")
    .neq("id", currentUserId)
    .or(`name.ilike.${like},email.ilike.${like}`)
    .order("name", { ascending: true })
    .limit(20);

  if (error) return { data: [] as ChatUser[], error: error.message };

  return {
    data: ((data ?? []) as any[]).map(mapUser).filter(Boolean) as ChatUser[],
    error: null,
  };
}

export async function getOrCreatePrivateChat(currentUserId: string, otherUserId: string) {
  const mineRes = await supabase
    .from("private_chat_participants")
    .select("chat_id")
    .eq("user_id", currentUserId)
    .limit(200);

  if (mineRes.error) {
    return { chatId: null, error: mineRes.error.message };
  }

  const candidateIds = (mineRes.data ?? []).map((row) => row.chat_id);
  if (candidateIds.length > 0) {
    const existingRes = await supabase
      .from("private_chat_participants")
      .select("chat_id")
      .eq("user_id", otherUserId)
      .in("chat_id", candidateIds)
      .limit(1)
      .maybeSingle();

    if (!existingRes.error && existingRes.data?.chat_id) {
      return { chatId: existingRes.data.chat_id as string, error: null };
    }
  }

  const createChatRes = await supabase
    .from("private_chats")
    .insert({})
    .select("id")
    .single();

  if (createChatRes.error || !createChatRes.data?.id) {
    return {
      chatId: null,
      error: createChatRes.error?.message ?? "Failed to create private chat.",
    };
  }

  const chatId = createChatRes.data.id as string;

  const participantsRes = await supabase
    .from("private_chat_participants")
    .insert([
      { chat_id: chatId, user_id: currentUserId },
      { chat_id: chatId, user_id: otherUserId },
    ]);

  if (participantsRes.error) {
    return { chatId: null, error: participantsRes.error.message };
  }

  return { chatId, error: null };
}

export async function fetchPrivateMessages(chatId: string) {
  const { data, error } = await supabase
    .from("private_chat_messages")
    .select(
      "id, chat_id, user_id, content, media_type, media_url, created_at, user:users(id, name, image)",
    )
    .eq("chat_id", chatId)
    .order("created_at", { ascending: true })
    .limit(200);

  if (error) {
    return { data: [] as PrivateChatMessage[], error: error.message };
  }

  return {
    data: ((data ?? []) as any[]).map(mapPrivateMessage),
    error: null,
  };
}

export async function sendPrivateChatMessage(input: {
  chatId: string;
  userId: string;
  content: string;
  mediaType?: ChatMediaType;
  mediaUrl?: string | null;
}) {
  const { data, error } = await supabase
    .from("private_chat_messages")
    .insert({
      chat_id: input.chatId,
      user_id: input.userId,
      content: input.content,
      media_type: input.mediaType ?? "text",
      media_url: input.mediaUrl ?? null,
    })
    .select("id, chat_id, user_id, content, media_type, media_url, created_at")
    .single();

  if (!error) {
    await supabase
      .from("private_chats")
      .update({ last_message_at: new Date().toISOString() })
      .eq("id", input.chatId);
  }

  return { data, error };
}

export async function fetchPrivateChatOverviews(userId: string) {
  const myParticipantsRes = await supabase
    .from("private_chat_participants")
    .select("chat_id")
    .eq("user_id", userId)
    .limit(200);

  if (myParticipantsRes.error) {
    return {
      data: [] as PrivateChatOverview[],
      error: myParticipantsRes.error.message,
    };
  }

  const chatIds = (myParticipantsRes.data ?? []).map((row) => row.chat_id);
  if (chatIds.length === 0) {
    return { data: [] as PrivateChatOverview[], error: null };
  }

  const [othersRes, messagesRes] = await Promise.all([
    supabase
      .from("private_chat_participants")
      .select("chat_id, user:users(id, name, image)")
      .in("chat_id", chatIds)
      .neq("user_id", userId),
    supabase
      .from("private_chat_messages")
      .select("chat_id, content, created_at")
      .in("chat_id", chatIds)
      .order("created_at", { ascending: false })
      .limit(500),
  ]);

  if (othersRes.error) {
    return { data: [] as PrivateChatOverview[], error: othersRes.error.message };
  }

  if (messagesRes.error) {
    return { data: [] as PrivateChatOverview[], error: messagesRes.error.message };
  }

  const lastByChat = new Map<string, { content: string; created_at: string }>();
  for (const row of messagesRes.data ?? []) {
    if (!lastByChat.has(row.chat_id)) {
      lastByChat.set(row.chat_id, {
        content: row.content ?? "",
        created_at: row.created_at,
      });
    }
  }

  const list: PrivateChatOverview[] = [];
  for (const row of othersRes.data ?? []) {
    const other = mapUser((row as any).user);
    if (!other) continue;
    const last = lastByChat.get(row.chat_id);
    list.push({
      chatId: row.chat_id,
      otherUser: other,
      lastMessageText: last?.content ?? "No messages yet",
      lastMessageAt: last?.created_at ?? null,
    });
  }

  list.sort((a, b) => {
    const at = a.lastMessageAt ? new Date(a.lastMessageAt).getTime() : 0;
    const bt = b.lastMessageAt ? new Date(b.lastMessageAt).getTime() : 0;
    return bt - at;
  });

  return { data: list, error: null };
}
