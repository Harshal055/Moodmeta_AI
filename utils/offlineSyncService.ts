/**
 * Offline Sync Service
 *
 * Manages local SQLite database + Supabase sync for offline chat support
 * Pro feature: allows users to chat offline and auto-sync when connected
 */

import AsyncStorage from "@react-native-async-storage/async-storage";
import NetInfo, { NetInfoState } from "@react-native-community/netinfo";
import { supabase } from "../lib/supabase";
import { logger } from "./logger";

// LocalDB structure (simulated - in production use SQLite module)
interface PendingChat {
  id: string;
  user_id: string | null;
  message: string | null;
  is_from_ai: boolean | null;
  created_at: string;
  sync_status: "pending" | "synced" | "failed";
  synced_at?: string;
  error_message?: string;
}

interface PendingMood {
  id: string;
  user_id: string;
  mood_score: number;
  notes?: string | null;
  created_at: string;
  sync_status: "pending" | "synced" | "failed";
}

interface SyncMetadata {
  last_sync_time: string;
  last_pull_time: string;
  pending_count: number;
}

class OfflineSyncService {
  private isSyncing = false;
  private pendingChats: Map<string, PendingChat> = new Map();
  private pendingMoods: Map<string, PendingMood> = new Map();
  private syncMetadata: SyncMetadata = {
    last_sync_time: new Date().toISOString(),
    last_pull_time: new Date().toISOString(),
    pending_count: 0,
  };

  private currentUserId: string | null = null;

  /**
   * Initialize offline sync service
   * Sets up network listener and restores pending operations
   */
  async init(userId: string) {
    try {
      this.currentUserId = userId;
      // Restore pending items from AsyncStorage
      await this.restorePendingItems();

      // Set up network listener
      this.setupNetworkListener();

      // Initial sync if online
      const netState = await NetInfo.fetch();
      if (netState.isConnected) {
        await this.syncAll();
      }

      logger.info("Offline sync service initialized");
    } catch (error) {
      logger.error("Failed to initialize offline sync:", error);
    }
  }

  /**
   * Listen for network state changes
   */
  private setupNetworkListener() {
    NetInfo.addEventListener((state: NetInfoState) => {
      if (state.isConnected && !this.isSyncing && this.hasPendingItems()) {
        logger.info("Network connected, starting sync...");
        this.syncAll();
      }
    });
  }

  /**
   * Store a chat message for offline sync
   */
  async storeOfflineChat(
    userId: string,
    message: string,
    isFromAI: boolean,
  ): Promise<PendingChat> {
    const pendingChat: PendingChat = {
      id: `offline_${Date.now()}_${Math.random()}`,
      user_id: userId,
      message,
      is_from_ai: isFromAI,
      created_at: new Date().toISOString(),
      sync_status: "pending",
    };

    this.pendingChats.set(pendingChat.id, pendingChat);
    this.syncMetadata.pending_count = this.pendingChats.size;

    // Persist to AsyncStorage
    await this.savePendingItems();

    logger.info(`Stored offline chat: ${pendingChat.id}`);
    return pendingChat;
  }

  /**
   * Store a mood entry for offline sync
   */
  async storeOfflineMood(
    userId: string,
    moodScore: number,
    notes?: string,
  ): Promise<PendingMood> {
    const pendingMood: PendingMood = {
      id: `mood_${Date.now()}_${Math.random()}`,
      user_id: userId,
      mood_score: moodScore,
      notes,
      created_at: new Date().toISOString(),
      sync_status: "pending",
    };

    this.pendingMoods.set(pendingMood.id, pendingMood);
    this.syncMetadata.pending_count =
      this.pendingChats.size + this.pendingMoods.size;

    await this.savePendingItems();

    logger.info(`Stored offline mood: ${pendingMood.id}`);
    return pendingMood;
  }

  /**
   * Sync all pending items to Supabase
   */
  async syncAll() {
    if (this.isSyncing) return;
    this.isSyncing = true;

    try {
      await this.syncChats();
      await this.syncMoods();
      await this.pullLatestData();

      this.syncMetadata.last_sync_time = new Date().toISOString();
      await this.savePendingItems();

      logger.info("Sync completed successfully");
    } catch (error) {
      logger.error("Sync failed:", error);
    } finally {
      this.isSyncing = false;
    }
  }

  /**
   * Upload pending chats to Supabase
   */
  private async syncChats() {
    const pending = Array.from(this.pendingChats.values()).filter(
      (c) => c.sync_status === "pending",
    );

    for (const chat of pending) {
      try {
        const { error } = await supabase.from("chats").insert({
          id: chat.id,
          user_id: chat.user_id,
          message: chat.message,
          is_from_ai: chat.is_from_ai,
          created_at: chat.created_at,
        });

        if (error) throw error;

        // Mark as synced
        chat.sync_status = "synced";
        chat.synced_at = new Date().toISOString();

        logger.info(`Synced chat: ${chat.id}`);
      } catch (error) {
        chat.sync_status = "failed";
        chat.error_message = String(error);
        logger.error(`Failed to sync chat ${chat.id}:`, error);
      }
    }

    this.syncMetadata.pending_count =
      this.pendingChats.size + this.pendingMoods.size;
  }

