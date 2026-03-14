import AppLoader from "@/components/AppLoader";
import { useThemeColor } from "@/hooks/use-theme-color";
import {
  fetchGroupById,
  updateGroupById,
  type Group,
} from "@/lib/actions/groups";
import { supabase } from "@/lib/Supabase";
import { useUser } from "@clerk/clerk-expo";
import { BlurView } from "expo-blur";
import * as FileSystem from "expo-file-system/legacy";
import { Image as ExpoImage } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import { LinearGradient } from "expo-linear-gradient";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Upload, X } from "lucide-react-native";
import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  Image as RNImage,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  useColorScheme,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const COMMUNITY_MEDIA_BUCKET = "community";

type PickedImage = {
  uri: string;
  fileName?: string | null;
  mimeType?: string | null;
};

const normalizeNullableText = (value: string) => {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

const parseTags = (value: string) => {
  const tags = value
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
  return tags.length > 0 ? tags : null;
};

const fileExtFromImage = (image: PickedImage) => {
  const fromMime = image.mimeType?.split("/")?.[1];
  const fromName = image.fileName?.split(".").pop();
  const fromUri = image.uri.split("?")[0].split(".").pop();
  return fromMime || fromName || fromUri || "jpg";
};

const getCommunityObjectPathFromUrl = (url?: string | null) => {
  if (!url) return null;

  try {
    const parsed = new URL(url);
    const marker = `/storage/v1/object/public/${COMMUNITY_MEDIA_BUCKET}/`;
    const idx = parsed.pathname.indexOf(marker);
    if (idx === -1) return null;
    const rawPath = parsed.pathname.slice(idx + marker.length);
    const cleanPath = decodeURIComponent(rawPath).replace(/^\/+/, "");
    return cleanPath || null;
  } catch {
    return null;
  }
};

export default function EditCommunityPage() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const communityId = Array.isArray(id) ? id[0] : id;
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useUser();
  const isDark = useColorScheme() === "dark";

  const bg = useThemeColor({}, "background");
  const card = useThemeColor({}, "card");
  const text = useThemeColor({}, "text");
  const secondary = useThemeColor({}, "textSecondary");
  const border = useThemeColor({}, "border");
  const input = useThemeColor({}, "input");
  const primary = useThemeColor({}, "primary");
  const primaryForeground = useThemeColor({}, "primaryForeground");
  const error = useThemeColor({}, "error");
  const glassBorder = useThemeColor(
    {
      light: "rgba(148, 163, 184, 0.35)",
      dark: "rgba(228, 228, 231, 0.2)",
    },
    "tabBarBorder",
  );

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [community, setCommunity] = useState<Group | null>(null);

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [bannerImageUrl, setBannerImageUrl] = useState("");
  const [rules, setRules] = useState("");
  const [tagsInput, setTagsInput] = useState("");
  const [isPrivate, setIsPrivate] = useState(false);

  const [pickedImage, setPickedImage] = useState<PickedImage | null>(null);
  const [pickedBanner, setPickedBanner] = useState<PickedImage | null>(null);
  const [pickingImage, setPickingImage] = useState(false);
  const [pickingBanner, setPickingBanner] = useState(false);

  const canEdit = useMemo(
    () => !!community?.owner_id && community.owner_id === user?.id,
    [community?.owner_id, user?.id],
  );

  useEffect(() => {
    if (!communityId) return;
    let cancelled = false;

    const load = async () => {
      setLoading(true);
      const { data, error: loadError } = await fetchGroupById(communityId);
      if (cancelled) return;

      if (loadError || !data) {
        Alert.alert(
          "Could not load community",
          loadError?.message ?? "Please try again.",
          [{ text: "OK", onPress: () => router.back() }],
        );
        setLoading(false);
        return;
      }

      setCommunity(data);
      setName(data.name ?? "");
      setDescription(data.description ?? "");
      setImageUrl(data.image ?? "");
      setBannerImageUrl(data.banner_image ?? "");
      setRules(data.rules ?? "");
      setTagsInput((data.tags ?? []).join(", "));
      setIsPrivate(Boolean(data.is_private));
      setLoading(false);
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, [communityId, router]);

  useEffect(() => {
    if (!loading && community && !canEdit) {
      Alert.alert(
        "No edit permission",
        "Only the community owner can edit this page.",
      );
    }
  }, [canEdit, community, loading]);

  const pickCommunityImage = async () => {
    if (!canEdit || saving || pickingImage) return;
    setPickingImage(true);

    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      const asset = result.assets?.[0];
      if (!result.canceled && asset?.uri) {
        setPickedImage({
          uri: asset.uri,
          fileName: asset.fileName,
          mimeType: asset.mimeType,
        });
      }
    } finally {
      setPickingImage(false);
    }
  };

  const pickCommunityBanner = async () => {
    if (!canEdit || saving || pickingBanner) return;
    setPickingBanner(true);

    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [3, 1],
        quality: 0.8,
      });

      const asset = result.assets?.[0];
      if (!result.canceled && asset?.uri) {
        setPickedBanner({
          uri: asset.uri,
          fileName: asset.fileName,
          mimeType: asset.mimeType,
        });
      }
    } finally {
      setPickingBanner(false);
    }
  };

  const uploadImageToStorage = async (
    localImage: PickedImage,
    type: "avatar" | "banner",
  ) => {
    const userId = user?.id;
    if (!userId) {
      return { data: null, error: { message: "Not signed in." } };
    }

    try {
      const extension = fileExtFromImage(localImage);
      const mimeType = localImage.mimeType ?? "image/jpeg";
      const objectPath = `groups/${userId}/${type}_${Date.now()}_${Math.random()
        .toString(36)
        .slice(2, 8)}.${extension}`;

      // On Android, content:// URIs must be copied to a local cache file first
      let localUri = localImage.uri;
      if (localImage.uri.startsWith("content://")) {
        localUri = `${FileSystem.cacheDirectory}upload_${Date.now()}.${extension}`;
        await FileSystem.copyAsync({ from: localImage.uri, to: localUri });
      }

      // Read as base64 then convert to a Uint8Array (works on both iOS & Android)
      const base64 = await FileSystem.readAsStringAsync(localUri, {
        encoding: FileSystem.EncodingType.Base64,
      });

      // Decode base64 → binary
      const binaryString = atob(base64);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }

      const { error: uploadError } = await supabase.storage
        .from(COMMUNITY_MEDIA_BUCKET)
        .upload(objectPath, bytes, {
          contentType: mimeType,
          upsert: true,
        });

      if (uploadError) {
        return { data: null, error: { message: uploadError.message } };
      }

      const { data } = supabase.storage
        .from(COMMUNITY_MEDIA_BUCKET)
        .getPublicUrl(objectPath);

      return { data: data.publicUrl, error: null };
    } catch (uploadError: any) {
      return {
        data: null,
        error: { message: uploadError?.message ?? "Could not upload image." },
      };
    }
  };

  const handleSave = async () => {
    if (!communityId || !community) return;
    if (!canEdit) {
      Alert.alert("No edit permission", "Only the community owner can edit.");
      return;
    }

    const nextName = name.trim();
    if (!nextName) {
      Alert.alert("Name required", "Community name cannot be empty.");
      return;
    }

    setSaving(true);

    const oldImagePath = getCommunityObjectPathFromUrl(community.image);
    const oldBannerPath = getCommunityObjectPathFromUrl(community.banner_image);

    let nextImage = normalizeNullableText(imageUrl);
    let nextBanner = normalizeNullableText(bannerImageUrl);

    if (pickedImage) {
      const uploadResult = await uploadImageToStorage(pickedImage, "avatar");
      if (uploadResult.error || !uploadResult.data) {
        setSaving(false);
        Alert.alert(
          "Image upload failed",
          uploadResult.error?.message ?? "Could not upload community image.",
        );
        return;
      }
      nextImage = uploadResult.data;
    }

    if (pickedBanner) {
      const uploadResult = await uploadImageToStorage(pickedBanner, "banner");
      if (uploadResult.error || !uploadResult.data) {
        setSaving(false);
        Alert.alert(
          "Banner upload failed",
          uploadResult.error?.message ?? "Could not upload banner image.",
        );
        return;
      }
      nextBanner = uploadResult.data;
    }

    const { error: updateError } = await updateGroupById(communityId, {
      name: nextName,
      description: normalizeNullableText(description),
      image: nextImage,
      banner_image: nextBanner,
      rules: normalizeNullableText(rules),
      tags: parseTags(tagsInput),
      is_private: isPrivate,
    });

    setSaving(false);

    if (updateError) {
      Alert.alert(
        "Could not save changes",
        updateError.message ?? "Please try again.",
      );
      return;
    }

    const pathsToDelete: string[] = [];
    if (
      oldImagePath &&
      oldImagePath !== getCommunityObjectPathFromUrl(nextImage)
    ) {
      pathsToDelete.push(oldImagePath);
    }
    if (
      oldBannerPath &&
      oldBannerPath !== getCommunityObjectPathFromUrl(nextBanner)
    ) {
      pathsToDelete.push(oldBannerPath);
    }

    if (pathsToDelete.length > 0) {
      const uniquePaths = [...new Set(pathsToDelete)];
      const { error: removeError } = await supabase.storage
        .from(COMMUNITY_MEDIA_BUCKET)
        .remove(uniquePaths);
      if (removeError) {
        console.log("Old community media cleanup warning:", removeError);
      }
    }

    Alert.alert("Saved", "Community details updated.", [
      {
        text: "OK",
        onPress: () => router.replace(`/community/${communityId}`),
      },
    ]);
  };

  if (loading) {
    return (
      <View style={[styles.center, { backgroundColor: bg }]}>
        <AppLoader fullScreen />
      </View>
    );
  }

  if (!community) {
    return (
      <View style={[styles.center, { backgroundColor: bg }]}>
        <Text style={[styles.emptyTitle, { color: text }]}>
          Community not found
        </Text>
      </View>
    );
  }

  const previewImageUri = pickedImage?.uri ?? imageUrl;
  const previewBannerUri = pickedBanner?.uri ?? bannerImageUrl;

  return (
    <View style={[styles.container, { backgroundColor: bg }]}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[
          styles.content,
          { paddingBottom: insets.bottom + 80 },
        ]}
        keyboardShouldPersistTaps="handled"
      >
        <LinearGradient
          colors={[primary, card, card]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[styles.heroCard, { borderColor: border }]}
        >
          <View style={styles.heroBadgeRow}>
            <View
              style={[
                styles.heroBadge,
                { backgroundColor: primaryForeground, borderColor: border },
              ]}
            >
              <Text style={[styles.heroBadgeText, { color: primary }]}>
                Editor
              </Text>
            </View>
          </View>
          <Text style={[styles.heroTitle, { color: text }]}>
            Keep your community fresh
          </Text>
          <Text style={[styles.heroSub, { color: secondary }]}>
            Changes are only applied after you tap Save, so you can review
            everything before publishing.
          </Text>
        </LinearGradient>

        {!canEdit ? (
          <View style={[styles.permissionCard, { borderColor: error }]}>
            <Text style={[styles.permissionText, { color: error }]}>
              You can view details, but only the owner can save edits.
            </Text>
          </View>
        ) : null}

        <View
          style={[
            styles.sectionCard,
            { backgroundColor: card, borderColor: border },
          ]}
        >
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, { color: text }]}>Basics</Text>
            <Text style={[styles.sectionSubtitle, { color: secondary }]}>
              Name and summary
            </Text>
          </View>
          <Field
            label="Name"
            value={name}
            onChangeText={setName}
            textColor={text}
            inputColor={input}
            borderColor={border}
            placeholder="Community name"
            editable={canEdit && !saving}
          />

          <Field
            label="Description"
            value={description}
            onChangeText={setDescription}
            textColor={text}
            inputColor={input}
            borderColor={border}
            placeholder="Community description"
            multiline
            editable={canEdit && !saving}
          />
        </View>

        <View
          style={[
            styles.sectionCard,
            { backgroundColor: card, borderColor: border },
          ]}
        >
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, { color: text }]}>Images</Text>
            <Text style={[styles.sectionSubtitle, { color: secondary }]}>
              Avatar and banner
            </Text>
          </View>

          <ImageCard
            title="Community image"
            subtitle="Square image"
            imageUri={previewImageUri}
            borderColor={border}
            cardColor={input}
            textColor={text}
            secondaryColor={secondary}
            accentColor={primary}
            pickLabel={previewImageUri ? "Replace" : "Pick image"}
            onPick={pickCommunityImage}
            onRemove={
              previewImageUri
                ? () => {
                    setPickedImage(null);
                    setImageUrl("");
                  }
                : undefined
            }
            disabled={!canEdit || saving || pickingImage}
            loading={pickingImage}
            fallbackAspectRatio={1}
          />

          <ImageCard
            title="Banner image"
            subtitle="Wide image"
            imageUri={previewBannerUri}
            borderColor={border}
            cardColor={input}
            textColor={text}
            secondaryColor={secondary}
            accentColor={primary}
            pickLabel={previewBannerUri ? "Replace" : "Pick banner"}
            onPick={pickCommunityBanner}
            onRemove={
              previewBannerUri
                ? () => {
                    setPickedBanner(null);
                    setBannerImageUrl("");
                  }
                : undefined
            }
            disabled={!canEdit || saving || pickingBanner}
            loading={pickingBanner}
            fallbackAspectRatio={3}
          />
        </View>

        <View
          style={[
            styles.sectionCard,
            { backgroundColor: card, borderColor: border },
          ]}
        >
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, { color: text }]}>
              Community setup
            </Text>
            <Text style={[styles.sectionSubtitle, { color: secondary }]}>
              Rules and discovery tags
            </Text>
          </View>
          <Field
            label="Rules"
            value={rules}
            onChangeText={setRules}
            textColor={text}
            inputColor={input}
            borderColor={border}
            placeholder="Add community rules"
            multiline
            editable={canEdit && !saving}
          />

          <Field
            label="Tags (comma separated)"
            value={tagsInput}
            onChangeText={setTagsInput}
            textColor={text}
            inputColor={input}
            borderColor={border}
            placeholder="tech, design, events"
            editable={canEdit && !saving}
          />
        </View>

        <View
          style={[
            styles.switchRow,
            { backgroundColor: card, borderColor: border },
          ]}
        >
          <View style={styles.switchTextWrap}>
            <Text style={[styles.switchTitle, { color: text }]}>Private</Text>
            <Text style={[styles.switchSubtext, { color: secondary }]}>
              Restrict community visibility and joining.
            </Text>
          </View>
          <Switch
            value={isPrivate}
            onValueChange={setIsPrivate}
            disabled={!canEdit || saving}
          />
        </View>
      </ScrollView>

      <View
        style={[
          styles.footer,
          {
            backgroundColor: "transparent",
            borderColor: glassBorder,
            bottom: insets.bottom + 10,
          },
        ]}
      >
        {Platform.OS !== "web" ? (
          <>
            <BlurView
              tint={isDark ? "systemMaterialDark" : "systemMaterialLight"}
              intensity={70}
              experimentalBlurMethod={
                Platform.OS === "android" ? "dimezisBlurView" : undefined
              }
              style={StyleSheet.absoluteFillObject}
            />
            <View
              pointerEvents="none"
              style={[
                StyleSheet.absoluteFillObject,
                { backgroundColor: "transparent" },
              ]}
            />
          </>
        ) : null}

        <Pressable
          onPress={() => router.back()}
          disabled={saving}
          style={({ pressed }) => [
            styles.cancelButton,
            {
              borderColor: border,
              backgroundColor: bg,
              opacity: saving ? 0.65 : pressed ? 0.85 : 1,
            },
          ]}
        >
          <Text style={[styles.cancelButtonText, { color: text }]}>Cancel</Text>
        </Pressable>

        <Pressable
          onPress={handleSave}
          disabled={saving}
          style={({ pressed }) => [
            styles.saveButton,
            {
              backgroundColor: primary,
              opacity: saving ? 0.6 : pressed ? 0.86 : 1,
            },
          ]}
        >
          {saving ? (
            <ActivityIndicator color={primaryForeground} />
          ) : (
            <Text style={[styles.saveButtonText, { color: text }]}>Save </Text>
          )}
        </Pressable>
      </View>
    </View>
  );
}

