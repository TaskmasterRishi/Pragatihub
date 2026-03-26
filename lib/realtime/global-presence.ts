import { supabase } from "@/lib/Supabase";
import { AppState, type AppStateStatus } from "react-native";

const GLOBAL_PRESENCE_CHANNEL = "global-presence";
const GLOBAL_PRESENCE_EVENT = "global_presence_heartbeat";
const HEARTBEAT_INTERVAL_MS = 2 * 60 * 1000;
const HEARTBEAT_THROTTLE_MS = 30 * 1000;
const ONLINE_TTL_MS = 5 * 60 * 1000;
const PRUNE_INTERVAL_MS = 30 * 1000;

type PresenceListener = (onlineUserIds: Set<string>) => void;

class GlobalPresenceManager {
  private userId: string | null = null;
  private channel: ReturnType<typeof supabase.channel> | null = null;
  private onlineByUser = new Map<string, number>();
  private listeners = new Set<PresenceListener>();
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  private pruneTimer: ReturnType<typeof setInterval> | null = null;
  private appStateSubscription: { remove: () => void } | null = null;
  private appState: AppStateStatus = AppState.currentState;
  private lastHeartbeatAt = 0;

  start(userId: string) {
    if (!userId) return;
    const isSameUser = this.userId === userId;
    this.userId = userId;

    if (!isSameUser) {
      this.onlineByUser.clear();
      this.lastHeartbeatAt = 0;
      this.notifyListeners();
    }

    this.ensureAppStateListener();
    this.ensureTimers();
    void this.ensureChannel();
    void this.sendHeartbeat(true);
  }

  stop() {
    this.userId = null;
    this.lastHeartbeatAt = 0;

    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
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

    if (this.channel) {
      void supabase.removeChannel(this.channel);
      this.channel = null;
    }

    this.onlineByUser.clear();
    this.notifyListeners();
  }

  subscribe(listener: PresenceListener) {
    this.listeners.add(listener);
    listener(this.getOnlineUserIds());

    return () => {
      this.listeners.delete(listener);
    };
  }

  getOnlineUserIds(): Set<string> {
    this.pruneStaleUsers();
    return new Set<string>(this.onlineByUser.keys());
  }

  private ensureAppStateListener() {
    if (this.appStateSubscription) return;
    this.appStateSubscription = AppState.addEventListener("change", (state) => {
      this.appState = state;
      if (state === "active") {
        void this.sendHeartbeat(true);
      }
    });
  }

  private ensureTimers() {
    if (!this.heartbeatTimer) {
      this.heartbeatTimer = setInterval(() => {
        void this.sendHeartbeat();
      }, HEARTBEAT_INTERVAL_MS);
    }
    if (!this.pruneTimer) {
      this.pruneTimer = setInterval(() => {
        this.pruneStaleUsers();
      }, PRUNE_INTERVAL_MS);
    }
  }

  private markUserOnline(userId: string, seenAt = Date.now()) {
    if (!userId) return;
    this.onlineByUser.set(userId, seenAt);
    this.notifyListeners();
  }

  private pruneStaleUsers() {
    const now = Date.now();
    let changed = false;

    for (const [id, seenAt] of this.onlineByUser.entries()) {
      if (now - seenAt > ONLINE_TTL_MS) {
        this.onlineByUser.delete(id);
        changed = true;
      }
    }

    if (changed) {
      this.notifyListeners();
    }
  }

  private notifyListeners() {
    const snapshot = this.getOnlineUserIds();
    for (const listener of this.listeners) {
      listener(snapshot);
    }
  }

  private async ensureChannel() {
    if (!this.userId || this.channel) return;

    const channel = supabase.channel(GLOBAL_PRESENCE_CHANNEL, {
      config: { broadcast: { self: true } },
    });

    channel.on("broadcast", { event: GLOBAL_PRESENCE_EVENT }, ({ payload }) => {
      const senderId = (payload as { userId?: string })?.userId;
      if (!senderId) return;
      this.markUserOnline(senderId);
    });

    channel.subscribe((status) => {
      if (status === "SUBSCRIBED") {
        if (this.userId) this.markUserOnline(this.userId);
        void this.sendHeartbeat(true);
      }
    });

    this.channel = channel;
  }

  private async sendHeartbeat(force = false) {
    if (!this.userId || !this.channel) return;
    if (this.appState !== "active") return;

    const now = Date.now();
    if (!force && now - this.lastHeartbeatAt < HEARTBEAT_THROTTLE_MS) return;

    this.lastHeartbeatAt = now;
    this.markUserOnline(this.userId, now);

    await this.channel.send({
      type: "broadcast",
      event: GLOBAL_PRESENCE_EVENT,
      payload: {
        userId: this.userId,
        sentAt: new Date(now).toISOString(),
      },
    });
  }
}

export const globalPresenceManager = new GlobalPresenceManager();
