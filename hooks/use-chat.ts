import {
  fetchCommunityMessages,
  fetchCommunityMeta,
  fetchPrivateMessages,
  getOrCreatePrivateChat,
  sendCommunityChatMessage,
  sendPrivateChatMessage,
} from "@/lib/actions/chat";
import { supabase } from "@/lib/Supabase";
import type {
  AnyChatMessage,
  ChatMediaType,
  ChatUser,
  CommunityChatMessage,
  ListItem,
  PrivateChatMessage,
  TypingUser,
} from "@/types/chat";
import { buildListItems, groupMessages } from "@/types/chat";
import { useUser } from "@clerk/clerk-expo";
import { RealtimeChannel } from "@supabase/supabase-js";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

export type { ListItem, MessageGroup } from "@/types/chat";

type UseChatOptions = {
  chatType: "community" | "private";
  communityId?: string;
  privateChatId?: string;
  otherUserId?: string;
};

type SendPayload = {
  content: string;
  mediaType?: ChatMediaType;
  mediaUrl?: string | null;
  mentionUserIds?: string[];
  mentionHandles?: string[];
};

function toTypingUser(row: any): TypingUser {
  return {
    id: String(row.user_id),
    name: String(row.user_name ?? "Someone"),
    image: (row.user_image as string | null) ?? null,
  };
}

