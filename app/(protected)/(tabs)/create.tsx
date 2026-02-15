import CommunitySearch from "@/components/CommunitySearch";
import CustomDialog, { CustomDialogAction } from "@/components/ui/custom-dialog";
import { useThemeColor } from "@/hooks/use-theme-color";
import { createPost, PostType } from "@/lib/actions/posts";
import { supabase } from "@/lib/Supabase";
import * as FileSystem from "expo-file-system/legacy";
import { useUser } from "@clerk/clerk-expo";
import * as ImagePicker from "expo-image-picker";
import { useRouter } from "expo-router";
import {
  BarChart3,
  Image as ImageIcon,
  Link2,
  Upload,
  Video,
  X,
} from "lucide-react-native";
import { useState } from "react";
import {
  Platform,
  Pressable,
  Switch,
  Text,
  TextInput,
  ToastAndroid,
  View,
} from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-aware-scroll-view";

type Group = {
  id: string;
  name: string;
  image: string | null;
};

const POST_MEDIA_BUCKET =
  process.env.EXPO_PUBLIC_SUPABASE_POST_MEDIA_BUCKET ?? "post-media";
const MAX_UPLOAD_BYTES = Number(
  process.env.EXPO_PUBLIC_MAX_UPLOAD_BYTES ?? 50 * 1024 * 1024,
);

