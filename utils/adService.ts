/**
 * Ad Service
 *
 * Manages ads for free users and skip ads feature for Pro users
 * Integration point for ad networks (AdMob, Facebook Ads, etc.)
 */

import AsyncStorage from "@react-native-async-storage/async-storage";
import mobileAds, {
  AdEventType,
  RewardedAd,
  RewardedAdEventType,
  TestIds,
} from "react-native-google-mobile-ads";
import { logger } from "./logger";

export interface AdConfig {
  enabled: boolean;
  ad_network: "admob" | "facebook" | "none";
  banner_ad_enabled: boolean;
  interstitial_ad_enabled: boolean;
  rewarded_ad_enabled: boolean;
  ad_frequency: "low" | "medium" | "high"; // How often to show ads
}

export interface AdEvent {
  type: "impression" | "click" | "close" | "error";
  ad_type: "banner" | "interstitial" | "rewarded";
  timestamp: string;
  user_id: string;
}

class AdService {
  private adConfig: AdConfig = {
    enabled: true,
    ad_network: "admob",
    banner_ad_enabled: true,
    interstitial_ad_enabled: true,
    rewarded_ad_enabled: true,
    ad_frequency: "medium",
  };

  private adEvents: AdEvent[] = [];
  private lastAdTime: number = 0;
  private currentUserId: string | null = null;
  private adCooldownMs: number = 30000; // 30 seconds between ads
  private initializedUserId: string | null = null;
  private adMobInitialized = false;

  private isUsingTestAds() {
    return __DEV__ || process.env.DEBUG === "true";
  }

  getBannerAdUnitId(): string {
    if (this.isUsingTestAds()) return TestIds.BANNER;
    return process.env.EXPO_PUBLIC_ADMOB_BANNER_ANDROID_ID || TestIds.BANNER;
  }

  private getRewardedAdUnitId(): string {
    if (this.isUsingTestAds()) return TestIds.REWARDED;
    return (
      process.env.EXPO_PUBLIC_ADMOB_REWARDED_ANDROID_ID || TestIds.REWARDED
    );
  }

  private async ensureAdMobInitialized() {
    if (this.adMobInitialized) return;
    await mobileAds().initialize();
    this.adMobInitialized = true;
    logger.info("AdMob SDK initialized");
  }

  async init(userId: string) {
    if (this.initializedUserId === userId) return;
    try {
      this.currentUserId = userId;
      this.initializedUserId = userId;
      await this.ensureAdMobInitialized();

      // Load ad config from storage
      const stored = await AsyncStorage.getItem(`@ad_config_${userId}`);
      if (stored) {
        this.adConfig = JSON.parse(stored);
      }

      logger.info("Ad service initialized");
    } catch (error) {
      logger.error("Failed to initialize ad service:", error);
    }
  }

  /**
   * Check if ads should be shown for this user
   */
  shouldShowAds(isPremium: boolean): boolean {
    // No ads for premium users
    if (isPremium) return false;

    // Ads disabled globally
    if (!this.adConfig.enabled) return false;

    // Check cooldown period between ads
    const timeSinceLastAd = Date.now() - this.lastAdTime;
    if (timeSinceLastAd < this.adCooldownMs) {
      return false;
    }

    return true;
  }

  /**
   * Show banner ad (always visible for free users)
   */
  async showBannerAd(userId: string, isPremium: boolean): Promise<void> {
    if (isPremium || !this.adConfig.banner_ad_enabled) {
      logger.info("Banner ad skipped (premium or disabled)");
      return;
    }

    try {
      // In production, integrate with AdMob:
      // await admob.BannerAd.show();

      this.recordAdEvent({
        type: "impression",
        ad_type: "banner",
        timestamp: new Date().toISOString(),
        user_id: userId,
      });

      logger.info("Banner ad shown");
    } catch (error) {
      logger.error("Failed to show banner ad:", error);
      this.recordAdEvent({
        type: "error",
        ad_type: "banner",
        timestamp: new Date().toISOString(),
        user_id: userId,
      });
    }
  }

