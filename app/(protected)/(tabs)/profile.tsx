import ProfileView from "@/components/profile/ProfileView";
import { getUserDisplayName, updateUserImage } from "@/lib/actions/users";
import { useUser } from "@clerk/clerk-expo";
import * as FileSystem from "expo-file-system/legacy";
import * as ImagePicker from "expo-image-picker";
import { useEffect, useState } from "react";

export default function ProfileScreen() {
  const { user } = useUser();
  const [updatingImage, setUpdatingImage] = useState(false);
  const [displayName, setDisplayName] = useState("User");
  const [profileUsername, setProfileUsername] = useState("@user");

  useEffect(() => {
    if (!user?.id || !user) return;

    const refreshIdentity = async () => {
      try {
        await user.reload();
      } catch (error) {
        console.log("Profile user reload error:", error);
      }

      const fallbackName = user.fullName || user.username || "User";
      setDisplayName(fallbackName);
      setProfileUsername(user.username ? `@${user.username}` : "@user");

      const { data, error } = await getUserDisplayName(user.id);
      if (error) {
        console.log("Profile display name fetch error:", error);
        return;
      }
      if (data?.name?.trim()) {
        setDisplayName(data.name.trim());
      }
    };

    refreshIdentity().catch((error) => {
      console.log("Profile identity refresh exception:", error);
    });
  }, [user, user?.id]);

  useEffect(() => {
    if (!user?.username) {
      setProfileUsername("@user");
      return;
    }
    setProfileUsername(`@${user.username}`);
  }, [user?.username]);

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
      displayName={displayName}
      username={profileUsername}
      avatarUrl={user.imageUrl}
      isOwnProfile={true}
      updatingImage={updatingImage}
      onEditImage={onSelectImage}
    />
  );
}
