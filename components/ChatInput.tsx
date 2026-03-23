import { useThemeColor } from "@/hooks/use-theme-color";
import { BlurView } from "expo-blur";
import { Plus, Send } from "lucide-react-native";
import React, { useEffect, useRef, useState } from "react";
import {
  Animated,
  Platform,
  Pressable,
  StyleSheet,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

type ChatInputProps = {
  value: string;
  onChangeText: (text: string) => void;
  onSend: () => void;
  onTypingStatusChange?: (isTyping: boolean) => void;
  isMember: boolean;
  isAuthed: boolean;
  sending: boolean;
  isDark: boolean;
  composerAnim: Animated.Value;
};

export default function ChatInput({
  value,
  onChangeText,
  onSend,
  onTypingStatusChange,
  isMember,
  isAuthed,
  sending,
  isDark,
  composerAnim,
}: ChatInputProps) {
  const insets = useSafeAreaInsets();
  const [isFocused, setIsFocused] = useState(false);
  const sendScale = useRef(new Animated.Value(1)).current;
  const isTypingRef = useRef(false);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const text = useThemeColor({}, "text");
  const secondary = useThemeColor({}, "textSecondary");
  const border = useThemeColor({}, "border");
  const primary = useThemeColor({}, "primary");
  const inputColor = useThemeColor({}, "input");

  const handleInputChange = (text: string) => {
    onChangeText(text);

    if (onTypingStatusChange) {
      if (!isTypingRef.current) {
        isTypingRef.current = true;
        onTypingStatusChange(true);
      }

      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = setTimeout(() => {
        isTypingRef.current = false;
        onTypingStatusChange(false);
      }, 3000);
    }
  };

  const handleSend = () => {
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    isTypingRef.current = false;
    onSend();
  };

  const composerOverlay = useThemeColor(
    {
      light: "rgba(255,255,255,0.72)",
      dark: "rgba(28,28,30,0.75)",
    },
    "tabBarBackground"
  );

  const composerBorder = useThemeColor(
    {
      light: "rgba(0,0,0,0.05)",
      dark: "rgba(255,255,255,0.1)",
    },
    "tabBarBorder"
  );

  const canSend = isMember && isAuthed && value.trim().length > 0 && !sending;

  useEffect(() => {
    Animated.spring(sendScale, {
      toValue: canSend ? 1 : 0.85,
      friction: 8,
      tension: 40,
      useNativeDriver: true,
    }).start();
  }, [canSend]);

  return (
    <Animated.View
      style={[
        styles.container,
        {
          transform: [
            {
              translateY: composerAnim.interpolate({
                inputRange: [0, 1],
                outputRange: [100, 0],
              }),
            },
          ],
          opacity: composerAnim,
          paddingBottom: Math.max(insets.bottom, 20),
        },
      ]}
    >
      {/* Background with Blur */}
      {Platform.OS !== "web" && (
        <BlurView
          tint={isDark ? "systemChromeMaterialDark" : "systemChromeMaterialLight"}
          intensity={90}
          style={StyleSheet.absoluteFillObject}
        />
      )}
      <View
        style={[
          StyleSheet.absoluteFillObject,
          { backgroundColor: composerOverlay },
        ]}
      />
      <View style={[styles.borderTop, { backgroundColor: composerBorder }]} />

      <View style={styles.inner}>
        {/* Attachment Button */}
        <Pressable
          style={({ pressed }) => [
            styles.actionBtn,
            { opacity: pressed ? 0.6 : 1 },
          ]}
        >
          <View
            style={[
              styles.actionIconWrap,
              { backgroundColor: isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.05)" },
            ]}
          >
            <Plus size={22} color={secondary} strokeWidth={2.5} />
          </View>
        </Pressable>

        {/* Input Wrapper */}
        <View
          style={[
            styles.inputWrap,
            {
              backgroundColor: isDark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.03)",
              borderColor: isFocused ? `${primary}50` : "transparent",
            },
          ]}
        >
          <TextInput
            value={value}
            onChangeText={handleInputChange}
            placeholder={isMember ? "Message..." : "Join to chat"}
            placeholderTextColor={`${secondary}80`}
            style={[styles.textInput, { color: text }]}
            multiline
            maxLength={2000}
            editable={isMember && isAuthed && !sending}
            onFocus={() => setIsFocused(true)}
            onBlur={() => setIsFocused(false)}
            textAlignVertical="center"
          />
        </View>

        {/* Send Button */}
        <Animated.View style={{ transform: [{ scale: sendScale }] }}>
          <Pressable
            onPress={handleSend}
            disabled={!canSend}
            style={({ pressed }) => [
              styles.sendBtn,
              {
                backgroundColor: canSend ? primary : `${primary}25`,
                opacity: pressed && canSend ? 0.7 : 1,
              },
            ]}
          >
            <Send
              size={18}
              color={isDark || canSend ? "#fff" : `${secondary}60`}
              strokeWidth={2.5}
            />
          </Pressable>
        </Animated.View>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingTop: 12,
    paddingHorizontal: 12,
  },
  borderTop: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: StyleSheet.hairlineWidth,
  },
  inner: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 8,
  },
  actionBtn: {
    marginBottom: 4,
  },
  actionIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
  },
  inputWrap: {
    flex: 1,
    borderRadius: 24,
    borderWidth: 1.5,
    paddingHorizontal: 16,
    paddingVertical: 8,
    minHeight: 40,
    justifyContent: "center",
  },
  textInput: {
    fontSize: 16,
    lineHeight: 20,
    maxHeight: 120,
    padding: 0,
    margin: 0,
  },
  sendBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
});
