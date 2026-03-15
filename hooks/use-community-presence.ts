import { communityPresenceManager } from "@/lib/realtime/community-presence";
import { useEffect, useState } from "react";

export function useCommunityPresence(communityId?: string) {
  const [onlineUserIds, setOnlineUserIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!communityId) {
      setOnlineUserIds(new Set());
      return;
    }

    setOnlineUserIds(communityPresenceManager.getOnlineUserIds(communityId));
    const unsubscribe = communityPresenceManager.subscribe(
      communityId,
      (nextOnlineIds) => {
        setOnlineUserIds(new Set(nextOnlineIds));
      },
    );

    return unsubscribe;
  }, [communityId]);

  return {
    onlineUserIds,
    onlineCount: onlineUserIds.size,
  };
}
