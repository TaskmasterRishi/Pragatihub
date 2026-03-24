import { supabase } from "@/lib/Supabase";
import { useEffect, useState } from "react";
import { useCommunityPresence } from "./use-community-presence";

export function useCommunityStats(communityId?: string) {
  const [membersCount, setMembersCount] = useState(0);
  const { onlineCount } = useCommunityPresence(communityId);

  useEffect(() => {
    if (!communityId) {
      setMembersCount(0);
      return;
    }

    const fetchMembersCount = async () => {
      const { count, error } = await supabase
        .from("user_groups")
        .select("group_id", { count: "exact", head: true })
        .eq("group_id", communityId);
      
      if (!error && count !== null) {
        setMembersCount(count);
      }
    };

    void fetchMembersCount();

    // Subscribe to membership changes
    const channel = supabase
      .channel(`community-stats:${communityId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "user_groups",
          filter: `group_id=eq.${communityId}`,
        },
        () => {
          void fetchMembersCount();
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [communityId]);

  return {
    membersCount,
    onlineCount,
  };
}
