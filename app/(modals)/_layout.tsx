import { Stack } from "expo-router";

export default function ModalsLayout() {
  return (
    <Stack screenOptions={{ headerShown: false, presentation: "modal" }}>
      <Stack.Screen name="paywall" />
      <Stack.Screen name="link-account" />
      <Stack.Screen name="upgrade-success" />
      <Stack.Screen
        name="save-chats"
        options={{
          presentation: "transparentModal",
          animation: "slide_from_bottom",
        }}
      />
    </Stack>
  );
}
