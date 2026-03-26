import { globalPresenceManager } from "@/lib/realtime/global-presence";
import { useEffect, useState } from "react";

export function useGlobalPresence() {
  const [onlineUserIds, setOnlineUserIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    setOnlineUserIds(globalPresenceManager.getOnlineUserIds());
    const unsubscribe = globalPresenceManager.subscribe((nextOnlineIds) => {
      setOnlineUserIds(new Set(nextOnlineIds));
    });

    return unsubscribe;
  }, []);

  return {
    onlineUserIds,
    onlineCount: onlineUserIds.size,
  };
}
