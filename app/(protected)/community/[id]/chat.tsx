import AppLoader from "@/components/AppLoader";
import { useThemeColor } from "@/hooks/use-theme-color";
import { fetchGroupById, type Group } from "@/lib/actions/groups";
import { supabase } from "@/lib/Supabase";
import { useGlobalSearchParams } from "expo-router";
import { MessageCircle, Send, Users } from "lucide-react-native";
import { useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export default function CommunityChatTab() {
  const { id } = useGlobalSearchParams<{ id: string }>();
  const communityId = Array.isArray(id) ? id[0] : id;
  const insets = useSafeAreaInsets();

  const [community, setCommunity] = useState<Group | null>(null);
  const [members, setMembers] = useState(0);
  const [loading, setLoading] = useState(true);

  const bg = useThemeColor({}, "background");
  const text = useThemeColor({}, "text");
  const secondary = useThemeColor({}, "textSecondary");
  const card = useThemeColor({}, "card");
  const border = useThemeColor({}, "border");
  const primary = useThemeColor({}, "primary");
  const backgroundSecondary = useThemeColor({}, "backgroundSecondary");

  useEffect(() => {
    if (!communityId) return;
    let cancelled = false;

    const load = async () => {
      setLoading(true);
      const [{ data }, membersRes] = await Promise.all([
        fetchGroupById(communityId),
        supabase
          .from("user_groups")
          .select("group_id, user_id", { count: "exact", head: true })
          .eq("group_id", communityId),
      ]);

      if (cancelled) return;
      setCommunity(data ?? null);
      if (membersRes.count !== null) setMembers(membersRes.count);
      setLoading(false);
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, [communityId]);

  if (loading || !community) {
    return (
      <View style={[styles.center, { backgroundColor: bg }]}>
        <AppLoader fullScreen />
      </View>
    );
  }

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: bg,
          paddingTop: 16,
          paddingBottom: insets.bottom + 90,
        },
      ]}
    >
      {/* Page header */}
      <View style={styles.header}>
        <View
          style={[styles.headerIconWrap, { backgroundColor: `${primary}18` }]}
        >
          <MessageCircle size={22} color={primary} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[styles.headerTitle, { color: text }]}>Global Chat</Text>
          <View style={styles.headerMeta}>
            <Users size={13} color={secondary} />
            <Text style={[styles.headerMetaText, { color: secondary }]}>
              {members} {members === 1 ? "member" : "members"}
            </Text>
          </View>
        </View>
      </View>

      {/* Coming soon card */}
      <View style={styles.body}>
        {/* Decorative message bubbles */}
        <View style={styles.bubblesRow}>
          <View
            style={[
              styles.bubble,
              styles.bubbleLeft,
              { backgroundColor: backgroundSecondary, borderColor: border },
            ]}
          >
            <Text style={[styles.bubbleText, { color: secondary }]}>
              Hey everyone! 👋
            </Text>
          </View>
          <View
            style={[
              styles.bubble,
              styles.bubbleRight,
              { backgroundColor: `${primary}18`, borderColor: `${primary}30` },
            ]}
          >
            <Text style={[styles.bubbleText, { color: primary }]}>
              Can't wait to chat here!
            </Text>
          </View>
          <View
            style={[
              styles.bubble,
              styles.bubbleLeft,
              { backgroundColor: backgroundSecondary, borderColor: border },
            ]}
          >
            <Text style={[styles.bubbleText, { color: secondary }]}>
              Global chat coming soon ✨
            </Text>
          </View>
        </View>

        {/* Main CTA area */}
        <View
          style={[
            styles.comingSoonCard,
            { backgroundColor: card, borderColor: border },
          ]}
        >
          <View
            style={[styles.comingSoonIcon, { backgroundColor: `${primary}18` }]}
          >
            <Send size={28} color={primary} />
          </View>
          <Text style={[styles.comingSoonTitle, { color: text }]}>
            Global Chat is on the way
          </Text>
          <Text style={[styles.comingSoonDesc, { color: secondary }]}>
            Soon you'll be able to talk with all members of this community in
            real-time right here.
          </Text>

          {/* Fake input bar */}
          <View
            style={[
              styles.fakeInput,
              { backgroundColor: backgroundSecondary, borderColor: border },
            ]}
          >
            <Text style={[styles.fakeInputText, { color: secondary }]}>
              Message everyone…
            </Text>
            <View
              style={[
                styles.fakeInputSend,
                { backgroundColor: `${primary}22` },
              ]}
            >
              <Send size={14} color={primary} />
            </View>
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },

  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 16,
    paddingBottom: 20,
  },
  headerIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    fontSize: 26,
    fontWeight: "800",
    letterSpacing: -0.5,
  },
  headerMeta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 2,
  },
  headerMetaText: { fontSize: 13 },

  body: {
    flex: 1,
    paddingHorizontal: 16,
    justifyContent: "center",
    gap: 20,
  },

  bubblesRow: {
    gap: 10,
  },
  bubble: {
    alignSelf: "flex-start",
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 18,
    borderWidth: 1,
    maxWidth: "75%",
  },
  bubbleLeft: { alignSelf: "flex-start" },
  bubbleRight: { alignSelf: "flex-end" },
  bubbleText: { fontSize: 14, lineHeight: 20 },

  comingSoonCard: {
    borderRadius: 22,
    borderWidth: 1,
    padding: 24,
    alignItems: "center",
    gap: 10,
  },
  comingSoonIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  comingSoonTitle: {
    fontSize: 18,
    fontWeight: "700",
    textAlign: "center",
  },
  comingSoonDesc: {
    fontSize: 14,
    textAlign: "center",
    lineHeight: 21,
    marginBottom: 12,
  },

  fakeInput: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 10,
    width: "100%",
  },
  fakeInputText: { flex: 1, fontSize: 14 },
  fakeInputSend: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
});
