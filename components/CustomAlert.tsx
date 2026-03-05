/**
 * CustomAlert Component
 *
 * Beautiful, animated alert dialog replacing React Native's Alert.alert
 * Supports success, error, warning, and info states with custom animations
 */

import { Ionicons } from "@expo/vector-icons";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  Animated,
  Modal,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

export type AlertType = "success" | "error" | "warning" | "info";

export interface CustomAlertConfig {
  type: AlertType;
  title: string;
  message: string;
  buttons?: Array<{
    text: string;
    onPress?: () => void;
    style?: "default" | "cancel" | "destructive";
  }>;
  duration?: number; // Auto-dismiss after X ms (null = don't auto-dismiss)
}

interface CustomAlertInstance {
  show: (config: CustomAlertConfig) => void;
  hide: () => void;
}

let instance: CustomAlertInstance | null = null;

export function useAlert(): CustomAlertInstance {
  return {
    show: (config: CustomAlertConfig) => {
      if (instance) {
        instance.show(config);
      }
    },
    hide: () => {
      if (instance) {
        instance.hide();
      }
    },
  };
}

export function CustomAlertProvider({ children }: { children: React.ReactNode }) {
  const [visible, setVisible] = useState(false);
  const [config, setConfig] = useState<CustomAlertConfig | null>(null);
  const scaleAnim = useRef(new Animated.Value(0)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;

  const show = useCallback((alertConfig: CustomAlertConfig) => {
    setConfig(alertConfig);
    setVisible(true);

    Animated.parallel([
      Animated.spring(scaleAnim, {
        toValue: 1,
        useNativeDriver: true,
        speed: 8,
      }),
      Animated.timing(opacityAnim, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }),
    ]).start();

    // Auto-dismiss if duration specified
    if (alertConfig.duration) {
      const timer = setTimeout(() => {
        hide();
      }, alertConfig.duration);

      return () => clearTimeout(timer);
    }
  }, []);

  const hide = useCallback(() => {
    Animated.parallel([
      Animated.spring(scaleAnim, {
        toValue: 0,
        useNativeDriver: true,
        speed: 10,
      }),
      Animated.timing(opacityAnim, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start(() => {
      setVisible(false);
    });
  }, []);

  useEffect(() => {
    instance = { show, hide };
  }, [show, hide]);

  if (!visible || !config) return <>{children}</>;

  const getIcon = () => {
    switch (config.type) {
      case "success":
        return { icon: "checkmark-circle", color: "#10B981" };
      case "error":
        return { icon: "close-circle", color: "#EF4444" };
      case "warning":
        return { icon: "alert-circle", color: "#F59E0B" };
      case "info":
        return { icon: "information-circle", color: "#3B82F6" };
    }
  };

  const getBackgroundColor = () => {
    switch (config.type) {
      case "success":
        return "#ECFDF5";
      case "error":
        return "#FEF2F2";
      case "warning":
        return "#FFFBEB";
      case "info":
        return "#EFF6FF";
    }
  };

  const getBorderColor = () => {
    switch (config.type) {
      case "success":
        return "#A7F3D0";
      case "error":
        return "#FECACA";
      case "warning":
        return "#FED7AA";
      case "info":
        return "#BFDBFE";
    }
  };

  const { icon, color } = getIcon();
  const bgColor = getBackgroundColor();
  const borderColor = getBorderColor();

  const buttonDefaults = [
    {
      text: "OK",
      onPress: undefined,
      style: "default" as const,
    },
  ];

  const buttons = config.buttons || buttonDefaults;

  return (
    <Modal
      transparent
      visible={visible}
      onRequestClose={hide}
      animationType="fade"
    >
      {/* Backdrop */}
      <TouchableOpacity
        activeOpacity={1}
        onPress={hide}
        className="flex-1 bg-black/50"
      >
        {/* Alert Container */}
        <View className="flex-1 justify-center items-center p-6">
          <Animated.View
            style={{
              transform: [{ scale: scaleAnim }],
              opacity: opacityAnim,
              backgroundColor: bgColor,
              borderColor,
              borderWidth: 1,
              borderRadius: 16,
              maxWidth: 340,
              width: "100%",
            }}
            onStartShouldSetResponder={() => true}
          >
            <View className="p-6">
              {/* Icon */}
              <View className="mb-4">
                <Ionicons name={icon as any} size={48} color={color} />
              </View>

              {/* Title */}
              <Text
                style={{
                  fontFamily: "Manrope_700Bold",
                  fontSize: 18,
                  color: "#1F2937",
                  marginBottom: 8,
                }}
              >
                {config.title}
              </Text>

              {/* Message */}
              <Text
                style={{
                  fontFamily: "Inter_400Regular",
                  fontSize: 14,
                  color: "#6B7280",
                  lineHeight: 20,
                  marginBottom: 20,
                }}
              >
                {config.message}
              </Text>

              {/* Buttons */}
              <View className="flex-row gap-3">
                {buttons.map((button, index) => (
                  <TouchableOpacity
                    key={index}
                    onPress={() => {
                      if (button.onPress) {
                        button.onPress();
                      }
                      hide();
                    }}
                    className="flex-1 py-3 rounded-lg items-center justify-center"
                    style={{
                      backgroundColor:
                        button.style === "destructive"
                          ? "#EF4444"
                          : button.style === "cancel"
                            ? "#F3F4F6"
                            : color,
                    }}
                  >
                    <Text
                      style={{
                        fontFamily: "Manrope_700Bold",
                        fontSize: 14,
                        color:
                          button.style === "cancel" ? "#374151" : "#FFFFFF",
                      }}
                    >
                      {button.text}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          </Animated.View>
        </View>
      </TouchableOpacity>
    </Modal>
  );
}
