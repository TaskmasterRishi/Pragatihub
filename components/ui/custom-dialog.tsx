import React from "react";
import { Modal, Pressable, Text, TouchableOpacity, View } from "react-native";

import { useThemeColor } from "@/hooks/use-theme-color";

export type CustomDialogAction = {
  label: string;
  onPress?: () => void;
  variant?: "default" | "destructive" | "cancel";
};

type CustomDialogProps = {
  visible: boolean;
  title: string;
  message?: string;
  actions: CustomDialogAction[];
  onClose: () => void;
};

export default function CustomDialog({
  visible,
  title,
  message,
  actions,
  onClose,
}: CustomDialogProps) {
  const card = useThemeColor({}, "card");
  const text = useThemeColor({}, "text");
  const muted = useThemeColor({}, "textMuted");
  const border = useThemeColor({}, "border");

  return (
    <Modal transparent visible={visible} animationType="fade" onRequestClose={onClose}>
      <Pressable
        style={{
          flex: 1,
          backgroundColor: "rgba(0,0,0,0.45)",
          justifyContent: "center",
          paddingHorizontal: 20,
        }}
        onPress={onClose}
      >
        <Pressable
          onPress={(event) => event.stopPropagation()}
          style={{
            backgroundColor: card,
            borderRadius: 16,
            borderWidth: 1,
            borderColor: border,
            overflow: "hidden",
          }}
        >
          <View style={{ paddingHorizontal: 16, paddingTop: 16, paddingBottom: 14 }}>
            <Text style={{ color: text, fontSize: 17, fontWeight: "700" }}>{title}</Text>
            {!!message && (
              <Text style={{ color: muted, marginTop: 8, fontSize: 14 }}>{message}</Text>
            )}
          </View>

          <View style={{ borderTopWidth: 1, borderTopColor: border }}>
            {actions.length === 2 ? (
              <View
                style={{
                  flexDirection: "row",
                }}
              >
                {actions.map((action, index) => {
                  const labelColor =
                    action.variant === "destructive"
                      ? "#ef4444"
                      : action.variant === "cancel"
                        ? muted
                        : text;

                  return (
                    <TouchableOpacity
                      key={`${action.label}-${index}`}
                      onPress={() => {
                        onClose();
                        action.onPress?.();
                      }}
                      style={{
                        flex: 1,
                        paddingVertical: 14,
                        alignItems: "center",
                        borderLeftWidth: index === 0 ? 0 : 1,
                        borderLeftColor: border,
                      }}
                    >
                      <Text style={{ color: labelColor, fontSize: 16, fontWeight: "600" }}>
                        {action.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            ) : (
              actions.map((action, index) => {
              const labelColor =
                action.variant === "destructive"
                  ? "#ef4444"
                  : action.variant === "cancel"
                    ? muted
                    : text;

              return (
                <TouchableOpacity
                  key={`${action.label}-${index}`}
                  onPress={() => {
                    onClose();
                    action.onPress?.();
                  }}
                  style={{
                    paddingVertical: 14,
                    alignItems: "center",
                    borderTopWidth: index === 0 ? 0 : 1,
                    borderTopColor: border,
                  }}
                >
                  <Text style={{ color: labelColor, fontSize: 16, fontWeight: "600" }}>
                    {action.label}
                  </Text>
                </TouchableOpacity>
              );
              })
            )}
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