  /**
   * Show interstitial ad (full screen, between actions)
   */
  async showInterstitialAd(userId: string, isPremium: boolean): Promise<void> {
    if (isPremium || !this.adConfig.interstitial_ad_enabled) {
      logger.info("Interstitial ad skipped (premium or disabled)");
      return;
    }

    if (!this.shouldShowAds(isPremium)) {
      logger.info("Interstitial ad skipped (cooldown period)");
      return;
    }

    try {
      // In production, integrate with AdMob:
      // const adLoaded = await admob.InterstitialAd.load();
      // if (adLoaded) {
      //   await admob.InterstitialAd.show();
      // }

      this.recordAdEvent({
        type: "impression",
        ad_type: "interstitial",
        timestamp: new Date().toISOString(),
        user_id: userId,
      });

      this.lastAdTime = Date.now();
      logger.info("Interstitial ad shown");
    } catch (error) {
      logger.error("Failed to show interstitial ad:", error);
      this.recordAdEvent({
        type: "error",
        ad_type: "interstitial",
        timestamp: new Date().toISOString(),
        user_id: userId,
      });
    }
  }

  /**
   * Show rewarded ad (user watches for reward)
   */
  async showRewardedAd(
    userId: string,
    isPremium: boolean,
  ): Promise<{ watched: boolean; reward: string }> {
    if (isPremium || !this.adConfig.rewarded_ad_enabled) {
      return { watched: false, reward: "" };
    }

    if (!this.shouldShowAds(isPremium)) {
      return { watched: false, reward: "" };
    }

    try {
      await this.ensureAdMobInitialized();
      const rewarded = RewardedAd.createForAdRequest(
        this.getRewardedAdUnitId(),
        {
          requestNonPersonalizedAdsOnly: true,
        },
      );

      const result = await new Promise<{ watched: boolean; reward: string }>(
        (resolve) => {
          let rewardedEarned = false;
          let rewardType = "";
          let settled = false;

          const finish = (payload: { watched: boolean; reward: string }) => {
            if (settled) return;
            settled = true;
            unsubscribeLoaded();
            unsubscribeReward();
            unsubscribeClosed();
            unsubscribeError();
            resolve(payload);
          };

          const unsubscribeLoaded = rewarded.addAdEventListener(
            RewardedAdEventType.LOADED,
            () => {
              rewarded.show();
            },
          );

          const unsubscribeReward = rewarded.addAdEventListener(
            RewardedAdEventType.EARNED_REWARD,
            (reward) => {
              rewardedEarned = true;
              rewardType = reward?.type || "reward";
            },
          );

          const unsubscribeClosed = rewarded.addAdEventListener(
            AdEventType.CLOSED,
            () => {
              if (rewardedEarned) {
                this.recordAdEvent({
                  type: "impression",
                  ad_type: "rewarded",
                  timestamp: new Date().toISOString(),
                  user_id: userId,
                });
                this.lastAdTime = Date.now();
                finish({ watched: true, reward: rewardType });
              } else {
                finish({ watched: false, reward: "" });
              }
            },
          );

          const unsubscribeError = rewarded.addAdEventListener(
            AdEventType.ERROR,
            (err) => {
              logger.error("Rewarded ad failed:", err);
              this.recordAdEvent({
                type: "error",
                ad_type: "rewarded",
                timestamp: new Date().toISOString(),
                user_id: userId,
              });
              finish({ watched: false, reward: "" });
            },
          );

          rewarded.load();
        },
      );

      if (result.watched) {
        logger.info("Rewarded ad watched", { reward: result.reward });
      }

      return result;
    } catch (error) {
      logger.error("Failed to show rewarded ad:", error);
      return { watched: false, reward: "" };
    }
  }

  /**
   * Record ad event for analytics
   */
  private recordAdEvent(event: AdEvent) {
    this.adEvents.push(event);

    // Keep only last 100 events
    if (this.adEvents.length > 100) {
      this.adEvents = this.adEvents.slice(-100);
    }

    // In production, send to analytics service
    // analytics.logEvent('ad_event', event);
  }

