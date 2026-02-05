import { useUser } from "@clerk/clerk-expo";
import { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, Text } from "react-native";

import { useThemeColor } from "@/hooks/use-theme-color";
import { isUserInGroup, joinUserGroup } from "@/lib/actions/user-groups";

type JoinCommunityButtonProps = {
  communityId: string;
};

export default function JoinCommunityButton({
  communityId,
}: JoinCommunityButtonProps) {
  const primary = useThemeColor({}, "primary");
  const muted = useThemeColor({}, "textMuted");
  const border = useThemeColor({}, "border");
  const { user, isLoaded } = useUser();
  const [isJoining, setIsJoining] = useState(false);
  const [isJoined, setIsJoined] = useState(false);

  useEffect(() => {
    const checkMembership = async () => {
      if (!user?.id) return;
      const { data, error } = await isUserInGroup({
        userId: user.id,
        groupId: communityId,
      });
      if (error) {
        console.log("Check group membership error:", error);
        return;
      }
      setIsJoined(!!data);
    };

    checkMembership();
  }, [communityId, user?.id]);

  return (
    <Pressable
      onPress={async () => {
        if (isJoined || isJoining) return;
        setIsJoining(true);
        try {
          if (!user?.id) {
            console.log("Join group blocked: no user id");
            return;
          }
          const { error } = await joinUserGroup({
            userId: user.id,
            groupId: communityId,
          });
          if (error) {
            console.log("Join group error:", error);
            return;
          }
          setIsJoined(true);
        } finally {
          setIsJoining(false);
        }
      }}
      disabled={!isLoaded || isJoined || isJoining}
      style={{
        backgroundColor: isJoined ? "transparent" : primary,
        borderColor: isJoined ? border : "transparent",
        borderWidth: isJoined ? 1 : 0,
        paddingHorizontal: 14,
        paddingVertical: 6,
        borderRadius: 999,
        opacity: !isLoaded ? 0.6 : 1,
      }}
    >
      {isJoining ? (
        <ActivityIndicator size="small" color="white" />
      ) : (
        <Text
          style={{ color: isJoined ? muted : "white" }}
          className="font-semibold"
        >
          {isJoined ? "Joined" : "Join"}
        </Text>
      )}
    </Pressable>
  );
}
