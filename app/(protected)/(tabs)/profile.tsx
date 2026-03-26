import ProfileView from "@/components/profile/ProfileView";
import { updateUserImage } from "@/lib/actions/users";
import { useUser } from "@clerk/clerk-expo";
import * as FileSystem from "expo-file-system/legacy";
import * as ImagePicker from "expo-image-picker";
import { useState } from "react";

export default function ProfileScreen() {
  const { user } = useUser();
  const [updatingImage, setUpdatingImage] = useState(false);

  const onSelectImage = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.5,
      });

      const firstAsset = result.assets?.[0];
      if (!result.canceled && firstAsset?.uri) {
        setUpdatingImage(true);
        const imageBase64 = await FileSystem.readAsStringAsync(firstAsset.uri, {
          encoding: "base64",
        });
        const base64 = `data:image/jpeg;base64,${imageBase64}`;

        await user?.setProfileImage({ file: base64 });
        await user?.reload();

        if (user?.id) {
          const { error } = await updateUserImage({
            id: user.id,
            image: user.imageUrl ?? null,
          });

          if (error) {
            console.log("Update user image error:", error);
          }
        }
      }
    } catch (err) {
      console.error("Error updating image:", err);
      alert("Failed to update profile image");
    } finally {
      setUpdatingImage(false);
    }
  };

  if (!user?.id) return null;

  return (
    <ProfileView
      profileUserId={user.id}
      displayName={user.fullName || user.username || "User"}
      username={user.username ? `@${user.username}` : "@user"}
      avatarUrl={user.imageUrl}
      isOwnProfile={true}
      updatingImage={updatingImage}
      onEditImage={onSelectImage}
    />
  );
}