type PickedMedia = {
  uri: string;
  fileName?: string | null;
  mimeType?: string | null;
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
  const [postType, setPostType] = useState<PostType>("text");
  const [linkUrl, setLinkUrl] = useState("");
  const [pickedMedia, setPickedMedia] = useState<PickedMedia | null>(null);
  const [pollOptions, setPollOptions] = useState(["", ""]);
  const [pollDurationHours, setPollDurationHours] = useState(24);
  const [pollAllowsMultiple, setPollAllowsMultiple] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedCommunity, setSelectedCommunity] = useState<Group | null>(
    null,
  );
  const [dialogVisible, setDialogVisible] = useState(false);
  const [dialogTitle, setDialogTitle] = useState("");
  const [dialogMessage, setDialogMessage] = useState("");
  const [dialogActions, setDialogActions] = useState<CustomDialogAction[]>([]);

  const showDialog = (
    title: string,
    message: string,
    actions: CustomDialogAction[] = [{ label: "OK" }],
  ) => {
    setDialogTitle(title);
    setDialogMessage(message);
    setDialogActions(actions);
    setDialogVisible(true);
  };

  const hasPollMinOptions =
    pollOptions.map((opt) => opt.trim()).filter(Boolean).length >= 2;
  const hasTypeRequirement =
    postType === "link"
      ? linkUrl.trim().length > 0
      : postType === "photo" || postType === "video"
        ? !!pickedMedia?.uri
        : postType === "poll"
          ? hasPollMinOptions
          : true;
  const canPost =
    title.trim().length > 0 &&
    !!selectedCommunity?.id &&
    !!user?.id &&
    hasTypeRequirement;

  const postTypeOptions: { key: PostType; icon: any }[] = [
    { key: "link", icon: Link2 },
    { key: "photo", icon: ImageIcon },
    { key: "video", icon: Video },
    { key: "poll", icon: BarChart3 },
  ];

  const pollDurations = [24, 72, 168];

  const resetTypeSpecificState = (type: PostType) => {
    setPostType(type);
    setLinkUrl("");
    setPickedMedia(null);
    setPollOptions(["", ""]);
    setPollDurationHours(24);
    setPollAllowsMultiple(false);
  };

  const handlePostTypePress = (type: PostType) => {
    if (postType === type) {
      resetTypeSpecificState("text");
      return;
    }
    resetTypeSpecificState(type);
  };

  const pickMediaFromLibrary = async (type: "photo" | "video") => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes:
        type === "photo"
          ? ImagePicker.MediaTypeOptions.Images
          : ImagePicker.MediaTypeOptions.Videos,
      allowsMultipleSelection: false,
      quality: 1,
    });

    if (result.canceled || !result.assets?.[0]) {
      return;
    }

    const asset = result.assets[0];
    setPickedMedia({
      uri: asset.uri,
      fileName: asset.fileName,
      mimeType: asset.mimeType,
    });
  };

  const uploadMediaToStorage = async (
    media: PickedMedia,
    type: "photo" | "video",
    userId: string,
  ) => {
    try {
      const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
      const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
      if (!supabaseUrl || !supabaseAnonKey) {
        return {
          publicUrl: null,
          error: { message: "Supabase URL or anon key is missing." },
        };
      }

      const extensionFromMime = media.mimeType?.split("/")?.[1];
      const extensionFromName = media.fileName?.split(".").pop();
      const extensionFromUri = media.uri.split("?")[0].split(".").pop();
      const extension =
        extensionFromMime || extensionFromName || extensionFromUri || "bin";
      const objectPath = `posts/${userId}/${type}_${Date.now()}_${Math.random()
        .toString(36)
        .slice(2, 8)}.${extension}`;

      const localUri = media.uri.startsWith("content://")
        ? `${FileSystem.cacheDirectory}upload_${Date.now()}.${extension}`
        : media.uri;

      if (media.uri.startsWith("content://")) {
        await FileSystem.copyAsync({ from: media.uri, to: localUri });
      }

      const fileInfo = await FileSystem.getInfoAsync(localUri);
      if (!fileInfo.exists) {
        return {
          publicUrl: null,
          error: { message: "Selected file could not be read." },
        };
      }
      const fileSize =
        typeof (fileInfo as { size?: number }).size === "number"
          ? (fileInfo as { size: number }).size
          : null;
      if (fileSize && fileSize > MAX_UPLOAD_BYTES) {
        const maxMb = (MAX_UPLOAD_BYTES / (1024 * 1024)).toFixed(0);
        const fileMb = (fileSize / (1024 * 1024)).toFixed(1);
        return {
          publicUrl: null,
          error: {
            message: `File is ${fileMb} MB. Max allowed is ${maxMb} MB.`,
          },
        };
      }

      const {
        data: { session },
      } = await supabase.auth.getSession();
      const accessToken = session?.access_token ?? supabaseAnonKey;
      const uploadUrl = `${supabaseUrl}/storage/v1/object/${POST_MEDIA_BUCKET}/${objectPath}`;

      const uploadResult = await FileSystem.uploadAsync(uploadUrl, localUri, {
        httpMethod: "POST",
        uploadType: FileSystem.FileSystemUploadType.BINARY_CONTENT,
        headers: {
          apikey: supabaseAnonKey,
          Authorization: `Bearer ${accessToken}`,
          "Content-Type":
            media.mimeType ?? (type === "photo" ? "image/jpeg" : "video/mp4"),
          "x-upsert": "false",
        },
      });

      if (uploadResult.status < 200 || uploadResult.status >= 300) {
        const rawBody = uploadResult.body || "";
        const isPayloadTooLarge =
          uploadResult.status === 413 ||
          rawBody.includes("Payload too large") ||
          rawBody.includes("exceeded the maximum allowed size");
        if (isPayloadTooLarge) {
          const maxMb = (MAX_UPLOAD_BYTES / (1024 * 1024)).toFixed(0);
          return {
            publicUrl: null,
            error: {
              message: `Upload rejected: file exceeds server limit (${maxMb} MB).`,
            },
          };
        }
        return {
          publicUrl: null,
          error: {
            message: `Upload failed (${uploadResult.status}): ${uploadResult.body || "unknown error"}`,
          },
        };
      }

      const { data: publicData } = supabase.storage
        .from(POST_MEDIA_BUCKET)
        .getPublicUrl(objectPath);

      return { publicUrl: publicData.publicUrl, error: null };
    } catch (err: any) {
      return {
        publicUrl: null,
        error: { message: err?.message ?? "Failed to process media file" },
      };
    }
  };

  const handleCreatePost = async () => {
    if (!canPost || !selectedCommunity || !user) {
      return;
    }

    if (postType === "link") {
      const url = linkUrl.trim();
      if (!/^https?:\/\//i.test(url)) {
        showDialog("Invalid URL", "Link must start with http:// or https://");
        return;
      }
    }

    setIsSubmitting(true);
    let uploadedMediaUrl: string | null = null;

    if ((postType === "photo" || postType === "video") && pickedMedia) {
      const uploadResult = await uploadMediaToStorage(
        pickedMedia,
        postType,
        user.id,
      );

      if (uploadResult.error || !uploadResult.publicUrl) {
        console.log("Media upload error:", uploadResult.error);
        showDialog(
          "Upload failed",
          uploadResult.error?.message ??
            `Could not upload ${postType}. Check storage bucket "${POST_MEDIA_BUCKET}" and try again.`,
        );
        setIsSubmitting(false);
        return;
      }

      uploadedMediaUrl = uploadResult.publicUrl;
    }

    const { error } = await createPost({
      title: title.trim(),
      description: body.trim().length > 0 ? body.trim() : null,
      postType,
      linkUrl: postType === "link" ? linkUrl.trim() : null,
      image: postType === "photo" ? uploadedMediaUrl : null,
      mediaUrl:
        postType === "photo" || postType === "video" ? uploadedMediaUrl : null,
      poll:
        postType === "poll"
          ? {
              options: pollOptions,
              durationHours: pollDurationHours,
              allowsMultiple: pollAllowsMultiple,
            }
          : undefined,
      groupId: selectedCommunity.id,
      userId: user.id,
    });

    if (error) {
      console.log("Create post error:", error);
      showDialog(
        "Could not create post",
        error.message ?? "An unexpected error occurred while creating the post.",
      );
      setIsSubmitting(false);
      return;
    }

    setIsSubmitting(false);
    if (Platform.OS === "android") {
      ToastAndroid.show("Post created", ToastAndroid.SHORT);
    }

    setTitle("");
    setBody("");
    setLinkUrl("");
    setPickedMedia(null);
    setPollOptions(["", ""]);
    setPollDurationHours(24);
    setPollAllowsMultiple(false);
    setPostType("text");
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
          <View
            style={{ backgroundColor: cardColor }}
            className="rounded-2xl p-2 flex-row flex-wrap gap-2"
          >
            {postTypeOptions.map((option) => {
              const isActive = postType === option.key;
              const Icon = option.icon;
              return (
                <Pressable
                  key={option.key}
                  onPress={() => handlePostTypePress(option.key)}
                  style={{
                    backgroundColor: isActive ? primaryColor : "transparent",
                    borderColor: isActive ? primaryColor : mutedColor + "30",
                    borderWidth: 1,
                  }}
                  className="w-10 h-10 rounded-full items-center justify-center"
                >
                  <Icon size={14} color={isActive ? "white" : textColor} />
                </Pressable>
              );
            })}
          </View>

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
              placeholder={
                postType === "poll" ? "Ask your poll question" : "Title"
              }
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

          {postType === "link" && (
            <View
              style={{ backgroundColor: cardColor }}
              className="rounded-2xl px-5 py-4"
            >
              <TextInput
                placeholder="https://example.com"
                placeholderTextColor={mutedColor}
                value={linkUrl}
                onChangeText={setLinkUrl}
                autoCapitalize="none"
                keyboardType="url"
                style={{
                  color: textColor,
                  fontSize: 16,
                }}
              />
            </View>
          )}

          {(postType === "photo" || postType === "video") && (
            <View
              style={{ backgroundColor: cardColor }}
              className="rounded-2xl px-5 py-4 gap-2"
            >
              <Text style={{ color: mutedColor }} className="text-xs">
                Select a {postType} from your device
              </Text>
              <View className="flex-row items-center gap-2">
                <Pressable
                  onPress={() => pickMediaFromLibrary(postType)}
                  className="px-3 py-2 rounded-full flex-row items-center gap-1.5"
                  style={{ backgroundColor: primaryColor + "20" }}
                >
                  <Upload size={14} color={primaryColor} />
                  <Text style={{ color: primaryColor }} className="text-xs font-semibold">
                    {pickedMedia ? "Change" : "Select"}
                  </Text>
                </Pressable>
                {pickedMedia && (
                  <Pressable
                    onPress={() => setPickedMedia(null)}
                    className="px-3 py-2 rounded-full"
                    style={{ backgroundColor: mutedColor + "20" }}
                  >
                    <Text style={{ color: textColor }} className="text-xs font-semibold">
                      Remove
                    </Text>
                  </Pressable>
                )}
              </View>
              {pickedMedia && (
                <Text style={{ color: textColor }} className="text-xs" numberOfLines={1}>
                  {pickedMedia.fileName ?? pickedMedia.uri}
                </Text>
              )}
            </View>
          )}

          {postType === "poll" && (
            <View
              style={{ backgroundColor: cardColor }}
              className="rounded-2xl px-5 py-4 gap-4"
            >
              <Text
                style={{ color: textColor }}
                className="text-sm font-semibold"
              >
                Poll options
              </Text>
              {pollOptions.map((option, index) => (
                <View
                  key={`poll-option-${index}`}
                  className="flex-row items-center gap-2"
                >
                  <TextInput
                    placeholder={`Option ${index + 1}`}
                    placeholderTextColor={mutedColor}
                    value={option}
                    onChangeText={(value) => {
                      setPollOptions((prev) => {
                        const next = [...prev];
                        next[index] = value;
                        return next;
                      });
                    }}
                    style={{
                      color: textColor,
                      fontSize: 16,
                      flex: 1,
                    }}
                  />
                  {pollOptions.length > 2 && (
                    <Pressable
                      onPress={() =>
                        setPollOptions((prev) =>
                          prev.filter((_, itemIndex) => itemIndex !== index),
                        )
                      }
                      className="px-3 py-2 rounded-full"
                      style={{ backgroundColor: mutedColor + "20" }}
                    >
                      <Text style={{ color: textColor }} className="text-xs">
                        Remove
                      </Text>
                    </Pressable>
                  )}
                </View>
              ))}

              {pollOptions.length < 6 && (
                <Pressable
                  onPress={() => setPollOptions((prev) => [...prev, ""])}
                  className="self-start px-3 py-2 rounded-full"
                  style={{ backgroundColor: primaryColor + "20" }}
                >
                  <Text
                    style={{ color: primaryColor }}
                    className="text-xs font-semibold"
                  >
                    Add option
                  </Text>
                </Pressable>
              )}

              <View className="gap-2">
                <Text style={{ color: mutedColor }} className="text-xs">
                  Poll duration
                </Text>
                <View className="flex-row gap-2">
                  {pollDurations.map((duration) => {
                    const selected = pollDurationHours === duration;
                    return (
                      <Pressable
                        key={duration}
                        onPress={() => setPollDurationHours(duration)}
                        className="px-3 py-2 rounded-full"
                        style={{
                          backgroundColor: selected
                            ? primaryColor
                            : mutedColor + "20",
                        }}
                      >
                        <Text
                          style={{ color: selected ? "white" : textColor }}
                          className="text-xs font-semibold"
                        >
                          {duration === 24
                            ? "1 day"
                            : duration === 72
                              ? "3 days"
                              : "7 days"}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>

              <View className="flex-row items-center justify-between">
                <Text style={{ color: textColor }} className="text-sm">
                  Allow multiple choices
                </Text>
                <Switch
                  value={pollAllowsMultiple}
                  onValueChange={setPollAllowsMultiple}
                  trackColor={{
                    false: mutedColor + "40",
                    true: primaryColor + "70",
                  }}
                  thumbColor={pollAllowsMultiple ? primaryColor : "#f4f3f4"}
                />
              </View>
            </View>
          )}

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
        </View>
      </KeyboardAwareScrollView>

      <CustomDialog
        visible={dialogVisible}
        title={dialogTitle}
        message={dialogMessage}
        actions={dialogActions}
        onClose={() => setDialogVisible(false)}
      />
    </View>
  );
}
