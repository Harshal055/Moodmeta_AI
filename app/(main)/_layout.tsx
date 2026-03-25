import { Stack } from "expo-router";
import { View } from "react-native";
import { MoodModal } from "../../components/MoodModal";

export default function MainLayout() {
  return (
    <View style={{ flex: 1 }}>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="dashboard" />
        <Stack.Screen name="leaderboard" />
        <Stack.Screen name="chat" />
        <Stack.Screen name="profile" />
        <Stack.Screen name="settings" />
        <Stack.Screen name="breathing" />
        <Stack.Screen name="meditation" />
        <Stack.Screen name="emergency" />
      </Stack>
      <MoodModal />
    </View>
  );
}
