import { Colors } from "@/constants/theme";
import { useThemeColor } from "@/hooks/use-theme-color";
import { BlurView } from "expo-blur";
import { Plus, Send, X } from "lucide-react-native";
import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  Platform,
  Pressable,
  StyleSheet,
  TextInput,
  View,
  type ViewStyle,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

type CommentInputProps = {
  value: string;
  onChangeText: (text: string) => void;
  onSubmit: () => void;
  onPickMedia?: () => void;
  isAuthed?: boolean;
  sending?: boolean;
  placeholder?: string;
  isDark?: boolean;
};

export default function CommentInput({
  value,
  onChangeText,
  onSubmit,
  onPickMedia,
  isAuthed = true,
  sending = false,
  placeholder = "Add a comment...",
  isDark = false,
}: CommentInputProps) {
  const [isFocused, setIsFocused] = useState(false);
  const sendScale = useRef(new Animated.Value(1)).current;

  const text = useThemeColor({}, "text");
  const secondary = useThemeColor({}, "textSecondary");
  const primary = useThemeColor({}, "primary");

  const composerOverlay = useThemeColor(
    {
      light: "rgba(255,255,255,0.72)",
      dark: "rgba(28,28,30,0.75)",
    },
    "tabBarBackground",
  );

  const composerBorder = useThemeColor(
    {
      light: "rgba(0,0,0,0.05)",
      dark: "rgba(255,255,255,0.1)",
    },
    "tabBarBorder",
  );

  const canSend = isAuthed && value.trim().length > 0 && !sending;
  const primaryColor = Colors.dark.primary;

  useEffect(() => {
    Animated.spring(sendScale, {
      toValue: canSend ? 1 : 0.85,
      friction: 8,
      tension: 40,
      useNativeDriver: true,
    }).start();
  }, [canSend]);

  return (
    <View style={styles.container}>
      {/* Background with Blur */}
      {Platform.OS !== "web" && (
        <BlurView
          tint={
            isDark ? "systemChromeMaterialDark" : "systemChromeMaterialLight"
          }
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
        {onPickMedia && (
          <Pressable
            onPress={onPickMedia}
            disabled={!isAuthed || sending}
            style={({ pressed }) => [
              styles.actionBtn,
              {
                opacity: !isAuthed || sending ? 0.45 : pressed ? 0.6 : 1,
              },
            ]}
          >
            <View
              style={[
                styles.actionIconWrap,
                {
                  backgroundColor: isDark
                    ? "rgba(255,255,255,0.08)"
                    : "rgba(0,0,0,0.05)",
                },
              ]}
            >
              <Plus size={22} color={secondary} strokeWidth={2.5} />
            </View>
          </Pressable>
        )}

        {/* Input Wrapper */}
        <View
          style={[
            styles.inputWrap,
            {
              backgroundColor: isDark
                ? "rgba(255,255,255,0.05)"
                : "rgba(0,0,0,0.03)",
              borderColor: isFocused ? `${primary}50` : "transparent",
            },
          ]}
        >
          <TextInput
            value={value}
            onChangeText={onChangeText}
            placeholder={placeholder}
            placeholderTextColor={`${secondary}80`}
            style={[styles.textInput, { color: text }]}
            multiline
            maxLength={2000}
            editable={isAuthed && !sending}
            onFocus={() => setIsFocused(true)}
            onBlur={() => setIsFocused(false)}
            textAlignVertical="center"
          />
        </View>

        {/* Send Button */}
        <Animated.View
          style={{
            transform: [{ scale: sendScale }],
            backgroundColor: primaryColor,
            borderRadius: 100,
            padding: 12,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            overflow: "hidden",
          }}
        >
          <Pressable
            onPress={onSubmit}
            disabled={!canSend}
            style={({ pressed }) => [
              styles.sendBtn,
              {
                backgroundColor: primary,
                opacity: pressed ? 0.7 : 1,
              },
            ]}
          >
            {sending ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Send size={20} color="#fff" strokeWidth={2} />
            )}
          </Pressable>
        </Animated.View>
      </View>
    </View>
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
    alignItems: "center",
    gap: 8,
  },
  actionBtn: {
    marginBottom: 0,
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
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 0,
  },
});
