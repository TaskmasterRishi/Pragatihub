import { supabase } from "@/lib/Supabase";
import { AppState, type AppStateStatus } from "react-native";

const PRESENCE_EVENT = "presence_heartbeat";
const HEARTBEAT_INTERVAL_MS = 2 * 60 * 1000;
const HEARTBEAT_THROTTLE_MS = 30 * 1000;
const ONLINE_TTL_MS = 5 * 60 * 1000;
const MEMBERSHIP_REFRESH_MS = 10 * 60 * 1000;
const PRUNE_INTERVAL_MS = 30 * 1000;

type PresenceMap = Map<string, number>;
type PresenceListener = (onlineUserIds: Set<string>) => void;

class CommunityPresenceManager {
  private userId: string | null = null;
  private channels = new Map<string, ReturnType<typeof supabase.channel>>();
  private presenceByCommunity = new Map<string, PresenceMap>();
  private listeners = new Map<string, Set<PresenceListener>>();
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  private refreshTimer: ReturnType<typeof setInterval> | null = null;
  private pruneTimer: ReturnType<typeof setInterval> | null = null;
  private appStateSubscription: { remove: () => void } | null = null;
  private appState: AppStateStatus = AppState.currentState;
  private lastHeartbeatAt = 0;

  start(userId: string) {
    if (!userId) return;
    const isSameUser = this.userId === userId;
    this.userId = userId;

    if (!isSameUser) {
      this.clearChannels();
      this.presenceByCommunity.clear();
      this.listeners.forEach((_listeners, communityId) =>
        this.notifyListeners(communityId),
      );
    }

    this.ensureAppStateListener();
    this.ensureTimers();
    void this.refreshMemberships();
    void this.sendHeartbeats(true);
  }

  stop() {
    this.userId = null;
    this.lastHeartbeatAt = 0;
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
    if (this.refreshTimer) {
      clearInterval(this.refreshTimer);
      this.refreshTimer = null;
    }
    if (this.pruneTimer) {
      clearInterval(this.pruneTimer);
      this.pruneTimer = null;
    }
    if (this.appStateSubscription) {
      this.appStateSubscription.remove();
      this.appStateSubscription = null;
    }
    this.appState = AppState.currentState;
    this.clearChannels();
    this.presenceByCommunity.clear();
    this.listeners.forEach((_listeners, communityId) =>
      this.notifyListeners(communityId),
    );
  }

  subscribe(communityId: string, listener: PresenceListener) {
    if (!communityId) return () => {};
    let set = this.listeners.get(communityId);
    if (!set) {
      set = new Set<PresenceListener>();
      this.listeners.set(communityId, set);
    }
    set.add(listener);

    void this.ensureCommunityChannel(communityId);
    listener(this.getOnlineUserIds(communityId));

    return () => {
      const next = this.listeners.get(communityId);
      if (!next) return;
      next.delete(listener);
      if (next.size === 0) {
        this.listeners.delete(communityId);
      }
    };
  }

  getOnlineUserIds(communityId: string): Set<string> {
    const now = Date.now();
    const presence = this.presenceByCommunity.get(communityId);
    if (!presence) return new Set<string>();

    for (const [id, seenAt] of presence.entries()) {
      if (now - seenAt > ONLINE_TTL_MS) {
        presence.delete(id);
      }
    }
    return new Set<string>(presence.keys());
  }

  private ensureAppStateListener() {
    if (this.appStateSubscription) return;
    this.appStateSubscription = AppState.addEventListener("change", (state) => {
      this.appState = state;
      if (state === "active") {
        void this.sendHeartbeats(true);
      }
    });
  }

  private ensureTimers() {
    if (!this.heartbeatTimer) {
      this.heartbeatTimer = setInterval(() => {
        void this.sendHeartbeats();
      }, HEARTBEAT_INTERVAL_MS);
    }
    if (!this.refreshTimer) {
      this.refreshTimer = setInterval(() => {
        void this.refreshMemberships();
      }, MEMBERSHIP_REFRESH_MS);
    }
    if (!this.pruneTimer) {
      this.pruneTimer = setInterval(() => {
        this.pruneStaleUsers();
      }, PRUNE_INTERVAL_MS);
    }
  }

