import React, { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { useThemeColor } from "@/hooks/use-theme-color";

type Props = {
  topTab?: string;
  bottomTab?: string;
  onChangeTopTab?: (tab: string) => void;
  onChangeBottomTab?: (tab: string) => void;
};

const TOP_TABS = ["All", "Joined", "Popular"];
const BOTTOM_TABS = ["Relevant", "Newest"];

export default function GroupTabs({
  topTab = "All",
  bottomTab = "Relevant",
  onChangeTopTab,
  onChangeBottomTab,
}: Props) {
  const background = useThemeColor({}, "background");
  const text = useThemeColor({}, "text");
  const tint = useThemeColor({}, "tint");

  const [selectedTop, setSelectedTop] = useState(topTab);
  const [selectedBottom, setSelectedBottom] = useState(bottomTab);

  const handleTopTab = (tab: string) => {
    setSelectedTop(tab);
    onChangeTopTab?.(tab);
  };

  const handleBottomTab = (tab: string) => {
    setSelectedBottom(tab);
    onChangeBottomTab?.(tab);
  };

  return (
    <View style={[styles.container, { backgroundColor: background }]}> 
      <View style={styles.topRow}>
        {TOP_TABS.map((tab) => {
          const selected = selectedTop === tab;
          return (
            <Pressable
              key={tab}
              onPress={() => handleTopTab(tab)}
              style={[
                styles.tabButton,
                selected && {
                  backgroundColor: tint + "20",
                },
              ]}
            >
              <Text
                style={[
                  styles.tabText,
                  { color: selected ? tint : text },
                ]}
              >
                {tab}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <View style={styles.bottomRow}>
        {BOTTOM_TABS.map((tab) => {
          const selected = selectedBottom === tab;
          return (
            <Pressable
              key={tab}
              onPress={() => handleBottomTab(tab)}
              style={[
                styles.tabButton,
                selected && {
                  backgroundColor: tint + "20",
                },
              ]}
            >
              <Text
                style={[
                  styles.tabText,
                  { color: selected ? tint : text },
                ]}
              >
                {tab}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  topRow: {
    flexDirection: "row",
    gap: 10,
  },
  bottomRow: {
    flexDirection: "row",
    gap: 10,
    marginTop: 16,
  },
  tabButton: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 12,
  },
  tabText: {
    fontSize: 14,
    fontWeight: "600",
  },
});
