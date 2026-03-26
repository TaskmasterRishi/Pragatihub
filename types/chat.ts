import type { Tables } from "@/types/database.types";

export type ChatMediaType = "text" | "image" | "gif" | "sticker" | "video";

export type ChatUser = Pick<Tables<"users">, "id" | "name" | "image">;

export type ChatClientStatus = "sent" | "sending" | "failed";

export type ChatMessageReaction = {
  emoji: string;
  user_id: string;
};

export type ChatReplyRef = {
  id: string;
  content: string;
  user_id: string;
  user: ChatUser | null;
};

export type CommunityChatMessage = Tables<"community_chat_messages"> & {
  user: ChatUser | null;
  media_type?: ChatMediaType | null;
  media_url?: string | null;
  reply_to_message_id?: string | null;
  edited_at?: string | null;
  is_deleted?: boolean | null;
  reply_to?: ChatReplyRef | null;
  reactions?: ChatMessageReaction[];
  clientStatus?: ChatClientStatus;
};

export type PrivateChatMessage = Tables<"private_chat_messages"> & {
  user: ChatUser | null;
  media_type?: ChatMediaType | null;
  media_url?: string | null;
  reply_to_message_id?: string | null;
  edited_at?: string | null;
  is_deleted?: boolean | null;
  reply_to?: ChatReplyRef | null;
  reactions?: ChatMessageReaction[];
  clientStatus?: ChatClientStatus;
};

export type AnyChatMessage = CommunityChatMessage | PrivateChatMessage;

export type TypingUser = {
  id: string;
  name: string;
  image: string | null;
};

export type MessageGroup<TMessage extends AnyChatMessage = AnyChatMessage> = {
  key: string;
  senderId: string;
  sender: ChatUser | null;
  mine: boolean;
  timestamp: string;
  minuteKey: string;
  messages: TMessage[];
};

export type ListItem<TMessage extends AnyChatMessage = AnyChatMessage> =
  | { type: "divider"; key: string; label: string }
  | { type: "group"; data: MessageGroup<TMessage> };

export type PickerMode = "gif" | "sticker";

export type PickerItem = {
  id: string;
  previewUrl: string;
  mediaUrl: string;
};

export type PrivateChatOverview = {
  chatId: string;
  otherUser: ChatUser;
  lastMessageText: string;
  lastMessageAt: string | null;
};

function minuteKey(isoString: string): string {
  return isoString.slice(0, 16);
}

function formatTime(isoString: string): string {
  const dt = new Date(isoString);
  if (Number.isNaN(dt.getTime())) return "";
  return dt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export function formatDateDivider(isoString: string): string {
  const dt = new Date(isoString);
  if (Number.isNaN(dt.getTime())) return "";
  const now = new Date();
  const isToday =
    dt.getDate() === now.getDate() &&
    dt.getMonth() === now.getMonth() &&
    dt.getFullYear() === now.getFullYear();
  if (isToday) return "Today";

  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  const isYesterday =
    dt.getDate() === yesterday.getDate() &&
    dt.getMonth() === yesterday.getMonth() &&
    dt.getFullYear() === yesterday.getFullYear();
  if (isYesterday) return "Yesterday";

  return dt.toLocaleDateString([], {
    weekday: "long",
    month: "short",
    day: "numeric",
  });
}

export function groupMessages<TMessage extends AnyChatMessage>(
  messages: TMessage[],
  myId: string,
): MessageGroup<TMessage>[] {
  const groups: MessageGroup<TMessage>[] = [];
  for (const msg of messages) {
    const mk = minuteKey(msg.created_at);
    const last = groups[groups.length - 1];
    if (last && last.senderId === msg.user_id && last.minuteKey === mk) {
      last.messages.push(msg);
    } else {
      groups.push({
        key: msg.id,
        senderId: msg.user_id,
        sender: msg.user,
        mine: msg.user_id === myId,
        timestamp: formatTime(msg.created_at),
        minuteKey: mk,
        messages: [msg],
      });
    }
  }
  return groups;
}

export function buildListItems<TMessage extends AnyChatMessage>(
  groups: MessageGroup<TMessage>[],
): ListItem<TMessage>[] {
  const items: ListItem<TMessage>[] = [];
  let lastDate = "";

  for (const g of groups) {
    const date = g.minuteKey.slice(0, 10);
    if (date !== lastDate) {
      lastDate = date;
      items.push({
        type: "divider",
        key: `divider-${date}`,
        label: formatDateDivider(g.messages[0].created_at),
      });
    }

    items.push({ type: "group", data: g });
  }

  return items;
}

export function parseKeyboardMediaInput(raw: string): {
  content: string;
  mediaType?: ChatMediaType;
  mediaUrl?: string;
} {
  const text = raw.trim();
  if (!text) return { content: "" };

  const urlRegex = /(https?:\/\/[^\s]+)/gi;
  const urls = text.match(urlRegex) ?? [];
  if (urls.length === 0) return { content: text };

  const mediaUrl = urls[0];
  if (!mediaUrl) return { content: text };
  const lower = mediaUrl.toLowerCase();

  const isGif =
    lower.includes(".gif") ||
    lower.includes("giphy.com") ||
    lower.includes("tenor.com");
  const isSticker = lower.includes(".webp") || lower.includes("sticker");
  const isImage =
    lower.includes(".png") ||
    lower.includes(".jpg") ||
    lower.includes(".jpeg") ||
    lower.includes(".heic");
  const isVideo =
    lower.includes(".mp4") ||
    lower.includes(".mov") ||
    lower.includes(".m4v") ||
    lower.includes(".webm");

  if (!isGif && !isSticker && !isImage && !isVideo) {
    return { content: text };
  }

  const mediaType: ChatMediaType = isVideo
    ? "video"
    : isGif
      ? "gif"
      : isSticker
        ? "sticker"
        : "image";

  const content = text.replace(mediaUrl, "").trim();
  return { content, mediaType, mediaUrl };
}
