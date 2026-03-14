/**
 * Chat Screen — MoodMateAI
 *
 * Modified to use GiftedChat for the UI layout while preserving
 * the existing Supabase storage logic and OpenAI integration.
 */

import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import NetInfo from "@react-native-community/netinfo";
import { Audio as ExpoAudio } from "expo-av";
import * as Crypto from "expo-crypto";
import * as Haptics from "expo-haptics";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, {
    useCallback,
    useEffect,
    useMemo,
    useRef,
    useState,
} from "react";
import {
    ActivityIndicator,
    AppState,
    Image,
    KeyboardAvoidingView,
    Platform,
    Text,
    TouchableOpacity,
    View,
} from "react-native";
import {
    Bubble,
    GiftedChat,
    IMessage,
    InputToolbar,
    MessageText,
    Send,
} from "react-native-gifted-chat";
import { BannerAd, BannerAdSize } from "react-native-google-mobile-ads";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "../../hooks/useAuth";
import { supabase } from "../../lib/supabase";
import {
    getAIResponseStream,
    transcribeAudio,
    warmEdgeFunction,
} from "../../services/openaiService";
import { adService } from "../../utils/adService";
import { aiMemoryService } from "../../utils/aiMemoryService";
import { shareChat } from "../../utils/chatExport";
import { isFeatureEnabled } from "../../utils/featureFlags";
import { logger } from "../../utils/logger";
import { NotificationService } from "../../utils/notificationService";
import { offlineSyncService } from "../../utils/offlineSyncService";
import { speakMessage, stopSpeech } from "../../utils/voiceService";

const MESSAGES_PER_PAGE = 20;
const CURRENT_USER = { _id: 1, name: "You" };
const FREE_MESSAGE_LIMIT = 20;
const AI_PLACEHOLDER_TEXT = "...";
const COMPANION_AVATARS: Record<string, any> = {
  friend: require("../../assets/images/avatar_friend.png"),
  boyfriend: require("../../assets/images/avatar_boyfriend.png"),
  girlfriend: require("../../assets/images/avatar_girlfriend.png"),
  mother: require("../../assets/images/avatar_mother.png"),
  father: require("../../assets/images/avatar_father.png"),
  default: require("../../assets/images/logo.png"),
};

/** Client-side intent classifier — determines how the AI should respond. */
function detectIntent(
  text: string,
): "venting" | "crisis" | "seeking_advice" | "question" | "casual_chat" {
  const lower = text.toLowerCase();
  const crisisWords = [
    "suicide",
    "kill myself",
    "end my life",
    "want to die",
    "hurt myself",
    "self harm",
    "don't want to live",
  ];
  const ventingWords = [
    "so frustrated",
    "so angry",
    "i hate",
    "ugh",
    "so tired of",
    "can't take",
    "fed up",
    "so upset",
    "so sad",
    "crying",
    "i'm done",
    "exhausted",
    "overwhelmed",
  ];
  const adviceWords = [
    "what should i",
    "how do i",
    "should i",
    "what do you think",
    "help me decide",
    "what would you",
    "what to do",
  ];
  if (crisisWords.some((w) => lower.includes(w))) return "crisis";
  if (ventingWords.some((w) => lower.includes(w))) return "venting";
  if (adviceWords.some((w) => lower.includes(w))) return "seeking_advice";
  if (lower.includes("?")) return "question";
  return "casual_chat";
}

function isAiPlaceholderText(text: string | null | undefined): boolean {
  if (typeof text !== "string") return true;
  const trimmed = text.trim();
  // Treat dot-only placeholders as non-content ("...", "…", ".. ..", etc.).
  return trimmed.length === 0 || /^[.\u2026\s]+$/.test(trimmed);
}