type FieldProps = {
  label: string;
  value: string;
  onChangeText: (next: string) => void;
  textColor: string;
  inputColor: string;
  borderColor: string;
  placeholder: string;
  multiline?: boolean;
  editable: boolean;
};

function Field({
  label,
  value,
  onChangeText,
  textColor,
  inputColor,
  borderColor,
  placeholder,
  multiline,
  editable,
}: FieldProps) {
  return (
    <View style={styles.fieldWrap}>
      <Text style={[styles.fieldLabel, { color: textColor }]}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={`${textColor}77`}
        multiline={multiline}
        editable={editable}
        style={[
          styles.input,
          multiline ? styles.inputMultiline : null,
          {
            color: textColor,
            backgroundColor: inputColor,
            borderColor,
            opacity: editable ? 1 : 0.75,
          },
        ]}
      />
    </View>
  );
}

type ImageCardProps = {
  title: string;
  subtitle: string;
  imageUri: string;
  pickLabel: string;
  onPick: () => void;
  onRemove?: () => void;
  disabled: boolean;
  loading: boolean;
  fallbackAspectRatio: number;
  borderColor: string;
  cardColor: string;
  textColor: string;
  secondaryColor: string;
  accentColor: string;
};

function ImageCard({
  title,
  subtitle,
  imageUri,
  pickLabel,
  onPick,
  onRemove,
  disabled,
  loading,
  fallbackAspectRatio,
  borderColor,
  cardColor,
  textColor,
  secondaryColor,
  accentColor,
}: ImageCardProps) {
  const hasImage = Boolean(imageUri);
  const [aspectRatio, setAspectRatio] = useState(fallbackAspectRatio);

  useEffect(() => {
    let active = true;

    if (!imageUri) {
      setAspectRatio(fallbackAspectRatio);
      return () => {
        active = false;
      };
    }

    RNImage.getSize(
      imageUri,
      (width, height) => {
        if (!active || !width || !height) return;
        setAspectRatio(width / height);
      },
      () => {
        if (!active) return;
        setAspectRatio(fallbackAspectRatio);
      },
    );

    return () => {
      active = false;
    };
  }, [fallbackAspectRatio, imageUri]);
  const primary = useThemeColor({}, "primary");
  return (
    <View style={styles.fieldWrap}>
      <View style={styles.imageRowHead}>
        <View style={styles.imageMeta}>
          <Text style={[styles.fieldLabel, { color: textColor }]}>{title}</Text>
          <Text style={[styles.imageHint, { color: secondaryColor }]}>
            {subtitle}
          </Text>
        </View>
        <View style={styles.imageActionRow}>
          {onRemove ? (
            <Pressable
              onPress={onRemove}
              disabled={disabled}
              style={{
                backgroundColor: primary,
                paddingHorizontal: 10,
                paddingVertical: 10,
                borderRadius: 999,
                shadowColor: "#000",
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 1,
                shadowRadius: 4,
                elevation: 4,
              }}
            >
              <X size={16} color={"white"} />
            </Pressable>
          ) : null}

          <Pressable
            onPress={onPick}
            disabled={disabled}
            style={{
              backgroundColor: primary,
              paddingHorizontal: 16,
              paddingVertical: 8,
              borderRadius: 999,
              shadowColor: "#000",
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: 1,
              shadowRadius: 4,
              elevation: 4,
            }}
          >
            {loading ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <View style={styles.pickButtonContent}>
                <View style={styles.pickButtonIcon}>
                  <Upload size={14} color="white" />
                </View>
                <Text
                  numberOfLines={1}
                  style={[styles.pickButtonPrimaryText, { color: "white" }]}
                >
                  {pickLabel}
                </Text>
              </View>
            )}
          </Pressable>
        </View>
      </View>

      <View
        style={[
          styles.imagePreview,
          {
            borderColor,
            backgroundColor: cardColor,
            aspectRatio,
            borderStyle: hasImage ? "solid" : "dashed",
          },
        ]}
      >
        {hasImage ? (
          <ExpoImage
            source={{ uri: imageUri }}
            style={styles.imageFill}
            contentFit="contain"
            contentPosition="center"
            transition={120}
          />
        ) : (
          <Text style={[styles.emptyPreviewText, { color: secondaryColor }]}>
            No image selected
          </Text>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },

  scroll: { flex: 1 },

  content: {
    paddingHorizontal: 18,
    paddingTop: 16,
    gap: 16,
  },

  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
  },

  emptyTitle: {
    fontSize: 18,
    fontWeight: "700",
  },

  heroCard: {
    borderWidth: 1,
    borderRadius: 22,
    paddingHorizontal: 16,
    paddingVertical: 16,
    gap: 8,

    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },

  heroBadgeRow: {
    flexDirection: "row",
    justifyContent: "flex-start",
  },

  heroBadge: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },

  heroBadgeText: {
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.3,
  },

  heroTitle: {
    fontSize: 20,
    fontWeight: "800",
  },

  heroSub: {
    fontSize: 13.5,
    lineHeight: 20,
  },

  permissionCard: {
    borderWidth: 1,
    borderRadius: 14,
    padding: 14,
  },

  permissionText: {
    fontSize: 13,
    fontWeight: "600",
  },

  sectionCard: {
    borderWidth: 1,
    borderRadius: 20,
    padding: 16,
    gap: 14,

    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },

  sectionHeader: {
    gap: 3,
  },

  sectionTitle: {
    fontSize: 16,
    fontWeight: "800",
    letterSpacing: 0.2,
  },

  sectionSubtitle: {
    fontSize: 12.5,
    fontWeight: "500",
  },

  fieldWrap: {
    gap: 8,
  },

  fieldLabel: {
    fontSize: 13,
    fontWeight: "700",
  },

  input: {
    borderWidth: 1,
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
  },

  inputMultiline: {
    minHeight: 110,
    textAlignVertical: "top",
  },

  imageRowHead: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },

  imageMeta: {
    flex: 1,
    minWidth: 0,
  },

  imageHint: {
    marginTop: 2,
    fontSize: 12.5,
  },

  imageActionRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flexShrink: 0,
  },

  iconAction: {
    width: 32,
    height: 32,
    borderWidth: 1,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
  },

  pickButtonPrimary: {
    minHeight: 42,
    minWidth: 118,
    paddingHorizontal: 16,
    borderRadius: 999,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOpacity: 0.2,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 4,
  },

  pickButtonContent: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },

  pickButtonIcon: {
    width: 22,
    height: 22,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.22)",
    alignItems: "center",
    justifyContent: "center",
  },

  pickButtonPrimaryText: {
    fontSize: 13,
    fontWeight: "800",
    color: "#fff",
    letterSpacing: 0.2,
    includeFontPadding: false,
  },

  imagePreview: {
    borderWidth: 1,
    borderRadius: 16,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
    width: "100%",
  },

  imageFill: {
    width: "100%",
    height: "100%",
  },

  emptyPreviewText: {
    fontSize: 12.5,
    fontWeight: "600",
  },

  switchRow: {
    borderWidth: 1,
    borderRadius: 20,
    padding: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,

    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },

  switchTextWrap: {
    flex: 1,
    minWidth: 0,
  },

  switchTitle: {
    fontSize: 15,
    fontWeight: "700",
  },

  switchSubtext: {
    marginTop: 4,
    fontSize: 13,
  },

  footer: {
    position: "absolute",
    left: 14,
    right: 14,
    borderWidth: 1,
    borderRadius: 20,
    overflow: "hidden",
    ...(Platform.OS === "web"
      ? ({
          backdropFilter: "saturate(140%) blur(18px)",
          WebkitBackdropFilter: "saturate(140%) blur(18px)",
        } as any)
      : {}),
    paddingHorizontal: 18,
    paddingVertical: 12,
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12,
    zIndex: 20,

    shadowColor: "#000",
    shadowOpacity: 0.14,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: -4 },
    elevation: 10,
  },

  cancelButton: {
    flex: 1,
    minHeight: 50,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },

  cancelButtonText: {
    fontSize: 15,
    fontWeight: "700",
  },

  saveButton: {
    flex: 1,
    minHeight: 50,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },

  saveButtonText: {
    fontSize: 16,
    fontWeight: "800",
  },
});
