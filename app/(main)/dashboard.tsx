import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
import {
    Animated,
    Easing,
    Image,
    RefreshControl,
    ScrollView,
    StatusBar,
    Text,
    TouchableOpacity,
    View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import BottomNav from "../../components/BottomNav";
import ConfettiOverlay, { ConfettiRef } from "../../components/ConfettiOverlay";
import { useAuth } from "../../hooks/useAuth";
import type { BadgeMilestone } from "../../services/dashboardService";
import {
    CoachingTip,
    DailyChallenge,
    dashboardService,
} from "../../services/dashboardService";
import { logger } from "../../utils/logger";
import { NotificationService } from "../../utils/notificationService";

export default function UserDashboard() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const profile = useAuth((s) => s.profile);
  const isPremium = useAuth((s) => s.isPremium);
  const user = useAuth((s) => s.currentUser);

  const [moodStats, setMoodStats] = useState<any>(null);
  const [memoryHighlight, setMemoryHighlight] = useState<string | null>(null);
  const [challenge, setChallenge] = useState<DailyChallenge | null>(null);
  const [tip, setTip] = useState<CoachingTip | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [stats, setStats] = useState({ totalKarma: 0, streak: 0 });
  const [badges, setBadges] = useState<BadgeMilestone[]>([]);
  const [moodHistory, setMoodHistory] = useState<any[]>([]);
  const [empathyMsg, setEmpathyMsg] = useState("");
  const [isChallengeDone, setIsChallengeDone] = useState(false);
  const [isCompleting, setIsCompleting] = useState(false);

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(20)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const floatAnim = useRef(new Animated.Value(0)).current;
  const scrollY = useRef(new Animated.Value(0)).current;
  const confettiRef = useRef<ConfettiRef>(null);
  // Ref so loadData() can always read the latest companionName without stale-closure issues
  const companionNameRef = useRef(profile?.companion_name || "Your Companion");

  // Keep ref in sync with profile
  useEffect(() => {
    companionNameRef.current = profile?.companion_name || "Your Companion";
  }, [profile?.companion_name]);

  useEffect(() => {
    logger.info("SCREEN_VIEW: UserDashboard");
    setChallenge(dashboardService.getDailyChallenge());
    setTip(dashboardService.getRandomTip());
    loadData();

    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 800,
        useNativeDriver: true,
      }),
      Animated.spring(slideAnim, {
        toValue: 0,
        tension: 20,
        friction: 7,
        useNativeDriver: true,
      }),
    ]).start();

    // Start pulsing animation
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.2,
          duration: 1500,
          easing: Easing.linear,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 1500,
          easing: Easing.linear,
          useNativeDriver: true,
        }),
      ]),
    ).start();

    // Start floating animation
    Animated.loop(
      Animated.sequence([
        Animated.timing(floatAnim, {
          toValue: -12,
          duration: 2500,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(floatAnim, {
          toValue: 0,
          duration: 2500,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ]),
    ).start();
  }, []);

  const loadData = async () => {
    if (!user?.id) return;

    // Load mood snapshot for ALL users (free gets basic, premium gets full analytics)
    const [snapshotResult, historyResult] = await Promise.all([
      dashboardService.getMoodSnapshot(user.id),
      dashboardService.getMoodHistory(user.id),
    ]);
    setMoodStats(snapshotResult);
    setMoodHistory(historyResult);

    if (isPremium) {
      const highlight = await dashboardService.getMemoryHighlight(user.id);
      setMemoryHighlight(highlight);
    }

    const challengeObj = dashboardService.getDailyChallenge();
    const done = await dashboardService.isChallengeCompletedToday(
      user.id,
      challengeObj.id,
    );
    setIsChallengeDone(done);

    const userStats = await dashboardService.getUserStats(user.id);
    setStats(userStats);
    const userBadges = await dashboardService.getUserBadges(user.id, userStats);
    setBadges(userBadges);

    // Compute a true average intensity across history instead of just using the last entry
    const avg =
      historyResult.length > 0
        ? historyResult.reduce((sum: number, h: any) => sum + h.intensity, 0) /
          historyResult.length
        : 7;
    setEmpathyMsg(
      dashboardService.getEmpathyMessage(avg, companionNameRef.current),
    );

    // Schedule notifications based on current stats
    NotificationService.scheduleChallengeReminder();
    if (userStats.streak >= 2)
      NotificationService.scheduleStreakReminder(userStats.streak);
    NotificationService.scheduleDailyReminder(companionNameRef.current);
  };

  const handleCompleteChallenge = async () => {
    if (!user?.id || !challenge || isChallengeDone) return;
    setIsCompleting(true);
    // Optimistic update — update UI instantly, confirm with server
    setIsChallengeDone(true);
    const karmaGain = challenge.karmaValue ?? 10;
    setStats((prev) => ({ ...prev, totalKarma: prev.totalKarma + karmaGain }));
    confettiRef.current?.burst();

    const success = await dashboardService.completeChallenge(
      user.id,
      challenge.id,
      challenge.reward,
    );
    if (!success) {
      // Revert on failure
      setIsChallengeDone(false);
      setStats((prev) => ({
        ...prev,
        totalKarma: prev.totalKarma - karmaGain,
      }));
    } else {
      loadData(); // Sync real totals from server
    }
    setIsCompleting(false);
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return "Good Morning";
    if (hour < 17) return "Good Afternoon";
    return "Good Evening";
  };

  const companionName = profile?.companion_name || "Your Companion";

  // Scroll interpolation
  const headerScale = scrollY.interpolate({
    inputRange: [0, 100],
    outputRange: [1, 0.95],
    extrapolate: "clamp",
  });

  const headerOpacity = scrollY.interpolate({
    inputRange: [0, 80],
    outputRange: [1, 0],
    extrapolate: "clamp",
  });

  return (
    <View className="flex-1 bg-[#F8FAFC]">
      <StatusBar barStyle="dark-content" />

      {/* Ambient Background Blur */}
      <View
        style={{
          position: "absolute",
          top: -100,
          left: -50,
          width: 300,
          height: 300,
          backgroundColor: "rgba(79, 70, 229, 0.05)",
          borderRadius: 150,
          zIndex: -1,
        }}
      />
      <View
        style={{
          position: "absolute",
          top: 200,
          right: -50,
          width: 250,
          height: 250,
          backgroundColor: "rgba(236, 72, 153, 0.03)",
          borderRadius: 125,
          zIndex: -1,
        }}
      />

      <Animated.ScrollView
        className="flex-1"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          paddingTop: insets.top + 20,
          paddingBottom: 100,
        }}
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { y: scrollY } } }],
          { useNativeDriver: true },
        )}
        scrollEventThrottle={16}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        <Animated.View
          style={{ opacity: fadeAnim, transform: [{ translateY: slideAnim }] }}
        >
          {/* Header Section */}
          <Animated.View
            className="px-6 mb-8 flex-row justify-between items-center"
            style={{
              opacity: headerOpacity,
              transform: [{ scale: headerScale }],
            }}
          >
            <View>
              <Text
                style={{
                  fontFamily: "Manrope_600SemiBold",
                  fontSize: 13,
                  color: "#94A3B8",
                  letterSpacing: 0.5,
                  textTransform: "uppercase",
                }}
              >
                {getGreeting()}
              </Text>
              <Text
                style={{
                  fontFamily: "Rosehot",
                  fontSize: 34,
                  color: "#0F172A",
                  marginTop: 2,
                }}
              >
                Welcome home.
              </Text>
            </View>
            <View className="flex-row items-center gap-3">
              <View
                style={{
                  backgroundColor: "#FFFBEB",
                  paddingHorizontal: 12,
                  paddingVertical: 6,
                  borderRadius: 16,
                  flexDirection: "row",
                  alignItems: "center",
                  borderWidth: 1,
                  borderColor: "#FEF3C7",
                }}
              >
                <Text style={{ fontSize: 14, marginRight: 4 }}>🔥</Text>
                <Text
                  style={{
                    fontFamily: "Manrope_600SemiBold",
                    fontSize: 13,
                    color: "#D97706",
                  }}
                >
                  {stats.streak}
                </Text>
              </View>
              <View
                style={{
                  backgroundColor: "#EFF6FF",
                  paddingHorizontal: 12,
                  paddingVertical: 6,
                  borderRadius: 16,
                  flexDirection: "row",
                  alignItems: "center",
                  borderWidth: 1,
                  borderColor: "#DBEAFE",
                }}
              >
                <Text style={{ fontSize: 14, marginRight: 4 }}>💎</Text>
                <Text
                  style={{
                    fontFamily: "Manrope_600SemiBold",
                    fontSize: 13,
                    color: "#2563EB",
                  }}
                >
                  {stats.totalKarma}
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => router.push("/(main)/settings")}
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 22,
                  backgroundColor: "#fff",
                  alignItems: "center",
                  justifyContent: "center",
                  shadowColor: "#000",
                  shadowOffset: { width: 0, height: 2 },
                  shadowOpacity: 0.08,
                  shadowRadius: 4,
                  elevation: 3,
                }}
              >
                <Ionicons name="settings-outline" size={22} color="#0F172A" />
              </TouchableOpacity>
            </View>
          </Animated.View>

          {/* Companion Status Card - Premium Glassmorphism */}
          <TouchableOpacity
            onPress={() => router.push("/(main)/chat" as any)}
            activeOpacity={0.9}
            className="mx-6 mb-8"
          >
            <LinearGradient
              colors={["#0F172A", "#1E293B"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={{
                borderRadius: 32,
                padding: 24,
                shadowColor: "#000",
                shadowOffset: { width: 0, height: 12 },
                shadowOpacity: 0.25,
                shadowRadius: 16,
                elevation: 12,
                borderWidth: 1,
                borderColor: "rgba(255,255,255,0.1)",
              }}
            >
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "space-between",
                }}
              >
                <View style={{ flex: 1 }}>
                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      marginBottom: 12,
                    }}
                  >
                    <Animated.View
                      style={{
                        width: 8,
                        height: 8,
                        borderRadius: 4,
                        backgroundColor: "#10B981",
                        marginRight: 8,
                        transform: [{ scale: pulseAnim }],
                        shadowColor: "#10B981",
                        shadowRadius: 6,
                        shadowOpacity: 0.8,
                      }}
                    />
                    <Text
                      style={{
                        fontFamily: "Manrope_600SemiBold",
                        fontSize: 11,
                        color: "#10B981",
                        letterSpacing: 1.5,
                        textTransform: "uppercase",
                      }}
                    >
                      Online & Waiting
                    </Text>
                  </View>
                  <Text
                    style={{
                      fontFamily: "Rosehot",
                      fontSize: 32,
                      color: "#fff",
                      marginBottom: 6,
                    }}
                  >
                    {companionName}
                  </Text>
                  <Text
                    style={{
                      fontFamily: "Inter_400Regular",
                      fontSize: 15,
                      color: "rgba(255,255,255,0.7)",
                      lineHeight: 22,
                    }}
                  >
                    "{empathyMsg || "Thinking about you..."}"
                  </Text>
                </View>

                <Animated.View
                  style={{
                    width: 110,
                    height: 110,
                    borderRadius: 55,
                    backgroundColor: "rgba(255,255,255,0.05)",
                    alignItems: "center",
                    justifyContent: "center",
                    borderWidth: 1,
                    borderColor: "rgba(255,255,255,0.1)",
                    transform: [{ translateY: floatAnim }],
                  }}
                >
                  <LinearGradient
                    colors={["rgba(255,255,255,0.1)", "transparent"]}
                    style={{
                      position: "absolute",
                      top: 0,
                      left: 0,
                      right: 0,
                      bottom: 0,
                      borderRadius: 55,
                    }}
                  />
                  <Image
                    source={require("../../assets/images/mascot_sora.png")}
                    style={{ width: 95, height: 95, borderRadius: 47.5 }}
                    resizeMode="contain"
                  />
                </Animated.View>
              </View>

              <View
                style={{
                  marginTop: 24,
                  paddingVertical: 14,
                  borderRadius: 16,
                  backgroundColor: "rgba(255,255,255,0.1)",
                  alignItems: "center",
                  borderWidth: 1,
                  borderColor: "rgba(255,255,255,0.1)",
                }}
              >
                <Text
                  style={{
                    fontFamily: "Manrope_600SemiBold",
                    fontSize: 15,
                    color: "#fff",
                  }}
                >
                  Message Now
                </Text>
              </View>
            </LinearGradient>
          </TouchableOpacity>

          {/* Daily Challenge Card */}
          <View className="px-6 mb-8">
            <View className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100">
              <View className="flex-row items-center mb-4">
                <View className="w-10 h-10 rounded-full bg-amber-50 items-center justify-center mr-3">
                  <Text style={{ fontSize: 20 }}>
                    {isChallengeDone ? "✅" : "🎯"}
                  </Text>
                </View>
                <View>
                  <Text
                    style={{
                      fontFamily: "Manrope_600SemiBold",
                      fontSize: 15,
                      color: "#0F172A",
                    }}
                  >
                    {challenge?.title || "Daily Challenge"}
                  </Text>
                  <Text
                    style={{
                      fontFamily: "Inter_400Regular",
                      fontSize: 12,
                      color: "#64748B",
                    }}
                  >
                    {isChallengeDone
                      ? "Reward Earned ✨"
                      : `Earn ${challenge?.reward || "+20 Karma points"}`}
                  </Text>
                </View>
              </View>
              <Text
                style={{
                  fontFamily: "Inter_400Regular",
                  fontSize: 15,
                  color: "#475569",
                  lineHeight: 22,
                  marginBottom: 16,
                }}
              >
                "{challenge?.description || "Take a moment to center yourself."}
                "
              </Text>
              <TouchableOpacity
                onPress={handleCompleteChallenge}
                disabled={isChallengeDone || isCompleting}
                style={{
                  paddingVertical: 14,
                  borderRadius: 16,
                  alignItems: "center",
                  borderWidth: 1,
                  backgroundColor: isChallengeDone ? "#F0FDF4" : "#F8FAFC",
                  borderColor: isChallengeDone ? "#DCFCE7" : "#E2E8F0",
                }}
              >
                <Text
                  style={{
                    fontFamily: "Manrope_600SemiBold",
                    fontSize: 14,
                    color: isChallengeDone ? "#10B981" : "#475569",
                  }}
                >
                  {isCompleting
                    ? "Saving..."
                    : isChallengeDone
                      ? "Awesome! Challenge Completed"
                      : "I've done it!"}
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Premium Grid Widgets */}
          <View className="px-6">
            <View
              style={{
                flexDirection: "row",
                justifyContent: "space-between",
                marginBottom: 32,
              }}
            >
              {/* Mood widget */}
              <View
                style={{
                  width: "48%",
                  backgroundColor: "#fff",
                  borderRadius: 24,
                  padding: 20,
                  borderWidth: 1,
                  borderColor: "#F1F5F9",
                  shadowColor: "#000",
                  shadowOpacity: 0.05,
                  shadowRadius: 10,
                }}
              >
                <Text
                  style={{
                    fontFamily: "Manrope_600SemiBold",
                    fontSize: 13,
                    color: "#64748B",
                    marginBottom: 16,
                  }}
                >
                  Mood Cycle
                </Text>
                {isPremium ? (
                  <View>
                    <Text
                      style={{
                        fontFamily: "Manrope_700Bold",
                        fontSize: 28,
                        color: "#0F172A",
                      }}
                    >
                      {moodStats?.averageIntensity?.toFixed(1) ??
                        (moodHistory.length > 0
                          ? (
                              moodHistory.reduce(
                                (s: number, h: any) => s + h.intensity,
                                0,
                              ) / moodHistory.length
                            ).toFixed(1)
                          : "—")}
                    </Text>
                    <View
                      style={{
                        flexDirection: "row",
                        alignItems: "flex-end",
                        height: 40,
                        marginTop: 12,
                      }}
                    >
                      {moodHistory.length > 0 ? (
                        moodHistory.slice(-7).map((h: any, i: number) => (
                          <View
                            key={i}
                            style={{
                              // min height of 4px so even mood=1 renders a bar
                              height: Math.max(4, (h.intensity / 10) * 40),
                              width: 6,
                              backgroundColor:
                                i === Math.min(6, moodHistory.length - 1)
                                  ? "#6366F1"
                                  : "#E2E8F0",
                              borderRadius: 3,
                              marginRight: 4,
                            }}
                          />
                        ))
                      ) : (
                        <TouchableOpacity
                          onPress={() => router.push("/(main)/chat" as any)}
                          style={{
                            paddingVertical: 8,
                            paddingHorizontal: 12,
                            borderRadius: 12,
                            backgroundColor: "#F1F5F9",
                            borderWidth: 1,
                            borderColor: "#E2E8F0",
                            alignItems: "center",
                          }}
                        >
                          <Text
                            style={{
                              fontFamily: "Manrope_600SemiBold",
                              fontSize: 11,
                              color: "#6366F1",
                            }}
                          >
                            + Log Mood
                          </Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  </View>
                ) : (
                  <TouchableOpacity
                    onPress={() => router.push("/(modals)/paywall")}
                    style={{ alignItems: "center", paddingVertical: 10 }}
                  >
                    <Ionicons name="lock-closed" size={24} color="#CBD5E1" />
                    <Text
                      style={{
                        fontFamily: "Manrope_600SemiBold",
                        fontSize: 11,
                        color: "#94A3B8",
                        marginTop: 8,
                      }}
                    >
                      Unlock Stats
                    </Text>
                  </TouchableOpacity>
                )}
              </View>

              {/* Memory widget */}
              <View
                style={{
                  width: "48%",
                  backgroundColor: "#fff",
                  borderRadius: 24,
                  padding: 20,
                  borderWidth: 1,
                  borderColor: "#F1F5F9",
                  shadowColor: "#000",
                  shadowOpacity: 0.05,
                  shadowRadius: 10,
                }}
              >
                <Text
                  style={{
                    fontFamily: "Manrope_600SemiBold",
                    fontSize: 13,
                    color: "#64748B",
                    marginBottom: 16,
                  }}
                >
                  Remembered
                </Text>
                {isPremium ? (
                  <View>
                    <Text
                      numberOfLines={3}
                      style={{
                        fontFamily: "Inter_400Regular",
                        fontSize: 13,
                        color: "#475569",
                        lineHeight: 18,
                      }}
                    >
                      "
                      {memoryHighlight ||
                        "You mentioned you love quiet mornings with coffee."}
                      "
                    </Text>
                    <View
                      style={{
                        marginTop: 12,
                        backgroundColor: "#EEF2FF",
                        paddingHorizontal: 8,
                        paddingVertical: 4,
                        borderRadius: 8,
                        alignSelf: "flex-start",
                      }}
                    >
                      <Text
                        style={{
                          fontFamily: "Manrope_700Bold",
                          fontSize: 9,
                          color: "#6366F1",
                        }}
                      >
                        SAVED ✨
                      </Text>
                    </View>
                  </View>
                ) : (
                  <TouchableOpacity
                    onPress={() => router.push("/(modals)/paywall")}
                    style={{ alignItems: "center", paddingVertical: 10 }}
                  >
                    <Ionicons name="lock-closed" size={24} color="#CBD5E1" />
                    <Text
                      style={{
                        fontFamily: "Manrope_600SemiBold",
                        fontSize: 11,
                        color: "#94A3B8",
                        marginTop: 8,
                      }}
                    >
                      Unlock AI Memory
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          </View>

          {/* Milestones Card */}
          {badges.length > 0 && (
            <View className="px-6 mb-8">
              <View className="flex-row justify-between items-center mb-4">
                <Text
                  style={{
                    fontFamily: "Rosehot",
                    fontSize: 24,
                    color: "#0F172A",
                  }}
                >
                  Milestones
                </Text>
                <Text
                  style={{
                    fontFamily: "Manrope_600SemiBold",
                    fontSize: 12,
                    color: "#94A3B8",
                  }}
                >
                  {stats.totalKarma} Karma
                </Text>
              </View>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                className="flex-row"
                style={{ paddingBottom: 10 }}
              >
                {badges.map((badge) => {
                  const threshold = badge.threshold || 100;
                  const progress = Math.min(
                    100,
                    (stats.totalKarma / threshold) * 100,
                  );

                  return (
                    <View
                      key={badge.id}
                      style={{
                        width: 120,
                        padding: 20,
                        backgroundColor: "#fff",
                        borderRadius: 28,
                        alignItems: "center",
                        marginRight: 12,
                        borderWidth: 1,
                        borderColor: "#F1F5F9",
                        shadowColor: "#000",
                        shadowOpacity: 0.03,
                        shadowRadius: 8,
                        elevation: 1,
                      }}
                    >
                      <View
                        style={{
                          width: 64,
                          height: 64,
                          borderRadius: 32,
                          backgroundColor:
                            progress >= 100 ? "#F0FDF4" : "#F8FAFC",
                          alignItems: "center",
                          justifyContent: "center",
                          marginBottom: 12,
                        }}
                      >
                        <Text style={{ fontSize: 32 }}>{badge.icon}</Text>
                      </View>
                      <Text
                        numberOfLines={1}
                        style={{
                          fontFamily: "Manrope_700Bold",
                          fontSize: 12,
                          color: "#0F172A",
                          marginBottom: 8,
                        }}
                      >
                        {badge.name}
                      </Text>
                      <View
                        style={{
                          width: "100%",
                          height: 4,
                          backgroundColor: "#F1F5F9",
                          borderRadius: 2,
                          overflow: "hidden",
                        }}
                      >
                        <View
                          style={{
                            width: `${progress}%`,
                            height: "100%",
                            backgroundColor:
                              progress >= 100 ? "#10B981" : "#6366F1",
                          }}
                        />
                      </View>
                    </View>
                  );
                })}
              </ScrollView>
            </View>
          )}

          {/* Self-Care Hub - State of the Art Grid */}
          <View className="px-6 mb-10">
            <Text
              style={{
                fontFamily: "Rosehot",
                fontSize: 24,
                color: "#0F172A",
                marginBottom: 20,
              }}
            >
              Self-Care Sanctuary
            </Text>
            <View className="flex-row gap-4 h-[220]">
              {/* Breathing Large Card */}
              <TouchableOpacity
                onPress={() => router.push("/(main)/breathing" as any)}
                activeOpacity={0.9}
                style={{ flex: 1.2 }}
              >
                <LinearGradient
                  colors={["#fff", "#FDF2F8"]}
                  style={{
                    flex: 1,
                    borderRadius: 32,
                    padding: 24,
                    justifyContent: "space-between",
                    borderWidth: 1,
                    borderColor: "#FCE7F3",
                    shadowColor: "#F43F5E",
                    shadowOffset: { width: 0, height: 4 },
                    shadowOpacity: 0.05,
                    shadowRadius: 10,
                    elevation: 2,
                  }}
                >
                  <View
                    style={{
                      width: 52,
                      height: 52,
                      borderRadius: 16,
                      backgroundColor: "#FFF1F2",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <Text style={{ fontSize: 26 }}>🫁</Text>
                  </View>
                  <View>
                    <Text
                      style={{
                        fontFamily: "Manrope_600SemiBold",
                        fontSize: 18,
                        color: "#E11D48",
                      }}
                    >
                      Breathing
                    </Text>
                    <Text
                      style={{
                        fontFamily: "Inter_400Regular",
                        fontSize: 12,
                        color: "#FDA4AF",
                        marginTop: 4,
                      }}
                    >
                      Regulate your flow
                    </Text>
                  </View>
                </LinearGradient>
              </TouchableOpacity>

              <View className="flex-1 gap-4">
                {/* Meditation card */}
                <TouchableOpacity
                  onPress={() => router.push("/(main)/meditation" as any)}
                  activeOpacity={0.9}
                  style={{ flex: 1 }}
                >
                  <View
                    style={{
                      flex: 1,
                      backgroundColor: "#fff",
                      borderRadius: 28,
                      padding: 16,
                      justifyContent: "center",
                      alignItems: "center",
                      borderWidth: 1,
                      borderColor: "#F3E8FF",
                      shadowColor: "#9333EA",
                      shadowOpacity: 0.05,
                      shadowRadius: 6,
                      elevation: 1,
                    }}
                  >
                    <Text style={{ fontSize: 28, marginBottom: 6 }}>🧘</Text>
                    <Text
                      style={{
                        fontFamily: "Manrope_600SemiBold",
                        fontSize: 14,
                        color: "#9333EA",
                      }}
                    >
                      Meditation
                    </Text>
                  </View>
                </TouchableOpacity>

                {/* Crisis card */}
                <TouchableOpacity
                  onPress={() => router.push("/(main)/emergency" as any)}
                  activeOpacity={0.9}
                  style={{ flex: 1 }}
                >
                  <View
                    style={{
                      flex: 1,
                      backgroundColor: "#fff",
                      borderRadius: 28,
                      padding: 16,
                      justifyContent: "center",
                      alignItems: "center",
                      borderWidth: 1,
                      borderColor: "#ECFDF5",
                      shadowColor: "#10B981",
                      shadowOpacity: 0.05,
                      shadowRadius: 6,
                      elevation: 1,
                    }}
                  >
                    <Text style={{ fontSize: 28, marginBottom: 6 }}>🆘</Text>
                    <Text
                      style={{
                        fontFamily: "Manrope_600SemiBold",
                        fontSize: 14,
                        color: "#059669",
                      }}
                    >
                      Calm Now
                    </Text>
                  </View>
                </TouchableOpacity>
              </View>
            </View>
          </View>

          {/* Coaching Tip Section */}
          <View className="px-6 mb-12">
            <View
              style={{
                backgroundColor: "#F8FAFC",
                borderRadius: 24,
                padding: 24,
                borderWidth: 1,
                borderColor: "#E2E8F0",
              }}
            >
              <View className="flex-row items-center mb-4">
                <Ionicons name="bulb" size={20} color="#F59E0B" />
                <Text
                  style={{
                    fontFamily: "Manrope_600SemiBold",
                    fontSize: 13,
                    color: "#64748B",
                    marginLeft: 8,
                    textTransform: "uppercase",
                    letterSpacing: 0.5,
                  }}
                >
                  {tip?.category || "Insight"}
                </Text>
              </View>
              <Text
                style={{
                  fontFamily: "Inter_400Regular",
                  fontSize: 15,
                  color: "#475569",
                  lineHeight: 24,
                }}
              >
                "
                {tip?.content ||
                  "Connecting with others is key to resilience. Try reaching out to a friend or simply telling me about your day."}
                "
              </Text>
            </View>
          </View>
        </Animated.View>
      </Animated.ScrollView>

      {/* Persistent Navigation */}
      <BottomNav />

      {/* Confetti overlay — renders above everything */}
      <ConfettiOverlay ref={confettiRef} />
    </View>
  );
}
