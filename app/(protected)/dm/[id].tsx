import ChatThread from "@/components/chat/ChatThread";
import { useGlobalSearchParams, useRouter } from "expo-router";

export default function PrivateChatScreen() {
  const router = useRouter();
  const { id, name } = useGlobalSearchParams<{ id: string; name?: string }>();
  const otherUserId = Array.isArray(id) ? id[0] : id;
  const otherUserName = Array.isArray(name) ? name[0] : name;

  return (
    <ChatThread
      chatType="private"
      otherUserId={otherUserId}
      title={otherUserName || "Private Chat"}
      subtitle="One-to-one conversation"
      emptyTitle="No messages yet"
      emptySubtitle="Say hi to start your direct chat."
      showBackButton
      onBackPress={() => router.back()}
    />
  );
}
