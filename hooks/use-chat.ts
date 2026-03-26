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
  ChatReplyRef,
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
  replyToMessageId?: string | null;
  replyTo?: ChatReplyRef | null;
  mentionUserIds?: string[];
  mentionHandles?: string[];
};

type ReactionChangePayload = {
  messageId: string;
  userId: string;
  emoji: string;
  mode: "added" | "removed";
};

type MessageUpdatePayload = {
  messageId: string;
  content: string;
  editedAt: string | null;
};

type MessageDeletePayload = {
  messageId: string;
};

type MessageCreatePayload = {
  id: string;
  user_id: string;
  content: string;
  media_type?: ChatMediaType | null;
  media_url?: string | null;
  reply_to_message_id?: string | null;
  edited_at?: string | null;
  is_deleted?: boolean | null;
  created_at: string;
  user?: ChatUser | null;
};

function toTypingUser(row: any): TypingUser {
  return {
    id: String(row.user_id),
    name: String(row.user_name ?? "Someone"),
    image: (row.user_image as string | null) ?? null,
  };
}

function mapReplyRefRow(row: any): ChatReplyRef {
  return {
    id: String(row.id),
    content: String(row.content ?? ""),
    user_id: String(row.user_id),
    user: row.user
      ? {
          id: String(row.user.id),
          name: String(row.user.name ?? "Unknown"),
          image: (row.user.image as string | null) ?? null,
        }
      : null,
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

  const [resolvedPrivateChatId, setResolvedPrivateChatId] = useState<
    string | null
  >(privateChatId ?? null);
  const [messages, setMessages] = useState<AnyChatMessage[]>([]);
  const [sending, setSending] = useState(false);
  const [errorText, setErrorText] = useState<string | null>(null);
  const [typingUsers, setTypingUsers] = useState<TypingUser[]>([]);
  const [isMember, setIsMember] = useState(chatType === "private");
  const [loading, setLoading] = useState(true);

  const channelRef = useRef<RealtimeChannel | null>(null);
  const toReplyRef = useCallback((message: AnyChatMessage): ChatReplyRef => {
    return {
      id: message.id,
      content: message.content ?? "",
      user_id: message.user_id,
      user: message.user ?? null,
    };
  }, []);
  const applyReactionChange = useCallback((payload: ReactionChangePayload) => {
    setMessages((prev) =>
      prev.map((message) => {
        if (message.id !== payload.messageId) return message;
        const reactions = message.reactions ?? [];
        if (payload.mode === "removed") {
          return {
            ...message,
            reactions: reactions.filter(
              (reaction) =>
                !(
                  reaction.user_id === payload.userId &&
                  reaction.emoji === payload.emoji
                ),
            ),
          } as AnyChatMessage;
        }

        const exists = reactions.some(
          (reaction) =>
            reaction.user_id === payload.userId &&
            reaction.emoji === payload.emoji,
        );
        if (exists) return message;
        return {
          ...message,
          reactions: [
            ...reactions,
            { user_id: payload.userId, emoji: payload.emoji },
          ],
        } as AnyChatMessage;
      }),
    );
  }, []);
  const applyMessageUpdate = useCallback((payload: MessageUpdatePayload) => {
    setMessages((prev) =>
      prev
        .map((message) => {
          if (message.id !== payload.messageId) return message;
          return {
            ...message,
            content: payload.content,
            edited_at: payload.editedAt,
          } as AnyChatMessage;
        })
        .map((message) => {
          if (message.reply_to?.id !== payload.messageId) return message;
          return {
            ...message,
            reply_to: {
              ...(message.reply_to ?? {
                id: payload.messageId,
                user_id: "",
                user: null,
              }),
              content: payload.content,
            },
          } as AnyChatMessage;
        }),
    );
  }, []);
  const applyMessageDelete = useCallback((payload: MessageDeletePayload) => {
    setMessages((prev) =>
      prev
        .filter((message) => message.id !== payload.messageId)
        .map((message) => {
          if (message.reply_to?.id !== payload.messageId) return message;
          return {
            ...message,
            reply_to: {
              ...(message.reply_to ?? {
                id: payload.messageId,
                user_id: "",
                user: null,
              }),
              content: "Message deleted",
            },
          } as AnyChatMessage;
        }),
    );
  }, []);
  const applyIncomingMessage = useCallback(
    (base: AnyChatMessage) => {
      let shouldHydrateReplyRef = false;
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
          const replyTo = base.reply_to_message_id
            ? prev.find((message) => message.id === base.reply_to_message_id)
            : null;
          next[optimisticIndex] = base;
          if (replyTo) {
            next[optimisticIndex] = {
              ...(next[optimisticIndex] as AnyChatMessage),
              reply_to: toReplyRef(replyTo),
            } as AnyChatMessage;
          }
          return next;
        }

        const replyTo = base.reply_to_message_id
          ? prev.find((message) => message.id === base.reply_to_message_id)
          : null;
        if (base.reply_to_message_id && !replyTo) {
          shouldHydrateReplyRef = true;
        }
        return [
          ...prev,
          {
            ...base,
            reply_to: replyTo ? toReplyRef(replyTo) : null,
          } as AnyChatMessage,
        ];
      });

      if (base.reply_to_message_id && shouldHydrateReplyRef) {
        void hydrateReplyRef(base.reply_to_message_id).then((replyRef) => {
          if (!replyRef) return;
          setMessages((prev) =>
            prev.map((message) =>
              message.id === base.id
                ? ({ ...message, reply_to: replyRef } as AnyChatMessage)
                : message,
            ),
          );
        });
      }
    },
    //@ts-ignore
    [hydrateReplyRef, toReplyRef],
  );

  const activeContextId =
    chatType === "community"
      ? communityId
      : (resolvedPrivateChatId ?? undefined);

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
      const { chatId, error } = await getOrCreatePrivateChat(
        currentUserId,
        otherUserId,
      );
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

  const hydrateSender = useCallback(
    async (userId: string): Promise<ChatUser | null> => {
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
    },
    [],
  );
  const hydrateReplyRef = useCallback(
    async (messageId: string): Promise<ChatReplyRef | null> => {
      if (!messageId) return null;
      const table =
        chatType === "community"
          ? "community_chat_messages"
          : "private_chat_messages";
      const { data } = await supabase
        .from(table)
        .select("id, content, user_id, user:users(id, name, image)")
        .eq("id", messageId)
        .maybeSingle();
      if (!data) return null;
      return mapReplyRefRow(data);
    },
    [chatType],
  );

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

    const topic =
      chatType === "community"
        ? `community-chat:${activeContextId}`
        : `private-chat:${activeContextId}`;
    const table =
      chatType === "community"
        ? "community_chat_messages"
        : "private_chat_messages";
    const reactionsTable =
      chatType === "community"
        ? "community_chat_message_reactions"
        : "private_chat_message_reactions";
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
            reply_to_message_id:
              (row.reply_to_message_id as string | null) ?? null,
            clientStatus: "sent" as const,
            user: sender,
          } as AnyChatMessage;
          applyIncomingMessage(base);
        },
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table,
          filter: `${column}=eq.${activeContextId}`,
        },
        async (payload) => {
          const row = payload.new as any;
          setMessages((prev) =>
            prev
              .map((message) => {
                if (message.id !== String(row.id)) return message;
                return {
                  ...message,
                  content:
                    typeof row.content === "string"
                      ? row.content
                      : message.content,
                  media_type:
                    (row.media_type as ChatMediaType | null) ??
                    message.media_type ??
                    "text",
                  media_url:
                    (row.media_url as string | null) ??
                    message.media_url ??
                    null,
                  created_at:
                    typeof row.created_at === "string"
                      ? row.created_at
                      : message.created_at,
                  reply_to_message_id:
                    (row.reply_to_message_id as string | null) ??
                    message.reply_to_message_id ??
                    null,
                  edited_at:
                    (row.edited_at as string | null) ??
                    message.edited_at ??
                    null,
                  is_deleted:
                    typeof row.is_deleted === "boolean"
                      ? row.is_deleted
                      : (message.is_deleted ?? false),
                  clientStatus: "sent" as const,
                } as AnyChatMessage;
              })
              .map((message) => {
                if (message.reply_to?.id !== String(row.id)) return message;
                return {
                  ...message,
                  reply_to: {
                    ...(message.reply_to ?? {
                      id: String(row.id),
                      user_id: String(row.user_id ?? ""),
                      user: null,
                    }),
                    content: String(row.content ?? ""),
                  },
                } as AnyChatMessage;
              }),
          );
        },
      )
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: reactionsTable,
        },
        (payload) => {
          const row = payload.new as any;
          const messageId = String(row.message_id ?? "");
          const userId = String(row.user_id ?? "");
          const emoji = String(row.emoji ?? "");
          if (!messageId || !userId || !emoji) return;
          applyReactionChange({ messageId, userId, emoji, mode: "added" });
        },
      )
      .on(
        "postgres_changes",
        {
          event: "DELETE",
          schema: "public",
          table: reactionsTable,
        },
        (payload) => {
          const row = payload.old as any;
          const messageId = String(row.message_id ?? "");
          const userId = String(row.user_id ?? "");
          const emoji = String(row.emoji ?? "");
          if (!messageId || !userId || !emoji) return;
          applyReactionChange({ messageId, userId, emoji, mode: "removed" });
        },
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: reactionsTable,
        },
        (payload) => {
          const oldRow = payload.old as any;
          const newRow = payload.new as any;

          const oldMessageId = String(oldRow.message_id ?? "");
          const oldUserId = String(oldRow.user_id ?? "");
          const oldEmoji = String(oldRow.emoji ?? "");
          const newMessageId = String(newRow.message_id ?? "");
          const newUserId = String(newRow.user_id ?? "");
          const newEmoji = String(newRow.emoji ?? "");
          if (!newMessageId || !newUserId || !newEmoji) return;
          if (oldMessageId && oldUserId && oldEmoji) {
            applyReactionChange({
              messageId: oldMessageId,
              userId: oldUserId,
              emoji: oldEmoji,
              mode: "removed",
            });
          }
          applyReactionChange({
            messageId: newMessageId,
            userId: newUserId,
            emoji: newEmoji,
            mode: "added",
          });
        },
      )
      .on("broadcast", { event: "reaction_changed" }, ({ payload }) => {
        const data = payload as Partial<ReactionChangePayload> | null;
        const messageId = String(data?.messageId ?? "");
        const userId = String(data?.userId ?? "");
        const emoji = String(data?.emoji ?? "");
        const mode = data?.mode;
        if (!messageId || !userId || !emoji) return;
        if (mode !== "added" && mode !== "removed") return;
        applyReactionChange({ messageId, userId, emoji, mode });
      })
      .on("broadcast", { event: "message_updated" }, ({ payload }) => {
        const data = payload as Partial<MessageUpdatePayload> | null;
        const messageId = String(data?.messageId ?? "");
        const content = typeof data?.content === "string" ? data.content : "";
        const editedAt =
          typeof data?.editedAt === "string" || data?.editedAt === null
            ? data.editedAt
            : null;
        if (!messageId) return;
        applyMessageUpdate({ messageId, content, editedAt });
      })
      .on("broadcast", { event: "message_deleted" }, ({ payload }) => {
        const data = payload as Partial<MessageDeletePayload> | null;
        const messageId = String(data?.messageId ?? "");
        if (!messageId) return;
        applyMessageDelete({ messageId });
      })
      .on("broadcast", { event: "message_created" }, ({ payload }) => {
        const data = payload as Partial<MessageCreatePayload> | null;
        const id = String(data?.id ?? "");
        const userId = String(data?.user_id ?? "");
        const content = typeof data?.content === "string" ? data.content : "";
        const createdAt = String(data?.created_at ?? "");
        if (!id || !userId || !createdAt) return;

        const incoming: AnyChatMessage =
          chatType === "community"
            ? ({
                id,
                group_id: activeContextId,
                user_id: userId,
                content,
                media_type:
                  (data?.media_type as ChatMediaType | null) ?? "text",
                media_url: (data?.media_url as string | null) ?? null,
                reply_to_message_id:
                  (data?.reply_to_message_id as string | null) ?? null,
                edited_at: (data?.edited_at as string | null) ?? null,
                is_deleted: Boolean(data?.is_deleted ?? false),
                created_at: createdAt,
                clientStatus: "sent",
                user: data?.user ?? null,
              } as CommunityChatMessage)
            : ({
                id,
                chat_id: activeContextId,
                user_id: userId,
                content,
                media_type:
                  (data?.media_type as ChatMediaType | null) ?? "text",
                media_url: (data?.media_url as string | null) ?? null,
                reply_to_message_id:
                  (data?.reply_to_message_id as string | null) ?? null,
                edited_at: (data?.edited_at as string | null) ?? null,
                is_deleted: Boolean(data?.is_deleted ?? false),
                created_at: createdAt,
                clientStatus: "sent",
                user: data?.user ?? null,
              } as PrivateChatMessage);

        applyIncomingMessage(incoming);
      })
      .on(
        "postgres_changes",
        {
          event: "DELETE",
          schema: "public",
          table,
          filter: `${column}=eq.${activeContextId}`,
        },
        (payload) => {
          const row = payload.old as any;
          setMessages((prev) =>
            prev
              .filter((message) => message.id !== String(row.id))
              .map((message) => {
                if (message.reply_to?.id !== String(row.id)) return message;
                return {
                  ...message,
                  reply_to: {
                    ...(message.reply_to ?? {
                      id: String(row.id),
                      user_id: String(row.user_id ?? ""),
                      user: null,
                    }),
                    content: "Message deleted",
                  },
                } as AnyChatMessage;
              }),
          );
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

        setTypingUsers(
          Array.from(new Map(typers.map((t) => [t.id, t])).values()),
        );
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
  }, [
    activeContextId,
    applyMessageDelete,
    applyMessageUpdate,
    applyIncomingMessage,
    applyReactionChange,
    chatType,
    currentUserId,
    hydrateSender,
    isAuthed,
    toReplyRef,
    user,
  ]);

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
      replyToMessageId = null,
      replyTo = null,
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
        reply_to_message_id: replyToMessageId,
        reply_to: replyTo,
        edited_at: null,
        is_deleted: false,
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
              replyToMessageId,
              mentionUserIds,
              mentionHandles,
            })
          : sendPrivateChatMessage({
              chatId: activeContextId,
              userId: currentUserId,
              content: normalized,
              mediaType,
              mediaUrl,
              replyToMessageId,
            });

      const { data, error } = await submit;

      if (error || !data) {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === optimisticId
              ? { ...m, clientStatus: "failed" as const }
              : m,
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
                reply_to_message_id: data.reply_to_message_id ?? null,
                edited_at: data.edited_at ?? null,
                is_deleted: data.is_deleted ?? false,
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
                reply_to_message_id: data.reply_to_message_id ?? null,
                edited_at: data.edited_at ?? null,
                is_deleted: data.is_deleted ?? false,
                created_at: data.created_at,
                clientStatus: "sent" as const,
              } as PrivateChatMessage;
            }
            return m;
          }),
        );

        const createdPayload: MessageCreatePayload = {
          id: data.id,
          user_id: data.user_id,
          content: data.content ?? normalized,
          media_type: (data.media_type as ChatMediaType | null) ?? mediaType,
          media_url: (data.media_url as string | null) ?? mediaUrl,
          reply_to_message_id:
            data.reply_to_message_id ?? replyToMessageId ?? null,
          edited_at: data.edited_at ?? null,
          is_deleted: data.is_deleted ?? false,
          created_at: data.created_at,
          user: {
            id: currentUserId,
            name: user?.fullName || user?.firstName || "You",
            image: user?.imageUrl ?? null,
          },
        };

        const channel = channelRef.current;
        if (channel) {
          await channel.send({
            type: "broadcast",
            event: "message_created",
            payload: createdPayload,
          });
        }
      }

      setSending(false);
    },
    [
      activeContextId,
      chatType,
      currentUserId,
      isAuthed,
      isMember,
      sending,
      setTypingStatus,
      user,
    ],
  );

  const listItems = useMemo<ListItem[]>(() => {
    const grouped = groupMessages(messages, currentUserId ?? "");
    return buildListItems(grouped);
  }, [currentUserId, messages]);

  const broadcastReactionChange = useCallback(
    async (payload: ReactionChangePayload) => {
      const channel = channelRef.current;
      if (!channel) return;
      await channel.send({
        type: "broadcast",
        event: "reaction_changed",
        payload,
      });
    },
    [],
  );
  const broadcastMessageUpdate = useCallback(
    async (payload: MessageUpdatePayload) => {
      const channel = channelRef.current;
      if (!channel) return;
      await channel.send({
        type: "broadcast",
        event: "message_updated",
        payload,
      });
    },
    [],
  );
  const broadcastMessageDelete = useCallback(
    async (payload: MessageDeletePayload) => {
      const channel = channelRef.current;
      if (!channel) return;
      await channel.send({
        type: "broadcast",
        event: "message_deleted",
        payload,
      });
    },
    [],
  );

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
    broadcastReactionChange,
    broadcastMessageUpdate,
    broadcastMessageDelete,
    sendMessage,
    reload: loadInitialData,
  };
}