  private clearChannels() {
    for (const channel of this.channels.values()) {
      void supabase.removeChannel(channel);
    }
    this.channels.clear();
  }

  private markUserOnline(communityId: string, userId: string, seenAt = Date.now()) {
    if (!communityId || !userId) return;
    let presence = this.presenceByCommunity.get(communityId);
    if (!presence) {
      presence = new Map<string, number>();
      this.presenceByCommunity.set(communityId, presence);
    }
    presence.set(userId, seenAt);
    this.notifyListeners(communityId);
  }

  private pruneStaleUsers() {
    const now = Date.now();
    for (const [communityId, presence] of this.presenceByCommunity.entries()) {
      let changed = false;
      for (const [id, seenAt] of presence.entries()) {
        if (now - seenAt > ONLINE_TTL_MS) {
          presence.delete(id);
          changed = true;
        }
      }
      if (changed) this.notifyListeners(communityId);
    }
  }

  private notifyListeners(communityId: string) {
    const listeners = this.listeners.get(communityId);
    if (!listeners || listeners.size === 0) return;
    const onlineUserIds = this.getOnlineUserIds(communityId);
    for (const listener of listeners) {
      listener(onlineUserIds);
    }
  }

  private async ensureCommunityChannel(communityId: string) {
    if (!this.userId || !communityId || this.channels.has(communityId)) return;

    const channel = supabase.channel(`community-presence:${communityId}`, {
      config: { broadcast: { self: true } },
    });

    channel.on("broadcast", { event: PRESENCE_EVENT }, ({ payload }) => {
      const senderId = (payload as { userId?: string })?.userId;
      if (!senderId) return;
      this.markUserOnline(communityId, senderId);
    });

    channel.subscribe((status) => {
      if (status === "SUBSCRIBED") {
        if (this.userId) this.markUserOnline(communityId, this.userId);
        void this.sendHeartbeatForCommunity(communityId, true);
      }
    });

    this.channels.set(communityId, channel);
  }

  private async refreshMemberships() {
    if (!this.userId) return;
    const { data, error } = await supabase
      .from("user_groups")
      .select("group_id")
      .eq("user_id", this.userId);
    if (error || !data) return;

    const nextCommunityIds = new Set<string>();
    for (const row of data) {
      if (row.group_id) {
        nextCommunityIds.add(row.group_id);
        void this.ensureCommunityChannel(row.group_id);
      }
    }

    for (const [communityId, channel] of this.channels.entries()) {
      if (nextCommunityIds.has(communityId)) continue;
      if (this.listeners.has(communityId)) continue;
      void supabase.removeChannel(channel);
      this.channels.delete(communityId);
      this.presenceByCommunity.delete(communityId);
    }
  }

  private async sendHeartbeatForCommunity(
    communityId: string,
    force = false,
  ) {
    if (!this.userId || !this.channels.has(communityId)) return;
    if (this.appState !== "active") return;
    const now = Date.now();
    if (!force && now - this.lastHeartbeatAt < HEARTBEAT_THROTTLE_MS) return;

    const channel = this.channels.get(communityId);
    if (!channel) return;
    this.lastHeartbeatAt = now;
    this.markUserOnline(communityId, this.userId, now);

    await channel.httpSend(PRESENCE_EVENT, {
      userId: this.userId,
      sentAt: new Date(now).toISOString(),
    });
  }

  private async sendHeartbeats(force = false) {
    if (!this.userId || this.appState !== "active") return;
    const now = Date.now();
    if (!force && now - this.lastHeartbeatAt < HEARTBEAT_THROTTLE_MS) return;

    this.lastHeartbeatAt = now;
    for (const [communityId, channel] of this.channels.entries()) {
      this.markUserOnline(communityId, this.userId, now);
      await channel.httpSend(PRESENCE_EVENT, {
        userId: this.userId,
        sentAt: new Date(now).toISOString(),
      });
    }
  }
}

export const communityPresenceManager = new CommunityPresenceManager();
