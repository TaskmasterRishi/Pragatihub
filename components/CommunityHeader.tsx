import JoinCommunityButton from "@/components/JoinCommunityButton";
import { type Group } from "@/lib/actions/groups";
import { useUser } from "@clerk/clerk-expo";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { usePathname, useRouter } from "expo-router";
import {
  ChevronLeft,
  Edit3,
  MessageCircle,
  MoreHorizontal,
  Rss,
  Share2,
  Users,
} from "lucide-react-native";
import { useState } from "react";
import {
  Modal,
  Pressable,
  Share as NativeShare,
  StyleSheet,
  Text,
  View,
} from "react-native";

interface CommunityHeaderProps {
  community: Group;
  membersCount: number;
  bg: string;
  card: string;
  border: string;
  primary: string;
  secondaryColor: string;
  text: string;
  secondary: string;
  backgroundSecondary: string;
  success: string;
}

export default function CommunityHeader({
  community,
  membersCount,
  bg,
  card,
  border,
  primary,
  secondaryColor,
  text,
  secondary,
  backgroundSecondary,
  success,
}: CommunityHeaderProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { user } = useUser();
  const [menuVisible, setMenuVisible] = useState(false);

  const handleBack = () => {
    // Navigate directly to the parent communities list.
    // Using router.back() / dismiss() animates through the tab history
    // (Members → Posts → Parent), so we jump straight to the parent instead.
    router.navigate("/(protected)/(tabs)/communities");
  };

  const handle = `r/${community.name.replace(/\s+/g, "")}`;
  const isOwner = !!community.owner_id && community.owner_id === user?.id;

  const handleShareCommunity = async () => {
    setMenuVisible(false);
    try {
      await NativeShare.share({
        message: `Join ${community.name}\n\nhttps://pragatihub.app/community/${community.id}`,
      });
    } catch (error) {
      console.log("Community share error:", error);
    }
  };

  const handleOpenMembers = () => {
    setMenuVisible(false);
    if (!pathname.endsWith("/members"))
      router.push(`/community/${community.id}/members`);
  };

  const handleOpenPosts = () => {
    setMenuVisible(false);
    if (!pathname.endsWith(`/${community.id}`))
      router.push(`/community/${community.id}`);
  };

  const handleOpenChat = () => {
    setMenuVisible(false);
    if (!pathname.endsWith("/chat"))
      router.push(`/community/${community.id}/chat`);
  };

  const onlineCount = Math.max(1, Math.floor(membersCount * 0.1));

  return (
    <View style={styles.root}>
      {/* ─── Banner ──────────────────────────────────── */}
      <View style={styles.bannerWrap}>
        {community.banner_image ? (
          <Image
            source={{ uri: community.banner_image }}
            style={styles.bannerImage}
            contentFit="cover"
            contentPosition="top"
          />
        ) : (
          <LinearGradient
            colors={[primary, secondaryColor]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.bannerImage}
          />
        )}

        {/* Gradient scrim so toolbar icons stay readable */}
        <LinearGradient
          colors={["rgba(0,0,0,0.45)", "transparent"]}
          style={styles.bannerScrim}
          pointerEvents="none"
        />

        {/* Toolbar */}
        <View style={styles.toolbar} pointerEvents="box-none">
          <Pressable onPress={handleBack} style={styles.iconBtn} hitSlop={8}>
            <ChevronLeft size={24} color="#fff" />
          </Pressable>
          <View style={styles.toolbarRight}>
            <Pressable style={styles.iconBtn} hitSlop={8} onPress={handleShareCommunity}>
              <Share2 size={20} color="#fff" />
            </Pressable>
            {isOwner && (
              <Pressable style={styles.iconBtn} hitSlop={8} onPress={() => setMenuVisible(true)}>
                <MoreHorizontal size={20} color="#fff" />
              </Pressable>
            )}
          </View>
        </View>
      </View>

      {/* ─── Info card ───────────────────────────────── */}
      <View style={[styles.infoCard, { backgroundColor: card, borderColor: border }]}>
        {/* Floating avatar */}
        <View style={styles.avatarRowOuter}>
          <View style={[styles.avatarRing, { borderColor: primary, backgroundColor: card }]}>
            <Image
              source={{ uri: community.image ?? undefined }}
              style={styles.avatar}
              contentFit="cover"
            />
          </View>
          <View style={styles.joinWrap}>
            <JoinCommunityButton communityId={community.id} />
          </View>
        </View>

        {/* Name + handle */}
        <View style={styles.nameSect}>
          <Text style={[styles.communityName, { color: text }]} numberOfLines={1}>
            {community.name}
          </Text>
          <Text style={[styles.handle, { color: secondary }]}>{handle}</Text>
        </View>

        {/* Description */}
        {community.description ? (
          <View style={[styles.descWrap, { borderLeftColor: primary, backgroundColor: backgroundSecondary }]}>
            <Text style={[styles.desc, { color: text }]} numberOfLines={4}>
              {community.description}
            </Text>
          </View>
        ) : null}

        {/* Stats */}
        <View style={styles.statsRow}>
          <View style={[styles.statChip, { backgroundColor: backgroundSecondary }]}>
            <Users size={13} color={primary} />
            <Text style={[styles.statNum, { color: text }]}>{membersCount.toLocaleString()}</Text>
            <Text style={[styles.statLbl, { color: secondary }]}>Members</Text>
          </View>

          <View style={[styles.statDivider, { backgroundColor: border }]} />

          <View style={[styles.statChip, { backgroundColor: backgroundSecondary }]}>
            <View style={[styles.dot, { backgroundColor: success }]} />
            <Text style={[styles.statNum, { color: text }]}>{onlineCount.toLocaleString()}</Text>
            <Text style={[styles.statLbl, { color: secondary }]}>Online</Text>
          </View>
        </View>
      </View>

      {/* ─── Bottom sheet menu ───────────────────────── */}
      <Modal
        transparent
        visible={menuVisible}
        animationType="slide"
        onRequestClose={() => setMenuVisible(false)}
      >
        <Pressable style={styles.sheetBackdrop} onPress={() => setMenuVisible(false)}>
          <Pressable
            style={[styles.sheetCard, { backgroundColor: card, borderColor: border }]}
            onPress={(e) => e.stopPropagation()}
          >
            {/* Handle bar */}
            <View style={[styles.sheetHandle, { backgroundColor: border }]} />

            <Text style={[styles.sheetTitle, { color: text }]}>Community</Text>

            {/* Actions */}
            {[
              {
                icon: <Edit3 size={18} color={primary} />,
                label: "Edit community",
                onPress: () => {
                  setMenuVisible(false);
                  router.push(`/community/edit/${community.id}`);
                },
                show: isOwner,
              },
              {
                icon: <Share2 size={18} color={primary} />,
                label: "Share community",
                onPress: handleShareCommunity,
                show: true,
              },
              {
                icon: <Rss size={18} color={primary} />,
                label: "Posts",
                onPress: handleOpenPosts,
                show: true,
              },
              {
                icon: <Users size={18} color={primary} />,
                label: "Members",
                onPress: handleOpenMembers,
                show: true,
              },
              {
                icon: <MessageCircle size={18} color={primary} />,
                label: "Global Chat",
                onPress: handleOpenChat,
                show: true,
              },
            ]
              .filter((a) => a.show)
              .map((action, idx) => (
                <Pressable
                  key={idx}
                  style={[styles.sheetRow, { borderColor: border }]}
                  onPress={action.onPress}
                >
                  <View style={[styles.sheetRowIcon, { backgroundColor: `${primary}15` }]}>
                    {action.icon}
                  </View>
                  <Text style={[styles.sheetRowLabel, { color: text }]}>{action.label}</Text>
                </Pressable>
              ))}

            <Pressable
              style={[styles.sheetCancelBtn, { backgroundColor: backgroundSecondary }]}
              onPress={() => setMenuVisible(false)}
            >
              <Text style={[styles.sheetCancelLabel, { color: secondary }]}>Cancel</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    marginBottom: 12,
  },

  /* Banner */
  bannerWrap: {
    position: "relative",
    height: 200,
  },
  bannerImage: {
    ...StyleSheet.absoluteFillObject,
  },
  bannerScrim: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 80,
  },
  toolbar: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingTop: 12,
  },
  toolbarRight: { flexDirection: "row", gap: 8 },
  iconBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "rgba(0,0,0,0.38)",
    alignItems: "center",
    justifyContent: "center",
  },

  /* Info card */
  infoCard: {
    marginHorizontal: 14,
    marginTop: -28,
    borderRadius: 20,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingBottom: 16,
    shadowColor: "#000",
    shadowOpacity: 0.1,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
  },

  avatarRowOuter: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    marginTop: -28,
    marginBottom: 10,
  },
  avatarRing: {
    padding: 3,
    borderRadius: 999,
    borderWidth: 3,
  },
  avatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: "#e5e7eb",
  },
  joinWrap: { paddingBottom: 4 },

  nameSect: { marginBottom: 10 },
  communityName: {
    fontSize: 20,
    fontWeight: "800",
    letterSpacing: -0.2,
  },
  handle: {
    fontSize: 13,
    fontWeight: "500",
    marginTop: 2,
    opacity: 0.85,
  },

  descWrap: {
    borderLeftWidth: 3,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 12,
  },
  desc: { fontSize: 13, lineHeight: 19 },

  statsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  statChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  statDivider: {
    width: StyleSheet.hairlineWidth,
    height: 18,
  },
  statNum: { fontSize: 13, fontWeight: "700" },
  statLbl: { fontSize: 11, fontWeight: "500" },
  dot: { width: 7, height: 7, borderRadius: 4 },

  /* Bottom sheet */
  sheetBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.45)",
    justifyContent: "flex-end",
  },
  sheetCard: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: 1,
    borderBottomWidth: 0,
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 32,
    gap: 4,
  },
  sheetHandle: {
    alignSelf: "center",
    width: 36,
    height: 4,
    borderRadius: 2,
    marginBottom: 12,
  },
  sheetTitle: {
    fontSize: 13,
    fontWeight: "600",
    opacity: 0.5,
    marginBottom: 8,
    paddingHorizontal: 4,
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  sheetRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 4,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  sheetRowIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  sheetRowLabel: { fontSize: 16, fontWeight: "500" },
  sheetCancelBtn: {
    marginTop: 10,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: "center",
  },
  sheetCancelLabel: { fontSize: 15, fontWeight: "600" },
});
