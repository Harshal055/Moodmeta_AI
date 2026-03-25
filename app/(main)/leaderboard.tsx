import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
    ActivityIndicator,
    Image,
    RefreshControl,
    ScrollView,
    StatusBar,
    Text,
    TouchableOpacity,
    View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "../../hooks/useAuth";
import {
    LeaderboardPeriod,
    leaderboardService,
    type LeaderboardEntry,
    type UserKarmaSummary,
} from "../../services/leaderboardService";

const PERIODS: Array<{ key: LeaderboardPeriod; label: string }> = [
  { key: "weekly", label: "Weekly" },
  { key: "monthly", label: "Monthly" },
  { key: "alltime", label: "All-time" },
];

function getAvatarPlaceholder(name: string, id: number) {
  // Use a pseudo-random but deterministic placeholder based on rank to keep it dynamic but stable
  return `https://i.pravatar.cc/150?u=${name.replace(/\s+/g, '')}${id}`;
}

export default function LeaderboardScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const user = useAuth((s) => s.currentUser);
  const profile = useAuth((s) => s.profile);

  const [period, setPeriod] = useState<LeaderboardPeriod>("weekly");
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [mySummary, setMySummary] = useState<UserKarmaSummary>({
    currentKarma: 0,
    todayGain: 0,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadLeaderboard = useCallback(async () => {
    if (!user?.id) {
      setEntries([]);
      setIsLoading(false);
      return;
    }

    const [data, summary] = await Promise.all([
      leaderboardService.getLeaderboard(user.id, period, 50),
      leaderboardService.getUserKarmaSummary(user.id, period),
    ]);
    setEntries(data);
    setMySummary(summary);
    setIsLoading(false);
  }, [user?.id, period]);

  useEffect(() => {
    setIsLoading(true);
    loadLeaderboard();
  }, [loadLeaderboard]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadLeaderboard();
    setRefreshing(false);
  }, [loadLeaderboard]);

  const sortedEntries = useMemo(
    () => [...entries].sort((a, b) => a.rank - b.rank),
    [entries],
  );
  
  const meEntry = useMemo(
    () => sortedEntries.find((e) => e.isMe) || null,
    [sortedEntries],
  );

  return (
    <View style={{ flex: 1, backgroundColor: "#F8F9FA" }}>
      <StatusBar barStyle="dark-content" />

      {/* Header */}
      <View
        style={{
          paddingTop: insets.top + 16,
          paddingHorizontal: 24,
          paddingBottom: 16,
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "center",
          position: "relative",
          backgroundColor: "#F8F9FA",
          zIndex: 10,
        }}
      >
        <TouchableOpacity
          onPress={() => {
            if (router.canGoBack()) {
              router.back();
            } else {
              router.replace("/(main)/dashboard");
            }
          }}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          style={{ position: "absolute", left: 24, top: insets.top + 16 }}
        >
          <Ionicons name="arrow-back" size={24} color="#0f172a" />
        </TouchableOpacity>
        
        <Text style={{ fontFamily: "Inter_700Bold", fontSize: 18, color: "#0f172a" }}>
          Leaderboard
        </Text>
      </View>

      {/* Tabs */}
      <View style={{ flexDirection: "row", borderBottomWidth: 1, borderBottomColor: "#E2E8F0", paddingHorizontal: 24 }}>
        {PERIODS.map((p) => {
          const active = period === p.key;
          return (
            <TouchableOpacity
              key={p.key}
              onPress={() => setPeriod(p.key)}
              style={{
                flex: 1,
                paddingVertical: 12,
                alignItems: "center",
                borderBottomWidth: active ? 3 : 0,
                borderBottomColor: "#3114D3",
              }}
            >
              <Text
                style={{
                  fontFamily: active ? "Inter_700Bold" : "Inter_500Medium",
                  fontSize: 14,
                  color: active ? "#3114D3" : "#64748B",
                }}
              >
                {p.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          paddingTop: 16,
          paddingBottom: insets.bottom + 120, // Extra padding for sticky footer
          paddingHorizontal: 16,
        }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {isLoading ? (
          <View style={{ alignItems: "center", justifyContent: "center", paddingVertical: 40 }}>
            <ActivityIndicator size="large" color="#3114D3" />
          </View>
        ) : entries.length === 0 ? (
          <View style={{ paddingVertical: 40, alignItems: "center" }}>
            <Text style={{ fontFamily: "Inter_500Medium", fontSize: 15, color: "#94A3B8" }}>
              No leaderboard data yet.
            </Text>
          </View>
        ) : (
          <View style={{ gap: 12 }}>
            {sortedEntries.map((entry) => {
              const isTop3 = entry.rank <= 3;
              
              let colors = {
                 border: "transparent",
                 pillBg: "#fff",
                 pillText: "#94A3B8",
                 medal: "#94A3B8",
                 karmaText: "#94A3B8",
              };

              if (entry.rank === 1) {
                 colors = { border: "#FBBF24", pillBg: "#fff", pillText: "#FBBF24", medal: "#FBBF24", karmaText: "#3114D3" };
              } else if (entry.rank === 2) {
                 colors = { border: "#CBD5E1", pillBg: "#fff", pillText: "#94A3B8", medal: "#94A3B8", karmaText: "#94A3B8" };
              } else if (entry.rank === 3) {
                 colors = { border: "#D97706", pillBg: "#fff", pillText: "#D97706", medal: "#D97706", karmaText: "#94A3B8" };
              }

              if (isTop3) {
                 return (
                   <View
                     key={entry.rank}
                     style={{
                       backgroundColor: "#fff",
                       borderRadius: 16,
                       padding: 16,
                       flexDirection: "row",
                       alignItems: "center",
                       shadowColor: "#000",
                       shadowOffset: { width: 0, height: 2 },
                       shadowOpacity: 0.05,
                       shadowRadius: 8,
                       elevation: 2,
                     }}
                   >
                     {/* Avatar Area */}
                     <View style={{ position: "relative", marginRight: 16 }}>
                       <Image
                         source={{ uri: entry.isMe && profile?.avatar_url ? profile.avatar_url : getAvatarPlaceholder(entry.displayName, entry.rank) }}
                         style={{ 
                            width: 56, 
                            height: 56, 
                            borderRadius: 28, 
                            borderWidth: 3, 
                            borderColor: colors.border
                         }}
                       />
                       {/* Floating Rank Pill */}
                       <View
                         style={{
                           position: "absolute",
                           top: -4,
                           left: -4,
                           backgroundColor: colors.pillBg,
                           borderRadius: 12,
                           width: 20,
                           height: 20,
                           alignItems: "center",
                           justifyContent: "center",
                           shadowColor: "#000",
                           shadowOffset: { width: 0, height: 1 },
                           shadowOpacity: 0.1,
                           shadowRadius: 2,
                           elevation: 1,
                         }}
                       >
                         <Text style={{ fontFamily: "Inter_700Bold", fontSize: 10, color: colors.pillText }}>
                           {entry.rank}
                         </Text>
                       </View>
                     </View>

                     {/* User Info */}
                     <View style={{ flex: 1 }}>
                       <Text style={{ fontFamily: "Inter_700Bold", fontSize: 16, color: "#0f172a", marginBottom: 2 }}>
                         {entry.displayName}
                       </Text>
                       <Text style={{ fontFamily: "Inter_500Medium", fontSize: 14, color: colors.karmaText }}>
                         {entry.karma.toLocaleString()} Karma
                       </Text>
                     </View>

                     {/* Medal Icon */}
                     <Ionicons name="medal" size={28} color={colors.medal} />
                   </View>
                 );
              }

              // Rank 4+ List View
              return (
                 <View
                   key={entry.rank}
                   style={{
                     flexDirection: "row",
                     alignItems: "center",
                     paddingHorizontal: 8,
                     paddingVertical: 10,
                   }}
                 >
                   {/* Big Number Rank */}
                   <Text style={{ fontFamily: "Inter_700Bold", fontSize: 18, color: "#94A3B8", width: 32, textAlign: "center" }}>
                     {entry.rank}
                   </Text>
                   
                   {/* Avatar */}
                   <Image
                      source={{ uri: entry.isMe && profile?.avatar_url ? profile.avatar_url : getAvatarPlaceholder(entry.displayName, entry.rank) }}
                      style={{ width: 44, height: 44, borderRadius: 22, marginHorizontal: 16 }}
                   />

                   {/* User Info */}
                   <View style={{ flex: 1 }}>
                     <Text style={{ fontFamily: "Inter_700Bold", fontSize: 15, color: "#0f172a", marginBottom: 2 }}>
                       {entry.displayName}
                     </Text>
                     <Text style={{ fontFamily: "Inter_500Medium", fontSize: 11, color: "#94A3B8", letterSpacing: 0.5 }}>
                       {entry.karma.toLocaleString()} KARMA
                     </Text>
                   </View>
                 </View>
              );
            })}
          </View>
        )}
      </ScrollView>

      {/* Sticky Bottom "You" Footer */}
      {!isLoading && meEntry && (
        <View
          style={{
            position: "absolute",
            bottom: Math.max(insets.bottom + 16, 24),
            left: 16,
            right: 16,
            backgroundColor: "#2013C9",
            borderRadius: 16,
            padding: 16,
            flexDirection: "row",
            alignItems: "center",
            shadowColor: "#2013C9",
            shadowOffset: { width: 0, height: 8 },
            shadowOpacity: 0.3,
            shadowRadius: 16,
            elevation: 8,
          }}
        >
          {/* Avatar Area */}
          <View style={{ position: "relative", marginRight: 16 }}>
            <Image
              source={profile?.avatar_url ? { uri: profile.avatar_url } : require("../../assets/images/logo.png")}
              style={{ width: 48, height: 48, borderRadius: 24, borderWidth: 2, borderColor: "rgba(255,255,255,0.2)" }}
            />
            {/* Floating Rank Pill */}
            <View
              style={{
                position: "absolute",
                top: -2,
                left: -6,
                backgroundColor: "#fff",
                borderRadius: 12,
                width: 22,
                height: 22,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Text style={{ fontFamily: "Inter_700Bold", fontSize: 10, color: "#2013C9" }}>
                {meEntry.rank}
              </Text>
            </View>
          </View>

          {/* User Info */}
          <View style={{ flex: 1 }}>
            <Text style={{ fontFamily: "Inter_700Bold", fontSize: 16, color: "#fff", marginBottom: 2 }}>
              You
            </Text>
            <Text style={{ fontFamily: "Inter_400Regular", fontSize: 13, color: "rgba(255,255,255,0.8)" }}>
              Rank #{meEntry.rank}
            </Text>
          </View>

          {/* Karma Info */}
          <View style={{ alignItems: "flex-end" }}>
            <Text style={{ fontFamily: "Inter_700Bold", fontSize: 18, color: "#fff", marginBottom: 2 }}>
              {meEntry.karma.toLocaleString()}
            </Text>
            <Text style={{ fontFamily: "Inter_500Medium", fontSize: 10, color: "rgba(255,255,255,0.8)", letterSpacing: 0.5 }}>
              KARMA POINTS
            </Text>
          </View>
        </View>
      )}

    </View>
  );
}
