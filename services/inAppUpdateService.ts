import Constants from "expo-constants";
import { Alert, Platform } from "react-native";
import SpInAppUpdates, {
    IAUInstallStatus,
    IAUUpdateKind,
    type StatusUpdateEvent,
} from "sp-react-native-in-app-updates";
import { logger } from "../utils/logger";

class InAppUpdateService {
  private updater = new SpInAppUpdates(__DEV__);
  private listenerAttached = false;
  private restartPromptShown = false;

  private statusListener = (event: StatusUpdateEvent) => {
    if (event.status !== IAUInstallStatus.DOWNLOADED) return;
    if (this.restartPromptShown) return;

    this.restartPromptShown = true;
    Alert.alert(
      "Update ready",
      "A new update has been downloaded. Restart now to install it.",
      [
        {
          text: "Later",
          style: "cancel",
          onPress: () => {
            this.restartPromptShown = false;
          },
        },
        {
          text: "Restart",
          onPress: () => {
            this.updater.installUpdate();
          },
        },
      ],
      { cancelable: true },
    );
  };

  private ensureListener() {
    if (this.listenerAttached) return;
    this.updater.addStatusUpdateListener(this.statusListener);
    this.listenerAttached = true;
  }

  async checkAndStartFlexibleUpdate() {
    // In-app updates only apply to Android Play Store builds.
    if (Platform.OS !== "android") return;
    if (__DEV__) return;

    try {
      this.ensureListener();

      const curVersion =
        Constants.expoConfig?.version ||
        Constants.nativeAppVersion ||
        undefined;

      const updateInfo = await this.updater.checkNeedsUpdate(
        curVersion ? { curVersion } : undefined,
      );

      if (!updateInfo.shouldUpdate) return;

      await this.updater.startUpdate({
        updateType: IAUUpdateKind.FLEXIBLE,
      });
    } catch (error) {
      logger.warn("InAppUpdateService: check/update failed", error);
    }
  }

  cleanup() {
    if (!this.listenerAttached) return;
    this.updater.removeStatusUpdateListener(this.statusListener);
    this.listenerAttached = false;
  }
}

export const inAppUpdateService = new InAppUpdateService();
