
import { useThemeColor } from "@/hooks/use-theme-color";
import {
  fetchReports,
  REPORT_REASONS,
  resolveReport,
  type PostReport,
  type ReportStatus,
} from "@/lib/actions/moderation";
import { Image } from "expo-image";
import { useGlobalSearchParams } from "expo-router";
import {
  AlertCircle,
  CheckCircle2,
  Clock,
  Shield,
  Trash2,
  XCircle,
} from "lucide-react-native";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const STATUS_TABS: { key: ReportStatus; label: string }[] = [
  { key: "pending", label: "Pending" },
  { key: "dismissed", label: "Dismissed" },
  { key: "removed", label: "Removed" },
];

const STATUS_COLORS: Record<ReportStatus, string> = {
  pending: "#F59E0B",
  dismissed: "#6B7280",
  removed: "#EF4444",
};

export default function CommunityModerationTab() {
  const { id } = useGlobalSearchParams<{ id: string }>();
  const communityId = Array.isArray(id) ? id[0] : id;
  const insets = useSafeAreaInsets();

  const [activeStatus, setActiveStatus] = useState<ReportStatus>("pending");
  const [reports, setReports] = useState<PostReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [resolving, setResolving] = useState<string | null>(null);

  const requestIdRef = useRef(0);

  // Theme
  const bg = useThemeColor({}, "background");
  const text = useThemeColor({}, "text");
  const secondary = useThemeColor({}, "textSecondary");
  const tint = useThemeColor({}, "tint");
  const card = useThemeColor({}, "card");
  const border = useThemeColor({}, "border");
  const primary = useThemeColor({}, "primary");
  const backgroundSecondary = useThemeColor({}, "backgroundSecondary");

  const loadReports = useCallback(
    async (status: ReportStatus) => {
      if (!communityId) return;
      const rid = ++requestIdRef.current;
      setLoading(true);
      const { data } = await fetchReports(communityId, status);
      if (rid !== requestIdRef.current) return;
      setReports(data ?? []);
      setLoading(false);
    },
    [communityId],
  );

  useEffect(() => {
    void loadReports(activeStatus);
  }, [activeStatus, loadReports]);

  const handleResolve = useCallback(
    (report: PostReport, action: "dismissed" | "removed") => {
      const actionLabel = action === "dismissed" ? "Dismiss" : "Remove Post";
      const message =
        action === "removed"
          ? "This will permanently delete the post and cannot be undone."
          : "The report will be marked as dismissed.";

      Alert.alert(actionLabel, message, [
        { text: "Cancel", style: "cancel" },
        {
          text: actionLabel,
          style: action === "removed" ? "destructive" : "default",
          onPress: async () => {
            setResolving(report.id);
            const { error } = await resolveReport(
              report.id,
              report.post_id,
              action,
            );
            setResolving(null);
            if (error) {
              Alert.alert("Error", "Failed to resolve report. Please try again.");
            } else {
              setReports((prev) => prev.filter((r) => r.id !== report.id));
            }
          },
        },
      ]);
    },
    [],
  );

  const formatDate = (value: string) => {
    const d = new Date(value);
    return d.toLocaleDateString(undefined, {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  };

  const getReasonConfig = (reason: string) =>
    REPORT_REASONS.find((r) => r.value === reason) ?? {
      label: reason,
      color: "#6B7280",
    };

  const renderReport = ({ item }: { item: PostReport }) => {
    const reasonCfg = getReasonConfig(item.reason);
    const isResolving = resolving === item.id;
    const reporter = item.reporter;
    const post = item.post;
    const initials = reporter
      ? reporter.name
          .split(" ")
          .filter(Boolean)
          .slice(0, 2)
          .map((p) => p[0]?.toUpperCase())
          .join("")
      : "?";

    return (
      <View style={[styles.reportCard, { backgroundColor: card, borderColor: border }]}>
        {/* Reporter row */}
        <View style={styles.reporterRow}>
          <View style={styles.avatarWrapper}>
            {reporter?.image ? (
              <Image
                source={{ uri: reporter.image }}
                style={styles.avatar}
                contentFit="cover"
              />
            ) : (
              <View
                style={[
                  styles.avatar,
                  styles.avatarFallback,
                  { backgroundColor: `${primary}22` },
                ]}
              >
                <Text style={[styles.avatarInitials, { color: primary }]}>
                  {initials}
                </Text>
              </View>
            )}
          </View>
          <View style={styles.reporterInfo}>
            <Text style={[styles.reporterName, { color: text }]} numberOfLines={1}>
              {reporter?.name ?? "Unknown User"}
            </Text>
            <Text style={[styles.reportDate, { color: secondary }]}>
              Reported {formatDate(item.created_at)}
            </Text>
          </View>
          {/* Reason badge */}
          <View
            style={[
              styles.reasonBadge,
              { backgroundColor: `${reasonCfg.color}20`, borderColor: `${reasonCfg.color}55` },
            ]}
          >
            <Text style={[styles.reasonLabel, { color: reasonCfg.color }]}>
              {reasonCfg.label}
            </Text>
          </View>
        </View>

        {/* Post preview */}
        {post && (
          <View
            style={[styles.postPreview, { backgroundColor: backgroundSecondary, borderColor: border }]}
          >
            <Text style={[styles.postTitle, { color: text }]} numberOfLines={2}>
              {post.title}
            </Text>
            {post.description ? (
              <Text style={[styles.postDesc, { color: secondary }]} numberOfLines={2}>
                {post.description}
              </Text>
            ) : null}
          </View>
        )}

        {/* Details */}
        {item.details ? (
          <View style={[styles.detailsBox, { backgroundColor: `${tint}10`, borderColor: `${tint}30` }]}>
            <AlertCircle size={13} color={tint} />
            <Text style={[styles.detailsText, { color: secondary }]} numberOfLines={3}>
              {item.details}
            </Text>
          </View>
        ) : null}

        {/* Resolved by */}
        {item.status !== "pending" && item.resolver && (
          <Text style={[styles.resolvedBy, { color: secondary }]}>
            {item.status === "dismissed" ? "Dismissed" : "Removed"} by{" "}
            {item.resolver.name}
            {item.resolved_at ? ` · ${formatDate(item.resolved_at)}` : ""}
          </Text>
        )}

        {/* Actions (only for pending) */}
        {item.status === "pending" && (
          <View style={styles.actionRow}>
            {isResolving ? (
              <View style={styles.resolvingContainer}>
                <ActivityIndicator size="small" color={tint} />
                <Text style={[styles.resolvingText, { color: secondary }]}>
                  Resolving…
                </Text>
              </View>
            ) : (
              <>
                <Pressable
                  onPress={() => handleResolve(item, "dismissed")}
                  style={[
                    styles.actionBtn,
                    { backgroundColor: backgroundSecondary, borderColor: border },
                  ]}
                >
                  <CheckCircle2 size={15} color={secondary} />
                  <Text style={[styles.actionBtnLabel, { color: secondary }]}>
                    Dismiss
                  </Text>
                </Pressable>
                <Pressable
                  onPress={() => handleResolve(item, "removed")}
                  style={[
                    styles.actionBtn,
                    styles.removeBtn,
                    { backgroundColor: "#EF444420", borderColor: "#EF444455" },
                  ]}
                >
                  <Trash2 size={15} color="#EF4444" />
                  <Text style={[styles.actionBtnLabel, { color: "#EF4444" }]}>
                    Remove Post
                  </Text>
                </Pressable>
              </>
            )}
          </View>
        )}
      </View>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: bg }]}>
      <FlatList
        style={styles.list}
        removeClippedSubviews
        windowSize={7}
        initialNumToRender={6}
        contentContainerStyle={{
          paddingBottom: insets.bottom + 90,
          flexGrow: 1,
        }}
        data={reports}
        keyExtractor={(i) => i.id}
        showsVerticalScrollIndicator={false}
        renderItem={renderReport}
        ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
        ListHeaderComponent={
          <View style={styles.header}>
            {/* Page title */}
            <View style={styles.titleRow}>
              <Shield size={22} color={primary} />
              <Text style={[styles.headerTitle, { color: text }]}>
                Moderation
              </Text>
            </View>
            <Text style={[styles.headerSub, { color: secondary }]}>
              Review and resolve reported posts.
            </Text>

            {/* Status filter tabs */}
            <View style={[styles.filterRow, { backgroundColor: backgroundSecondary, borderColor: border }]}>
              {STATUS_TABS.map((tab) => {
                const active = tab.key === activeStatus;
                const statusColor = STATUS_COLORS[tab.key];
                return (
                  <Pressable
                    key={tab.key}
                    onPress={() => setActiveStatus(tab.key)}
                    style={[
                      styles.filterTab,
                      active && {
                        backgroundColor: `${statusColor}22`,
                        borderColor: `${statusColor}55`,
                        borderWidth: 1,
                      },
                    ]}
                  >
                    {tab.key === "pending" && (
                      <Clock size={13} color={active ? statusColor : secondary} />
                    )}
                    {tab.key === "dismissed" && (
                      <XCircle size={13} color={active ? statusColor : secondary} />
                    )}
                    {tab.key === "removed" && (
                      <Trash2 size={13} color={active ? statusColor : secondary} />
                    )}
                    <Text
                      style={[
                        styles.filterTabLabel,
                        { color: active ? statusColor : secondary },
                      ]}
                    >
                      {tab.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
        }
        ListEmptyComponent={
          loading ? (
            <View style={styles.emptyCenter}>
              <ActivityIndicator size="large" color={tint} />
              <Text style={[styles.emptyText, { color: secondary }]}>
                Loading reports…
              </Text>
            </View>
          ) : (
            <View style={styles.emptyCenter}>
              <View style={[styles.emptyIcon, { backgroundColor: backgroundSecondary }]}>
                <Shield size={32} color={secondary} />
              </View>
              <Text style={[styles.emptyTitle, { color: text }]}>
                {activeStatus === "pending"
                  ? "No pending reports"
                  : activeStatus === "dismissed"
                    ? "No dismissed reports"
                    : "No removed posts"}
              </Text>
              <Text style={[styles.emptyText, { color: secondary }]}>
                {activeStatus === "pending"
                  ? "Your community is all clear! 🎉"
                  : "Nothing archived here yet."}
              </Text>
            </View>
          )
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  list: { flex: 1 },

  header: {
    paddingHorizontal: 16,
    paddingTop: 20,
    paddingBottom: 12,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 4,
  },
  headerTitle: {
    fontSize: 30,
    fontWeight: "800",
    letterSpacing: -0.5,
  },
  headerSub: {
    fontSize: 14,
    marginBottom: 18,
    lineHeight: 20,
  },

  filterRow: {
    flexDirection: "row",
    borderRadius: 16,
    borderWidth: 1,
    padding: 4,
    gap: 4,
    marginBottom: 6,
  },
  filterTab: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
    paddingVertical: 8,
    paddingHorizontal: 6,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "transparent",
  },
  filterTabLabel: {
    fontSize: 13,
    fontWeight: "600",
  },

  reportCard: {
    marginHorizontal: 14,
    borderRadius: 18,
    borderWidth: 1,
    padding: 14,
    gap: 12,
  },

  reporterRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  avatarWrapper: {},
  avatar: { width: 40, height: 40, borderRadius: 20 },
  avatarFallback: { alignItems: "center", justifyContent: "center" },
  avatarInitials: { fontSize: 15, fontWeight: "700" },
  reporterInfo: { flex: 1, minWidth: 0 },
  reporterName: { fontSize: 14, fontWeight: "700" },
  reportDate: { fontSize: 12, marginTop: 1 },

  reasonBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: 1,
  },
  reasonLabel: { fontSize: 11, fontWeight: "700" },

  postPreview: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 10,
    gap: 4,
  },
  postTitle: { fontSize: 14, fontWeight: "700" },
  postDesc: { fontSize: 13, lineHeight: 18 },

  detailsBox: {
    flexDirection: "row",
    alignItems: "flex-start",
    borderRadius: 10,
    borderWidth: 1,
    padding: 10,
    gap: 7,
  },
  detailsText: { flex: 1, fontSize: 13, lineHeight: 18 },

  resolvedBy: { fontSize: 12, fontStyle: "italic" },

  actionRow: {
    flexDirection: "row",
    gap: 8,
    marginTop: 2,
  },
  actionBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  removeBtn: {},
  actionBtnLabel: { fontSize: 13, fontWeight: "700" },

  resolvingContainer: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 10,
  },
  resolvingText: { fontSize: 13, fontWeight: "600" },

  emptyCenter: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 60,
    paddingHorizontal: 32,
    gap: 10,
  },
  emptyIcon: {
    width: 68,
    height: 68,
    borderRadius: 34,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  emptyTitle: { fontSize: 18, fontWeight: "700" },
  emptyText: { fontSize: 14, textAlign: "center", lineHeight: 20 },
});
