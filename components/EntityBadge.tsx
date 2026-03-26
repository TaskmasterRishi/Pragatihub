import { useThemeColor } from "@/hooks/use-theme-color";
import { Text, View } from "react-native";

type EntityBadgeProps = {
  kind: "user" | "community";
  size?: number;
};

export default function EntityBadge({ kind, size = 14 }: EntityBadgeProps) {
  const primary = useThemeColor({}, "primary");
  const userAccent = useThemeColor({}, "userBadgeAccent");
  const communityAccent = useThemeColor({}, "communityBadgeAccent");
  const accent = kind === "community" ? communityAccent : userAccent;
  const fg = accent || primary;

  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: `${fg}22`,
        borderWidth: 1,
        borderColor: `${fg}4A`,
      }}
    >
      <Text
        style={{
          color: fg,
          fontSize: Math.max(8, size * 0.58),
          fontWeight: "900",
          lineHeight: Math.max(8, size * 0.58),
        }}
      >
        {kind === "community" ? "C" : "U"}
      </Text>
    </View>
  );
}
