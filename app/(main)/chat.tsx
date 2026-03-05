/**
 * Chat Screen — MoodMateAI
 *
 * Modified to use GiftedChat for the UI layout while preserving
 * the existing Supabase storage logic and OpenAI integration.
 */

import AsyncStorage from "@react-native-async-storage/async-storage";
import { Audio } from "expo-av";
import * as Crypto from "expo-crypto";
import * as Haptics from "expo-haptics";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
    ActivityIndicator,
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
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "../../hooks/useAuth";
import { supabase } from "../../lib/supabase";
import {
    getAIResponseStream,
    transcribeAudio,
} from "../../services/openaiService";
import { speakMessage, stopSpeech } from "../../utils/voiceService";
import { shareChat, exportAsText } from "../../utils/chatExport";
import { isFeatureEnabled } from "../../utils/featureFlags";
import { logger } from "../../utils/logger";

const FREE_MESSAGE_LIMIT = 20;
const CHAT_SESSION_COUNT_KEY_PREFIX = "chat_sessions_";
const MESSAGES_PER_PAGE = 30;

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
  const recordingRef = useRef<Audio.Recording | null>(null);
  const trackedSessionUserRef = useRef<string | null>(null);

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

  // AI Avatar config for GiftedChat
  const AI_USER = useMemo(
    () => ({
      _id: 2,
      name: companionName,
      avatar: profile?.avatar_url || "https://i.pravatar.cc/150?img=47", // Use custom avatar if available
    }),
    [companionName, profile?.avatar_url],
  );

  const CURRENT_USER = useMemo(
    () => ({
      _id: 1,
      name: "You",
    }),
    [],
  );

  // ── Chat session tracking (for delayed mood prompt) ──────────────
  useEffect(() => {
    if (!user?.id) return;
    if (trackedSessionUserRef.current === user.id) return;

    trackedSessionUserRef.current = user.id;
    const sessionCountKey = `${CHAT_SESSION_COUNT_KEY_PREFIX}${user.id}`;

    AsyncStorage.getItem(sessionCountKey)
      .then((raw) => {
        const currentCount = Number.parseInt(raw || "0", 10) || 0;
        return AsyncStorage.setItem(sessionCountKey, String(currentCount + 1));
      })
      .catch((err) => {
        logger.warn("Could not update chat session count", err);
      });
  }, [user?.id]);

  // ── Toast auto-hide ──────────────────────────────────────────────
  useEffect(() => {
    if (!errorToast) return;
    const timer = setTimeout(() => setErrorToast(null), 4000);
    return () => clearTimeout(timer);
  }, [errorToast]);

  // ── Load chat history ─────────────────────────────────────────────
  // Ghost user check is already handled in useAuth.initialize(),
  // no need to re-check here on every chat screen mount.
  useEffect(() => {
    if (!user || !profile) return;
    loadHistory();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, profile?.id]); // Only refetch if the actual ID changes, not the object reference

  const loadHistory = async (loadMore = false) => {
    if (!user || !profile) return;
    const cacheKey = `chat_history_${user.id}`;

    // If loading more, set loading state but don't touch initial loading state
    if (loadMore) {
      setIsLoadingMore(true);
    } else {
      // 1. INSTANT LOAD: Try to load from Local Storage first (initial load only)
      try {
        const cachedData = await AsyncStorage.getItem(cacheKey);
        if (cachedData) {
          const parsedCache = JSON.parse(cachedData);
          // Hydrate dates since JSON strigifies them
          const hydratedMessages = parsedCache.map((msg: any) => ({
            ...msg,
            createdAt: new Date(msg.createdAt),
          }));
          // Instantly show cached messages (no loading spinner required!)
          setMessages(hydratedMessages);
          setIsLoadingHistory(false);
          // Limit will be checked accurately via the DB count query below
        } else {
          // Only show loading spinner if we have absolutely no cache
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

      const { data, error } = await supabase
        .from("chats")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .range(offset, offset + limit - 1);

      if (error) {
        logger.error("Load history error:", error.message);
      } else if (data) {
        const formattedHistory: IMessage[] = data.map((msg: any) => ({
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
              prev[0]._id === formattedHistory[0]._id
            ) {
              return prev; // No new messages to append, skip UI flash!
            }
            return formattedHistory;
          });
        }

        // For limit checking, count ALL user messages via a separate count query
        if (!loadMore) {
          const { count, error: countError } = await supabase
            .from("chats")
            .select("id", { count: "exact", head: true })
            .eq("user_id", user.id)
            .eq("is_from_ai", false);
          if (!countError && count !== null) {
            checkLimit(count);
          }
        }

        // --- NEW: Generate first greeting if chat is completely empty ---
        if (!loadMore && data.length === 0) {
          const firstGreeting = `Hey baby, I'm ${companionName}... how are you feeling today? ❤️`;
          // Use a stable UUID so the optimistic _id matches the DB row id.
          // Without this, realtime echoes the INSERT with a *different* server-generated
          // UUID and dedup fails → duplicate greeting bubble.
          const greetingId = Crypto.randomUUID();
          const firstMsg: IMessage = {
            _id: greetingId,
            text: firstGreeting,
            createdAt: new Date(),
            user: AI_USER,
          };

          setMessages([firstMsg]);
          setHasMoreMessages(false);

          // Save to DB in background — pass the same greetingId so the DB row
          // id matches the optimistic _id the realtime subscription checks.
          supabase
            .from("chats")
            .insert({
              id: greetingId,
              user_id: user.id,
              message: firstGreeting,
              is_from_ai: true,
            })
            .then(({ error }) => {
              if (error)
                logger.error("Save first greeting error:", error.message);
            });
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
      const { granted } = await Audio.requestPermissionsAsync();
      if (!granted) return;
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });
      const { recording } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY,
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
      await Audio.setAudioModeAsync({ allowsRecordingIOS: false });
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

      if (persistUserMessage) {
        supabase
          .from("chats")
          .insert({
            ...(userMessageId ? { id: userMessageId } : {}),
            user_id: user?.id,
            message: userText,
            is_from_ai: false,
          })
          .then(({ error }) => {
            if (error)
              logger.warn("Save user msg (non-blocking):", error.message);
          });
      }

      setRetryPending(false);
      setRetryPayload(null);
      setIsTyping(true);

      // Stable UUID so the optimistic _id matches the DB row id.
      // Math.random() caused duplicates because realtime echoed back
      // a server-generated UUID that didn't match the local _id.
      const aiMessageId = Crypto.randomUUID();
      let streamingText = "";
      let aiMessageAdded = false;

      let moodContext: string | undefined;
      try {
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const { data } = await supabase
          .from("mood_logs")
          .select("mood_score")
          .eq("user_id", user.id)
          .gte("created_at", today.toISOString())
          .order("created_at", { ascending: false })
          .limit(1)
          .single();

        if (data?.mood_score) {
          const MOOD_MAP: Record<number, string> = {
            1: "Terrible",
            2: "Bad",
            3: "Okay",
            4: "Good",
            5: "Great",
          };
          moodContext = MOOD_MAP[data.mood_score];
        }
      } catch (e) {}

      try {
        await getAIResponseStream(
          userText,
          userRole || "friend",
          companionName,
          historyForOpenAI,
          userLanguage || "Hinglish",
          moodContext,
          user.id,
          (chunk: string) => {
            streamingText += chunk;

            if (!aiMessageAdded) {
              aiMessageAdded = true;
              const newAiMsg: IMessage = {
                _id: aiMessageId,
                text: streamingText,
                createdAt: new Date(),
                user: AI_USER,
              };
              setMessages((previousMessages) =>
                GiftedChat.append(previousMessages, [newAiMsg]),
              );
            } else {
              setMessages((currentMsgs) => {
                return currentMsgs.map((m) => {
                  if (m._id === aiMessageId) {
                    return { ...m, text: streamingText };
                  }
                  return m;
                });
              });
            }
          },
        );
      } catch (streamErr: any) {
        if (!streamingText) {
          const fallback =
            "Yaar abhi connection thoda slow hai... thodi der mein try karo 💙";
          streamingText = fallback;

          const fallbackMsg: IMessage = {
            _id: aiMessageId,
            text: fallback,
            createdAt: new Date(),
            user: AI_USER,
          };
          setMessages((previousMessages) =>
            GiftedChat.append(previousMessages, [fallbackMsg]),
          );
        }

        setRetryPending(true);
        setRetryPayload({ text: userText, history: historyForOpenAI });
        setErrorToast("Connection issue — tap Retry to continue");
        logger.warn("Stream error handled:", streamErr?.message);
      }

      setIsTyping(false);

      // Pass the same aiMessageId so the DB row id matches the optimistic
      // _id. The realtime subscription deduplicates by _id — if we let
      // Postgres auto-generate a different UUID, the echo appears as a
      // second bubble.
      const { error: aiMsgError } = await supabase.from("chats").insert({
        id: aiMessageId,
        user_id: user.id,
        message: streamingText,
        is_from_ai: true,
      });

      if (aiMsgError) {
        logger.error("Save AI msg error:", aiMsgError.message);
      }
    },
    [user, userRole, companionName, userLanguage, AI_USER],
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
      const messagesWithStableId = [{ ...msg, _id: stableId }];

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

  // ── Auth loading state ────────────────────────────────────────────
  if (isAuthLoading) {
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
          await speakMessage(text, { 
            rate: 0.9, 
            pitch: 1.1,
            language: userLanguage === "Hinglish" ? "hi-IN" : "en-US"
          });
          setPlayingMessageId(null);
        }
      } catch (error) {
        logger.error("Voice playback error:", error);
        setPlayingMessageId(null);
      }
    },
    [isPremium, playingMessageId, userLanguage]
  );

  // Chat export handler (Pro feature)
  const handleExportChat = useCallback(async () => {
    if (!isPremium || !isFeatureEnabled("chatExport", isPremium)) return;
    
    setIsExporting(true);
    try {
      const success = await shareChat(
        messages.map(m => ({
          role: m.user._id === 1 ? "user" : "assistant",
          content: m.text,
          timestamp: m.createdAt?.toISOString(),
        })),
        companionName,
        profile?.name || "You"
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
  }, [isPremium, messages, companionName, profile?.name]);

  const renderBubble = useCallback((props: any) => {
    const isAI = props.currentMessage.user._id === 2;
    
    return (
      <View>
        <Bubble
          {...props}
          wrapperStyle={{
            right: {
              backgroundColor: "#D9EEFF", // Blue for user
              borderTopRightRadius: 4,
              borderTopLeftRadius: 20,
              borderBottomRightRadius: 20,
              borderBottomLeftRadius: 20,
              padding: 4,
              marginBottom: 4,
            },
            left: {
              backgroundColor: "#FCDCE4", // Pink for AI
              borderTopLeftRadius: 4,
              borderTopRightRadius: 20,
              borderBottomRightRadius: 20,
              borderBottomLeftRadius: 20,
              padding: 4,
              marginBottom: 4,
            },
          }}
        />
        {/* Voice playback button for AI messages (Pro feature) */}
        {isAI && isPremium && isFeatureEnabled("voiceMessages", isPremium) && (
          <TouchableOpacity
            onPress={() =>
              handlePlayVoice(props.currentMessage._id, props.currentMessage.text)
            }
            style={{
              paddingLeft: 8,
              marginBottom: 8,
              flexDirection: "row",
              alignItems: "center",
            }}
          >
            <View
              style={{
                width: 32,
                height: 32,
                borderRadius: 16,
                backgroundColor: playingMessageId === props.currentMessage._id ? "#FF6B9D" : "#F0F0F0",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Text style={{ fontSize: 16 }}>
                {playingMessageId === props.currentMessage._id ? "⏸️" : "🔊"}
              </Text>
            </View>
          </TouchableOpacity>
        )}
      </View>
    );
  }, [isPremium, playingMessageId, handlePlayVoice]);

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
            color: "#1a1a2e",
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
          }}
          primaryStyle={{
            alignItems: "center",
          }}
          renderActions={() => (
            <TouchableOpacity
              onPress={isRecording ? stopAndTranscribe : startRecording}
              style={{
                justifyContent: "center",
                alignItems: "center",
                paddingHorizontal: 8,
                paddingVertical: 4,
              }}
            >
              {isTranscribing ? (
                <ActivityIndicator size="small" color="#FF3B30" />
              ) : (
                <Text style={{ fontSize: 20 }}>
                  {isRecording ? "⏹️" : "🎙️"}
                </Text>
              )}
            </TouchableOpacity>
          )}
        />
      );
    },
    [hitLimit, isPremium, isRecording, isTranscribing],
  );

  const renderSend = useCallback((props: any) => {
    return (
      <Send
        {...props}
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

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      style={{ flex: 1 }}
      keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 20}
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
            {/* Export Chat Button (Pro feature) */}
            {isPremium && isFeatureEnabled("chatExport", isPremium) && (
              <TouchableOpacity
                onPress={handleExportChat}
                disabled={isExporting}
                className="w-9 h-9 rounded-full bg-[#F5F5F5] items-center justify-center"
              >
                {isExporting ? (
                  <ActivityIndicator size="small" color="#FF6B9D" />
                ) : (
                  <Text style={{ fontSize: 16 }}>📤</Text>
                )}
              </TouchableOpacity>
            )}
            <TouchableOpacity
              onPress={() => router.push("/(main)/settings")}
              className="w-9 h-9 rounded-full bg-[#F5F5F5] items-center justify-center"
            >
              <Text style={{ fontSize: 16 }}>⚙️</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => router.push("/(main)/profile")}
              className="w-9 h-9 rounded-full bg-[#F5F5F5] items-center justify-center"
            >
              <Text style={{ fontSize: 14, color: "#666" }}>✕</Text>
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
          onSend={(messages) => onSend(messages)}
          user={CURRENT_USER}
          isTyping={isTyping}
          renderBubble={renderBubble}
          renderMessageText={renderMessageText}
          renderInputToolbar={renderInputToolbar}
          renderSend={renderSend}
          renderAvatar={() => null} // Hide avatars to match original UI
          // @ts-ignore - these props are valid in JS but missing from GiftedChat's strict Typescript definitions
          showUserAvatar={false}
          showAvatarForEveryMessage={false}
          bottomOffset={Platform.OS === "ios" ? insets.bottom : 0}
          placeholder="Type a message..."
          alwaysShowSend
          isKeyboardInternallyHandled={false}
          loadEarlier={hasMoreMessages}
          isLoadingEarlier={isLoadingMore}
          onLoadEarlier={handleLoadEarlier}
        />
      </View>
    </KeyboardAvoidingView>
  );
}