export function useChat({
  chatType,
  communityId,
  privateChatId,
  otherUserId,
}: UseChatOptions) {
  const { user } = useUser();
  const currentUserId = user?.id;
  const isAuthed = !!currentUserId;

  const [resolvedPrivateChatId, setResolvedPrivateChatId] = useState<string | null>(
    privateChatId ?? null,
  );
  const [messages, setMessages] = useState<AnyChatMessage[]>([]);
  const [sending, setSending] = useState(false);
  const [errorText, setErrorText] = useState<string | null>(null);
  const [typingUsers, setTypingUsers] = useState<TypingUser[]>([]);
  const [isMember, setIsMember] = useState(chatType === "private");
  const [loading, setLoading] = useState(true);

  const channelRef = useRef<RealtimeChannel | null>(null);

  const activeContextId =
    chatType === "community" ? communityId : resolvedPrivateChatId ?? undefined;

  useEffect(() => {
    if (chatType !== "private") return;
    if (privateChatId) {
      setResolvedPrivateChatId(privateChatId);
      return;
    }
    setResolvedPrivateChatId(null);
  }, [chatType, privateChatId]);

  useEffect(() => {
    if (chatType !== "private") return;
    if (!currentUserId || !otherUserId || privateChatId) return;

    let cancelled = false;
    const run = async () => {
      const { chatId, error } = await getOrCreatePrivateChat(currentUserId, otherUserId);
      if (cancelled) return;
      if (error || !chatId) {
        setErrorText(error ?? "Could not open this chat.");
        setLoading(false);
        return;
      }
      setResolvedPrivateChatId(chatId);
    };

    void run();
    return () => {
      cancelled = true;
    };
  }, [chatType, currentUserId, otherUserId, privateChatId]);

  const hydrateSender = useCallback(async (userId: string): Promise<ChatUser | null> => {
    const { data } = await supabase
      .from("users")
      .select("id, name, image")
      .eq("id", userId)
      .maybeSingle();

    if (!data) return null;
    return {
      id: data.id,
      name: data.name,
      image: data.image,
    };
  }, []);

  const loadInitialData = useCallback(async () => {
    if (!isAuthed || !currentUserId || !activeContextId) return;

    setLoading(true);
    setErrorText(null);

    if (chatType === "community") {
      const [metaRes, msgRes] = await Promise.all([
        fetchCommunityMeta(activeContextId, currentUserId),
        fetchCommunityMessages(activeContextId),
      ]);

      setIsMember(metaRes.isMember);
      if (metaRes.error) setErrorText(metaRes.error);
      if (msgRes.error) setErrorText(msgRes.error);
      setMessages(msgRes.data);
    } else {
      setIsMember(true);
      const msgRes = await fetchPrivateMessages(activeContextId);
      if (msgRes.error) setErrorText(msgRes.error);
      setMessages(msgRes.data);
    }

    setLoading(false);
  }, [activeContextId, chatType, currentUserId, isAuthed]);

  useEffect(() => {
    if (!activeContextId || !isAuthed || !currentUserId) return;
    void loadInitialData();
  }, [activeContextId, isAuthed, currentUserId, loadInitialData]);

  useEffect(() => {
    if (!activeContextId || !isAuthed || !currentUserId || !user) return;

    const topic = chatType === "community" ? `community-chat:${activeContextId}` : `private-chat:${activeContextId}`;
    const table = chatType === "community" ? "community_chat_messages" : "private_chat_messages";
    const column = chatType === "community" ? "group_id" : "chat_id";

    const channel = supabase.channel(topic, {
      config: { presence: { key: currentUserId } },
    });

    channelRef.current = channel;

    channel
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table,
          filter: `${column}=eq.${activeContextId}`,
        },
        async (payload) => {
          const row = payload.new as any;
          const sender = await hydrateSender(String(row.user_id));

          const base = {
            ...row,
            media_type: (row.media_type as ChatMediaType | null) ?? "text",
            media_url: (row.media_url as string | null) ?? null,
            clientStatus: "sent" as const,
            user: sender,
          };

          setMessages((prev) => {
            if (prev.some((m) => m.id === base.id)) return prev;

            const optimisticIndex = prev.findIndex(
              (m) =>
                m.clientStatus === "sending" &&
                m.user_id === base.user_id &&
                m.content === base.content &&
                (m.media_url ?? null) === (base.media_url ?? null),
            );

            if (optimisticIndex >= 0) {
              const next = [...prev];
              next[optimisticIndex] = base;
              return next;
            }

            return [...prev, base];
          });
        },
      )
      .on("presence", { event: "sync" }, () => {
        const state = channel.presenceState();
        const typers: TypingUser[] = [];

        Object.keys(state).forEach((key) => {
          const presence = state[key] as any[];
          presence.forEach((entry) => {
            if (entry.typing && entry.user_id !== currentUserId) {
              typers.push(toTypingUser(entry));
            }
          });
        });

        setTypingUsers(Array.from(new Map(typers.map((t) => [t.id, t])).values()));
      })
      .subscribe(async (status) => {
        if (status === "SUBSCRIBED") {
          await channel.track({
            user_id: currentUserId,
            user_name: user.fullName || user.firstName || "User",
            user_image: user.imageUrl || null,
            typing: false,
          });
        }
      });

    return () => {
      void supabase.removeChannel(channel);
      channelRef.current = null;
      setTypingUsers([]);
    };
  }, [activeContextId, chatType, currentUserId, hydrateSender, isAuthed, user]);

  const setTypingStatus = useCallback(
    async (typing: boolean) => {
      if (!channelRef.current || !user || !currentUserId) return;
      await channelRef.current.track({
        user_id: currentUserId,
        user_name: user.fullName || user.firstName || "User",
        user_image: user.imageUrl || null,
        typing,
      });
    },
    [currentUserId, user],
  );

  const sendMessage = useCallback(
    async ({
      content,
      mediaType = "text",
      mediaUrl = null,
      mentionUserIds = [],
      mentionHandles = [],
    }: SendPayload) => {
      if (!isAuthed || !currentUserId || !activeContextId || sending) return;
      const normalized = content.trim();
      if (!normalized && !mediaUrl) return;
      if (chatType === "community" && !isMember) return;

      const optimisticId = `optimistic-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const now = new Date().toISOString();
      const optimisticBase = {
        id: optimisticId,
        user_id: currentUserId,
        content: normalized,
        media_type: mediaType,
        media_url: mediaUrl,
        created_at: now,
        user: {
          id: currentUserId,
          name: user?.fullName || user?.firstName || "You",
          image: user?.imageUrl ?? null,
        },
        clientStatus: "sending" as const,
      };

      const optimisticMessage: AnyChatMessage =
        chatType === "community"
          ? ({
              ...optimisticBase,
              group_id: activeContextId,
            } as CommunityChatMessage)
          : ({
              ...optimisticBase,
              chat_id: activeContextId,
            } as PrivateChatMessage);

      setMessages((prev) => [...prev, optimisticMessage]);
      setSending(true);
      setErrorText(null);
      void setTypingStatus(false);

      const submit =
        chatType === "community"
          ? sendCommunityChatMessage({
              groupId: activeContextId,
              userId: currentUserId,
              content: normalized,
              mediaType,
              mediaUrl,
              mentionUserIds,
              mentionHandles,
            })
          : sendPrivateChatMessage({
              chatId: activeContextId,
              userId: currentUserId,
              content: normalized,
              mediaType,
              mediaUrl,
            });

      const { data, error } = await submit;

      if (error || !data) {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === optimisticId ? { ...m, clientStatus: "failed" as const } : m,
          ),
        );
        setErrorText(error?.message ?? "Failed to send message.");
      } else {
        setMessages((prev) =>
          prev.map((m) => {
            if (m.id !== optimisticId) return m;
            if (chatType === "community" && "group_id" in data) {
              return {
                ...m,
                id: data.id,
                group_id: data.group_id,
                user_id: data.user_id,
                content: data.content,
                media_type: data.media_type ?? "text",
                media_url: data.media_url ?? null,
                created_at: data.created_at,
                clientStatus: "sent" as const,
              } as CommunityChatMessage;
            }
            if (chatType === "private" && "chat_id" in data) {
              return {
                ...m,
                id: data.id,
                chat_id: data.chat_id,
                user_id: data.user_id,
                content: data.content,
                media_type: data.media_type ?? "text",
                media_url: data.media_url ?? null,
                created_at: data.created_at,
                clientStatus: "sent" as const,
              } as PrivateChatMessage;
            }
            return m;
          }),
        );
      }

      setSending(false);
    },
    [activeContextId, chatType, currentUserId, isAuthed, isMember, sending, setTypingStatus, user],
  );

  const listItems = useMemo<ListItem[]>(() => {
    const grouped = groupMessages(messages, currentUserId ?? "");
    return buildListItems(grouped);
  }, [currentUserId, messages]);

  return {
    loading,
    sending,
    errorText,
    typingUsers,
    isMember,
    messages,
    listItems,
    activeContextId,
    setMessages,
    setErrorText,
    setTypingStatus,
    sendMessage,
    reload: loadInitialData,
  };
}