  /**
   * Upload pending moods to Supabase
   */
  private async syncMoods() {
    const pending = Array.from(this.pendingMoods.values()).filter(
      (m) => m.sync_status === "pending",
    );

    for (const mood of pending) {
      try {
        const { error } = await supabase.from("mood_logs").insert({
          id: mood.id,
          user_id: mood.user_id,
          mood_score: mood.mood_score,
          notes: mood.notes,
          created_at: mood.created_at,
        });

        if (error) throw error;

        mood.sync_status = "synced";
        logger.info(`Synced mood: ${mood.id}`);
      } catch (error) {
        mood.sync_status = "failed";
        logger.error(`Failed to sync mood ${mood.id}:`, error);
      }
    }

    this.syncMetadata.pending_count =
      this.pendingChats.size + this.pendingMoods.size;
  }

  /**
   * Pull latest data from Supabase
   */
  private async pullLatestData() {
    try {
      // Get latest chats since last pull
      const { data: newChats, error: chatError } = await supabase
        .from("chats")
        .select("*")
        .gt("created_at", this.syncMetadata.last_pull_time)
        .order("created_at", { ascending: true })
        .limit(100);

      if (chatError) throw chatError;

      // Merge new chats with local data
      for (const chat of newChats || []) {
        if (!this.pendingChats.has(chat.id)) {
          this.pendingChats.set(chat.id, {
            ...chat,
            sync_status: "synced",
          });
        }
      }

      // Get latest moods
      const { data: newMoods, error: moodError } = await supabase
        .from("mood_logs")
        .select("*")
        .gt("created_at", this.syncMetadata.last_pull_time)
        .order("created_at", { ascending: true })
        .limit(100);

      if (moodError) throw moodError;

      for (const mood of newMoods || []) {
        if (!this.pendingMoods.has(mood.id)) {
          this.pendingMoods.set(mood.id, {
            ...mood,
            sync_status: "synced",
          });
        }
      }

      this.syncMetadata.last_pull_time = new Date().toISOString();

      logger.info(
        `Pulled ${newChats?.length || 0} chats and ${newMoods?.length || 0} moods`,
      );
    } catch (error) {
      logger.error("Failed to pull data from cloud:", error);
    }
  }

  /**
   * Check if there are pending items to sync
   */
  private hasPendingItems(): boolean {
    return (
      Array.from(this.pendingChats.values()).some(
        (c) => c.sync_status === "pending",
      ) ||
      Array.from(this.pendingMoods.values()).some(
        (m) => m.sync_status === "pending",
      )
    );
  }

  /**
   * Save pending items to AsyncStorage (persistence)
   */
  private async savePendingItems() {
    if (!this.currentUserId) return;
    try {
      const data = {
        chats: Array.from(this.pendingChats.values()),
        moods: Array.from(this.pendingMoods.values()),
        metadata: this.syncMetadata,
      };
      await AsyncStorage.setItem(`@offline_sync_data_${this.currentUserId}`, JSON.stringify(data));
    } catch (error) {
      logger.error("Failed to persist offline data:", error);
    }
  }

  /**
   * Restore pending items from AsyncStorage
   */
  private async restorePendingItems() {
    if (!this.currentUserId) return;
    try {
      const data = await AsyncStorage.getItem(`@offline_sync_data_${this.currentUserId}`);
      if (data) {
        const parsed = JSON.parse(data);
        this.pendingChats = new Map(parsed.chats.map((c: any) => [c.id, c]));
        this.pendingMoods = new Map(parsed.moods.map((m: any) => [m.id, m]));
        this.syncMetadata = parsed.metadata;
      }
    } catch (error) {
      logger.error("Failed to restore offline data:", error);
    }
  }

  /**
   * Get all synced chats
   */
  getSyncedChats(): PendingChat[] {
    return Array.from(this.pendingChats.values()).filter(
      (c) => c.sync_status === "synced",
    );
  }

  /**
   * Get sync status
   */
  getSyncStatus(): SyncMetadata {
    return this.syncMetadata;
  }

  /**
   * Clear all offline data (for logout/reset)
   */
  async clearOfflineData() {
    const userId = this.currentUserId;
    this.pendingChats.clear();
    this.pendingMoods.clear();
    this.syncMetadata.pending_count = 0;
    if (userId) {
      await AsyncStorage.removeItem(`@offline_sync_data_${userId}`);
    }
    logger.info("Offline data cleared");
  }
}

export const offlineSyncService = new OfflineSyncService();
