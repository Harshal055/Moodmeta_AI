/**
 * Error Boundary for Purchase Flow
 *
 * Catches errors in paywall screen and shows user-friendly messages
 * with recovery options (retry, contact support, etc.)
 */

import { Ionicons } from "@expo/vector-icons";
import React, { ReactNode } from "react";
import { ScrollView, Text, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { logger } from "../utils/logger";

interface Props {
  children: ReactNode;
  fallback?: (error: Error, retry: () => void) => ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  retryCount: number;
}

export class PurchaseErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      retryCount: 0,
    };
  }

  static getDerivedStateFromError(error: Error): State {
    return {
      hasError: true,
      error,
      retryCount: 0,
    };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    logger.error(
      "Purchase Error Boundary caught:",
      error,
      errorInfo.componentStack,
    );

    // Report to error tracking service
    // Sentry.captureException(error, { contexts: { react: errorInfo } });
  }

  retry = () => {
    this.setState((prevState) => ({
      hasError: false,
      error: null,
      retryCount: prevState.retryCount + 1,
    }));
  };

  render() {
    if (this.state.hasError && this.state.error) {
      if (this.props.fallback) {
        return this.props.fallback(this.state.error, this.retry);
      }

      return (
        <DefaultErrorFallback
          error={this.state.error}
          retry={this.retry}
          retryCount={this.state.retryCount}
        />
      );
    }

    return this.props.children;
  }
}

interface FallbackProps {
  error: Error;
  retry: () => void;
  retryCount: number;
}

function DefaultErrorFallback({ error, retry, retryCount }: FallbackProps) {
  const insets = useSafeAreaInsets();

  const isRecoverable =
    !error.message.toLowerCase().includes("network") && retryCount < 3;

  const getErrorMessage = () => {
    if (error.message.toLowerCase().includes("network")) {
      return "No internet connection. Please check your network and try again.";
    }
    if (
      error.message.toLowerCase().includes("billing") ||
      error.message.toLowerCase().includes("payment")
    ) {
      return "Payment processing failed. Please check your payment method and try again.";
    }
    if (error.message.toLowerCase().includes("entitlement")) {
      return "Could not activate your subscription. Please contact support if this persists.";
    }
    return "Something went wrong with your purchase. Please try again or contact support.";
  };

  return (
    <ScrollView
      className="flex-1 bg-white"
      contentContainerStyle={{ paddingBottom: insets.bottom + 20 }}
    >
      <View
        style={{ paddingTop: insets.top + 20 }}
        className="px-6 pt-20 pb-20"
      >
        {/* Error Icon */}
        <View className="mb-6 items-center">
          <View className="w-20 h-20 rounded-full bg-[#FEF2F2] items-center justify-center mb-4">
            <Ionicons name="alert-circle" size={48} color="#EF4444" />
          </View>
        </View>

        {/* Error Title */}
        <Text
          style={{
            fontFamily: "Manrope_700Bold",
            fontSize: 24,
            color: "#000",
            marginBottom: 8,
            textAlign: "center",
          }}
        >
          Oops!
        </Text>

        {/* Error Message */}
        <Text
          style={{
            fontFamily: "Inter_400Regular",
            fontSize: 14,
            color: "#666",
            lineHeight: 20,
            marginBottom: 20,
            textAlign: "center",
          }}
        >
          {getErrorMessage()}
        </Text>

        {/* Debug Info */}
        {__DEV__ && (
          <View className="bg-gray-100 p-3 rounded-lg mb-6">
            <Text
              style={{
                fontFamily: "Courier",
                fontSize: 10,
                color: "#666",
                lineHeight: 14,
              }}
            >
              {error.message}
            </Text>
          </View>
        )}

        {/* Retry Info */}
        {isRecoverable && retryCount > 0 && (
          <Text
            style={{
              fontFamily: "Inter_400Regular",
              fontSize: 12,
              color: "#F59E0B",
              textAlign: "center",
              marginBottom: 20,
            }}
          >
            Attempt {retryCount} of 3
          </Text>
        )}

        {/* Actions */}
        <View className="gap-3">
          {isRecoverable && (
            <TouchableOpacity
              onPress={retry}
              className="w-full bg-black py-4 rounded-full items-center justify-center"
            >
              <Text
                style={{
                  fontFamily: "Manrope_700Bold",
                  fontSize: 15,
                  color: "#fff",
                }}
              >
                Try Again
              </Text>
            </TouchableOpacity>
          )}

          {!isRecoverable && (
            <Text
              style={{
                fontFamily: "Inter_400Regular",
                fontSize: 12,
                color: "#EF4444",
                textAlign: "center",
                marginBottom: 8,
              }}
            >
              Maximum retry attempts reached
            </Text>
          )}

          <TouchableOpacity
            onPress={() => {
              // Open support in-app or navigate to help
              // router.push("/(modals)/contact-support");
            }}
            className="w-full border border-gray-200 py-4 rounded-full items-center justify-center"
          >
            <Text
              style={{
                fontFamily: "Manrope_700Bold",
                fontSize: 15,
                color: "#000",
              }}
            >
              Contact Support
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => {
              // Go back to main app
              // router.back();
            }}
            className="py-2"
          >
            <Text
              style={{
                fontFamily: "Inter_500Medium",
                fontSize: 13,
                color: "#888",
                textAlign: "center",
                textDecorationLine: "underline",
              }}
            >
              Go Back
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </ScrollView>
  );
}