  /**
   * Set ad frequency preference
   */
  async setAdFrequency(frequency: "low" | "medium" | "high"): Promise<void> {
    try {
      this.adConfig.ad_frequency = frequency;

      // Adjust cooldown based on frequency
      switch (frequency) {
        case "low":
          this.adCooldownMs = 60000; // 60 seconds
          break;
        case "medium":
          this.adCooldownMs = 30000; // 30 seconds
          break;
        case "high":
          this.adCooldownMs = 10000; // 10 seconds
          break;
      }

      if (this.currentUserId) {
        await AsyncStorage.setItem(
          `@ad_config_${this.currentUserId}`,
          JSON.stringify(this.adConfig),
        );
      }
      logger.info(`Ad frequency set to: ${frequency}`);
    } catch (error) {
      logger.error("Failed to set ad frequency:", error);
    }
  }

  /**
   * Disable ads (for premium users or testing)
   */
  async disableAds(): Promise<void> {
    try {
      this.adConfig.enabled = false;
      if (this.currentUserId) {
        await AsyncStorage.setItem(
          `@ad_config_${this.currentUserId}`,
          JSON.stringify(this.adConfig),
        );
      }
      logger.info("Ads disabled");
    } catch (error) {
      logger.error("Failed to disable ads:", error);
    }
  }

  /**
   * Enable ads
   */
  async enableAds(): Promise<void> {
    try {
      this.adConfig.enabled = true;
      if (this.currentUserId) {
        await AsyncStorage.setItem(
          `@ad_config_${this.currentUserId}`,
          JSON.stringify(this.adConfig),
        );
      }
      logger.info("Ads enabled");
    } catch (error) {
      logger.error("Failed to enable ads:", error);
    }
  }

  /**
   * Get ad statistics
   */
  getAdStats() {
    const impressions = this.adEvents.filter(
      (e) => e.type === "impression",
    ).length;
    const clicks = this.adEvents.filter((e) => e.type === "click").length;
    const errors = this.adEvents.filter((e) => e.type === "error").length;

    return {
      total_events: this.adEvents.length,
      impressions,
      clicks,
      errors,
      ctr: impressions > 0 ? ((clicks / impressions) * 100).toFixed(2) : "0",
    };
  }

  /**
   * Initialize AdMob (placeholder for actual implementation)
   */
  async initializeAdMob(publisherId: string): Promise<void> {
    try {
      // In production:
      // import { GoogleMobileAds } from 'react-native-google-mobile-ads';
      // await GoogleMobileAds.initialize();

      logger.info(`AdMob initialized with publisher ID: ${publisherId}`);
    } catch (error) {
      logger.error("Failed to initialize AdMob:", error);
    }
  }

  /**
   * Setup banner ad unit
   */
  async setupBannerAdUnit(adUnitId: string): Promise<void> {
    try {
      // In production:
      // admob.BannerAd.setAdUnitId(adUnitId);

      logger.info(`Banner ad unit setup: ${adUnitId}`);
    } catch (error) {
      logger.error("Failed to setup banner ad unit:", error);
    }
  }

  /**
   * Setup interstitial ad unit
   */
  async setupInterstitialAdUnit(adUnitId: string): Promise<void> {
    try {
      // In production:
      // admob.InterstitialAd.setAdUnitId(adUnitId);

      logger.info(`Interstitial ad unit setup: ${adUnitId}`);
    } catch (error) {
      logger.error("Failed to setup interstitial ad unit:", error);
    }
  }

  /**
   * Setup rewarded ad unit
   */
  async setupRewardedAdUnit(adUnitId: string): Promise<void> {
    try {
      // In production:
      // admob.RewardedAd.setAdUnitId(adUnitId);

      logger.info(`Rewarded ad unit setup: ${adUnitId}`);
    } catch (error) {
      logger.error("Failed to setup rewarded ad unit:", error);
    }
  }

  /**
   * Clean up ads on shutdown
   */
  async cleanup(): Promise<void> {
    try {
      // Send remaining ad events to analytics
      if (this.adEvents.length > 0) {
        logger.info(`Flushing ${this.adEvents.length} ad events`);
      }

      this.adEvents = [];
      this.initializedUserId = null;
      logger.info("Ad service cleaned up");
    } catch (error) {
      logger.error("Failed to cleanup ad service:", error);
    }
  }
}

export const adService = new AdService();
