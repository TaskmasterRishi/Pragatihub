import { useThemeColor } from "@/hooks/use-theme-color";
import { Send } from "lucide-react-native";
import React, { useState } from "react";
import { Pressable, TextInput, View } from "react-native";

type CommentInputProps = {
  onSubmit: (content: string) => void;
  placeholder?: string;
};

export default function CommentInput({
  onSubmit,
  placeholder = "Add a comment...",
}: CommentInputProps) {
  const [content, setContent] = useState("");
  const text = useThemeColor({}, "text");
  const muted = useThemeColor({}, "textMuted");
  const card = useThemeColor({}, "card");
  const border = useThemeColor({}, "border");
  const primary = useThemeColor({}, "primary");

  const handleSubmit = () => {
    if (content.trim()) {
      onSubmit(content.trim());
      setContent("");
    }
  };

  return (
    <View
      style={{
        backgroundColor: card,
        borderRadius: 20,
        paddingHorizontal: 20,
        paddingVertical: 5,
        marginHorizontal: 16,
        marginBottom: 48,
        marginTop: 8,
        borderWidth: 1,
        borderColor: border,
        flexDirection: "row",
        alignItems: "flex-end",
        // Add subtle shadow
        shadowColor: "#000",
        shadowOffset: { width: 0, height: -2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 4,
      }}
    >
      <TextInput
        value={content}
        onChangeText={setContent}
        placeholder={placeholder}
        placeholderTextColor={muted}
        style={{
          flex: 1,
          color: text,
          fontSize: 16,
          paddingVertical: 8,
          paddingRight: 12,
          maxHeight: 100,
          minHeight: 20,
        }}
        multiline
        maxLength={500}
        textAlignVertical="center"
      />
      <Pressable
        onPress={handleSubmit}
        style={{
          padding: 10,
          borderRadius: 18,
          backgroundColor: content.trim() ? primary : muted,
          opacity: content.trim() ? 1 : 0.6,
        }}
        disabled={!content.trim()}
      >
        <Send size={18} color="white" />
      </Pressable>
    </View>
  );
}
