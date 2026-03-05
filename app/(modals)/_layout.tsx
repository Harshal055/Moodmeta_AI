import { Stack } from "expo-router";
import { PurchaseErrorBoundary } from "../../components/PurchaseErrorBoundary";
import { CustomAlertProvider } from "../../components/CustomAlert";

export default function ModalsLayout() {
  return (
    <PurchaseErrorBoundary>
      <CustomAlertProvider>
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
      </CustomAlertProvider>
    </PurchaseErrorBoundary>
  );
}
