import ChatThread from "@/components/chat/ChatThread";
import { useCommunityStats } from "@/hooks/use-community-stats";
import { fetchGroupById } from "@/lib/actions/groups";
import { useGlobalSearchParams } from "expo-router";
import { useEffect, useState } from "react";

export default function CommunityChatTab() {
  const { id } = useGlobalSearchParams<{ id: string }>();
  const communityId = Array.isArray(id) ? id[0] : id;
  const { membersCount } = useCommunityStats(communityId);
  const [communityName, setCommunityName] = useState("Community Chat");

  useEffect(() => {
    if (!communityId) return;
    let cancelled = false;

    const load = async () => {
      const { data } = await fetchGroupById(communityId);
      if (cancelled) return;
      setCommunityName(data?.name ? `${data.name} Chat` : "Community Chat");
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, [communityId]);

  return (
    <ChatThread
      chatType="community"
      communityId={communityId}
      title={communityName}
      subtitle={`${membersCount} ${membersCount === 1 ? "member" : "members"}`}
      emptyTitle="No messages yet"
      emptySubtitle="Be the first to say something!"
    />
  );
}
