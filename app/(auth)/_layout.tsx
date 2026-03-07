import { Stack } from "expo-router";

export default function AuthLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="welcome" />
      <Stack.Screen name="login" />
      <Stack.Screen name="role-picker" />
      <Stack.Screen name="country-picker" />
      <Stack.Screen name="language-picker" />
      <Stack.Screen name="name-companion" />
      <Stack.Screen name="building" />
    </Stack>
  );
}
