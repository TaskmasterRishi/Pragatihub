import CommunitySearch from "@/components/CommunitySearch";
import { useThemeColor } from "@/hooks/use-theme-color";
import { createPost } from "@/lib/actions/posts";
import { useUser } from "@clerk/clerk-expo";
import { useRouter } from "expo-router";
import { X } from "lucide-react-native";
import { useState } from "react";
import { Alert, Platform, Pressable, Text, TextInput, ToastAndroid, View } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-aware-scroll-view";

type Group = {
  id: string;
  name: string;
  image: string | null;
};

export default function CreateScreen() {
  const router = useRouter();
  const { user } = useUser();

  const backgroundColor = useThemeColor({}, "background");
  const textColor = useThemeColor({}, "text");
  const primaryColor = useThemeColor({}, "primary");
  const mutedColor = useThemeColor({}, "textMuted");
  const cardColor = useThemeColor({}, "card");

  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedCommunity, setSelectedCommunity] = useState<Group | null>(
    null,
  );

  const canPost =
    title.trim().length > 0 && !!selectedCommunity?.id && !!user?.id;

  const handleCreatePost = async () => {
    if (!canPost || !selectedCommunity || !user) {
      return;
    }

    setIsSubmitting(true);
    const { error } = await createPost({
      title: title.trim(),
      description: body.trim().length > 0 ? body.trim() : null,
      groupId: selectedCommunity.id,
      userId: user.id,
    });

    if (error) {
      console.log("Create post error:", error);
      setIsSubmitting(false);
      return;
    }

    setIsSubmitting(false);
    if (Platform.OS === "android") {
      ToastAndroid.show("Post created", ToastAndroid.SHORT);
    } else {
      Alert.alert("Success", "Post created");
    }

    setTitle("");
    setBody("");
    setSelectedCommunity(null);
    router.replace("/(protected)/(tabs)");
  };

  return (
    <View style={{ flex: 1, backgroundColor }}>
      {/* Header */}
      <View className="px-4 pt-4 pb-2">
        <View className="relative flex-row items-center justify-between">
          {/* Left */}
          <Pressable onPress={() => router.back()} className="p-2 rounded-full">
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
            disabled={!canPost || isSubmitting}
            onPress={handleCreatePost}
          >
            <Text className="text-white font-semibold">
              {isSubmitting ? "Posting..." : "Post"}
            </Text>
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
          {/* Community Search Component */}
          <CommunitySearch
            selectedCommunity={selectedCommunity}
            onCommunitySelect={setSelectedCommunity}
          />

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
