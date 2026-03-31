import AsyncStorage from "@react-native-async-storage/async-storage";
import Constants from "expo-constants";
import { Platform, AppState, type AppStateStatus } from "react-native";

import { fetchInboxItems, type InboxItem } from "@/lib/inbox/inbox-data";
import { supabase } from "@/lib/Supabase";

const CACHE_KEY_PREFIX = "pragatihub.inbox.cache.v1";

let notificationsModule: any | null | undefined;
function getNotificationsModule() {
  if (notificationsModule !== undefined) return notificationsModule;

  const isExpoGo =
    Constants.executionEnvironment === "storeClient" ||
    Constants.appOwnership === "expo";
  if (Platform.OS === "web" || isExpoGo) {
    notificationsModule = null;
    return notificationsModule;
  }

  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    notificationsModule = require("expo-notifications");
  } catch {
    notificationsModule = null;
  }
  return notificationsModule;
}

type InboxSubscriber = (items: InboxItem[]) => void;

class InboxSyncManager {
  private userId: string | null = null;
  private items: InboxItem[] = [];
  private subscribers = new Set<InboxSubscriber>();
  private channel: ReturnType<typeof supabase.channel> | null = null;
  private appState: AppStateStatus = AppState.currentState;
  private appStateSubscription: { remove: () => void } | null = null;
  private refreshDebounceTimer: ReturnType<typeof setTimeout> | null = null;
  private activePollInterval: ReturnType<typeof setInterval> | null = null;
  private fetchInFlight = false;
  private pendingSilentRefresh = false;
  private seededIds = false;
  private knownIds = new Set<string>();

  start(userId: string) {
    if (!userId) return;
    if (this.userId === userId) return;
    this.stop();

    this.userId = userId;
    this.appState = AppState.currentState;
    void this.hydrateFromCache();
    void this.sync("silent");
    this.ensureRealtimeSubscription();
    this.ensureAppStateListener();
    this.ensureActivePolling();
  }

  stop() {
    this.userId = null;
    this.items = [];
    this.fetchInFlight = false;
    this.pendingSilentRefresh = false;
    this.seededIds = false;
    this.knownIds = new Set<string>();

    if (this.refreshDebounceTimer) {
      clearTimeout(this.refreshDebounceTimer);
      this.refreshDebounceTimer = null;
    }
    if (this.activePollInterval) {
      clearInterval(this.activePollInterval);
      this.activePollInterval = null;
    }
    if (this.channel) {
      void supabase.removeChannel(this.channel);
      this.channel = null;
    }
    if (this.appStateSubscription) {
      this.appStateSubscription.remove();
      this.appStateSubscription = null;
    }
  }

  getItems() {
    return this.items;
  }

  subscribe(callback: InboxSubscriber) {
    this.subscribers.add(callback);
    callback(this.items);
    return () => {
      this.subscribers.delete(callback);
    };
  }

  async refresh() {
    await this.sync("refresh");
  }

  private emit() {
    for (const callback of this.subscribers) {
      callback(this.items);
    }
  }

  private getCacheKey() {
    if (!this.userId) return null;
    return `${CACHE_KEY_PREFIX}.${this.userId}`;
  }

  private async hydrateFromCache() {
    const cacheKey = this.getCacheKey();
    if (!cacheKey) return;

    try {
      const raw = await AsyncStorage.getItem(cacheKey);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return;
      this.items = parsed.filter(
        (item) =>
          item &&
          typeof item.id === "string" &&
          typeof item.createdAt === "string" &&
          typeof item.title === "string",
      ) as InboxItem[];
      this.knownIds = new Set(this.items.map((item) => item.id));
      this.seededIds = true;
      this.emit();
    } catch {
      // no-op: stale cache shouldn't block runtime sync
    }
  }

  private async persistCache() {
    const cacheKey = this.getCacheKey();
    if (!cacheKey) return;
    try {
      await AsyncStorage.setItem(cacheKey, JSON.stringify(this.items));
    } catch {
      // no-op
    }
  }

  private queueSilentSync() {
    if (!this.userId) return;
    if (this.appState !== "active") {
      this.pendingSilentRefresh = true;
      return;
    }
    if (this.refreshDebounceTimer) {
      clearTimeout(this.refreshDebounceTimer);
    }
    this.refreshDebounceTimer = setTimeout(() => {
      void this.sync("silent");
    }, 900);
  }

  private async sync(mode: "silent" | "refresh") {
    if (!this.userId) return;

    if (this.fetchInFlight) {
      this.pendingSilentRefresh = true;
      return;
    }
    this.fetchInFlight = true;

    try {
      const nextItems = await fetchInboxItems(this.userId);
      const previousItems = this.items;
      this.items = nextItems;
      this.emit();
      void this.persistCache();
      void this.scheduleNotifications(previousItems, nextItems);
    } catch (error) {
      if (mode === "refresh") {
        console.log("Inbox refresh failed:", error);
      }
    } finally {
      this.fetchInFlight = false;
      if (this.pendingSilentRefresh) {
        this.pendingSilentRefresh = false;
        void this.sync("silent");
      }
    }
  }

  private async scheduleNotifications(previous: InboxItem[], current: InboxItem[]) {
    const Notifications = getNotificationsModule();
    if (!Notifications || Platform.OS === "web") return;

    if (!this.seededIds) {
      this.knownIds = new Set(previous.map((item) => item.id));
      this.seededIds = true;
    }

    const newItems = current.filter((item) => !this.knownIds.has(item.id));
    for (const item of current) {
      this.knownIds.add(item.id);
    }

    for (const item of newItems.slice(0, 3)) {
      try {
        await Notifications.scheduleNotificationAsync({
          content: {
            title: item.title,
            body: item.preview,
            data: { path: item.path, itemId: item.id },
            ...(Platform.OS === "android" ? { channelId: "inbox-updates" } : {}),
          },
          trigger: null,
        });
      } catch {
        // no-op
      }
    }
  }

  private ensureRealtimeSubscription() {
    if (!this.userId || this.channel) return;
    const userId = this.userId;

    this.channel = supabase
      .channel(`inbox-sync-${userId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "notifications",
          filter: `recipient_user_id=eq.${userId}`,
        },
        () => this.queueSilentSync(),
      )
      .subscribe((status) => {
        if (status === "SUBSCRIBED") {
          void this.sync("silent");
        }
      });
  }

  private ensureActivePolling() {
    if (this.activePollInterval) return;
    this.activePollInterval = setInterval(() => {
      if (!this.userId || this.appState !== "active") return;
      void this.sync("silent");
    }, 15000);
  }

  private ensureAppStateListener() {
    if (this.appStateSubscription) return;
    this.appStateSubscription = AppState.addEventListener("change", (nextState) => {
      const wasInactive =
        this.appState === "background" || this.appState === "inactive";
      this.appState = nextState;
      if (wasInactive && nextState === "active") {
        void this.sync("silent");
      }
    });
  }
}

export const inboxSyncManager = new InboxSyncManager();
