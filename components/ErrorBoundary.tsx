import React, { Component, ErrorInfo, ReactNode } from "react";
import { Text, TouchableOpacity, View } from "react-native";
import { logger } from "../utils/logger";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

/**
 * Global error boundary that catches unhandled JS errors in the
 * component tree and shows a recovery screen instead of crashing.
 */
export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // Report to crash service (Sentry / Crashlytics when integrated)
    logger.captureException(error, {
      componentStack: errorInfo.componentStack || "",
    });
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      return (
        <View
          style={{
            flex: 1,
            justifyContent: "center",
            alignItems: "center",
            backgroundColor: "#fff",
            padding: 32,
          }}
        >
          <Text style={{ fontSize: 48, marginBottom: 16 }}>😔</Text>
          <Text
            style={{
              fontFamily: "Manrope_700Bold",
              fontSize: 22,
              color: "#1a1a2e",
              textAlign: "center",
              marginBottom: 8,
            }}
          >
            Something went wrong
          </Text>
          <Text
            style={{
              fontFamily: "Inter_400Regular",
              fontSize: 14,
              color: "#666",
              textAlign: "center",
              marginBottom: 24,
              lineHeight: 22,
            }}
          >
            The app ran into an unexpected error. Tap below to try again.
          </Text>
          <TouchableOpacity
            onPress={this.handleReset}
            activeOpacity={0.85}
            style={{
              backgroundColor: "#1a1a2e",
              borderRadius: 999,
              paddingVertical: 16,
              paddingHorizontal: 40,
            }}
          >
            <Text
              style={{
                fontFamily: "Manrope_600SemiBold",
                fontSize: 16,
                color: "#fff",
              }}
            >
              Try Again
            </Text>
          </TouchableOpacity>
        </View>
      );
    }

    return this.props.children;
  }
}
