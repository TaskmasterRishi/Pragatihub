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
        borderRadius: 12,
        padding: 16,
        margin: 16,
        borderWidth: 1,
        borderColor: border,
        flexDirection: "row",
        alignItems: "center",
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
        }}
        multiline
        maxLength={500}
      />
      <Pressable
        onPress={handleSubmit}
        style={{
          marginLeft: 12,
          padding: 8,
          borderRadius: 20,
          backgroundColor: primary,
        }}
        disabled={!content.trim()}
      >
        <Send size={20} color="white" />
      </Pressable>
    </View>
  );
}