export default function ChatScreen() {
  const router = useRouter();
  const { companionName: paramName } = useLocalSearchParams<{
    companionName: string;
  }>();
  const insets = useSafeAreaInsets();

  const user = useAuth((s) => s.currentUser);
  const profile = useAuth((s) => s.profile);
  const isAuthLoading = useAuth((s) => s.isLoading);

  const [messages, setMessages] = useState<IMessage[]>([]);
  const [isTyping, setIsTyping] = useState(false);
  const [isLoadingHistory, setIsLoadingHistory] = useState(true);
  const [hitLimit, setHitLimit] = useState(false);
  const [hasMoreMessages, setHasMoreMessages] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [retryPending, setRetryPending] = useState(false);
  const [errorToast, setErrorToast] = useState<string | null>(null);
  const [retryPayload, setRetryPayload] = useState<{
    text: string;
    history: Array<{ role: "user" | "assistant"; content: string }>;
  } | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [playingMessageId, setPlayingMessageId] = useState<string | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [showAd, setShowAd] = useState(false);
  const [isOnline, setIsOnline] = useState(true);
  const recordingRef = useRef<ExpoAudio.Recording | null>(null);
  const trackedSessionUserRef = useRef<string | null>(null);
  const hasLoadedInitialHistoryForUserRef = useRef<string | null>(null);
  const lastForegroundRefreshAtRef = useRef(0);
  const isLoadingHistoryRef = useRef(false);
  const greetingInsertedRef = useRef(false);
  const hasHydratedCacheRef = useRef(false);
  const lastMoodContextRef = useRef<string | undefined>(undefined);

  // Use a ref to keep track of the latest messages safely without causing React to
  // endlessly recreate the onSend callback and glitch out the GiftedChat input UI.
  const messagesRef = useRef(messages);
  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  const companionName =
    profile?.companion_name || paramName || "Your Companion";
  const userRole = profile?.role || "default";
  const userLanguage = profile?.language || "Hinglish";
  const isPremium = useAuth((s) => s.isPremium);
  const chatBottomOffset = Math.max(
    insets.bottom,
    Platform.OS === "android" ? 12 : 0,
  );

  // AI Avatar config for GiftedChat
  const AI_USER = useMemo(
    () => ({
      _id: 2,
      name: companionName,
      avatar:
        profile?.avatar_url ||
        COMPANION_AVATARS[userRole] ||
        COMPANION_AVATARS.default,
    }),
    [companionName, profile?.avatar_url, userRole],
  );

  // ── Network Connectivity Monitoring ─────────────────────────────────
  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener((state) => {
      setIsOnline(!!state.isConnected);
    });
    return () => unsubscribe();
  }, []);

  // ── Initialize services ────────────────────────────────────────────
  useEffect(() => {
    if (!user?.id) return;

    // Initialize AI Memory Service for personalized responses
    aiMemoryService.getUserMemory(user.id).catch((err) => {
      logger.error("Failed to load user memory:", err);
    });

    // Initialize Offline Sync Service (Pro feature)
    if (isPremium && isFeatureEnabled("offlineChat", isPremium)) {
      offlineSyncService.init(user.id).catch((err) => {
        logger.error("Failed to initialize offline sync:", err);
      });
    }

    // Initialize Ad Service for free users
    if (!isPremium) {
      adService
        .init(user.id)
        .then(() => {
          adService.showBannerAd(user.id, isPremium);
          setShowAd(true);
        })
        .catch((err) => {
          logger.error("Failed to initialize ads:", err);
        });
    }

    return () => {
      // Cleanup
      if (!isPremium) {
        adService.cleanup();
      }
    };
  }, [user?.id, isPremium]);

  // ── Toast auto-hide ──────────────────────────────────────────────
  useEffect(() => {
    if (!errorToast) return;
    const timer = setTimeout(() => setErrorToast(null), 4000);
    return () => clearTimeout(timer);
  }, [errorToast]);

  // Force limit check refresh when premium status changes mid-session
  useEffect(() => {
    if (user?.id) {
      if (isPremium) {
        setHitLimit(false);
      } else if (messages.length > 0) {
        // Recount user messages to be sure
        const userMsgCount = messages.filter((m) => m.user._id === 1).length;
        if (userMsgCount >= FREE_MESSAGE_LIMIT) {
          setHitLimit(true);
        }
      }
    }
  }, [isPremium, user?.id]);

  // Handle app background/foreground transitions — wired after loadHistory is declared below

  // ── Session reset on user change ──────────────────────────────────
  useEffect(() => {
    if (!user?.id) return;

    if (trackedSessionUserRef.current !== user.id) {
      trackedSessionUserRef.current = user.id;
      hasLoadedInitialHistoryForUserRef.current = null;
      hasHydratedCacheRef.current = false;
      greetingInsertedRef.current = false;
      lastMoodContextRef.current = undefined;
      setMessages([]);
      setHasMoreMessages(false);
      setIsLoadingHistory(true);
    }
  }, [user?.id]);

  // ── Load chat history ─────────────────────────────────────────────
  // Ghost user check is already handled in useAuth.initialize(),
  // no need to re-check here on every chat screen mount.
  useEffect(() => {
    if (!user || !profile) return;

    // Avoid repeated initial reloads for the same user during profile/store churn.
    if (hasLoadedInitialHistoryForUserRef.current === user.id) return;

    hasLoadedInitialHistoryForUserRef.current = user.id;
    loadHistory();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, profile?.id]);

  const loadHistory = async (loadMore = false, skipCacheHydration = false) => {
    if (!user || !profile || isLoadingHistoryRef.current) return;
    isLoadingHistoryRef.current = true;
    const cacheKey = `chat_history_${user.id}`;

    // If loading more, set loading state but don't touch initial loading state
    if (loadMore) {
      setIsLoadingMore(true);
    } else {
      // 1. INSTANT LOAD: Try to load from Local Storage first (initial load only)
      try {
        // Hydrate cache only once per chat session/user and only when there are
        // no in-memory messages yet. Re-hydrating later can cause visible flicker.
        const shouldHydrateCache =
          !skipCacheHydration &&
          !hasHydratedCacheRef.current &&
          messagesRef.current.length === 0;

        if (shouldHydrateCache) {
          const cachedData = await AsyncStorage.getItem(cacheKey);
          if (cachedData) {
            const parsedCache = JSON.parse(cachedData);
            // Hydrate dates since JSON stringifies them
            const hydratedMessages = parsedCache
              .filter(
                (msg: any) =>
                  !(msg?.user?._id !== 1 && isAiPlaceholderText(msg?.text)),
              )
              .map((msg: any) => ({
                ...msg,
                createdAt: new Date(msg.createdAt),
              }));
            setMessages(hydratedMessages);
            setIsLoadingHistory(false);
          }
          hasHydratedCacheRef.current = true;
        }

        if (messagesRef.current.length === 0) {
          // Only show loading spinner if we still have no local or in-memory messages.
          setIsLoadingHistory(true);
        }
      } catch (e) {
        logger.warn("Could not load local cache", e);
        setIsLoadingHistory(true);
      }
    }

    // 2. BACKGROUND SYNC: Fetch true state from Supabase
    try {
      const offset = loadMore ? messages.length : 0;
      const limit = MESSAGES_PER_PAGE;

      // Parallelize data + count queries for faster first-paint
      const [{ data, error }, { count, error: countError }] = await Promise.all(
        [
          supabase
            .from("chats")
            .select("*")
            .eq("user_id", user.id)
            .order("created_at", { ascending: false })
            .range(offset, offset + limit - 1),
          !loadMore
            ? supabase
                .from("chats")
                .select("id", { count: "exact", head: true })
                .eq("user_id", user.id)
                .eq("is_from_ai", false)
            : Promise.resolve({ count: null, error: null }),
        ],
      );

      if (error) {
        logger.error("Load history error:", error.message);
        // If we are offline and have no messages, show a local greeting
        if (messages.length === 0) {
          setMessages([
            {
              _id: "welcome-offline",
              text: "Hey there! I can't reach the server right now, but I'm still here for you. (Offline Mode)",
              createdAt: new Date(),
              user: { _id: 2, name: profile?.companion_name || "Companion" },
            },
          ]);
        }
      } else if (data) {
        const placeholderIds = data
          .filter(
            (msg: any) => msg.is_from_ai && isAiPlaceholderText(msg.message),
          )
          .map((msg: any) => msg.id)
          .filter(Boolean);

        if (placeholderIds.length > 0) {
          supabase
            .from("chats")
            .delete()
            .in("id", placeholderIds)
            .then(({ error }) => {
              if (error) {
                logger.warn(
                  "Failed to clean placeholder chat rows:",
                  error.message,
                );
              }
            });
        }

        const sanitizedData = data.filter(
          (msg: any) => !(msg.is_from_ai && isAiPlaceholderText(msg.message)),
        );

        const formattedHistory: IMessage[] = sanitizedData.map((msg: any) => ({
          _id: msg.id,
          text: msg.message,
          createdAt: new Date(msg.created_at),
          user: msg.is_from_ai ? AI_USER : CURRENT_USER,
        }));

        // Check if there are more messages to load
        setHasMoreMessages(data.length === MESSAGES_PER_PAGE);

        if (loadMore) {
          // Append older messages to the end of the list
          setMessages((prev) => [...prev, ...formattedHistory]);
        } else {
          // Initial load or refresh
          // Prevent massive UI flash: Only set if the newest backend message ID is different
          // than what is already displayed from the cache.
          setMessages((prev) => {
            if (
              prev.length > 0 &&
              formattedHistory.length > 0 &&
              prev[0]._id === formattedHistory[0]._id &&
              prev.length === formattedHistory.length
            ) {
              return prev; // No new messages to append, skip UI flash!
            }

            // SMART MERGE: Don't just overwrite! The user might have just typed
            // a new temporary message that isn't in 'formattedHistory' yet.
            // We merge them by unique ID, keeping the absolute newest on top.
            const mergedMap = new Map();

            // Add old cloud history first
            formattedHistory.forEach((msg) => mergedMap.set(msg._id, msg));

            // Overwrite/Append any newer local state (like optimistic messages)
            prev.forEach((msg) => mergedMap.set(msg._id, msg));

            // Convert back to Array and sort descending by date
            const finalMerged = Array.from(mergedMap.values()).sort((a, b) => {
              return (
                new Date(b.createdAt).getTime() -
                new Date(a.createdAt).getTime()
              );
            });

            return finalMerged.filter(
              (msg) =>
                !(msg.user._id === 2 && isAiPlaceholderText(String(msg.text))),
            );
          });

          AsyncStorage.setItem(
            cacheKey,
            JSON.stringify(formattedHistory.slice(0, MESSAGES_PER_PAGE)),
          );
        }

        // Use parallel count result for limit check
        if (!loadMore && !countError && count !== null) {
          checkLimit(count);
        }

        // --- Generate first greeting if chat is completely empty ---
        // CRITICAL GUARD: Only insert greeting if we have NO messages and haven't inserted one this session
        // We check messagesRef again to be absolutely sure no other process injected messages while we were fetching.
        if (
          !loadMore &&
          sanitizedData.length === 0 &&
          messages.length === 0 &&
          messagesRef.current.length === 0 &&
          !greetingInsertedRef.current &&
          !isLoadingHistory // Double check main loading state hasn't flipped
        ) {
          greetingInsertedRef.current = true;
          // Role-aware greeting — tailored per companion type
          const greetingByRole: Record<string, string> = {
            girlfriend: `Hey baby, I'm ${companionName}... how are you feeling today? 💕`,
            boyfriend: `Hey babe, I'm ${companionName}... how's your day going? 💙`,
            mother: `Hey sweetheart, I'm ${companionName}. I'm always here for you — how are you feeling? 💜`,
            father: `Hey champ, I'm ${companionName}. How are you doing today? 🧡`,
            friend: `Hey! I'm ${companionName} — your new companion 😊 How are you feeling today?`,
          };
          const firstGreeting =
            greetingByRole[userRole] ||
            `Hi, I'm ${companionName}! How are you feeling today? ✨`;
          const greetingId = Crypto.randomUUID();
          const firstMsg: IMessage = {
            _id: greetingId,
            text: firstGreeting,
            createdAt: new Date(),
            user: AI_USER,
          };

          setMessages([firstMsg]);
          setHasMoreMessages(false);

          supabase
            .from("chats")
            .insert({
              id: greetingId,
              user_id: user.id,
              message: firstGreeting,
              is_from_ai: true,
            })
            .then(({ error }) => {
              if (error) {
                logger.error("Save first greeting error:", error.message);
                greetingInsertedRef.current = false; // Allow retry on failure
              }
            });
        }

        // Pro: inject a callback message when user returns after 24h+ absence
        if (
          !loadMore &&
          isPremium &&
          sanitizedData.length > 0 &&
          !greetingInsertedRef.current
        ) {
          const lastMsg = sanitizedData[0]; // sorted DESC — most recent first
          const hoursSinceLast =
            (Date.now() - new Date(lastMsg.created_at).getTime()) /
            (1000 * 60 * 60);
          if (hoursSinceLast >= 24 && !lastMsg.is_from_ai) {
            greetingInsertedRef.current = true;
            const callbackPhrases = [
              `Hey, I've been thinking about you... how are you doing? 💭`,
              `You've been on my mind. How's everything going? 🌸`,
              `It's been a while! I missed our conversations. How are you feeling today? 💙`,
            ];
            const callbackText =
              callbackPhrases[
                Math.floor(Math.random() * callbackPhrases.length)
              ];
            const callbackId = Crypto.randomUUID();
            const callbackMsg: IMessage = {
              _id: callbackId,
              text: callbackText,
              createdAt: new Date(),
              user: AI_USER,
            };
            setMessages((prev) => GiftedChat.append(prev, [callbackMsg]));
            supabase
              .from("chats")
              .insert({
                id: callbackId,
                user_id: user.id,
                message: callbackText,
                is_from_ai: true,
              })
              .then(({ error }) => {
                if (error) logger.warn("Callback insert failed:", error);
              });
          }
        }

        // Cache the newly fetched backend truth locally (only on initial load)
        if (!loadMore) {
          try {
            await AsyncStorage.setItem(
              cacheKey,
              JSON.stringify(formattedHistory),
            );
          } catch (e) {
            logger.warn("Could not write completely fresh cache", e);
          }
        }
      }
    } catch (err) {
      logger.error("loadHistory error:", err);
    } finally {
      isLoadingHistoryRef.current = false;
      if (loadMore) {
        setIsLoadingMore(false);
      } else {
        setIsLoadingHistory(false);
      }
    }
  };

  // Load more messages handler
  const handleLoadEarlier = () => {
    if (!isLoadingMore && hasMoreMessages) {
      loadHistory(true);
    }
  };

  // ── AppState: refresh history when app returns to foreground ────────
  useEffect(() => {
    const subscription = AppState.addEventListener("change", (nextAppState) => {
      if (nextAppState === "background") {
        logger.info("Chat: App moved to background.");
        // Schedule mood-aware re-engagement notification for Pro users
        if (isPremium) {
          NotificationService.scheduleMoodAwareCheckIn(
            companionName,
            lastMoodContextRef.current,
          ).catch(() => {});
        }
      } else if (nextAppState === "active") {
        const now = Date.now();
        if (now - lastForegroundRefreshAtRef.current < 1500) {
          return;
        }
        lastForegroundRefreshAtRef.current = now;

        logger.info("Chat: App returned to foreground. Refreshing history...");
        // Pre-warm the edge function to reduce cold-start latency
        warmEdgeFunction();
        // On foreground refresh, fetch backend truth without resetting UI from cache.
        loadHistory(false, true);
      }
    });
    return () => subscription.remove();
    // loadHistory is stable — it reads from closure refs, not props
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, profile?.id]);

  // ── Cache listener ──────────────────────────────────────────────
  // Whenever our messages state changes significantly (e.g., someone sends a message, or we receive one),
  // keep the local storage cache completely up to date in the background.
  // Only cache the most recent page for instant load on app restart.
  useEffect(() => {
    if (!user || messages.length === 0) return;

    const updateCache = async () => {
      try {
        const cacheKey = `chat_history_${user.id}`;
        // Cache only the most recent messages (first page) for fast initial load
        await AsyncStorage.setItem(
          cacheKey,
          JSON.stringify(messages.slice(0, MESSAGES_PER_PAGE)),
        );
      } catch (e) {
        logger.warn("Failed to update cache on message change", e);
      }
    };

    // Slight debounce so we don't spam storage on rapid replies
    const timer = setTimeout(() => {
      updateCache();
    }, 500);

    return () => clearTimeout(timer);
  }, [messages.length, user]); // Only trigger cache update when length changes, not on every memory re-allocation of the array

  // ── Real-time subscription ────────────────────────────────────────
  useEffect(() => {
    if (!user?.id || !profile) return;

    const channel = supabase
      .channel(`chats:${user.id}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "chats",
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          const newMsg = payload.new;
          // IMPORTANT: Check if we are the ones who just sent this message
          // Real-time can echo our own inserts back to us.
          if (!newMsg.is_from_ai) return;
          if (isAiPlaceholderText(newMsg.message)) {
            supabase
              .from("chats")
              .delete()
              .eq("id", newMsg.id)
              .then(() => {})
              .catch(() => {});
            return;
          }

          const formattedMsg: IMessage = {
            _id: newMsg.id,
            text: newMsg.message,
            createdAt: new Date(newMsg.created_at),
            user: AI_USER,
          };

          setMessages((prev) => {
            // Deduplicate by DB ID — text matching is fragile and
            // can suppress legitimately repeated messages.
            if (prev.some((m) => m._id === formattedMsg._id)) {
              return prev;
            }

            // Otherwise, it's a completely new incoming message from AI
            return GiftedChat.append(prev, [formattedMsg]);
          });
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, profile?.id]); // Only rebind channel if the actual User ID changes

  // ── Premium limit check (hard limit) ───────────────────────────
  const checkLimit = (count: number) => {
    if (!isPremium && count >= FREE_MESSAGE_LIMIT) {
      setHitLimit(true);
    } else if (isPremium) {
      setHitLimit(false);
    }
  };

  // Watch for premium status changes (e.g., returning from successful paywall)
  useEffect(() => {
    if (isPremium && hitLimit) {
      setHitLimit(false);
    }
  }, [isPremium, hitLimit]);

  // ── Voice Recording ───────────────────────────────────────────────
  const startRecording = async () => {
    try {
      const { granted } = await ExpoAudio.requestPermissionsAsync();
      if (!granted) return;
      await ExpoAudio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });
      const { recording } = await ExpoAudio.Recording.createAsync(
        ExpoAudio.RecordingOptionsPresets.HIGH_QUALITY,
      );
      recordingRef.current = recording;
      setIsRecording(true);
    } catch (e) {
      logger.error("startRecording error:", e);
    }
  };

  const stopAndTranscribe = async () => {
    if (!recordingRef.current) return;
    try {
      setIsRecording(false);
      setIsTranscribing(true);
      await recordingRef.current.stopAndUnloadAsync();
      await ExpoAudio.setAudioModeAsync({ allowsRecordingIOS: false });
      const uri = recordingRef.current.getURI();
      recordingRef.current = null;
      if (!uri) return;

      const text = await transcribeAudio(uri);
      if (text) {
        // Fire the same onSend pipeline with the transcribed text
        const voiceMsg: IMessage = {
          _id: Math.random().toString(),
          text,
          createdAt: new Date(),
          user: { _id: 1, name: "You" },
        };
        onSend([voiceMsg]);
      }
    } catch (e) {
      logger.error("stopAndTranscribe error:", e);
    } finally {
      setIsTranscribing(false);
    }
  };

  const streamAssistantReply = useCallback(
    async (
      userText: string,
      historyForOpenAI: Array<{ role: "user" | "assistant"; content: string }>,
      persistUserMessage: boolean,
      userMessageId?: string,
    ) => {
      if (!user) return;

      setRetryPending(false);
      setRetryPayload(null);
      setIsTyping(true);

      // Track sync status for user message
      if (persistUserMessage && userMessageId) {
        setMessages((prev) =>
          prev.map((m) =>
            m._id === userMessageId ? { ...m, pendingSync: true } : m,
          ),
        );

        const performInsert = async () => {
          try {
            const { error: insertError } = await supabase.from("chats").insert({
              id: userMessageId,
              user_id: user.id,
              message: userText,
              is_from_ai: false,
            });

            if (insertError) {
              logger.warn("Save user msg failed:", insertError.message);
              // User specified ⚠️ shows when pendingSync: true
              // To handle failure, we can either keep it true or add a failure flag
              // But following the prompt "Show ⚠️ if pendingSync === true" literally.
              setMessages((prev) =>
                prev.map((m) =>
                  m._id === userMessageId ? { ...m, pendingSync: true } : m,
                ),
              );
            } else {
              setMessages((prev) =>
                prev.map((m) =>
                  m._id === userMessageId ? { ...m, pendingSync: false } : m,
                ),
              );
            }
          } catch (err) {
            logger.error("Save user msg crash:", err);
            setMessages((prev) =>
              prev.map((m) =>
                m._id === userMessageId ? { ...m, pendingSync: true } : m,
              ),
            );
          }
        };

        performInsert();
      }

      // Stable UUID so the optimistic _id matches the DB row id.
      const aiMessageId = Crypto.randomUUID();
      let streamingText = "";

      // Get user context: run mood + memory in parallel for speed
      let moodContext: string | undefined;
      let userMemoryContext = "";

      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const shouldLoadMemory =
        isPremium && isFeatureEnabled("aiMemory", isPremium);

      const [moodResult, memoryData] = await Promise.all([
        (async () => {
          const { data, error } = await supabase
            .from("mood_logs")
            .select("mood_score")
            .eq("user_id", user.id)
            .gte("created_at", today.toISOString())
            .order("created_at", { ascending: false })
            .limit(1)
            .maybeSingle();

          if (error) {
            logger.warn("Failed to load mood context:", error.message);
            return { data: null };
          }

          return { data };
        })(),
        shouldLoadMemory
          ? aiMemoryService.getUserMemory(user.id).catch((err: unknown) => {
              logger.warn("Failed to load AI memory:", err);
              return null;
            })
          : Promise.resolve(null),
      ]);

      if (moodResult.data?.mood_score) {
        const MOOD_MAP: Record<number, string> = {
          1: "Terrible",
          2: "Bad",
          3: "Okay",
          4: "Good",
          5: "Great",
        };
        moodContext = MOOD_MAP[moodResult.data.mood_score];
        lastMoodContextRef.current = moodContext;
      }

      if (memoryData) {
        const interests = memoryData.interests?.length
          ? memoryData.interests.join(", ")
          : "";
        const topics = memoryData.favorite_topics?.length
          ? memoryData.favorite_topics.join(", ")
          : "";
        userMemoryContext = `User interests: ${interests}. Favorite topics: ${topics}. Preferred tone: ${memoryData.preferred_tone}.`;
        if (moodContext) {
          aiMemoryService
            .recordCurrentMood(user.id, moodContext)
            .catch(() => {});
        }
      }

      // Inject memory context into history invisibly
      const finalHistory = [...historyForOpenAI];
      if (userMemoryContext) {
        finalHistory.unshift({
          role: "user" as const,
          content: `[System Context: ${userMemoryContext}]`,
        });
      }

      // Detect intent to guide AI tone and response style
      const intent = detectIntent(userText);

      // Pre-insert optimistic AI bubble immediately — user sees it before first chunk
      setMessages((prev) =>
        GiftedChat.append(prev, [
          {
            _id: aiMessageId,
            text: " ",
            createdAt: new Date(),
            user: AI_USER,
          },
        ]),
      );

      try {
        await getAIResponseStream(
          userText,
          userRole || "friend",
          companionName,
          finalHistory,
          userLanguage || "Hinglish",
          moodContext,
          user.id,
          intent,
          (chunk: string) => {
            streamingText += chunk;
            // Always update the pre-inserted bubble in place
            setMessages((currentMsgs) =>
              currentMsgs.map((m) =>
                m._id === aiMessageId ? { ...m, text: streamingText } : m,
              ),
            );
          },
        );
      } catch (streamErr: any) {
        if (!streamingText) {
          const fallback =
            "Yaar abhi connection thoda slow hai... thodi der mein try karo 💙";
          streamingText = fallback;
          // Update the pre-inserted bubble with fallback text
          setMessages((curr) =>
            curr.map((m) =>
              m._id === aiMessageId ? { ...m, text: fallback } : m,
            ),
          );
        }

        setRetryPending(true);
        setRetryPayload({ text: userText, history: historyForOpenAI });
        setErrorToast("Connection issue — tap Retry to continue");
        logger.warn("Stream error handled:", streamErr?.message);
      }

      setIsTyping(false);

      const finalAiText =
        streamingText && !isAiPlaceholderText(streamingText)
          ? streamingText
          : "Sorry, I could not generate a proper reply right now. Please try again. 💙";

      if (finalAiText !== streamingText) {
        setMessages((curr) =>
          curr.map((m) =>
            m._id === aiMessageId ? { ...m, text: finalAiText } : m,
          ),
        );
      }

      // FINAL SAVE: Persist only finalized AI text
      const { error: aiMsgError } = await supabase.from("chats").upsert({
        id: aiMessageId,
        user_id: user.id,
        message: finalAiText,
        is_from_ai: true,
      });

      if (aiMsgError) {
        logger.error("Save AI msg error:", aiMsgError.message);
      }
    },
    [user, userRole, companionName, userLanguage, AI_USER, isPremium],
  );

  // ── Send message ─────────────────────────────────────────────────
  const onSend = useCallback(
    async (newMessages: IMessage[] = []) => {
      if (!user) return;

      const currentMessages = messagesRef.current;
      const userMessageCount = currentMessages.filter(
        (m: IMessage) => m.user._id === 1,
      ).length;

      if (!isPremium && userMessageCount >= FREE_MESSAGE_LIMIT) {
        setHitLimit(true);
        router.push("/(modals)/paywall");
        return;
      }

      const msg = newMessages[0];

      // Generate a stable UUID so the optimistic message _id matches the DB row id.
      // This prevents duplicates when the background sync or cache reload fetches
      // the same message from the server with its real id.
      const stableId = Crypto.randomUUID();
      const messagesWithStableId = [
        { ...msg, _id: stableId, pendingSync: true },
      ];

      // Optimistic append
      setMessages((previousMessages) =>
        GiftedChat.append(previousMessages, messagesWithStableId),
      );

      // Haptic feedback
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

      try {
        const historyForOpenAI = [...currentMessages]
          .reverse()
          .slice(-20)
          .map((m: IMessage) => ({
            role: (m.user._id === 1 ? "user" : "assistant") as
              | "user"
              | "assistant",
            content: m.text,
          }));

        await streamAssistantReply(msg.text, historyForOpenAI, true, stableId);

        checkLimit(userMessageCount + 1);
      } catch (err) {
        logger.error("onSend error:", err);
        setIsTyping(false);
        setErrorToast("Something went wrong. Please try again.");
      }
    },
    [user, isPremium, router, streamAssistantReply],
  );

  const retryLastResponse = useCallback(async () => {
    if (!retryPayload || !user) return;
    await streamAssistantReply(retryPayload.text, retryPayload.history, false);
  }, [retryPayload, user, streamAssistantReply]);

  // ── Custom UI Renders for GiftedChat (Memoized for Performance) ──

  // Voice message handler (Pro feature)
  const handlePlayVoice = useCallback(
    async (messageId: string, text: string) => {
      if (!isPremium || !isFeatureEnabled("voiceMessages", isPremium)) return;

      try {
        if (playingMessageId === messageId) {
          await stopSpeech();
          setPlayingMessageId(null);
        } else {
          setPlayingMessageId(messageId);
          await speakMessage(
            text,
            {
              rate: 0.95,
              pitch: 1.05,
              language: userLanguage === "Hinglish" ? "hi-IN" : "en-US",
            },
            userRole,
          );
          setPlayingMessageId(null);
        }
      } catch (error) {
        logger.error("Voice playback error:", error);
        setPlayingMessageId(null);
      }
    },
    [isPremium, playingMessageId, userLanguage],
  );

  // Chat export handler (Pro feature)
  const handleExportChat = useCallback(async () => {
    if (!isPremium || !isFeatureEnabled("chatExport", isPremium)) return;

    setIsExporting(true);
    try {
      const success = await shareChat(
        messages.map((m) => ({
          role: m.user._id === 1 ? "user" : "assistant",
          content: m.text,
          timestamp: m.createdAt
            ? new Date(m.createdAt).toISOString()
            : new Date().toISOString(),
        })),
        companionName,
        profile?.companion_name || "You",
      );

      if (success) {
        setErrorToast(null);
      }
    } catch (error) {
      logger.error("Export chat error:", error);
      setErrorToast("Failed to export chat");
    } finally {
      setIsExporting(false);
    }
  }, [isPremium, messages, companionName, profile?.companion_name]);

  const renderBubble = useCallback(
    (props: any) => {
      const isAI = props.currentMessage.user._id === 2;

      return (
        <View>
          <Bubble
            {...props}
            wrapperStyle={{
              right: {
                backgroundColor: "#4F46E5", // Modern Indigo for user
                borderRadius: 20,
                borderBottomRightRadius: 4,
                padding: 2,
                marginBottom: 6,
                shadowColor: "#4F46E5",
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.1,
                shadowRadius: 4,
                elevation: 2,
              },
              left: {
                backgroundColor: "#fff", // Clean white for AI
                borderRadius: 20,
                borderBottomLeftRadius: 4,
                padding: 2,
                marginBottom: 6,
                borderWidth: 1,
                borderColor: "#F0F0F0",
                shadowColor: "#000",
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.05,
                shadowRadius: 4,
                elevation: 1,
              },
            }}
            textStyle={{
              right: {
                color: "#fff",
                fontFamily: "Inter_500Medium",
                fontSize: 15,
              },
              left: {
                color: "#1a1a2e",
                fontFamily: "Inter_500Medium",
                fontSize: 15,
              },
            }}
          />
          {/* Sync status for user messages */}
          {!isAI && props.currentMessage.pendingSync && (
            <View
              style={{
                flexDirection: "row",
                justifyContent: "flex-end",
                paddingRight: 8,
                marginTop: -4,
                marginBottom: 8,
              }}
            >
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  backgroundColor: "#FEF2F2",
                  paddingHorizontal: 6,
                  paddingVertical: 2,
                  borderRadius: 8,
                }}
              >
                <Text
                  style={{
                    fontSize: 10,
                    color: "#EF4444",
                    marginRight: 4,
                    fontFamily: "Inter_600SemiBold",
                  }}
                >
                  Sending...
                </Text>
                <ActivityIndicator size={10} color="#EF4444" />
              </View>
            </View>
          )}
          {/* Voice playback button for AI messages — ONLY for Premium */}
          {isAI && isPremium && (
            <TouchableOpacity
              onPress={() => {
                handlePlayVoice(
                  props.currentMessage._id,
                  props.currentMessage.text,
                );
              }}
              style={{
                marginLeft: 8,
                marginBottom: 10,
                flexDirection: "row",
                alignItems: "center",
              }}
            >
              <View
                style={{
                  width: 36,
                  height: 28,
                  borderRadius: 14,
                  backgroundColor:
                    playingMessageId === props.currentMessage._id
                      ? "#FF6B9D"
                      : "#F8F9FA",
                  alignItems: "center",
                  justifyContent: "center",
                  borderWidth: 1,
                  borderColor:
                    playingMessageId === props.currentMessage._id
                      ? "#FF6B9D"
                      : "#E5E7EB",
                }}
              >
                <Ionicons
                  name={
                    playingMessageId === props.currentMessage._id
                      ? "pause"
                      : "volume-medium"
                  }
                  size={14}
                  color={
                    playingMessageId === props.currentMessage._id
                      ? "#fff"
                      : "#666"
                  }
                />
              </View>
              {playingMessageId === props.currentMessage._id && (
                <Text
                  style={{
                    marginLeft: 6,
                    fontSize: 10,
                    color: "#FF6B9D",
                    fontFamily: "Inter_600SemiBold",
                  }}
                >
                  Speaking...
                </Text>
              )}
            </TouchableOpacity>
          )}
        </View>
      );
    },
    [isPremium, playingMessageId, handlePlayVoice],
  );

  const renderMessageText = useCallback(
    (props: any) => (
      <MessageText
        {...props}
        textStyle={{
          left: {
            fontFamily: "Inter_400Regular",
            fontSize: 15,
            lineHeight: 23,
            color: "#1a1a2e",
          },
          right: {
            fontFamily: "Inter_400Regular",
            fontSize: 15,
            lineHeight: 23,
            color: "#fff",
          },
        }}
      />
    ),
    [],
  );

  const renderInputToolbar = useCallback(
    (props: any) => {
      if (hitLimit && !isPremium) return null;
      return (
        <InputToolbar
          {...props}
          containerStyle={{
            backgroundColor: "#fff",
            borderTopWidth: 1,
            borderTopColor: "#F0F0F0",
            paddingHorizontal: 8,
            paddingVertical: 4,
            paddingBottom: Math.max(chatBottomOffset, 4),
          }}
          primaryStyle={{
            alignItems: "center",
          }}
          renderActions={() => (
            <TouchableOpacity
              onPress={isRecording ? stopAndTranscribe : startRecording}
              accessibilityLabel={
                isRecording ? "Stop recording" : "Start voice recording"
              }
              accessibilityRole="button"
              style={{
                width: 44,
                height: 44,
                borderRadius: 22,
                backgroundColor: isRecording ? "#FEF2F2" : "#F8F9FA",
                justifyContent: "center",
                alignItems: "center",
                marginLeft: 4,
              }}
            >
              {isTranscribing ? (
                <ActivityIndicator size="small" color="#4F46E5" />
              ) : (
                <Ionicons
                  name={isRecording ? "stop-circle" : "mic"}
                  size={24}
                  color={isRecording ? "#EF4444" : "#666"}
                />
              )}
            </TouchableOpacity>
          )}
        />
      );
    },
    [hitLimit, isPremium, isRecording, isTranscribing, chatBottomOffset],
  );

  const renderSend = useCallback((props: any) => {
    return (
      <Send
        {...props}
        accessibilityLabel="Send message"
        accessibilityRole="button"
        containerStyle={{ justifyContent: "center", marginHorizontal: 10 }}
      >
        <View
          style={{
            width: 36,
            height: 36,
            borderRadius: 18,
            backgroundColor: "#1a1a2e",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Text style={{ fontSize: 14, color: "#fff" }}>➤</Text>
        </View>
      </Send>
    );
  }, []);

  // ── Auth loading state ────────────────────────────────────────────
  if (isAuthLoading && !user) {
    return (
      <View className="flex-1 items-center justify-center bg-[#F8FBFF]">
        <ActivityIndicator size="large" color="#1a1a2e" />
        <Text
          style={{
            fontFamily: "Inter_400Regular",
            fontSize: 14,
            color: "#999",
            marginTop: 12,
          }}
        >
          Connecting...
        </Text>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      style={{ flex: 1 }}
      keyboardVerticalOffset={0}
    >
      <View className="flex-1 bg-[#F8FBFF]">
        {/* Header */}
        <View
          style={{
            paddingTop: insets.top + 10,
            paddingBottom: 14,
            paddingHorizontal: 20,
            backgroundColor: "#fff",
            borderBottomWidth: 1,
            borderBottomColor: "#F0F0F0",
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <View className="flex-row items-center gap-3">
            <TouchableOpacity
              onPress={() => {
                if (router.canGoBack()) {
                  router.back();
                } else {
                  router.replace("/(main)/dashboard");
                }
              }}
              style={{ padding: 4, marginRight: -4 }}
            >
              <Ionicons name="arrow-back" size={24} color="#1a1a2e" />
            </TouchableOpacity>

            {profile?.avatar_url ? (
              <Image
                source={{ uri: profile.avatar_url }}
                className="w-11 h-11 rounded-full"
              />
            ) : (
              <View className="w-11 h-11 rounded-full bg-[#FCDCE4] items-center justify-center">
                <Text style={{ fontSize: 22 }}>🧑‍💼</Text>
              </View>
            )}
            <View>
              <Text
                style={{
                  fontFamily: "Manrope_600SemiBold",
                  fontSize: 16,
                  color: "#1a1a2e",
                }}
              >
                {companionName}
              </Text>
              <Text
                style={{
                  fontFamily: "Inter_400Regular",
                  fontSize: 11,
                  color: "#4ADE80",
                  marginTop: 2,
                }}
              >
                Your Companion • Online
              </Text>
            </View>
          </View>
          <View className="flex-row items-center gap-2">
            {/* Export Chat Button - visible for all, locked for free */}
            <TouchableOpacity
              onPress={() => {
                if (!isPremium) {
                  router.push("/(modals)/paywall");
                  return;
                }
                handleExportChat();
              }}
              disabled={isExporting}
              className="w-9 h-9 rounded-full bg-[#F5F5F5] items-center justify-center"
            >
              {isExporting ? (
                <ActivityIndicator size="small" color="#FF6B9D" />
              ) : (
                <Text style={{ fontSize: 16 }}>{isPremium ? "📤" : "🔒"}</Text>
              )}
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => router.push("/(main)/settings")}
              className="w-9 h-9 rounded-full bg-[#F5F5F5] items-center justify-center"
            >
              <Text style={{ fontSize: 16 }}>⚙️</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* AI Disclaimer */}
        <View
          style={{
            backgroundColor: "#F0F8FF",
            paddingVertical: 8,
            paddingHorizontal: 12,
          }}
        >
          <Text
            style={{
              fontFamily: "Inter_400Regular",
              fontSize: 11,
              color: "#0066CC",
              textAlign: "center",
            }}
          >
            Powered by AI — responses may not be perfect
          </Text>
        </View>

        {/* Recording indicator banner */}
        {isRecording && (
          <View
            style={{
              backgroundColor: "#FF3B30",
              paddingVertical: 8,
              paddingHorizontal: 16,
              flexDirection: "row",
              alignItems: "center",
              gap: 8,
            }}
          >
            <View
              style={{
                width: 8,
                height: 8,
                borderRadius: 4,
                backgroundColor: "#fff",
              }}
            />
            <Text
              style={{
                fontFamily: "Inter_500Medium",
                fontSize: 13,
                color: "#fff",
              }}
            >
              Recording... Tap ⏹️ to stop and send
            </Text>
          </View>
        )}

        {/* Error Toast */}
        {errorToast && (
          <View
            style={{
              backgroundColor: "#FF3B30",
              paddingVertical: 12,
              paddingHorizontal: 16,
              flexDirection: "row",
              alignItems: "center",
              gap: 8,
            }}
          >
            <Text
              style={{
                fontFamily: "Inter_500Medium",
                fontSize: 13,
                color: "#fff",
                flex: 1,
              }}
              numberOfLines={2}
            >
              {errorToast}
            </Text>
            <TouchableOpacity onPress={() => setErrorToast(null)}>
              <Text
                style={{
                  fontFamily: "Inter_500Medium",
                  fontSize: 13,
                  color: "#fff",
                }}
              >
                ✕
              </Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Premium limit banner */}
        {hitLimit && (
          <View className="bg-[#FFF8E1] py-3 px-5 flex-row items-center justify-between">
            <Text
              style={{
                fontFamily: "Inter_500Medium",
                fontSize: 13,
                color: "#F59E0B",
                flex: 1,
              }}
            >
              You reached your 20 free messages. Upgrade to continue 💛
            </Text>
            <TouchableOpacity
              onPress={() => router.push("/(modals)/paywall")}
              className="bg-[#1a1a2e] rounded-full px-4 py-2"
            >
              <Text
                style={{
                  fontFamily: "Manrope_600SemiBold",
                  fontSize: 13,
                  color: "#fff",
                }}
              >
                Upgrade
              </Text>
            </TouchableOpacity>
          </View>
        )}

        {retryPending && retryPayload && (
          <View className="bg-[#FEF3C7] py-3 px-5 flex-row items-center justify-between">
            <Text
              style={{
                fontFamily: "Inter_500Medium",
                fontSize: 13,
                color: "#92400E",
                flex: 1,
              }}
            >
              Reply was interrupted. Retry to continue from your last message.
            </Text>
            <TouchableOpacity
              onPress={retryLastResponse}
              className="bg-[#1a1a2e] rounded-full px-4 py-2"
            >
              <Text
                style={{
                  fontFamily: "Manrope_600SemiBold",
                  fontSize: 13,
                  color: "#fff",
                }}
              >
                Retry
              </Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Save Chats Banner */}
        {user?.is_anonymous &&
          messages.filter((m: IMessage) => m.user._id === 1).length >= 3 && (
            <TouchableOpacity
              onPress={() => router.push("/(modals)/link-account")}
              className="bg-[#FCDCE4] py-3 px-5 flex-row items-center justify-center"
            >
              <Text
                style={{
                  fontFamily: "Inter_500Medium",
                  fontSize: 13,
                  color: "#1a1a2e",
                  textAlign: "center",
                }}
              >
                Sign in with Google/Apple to save forever ❤️
              </Text>
            </TouchableOpacity>
          )}

        <GiftedChat
          messages={messages}
          onSend={(newMsgs: IMessage[]) => onSend(newMsgs)}
          user={CURRENT_USER}
          isTyping={isTyping}
          renderBubble={renderBubble}
          renderMessageText={renderMessageText}
          renderInputToolbar={renderInputToolbar}
          renderSend={renderSend}
          renderAvatar={(props: any) => (
            <View
              style={{
                width: 36,
                height: 36,
                borderRadius: 18,
                backgroundColor: "#FDF2F8",
                alignItems: "center",
                justifyContent: "center",
                borderWidth: 1,
                borderColor: "#FCE7F3",
              }}
            >
              {profile?.avatar_url ? (
                <Image
                  source={{ uri: profile.avatar_url }}
                  style={{ width: 36, height: 36, borderRadius: 18 }}
                />
              ) : (
                <Text style={{ fontSize: 18 }}>❤️</Text>
              )}
            </View>
          )}
          // @ts-ignore
          showUserAvatar={false}
          showAvatarForEveryMessage={false}
          bottomOffset={chatBottomOffset}
          placeholder="Type a message..."
          alwaysShowSend
          isKeyboardInternallyHandled
          listViewProps={{
            keyboardShouldPersistTaps: "handled",
          }}
          loadEarlier={hasMoreMessages}
          isLoadingEarlier={isLoadingMore}
          onLoadEarlier={handleLoadEarlier}
        />

        {!isPremium && showAd && (
          <View
            style={{
              backgroundColor: "#fff",
              borderTopWidth: 1,
              borderTopColor: "#F0F0F0",
              alignItems: "center",
              paddingVertical: 6,
            }}
          >
            <BannerAd
              unitId={adService.getBannerAdUnitId()}
              size={BannerAdSize.ANCHORED_ADAPTIVE_BANNER}
              requestOptions={{ requestNonPersonalizedAdsOnly: true }}
            />
          </View>
        )}
      </View>
    </KeyboardAvoidingView>
  );
}
