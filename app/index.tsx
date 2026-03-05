import { Redirect } from "expo-router";
import { ActivityIndicator, View } from "react-native";
import { useAuth } from "../hooks/useAuth";

export default function Index() {
  const isInitialized = useAuth((s) => s.isInitialized);
  const onboarded = useAuth((s) => s.onboarded);
  const currentUser = useAuth((s) => s.currentUser);

  // Show loading while auth initializes
  if (!isInitialized) {
    return (
      <View className="flex-1 justify-center items-center bg-white">
        <ActivityIndicator size="large" color="#FF3B30" />
      </View>
    );
  }

  // Redirect based on auth + onboarding state
  if (onboarded && currentUser) {
    return <Redirect href="/(main)/chat" />;
  }

  if (!currentUser) {
    return <Redirect href="/(auth)/welcome" />;
  }

  // Not onboarded yet, let default routing take over
  return <Redirect href="/(auth)/welcome" />;
}
