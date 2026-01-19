import { useThemeColor } from "@/hooks/use-theme-color";
import { Search, X } from "lucide-react-native";
import { useState } from "react";
import { Pressable, Text, TextInput, View } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-aware-scroll-view";

export default function CreateScreen() {
  const backgroundColor = useThemeColor({}, "background");
  const textColor = useThemeColor({}, "text");
  const primaryColor = useThemeColor({}, "primary");
  const mutedColor = useThemeColor({}, "textMuted");
  const cardColor = useThemeColor({}, "card");

  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");

  return (
    <View style={{ flex: 1, backgroundColor }}>
      {/* Header */}
      <View className="px-4 pt-4 pb-2">
        <View className="relative flex-row items-center justify-between">
          {/* Left */}
          <Pressable className="p-2 rounded-full">
            <X size={22} color={textColor} />
          </Pressable>

          {/* Center (absolute) */}
          <View className="absolute left-0 right-0 items-center">
            <Text
              style={{ color: textColor }}
              className="text-base font-semibold"
            >
              Create Post
            </Text>
          </View>

          {/* Right */}
          <Pressable
            style={{ backgroundColor: primaryColor }}
            className="px-4 py-1.5 rounded-full"
          >
            <Text className="text-white font-semibold">Post</Text>
          </Pressable>
        </View>
      </View>

      <KeyboardAwareScrollView
        enableOnAndroid
        keyboardShouldPersistTaps="handled"
        extraScrollHeight={100}
        contentContainerStyle={{
          paddingBottom: 120,
        }}
      >
        <View className="px-4 pt-4 gap-6">
          {/* Community Selector */}
          <Pressable
            style={{ backgroundColor: cardColor }}
            className="flex-row items-center gap-3 px-4 py-3 rounded-2xl"
          >
            <View
              style={{ backgroundColor: primaryColor }}
              className="p-2 rounded-xl"
            >
              <Search size={18} color="white" />
            </View>

            <View className="flex-1">
              <Text style={{ color: mutedColor }} className="text-xs">
                Community
              </Text>
              <Text
                style={{ color: textColor }}
                className="text-sm font-medium"
              >
                Select a community
              </Text>
            </View>
          </Pressable>

          {/* Title Input */}
          <View
            style={{ backgroundColor: cardColor }}
            className="rounded-2xl px-5 py-4"
          >
            <TextInput
              placeholder="Title"
              placeholderTextColor={mutedColor}
              value={title}
              onChangeText={setTitle}
              multiline
              scrollEnabled={false}
              style={{
                color: textColor,
                fontSize: 22,
                fontWeight: "600",
              }}
            />
          </View>

          {/* Body Input */}
          <View
            style={{ backgroundColor: cardColor }}
            className="rounded-2xl px-5 py-4 min-h-[180px]"
          >
            <TextInput
              placeholder="Write your post here…"
              placeholderTextColor={mutedColor}
              value={body}
              onChangeText={setBody}
              multiline
              scrollEnabled={false}
              textAlignVertical="top"
              style={{
                color: textColor,
                fontSize: 16,
                lineHeight: 22,
              }}
            />
          </View>

          {/* Helper text */}
          <Text style={{ color: mutedColor }} className="text-xs px-2">
            You can add links, explanations, or context
          </Text>
        </View>
      </KeyboardAwareScrollView>
    </View>
  );
}
