import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import {
    BackHandler,
    Image,
    RefreshControl,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "../../hooks/useAuth";
import { supabase } from "../../lib/supabase";
import { logger } from "../../utils/logger";

interface Overview {
    totalUsers: number;
    newUsersToday: number;
    newUsersWeek: number;
    totalMessages: number;
    premiumUsers: number;
    avgRating: string;
}

interface ChatStats {
    dailyMsgData: { day: string; count: number }[];
    totalMessages: number;
    avgMessagesPerUser: number;
    peakHour: number;
    topUsers: { companion_name: string; user_id: string }[];
}

interface MoodStats {
    moodTrendData: { day: string; avg_rating: number }[];
    moodBreakdown: Record<string, number>;
    commonMood: string;
    logPercentage: number;
}

interface RevenueStats {
    premiumUsers: number;
    totalUsers: number;
    conversionRate: number;
    monthlyRevenue: number;
    planSplit: { monthly: number; annual: number };
}

interface RetentionStats {
    d1: number;
    d7: number;
    d30: number;
    activeStreaks: number;
    churnedThisWeek: number;
}

interface Feedback {
    id: string;
    rating: number;
    message: string;
    created_at: string;
    profiles?: {
        companion_name: string;
        role: string;
    };
}

interface DashboardData {
    overview: Overview;
    chat: ChatStats;
    mood: MoodStats;
    revenue: RevenueStats;
    retention: RetentionStats;
    feedback: Feedback[];
}

// Custom Visualization Components
const LineChart = ({ data, color, height = 100 }: { data: number[], color: string, height?: number }) => {
    const max = Math.max(...data, 1);
    return (
        <View style={[styles.chartContainer, { height }]}>
            <View style={styles.chartLineArea}>
                {data.map((val, i) => (
                    <View key={i} style={styles.lineBarContainer}>
                        <View style={[styles.lineBar, {
                            height: (val / max) * 100 + "%" as any,
                            backgroundColor: color,
                            opacity: 0.3 + (i / data.length) * 0.7
                        }]} />
                    </View>
                ))}
            </View>
        </View>
    );
};

const MiniPieChart = ({ percent, color }: { percent: number, color: string }) => (
    <View style={styles.pieContainer}>
        <View style={[styles.pieCircle, { backgroundColor: "#EEE" }]}>
            <View style={[styles.pieFill, {
                backgroundColor: color,
                width: percent + "%" as any
            }]} />
        </View>
        <Text style={styles.pieLabel}>{Math.round(percent)}%</Text>
    </View>
);

export default function AdminDashboard() {
    const router = useRouter();
    const insets = useSafeAreaInsets();
    const { currentUser, session, isLoading: isAuthLoading } = useAuth();

    const [data, setData] = useState<DashboardData | null>(null);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [activeTab, setActiveTab] = useState<"overview" | "chat" | "mood" | "revenue" | "retention" | "feedback">("overview");

    const fetchAnalytics = async () => {
        if (!session?.access_token) {
            logger.warn("AdminDashboard: Skipping fetch, no session");
            return;
        }

        try {
            setLoading(true);
            const { data: analytics, error } = await supabase.functions.invoke("analytics", {
                headers: {
                    Authorization: `Bearer ${session.access_token}`
                },
            });

            if (error) {
                console.error("Edge Function Error Detail:", error);
                throw error;
            }

            if (analytics) {
                setData(analytics as DashboardData);
            }
        } catch (err: any) {
            logger.error("AdminDashboard: Failed to fetch analytics", err);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    useEffect(() => {
        // Wait for auth to fully initialize before making decisions
        if (isAuthLoading || !currentUser) return;

        if (currentUser.email !== "harsh@moodmateai.com") {
            router.replace("/(main)/settings");
            return;
        }

        // Only fetch if we have a valid session
        if (session?.access_token) {
            fetchAnalytics();
        }
    }, [currentUser, session, isAuthLoading]);

    // Handle android hardware back button manually to prevent app exit 
    // when arriving via router.replace
    useEffect(() => {
        const backAction = () => {
            if (router.canGoBack()) {
                router.back();
            } else {
                router.replace("/(main)/chat");
            }
            return true;
        };

        const backHandler = BackHandler.addEventListener(
            "hardwareBackPress",
            backAction
        );

        return () => backHandler.remove();
    }, [router]);

    const onRefresh = () => {
        setRefreshing(true);
        fetchAnalytics();
    };

    const renderCard = (title: string, value: string | number, icon: any, color: string, subtitle?: string) => (
        <View style={styles.statCard}>
            <View style={[styles.statIconContainer, { backgroundColor: color + "15" }]}>
                <Ionicons name={icon} size={20} color={color} />
            </View>
            <Text style={styles.statValue}>{value}</Text>
            <Text style={styles.statTitle}>{title}</Text>
            {subtitle && <Text style={styles.statSubtitle}>{subtitle}</Text>}
        </View>
    );

    const renderProgressBar = (label: string, value: number, max: number, color: string, key?: string) => (
        <View key={key} style={styles.barItem}>
            <View style={styles.barHeader}>
                <Text style={styles.barLabel}>{label}</Text>
                <Text style={styles.barValue}>{Math.round(value)}%</Text>
            </View>
            <View style={styles.barBg}>
                <View style={[styles.barFill, { width: `${(value / max) * 100}%`, backgroundColor: color }]} />
            </View>
        </View>
    );

    if (loading && !refreshing) {
        return (
            <View style={styles.centered}>
                <Image
                    source={require("../../assets/images/logo.png")}
                    style={{ width: 64, height: 64, marginBottom: 16 }}
                    resizeMode="contain"
                />
                <Text style={styles.loadingText}>Loading owner console...</Text>
            </View>
        );
    }

    if (!data) return (
        <View style={styles.centered}>
            <Ionicons name="alert-circle-outline" size={48} color="#FF6B6B" />
            <Text style={styles.errorText}>Failed to load analytics.</Text>
            <TouchableOpacity onPress={onRefresh} style={styles.retryButton}>
                <Text style={styles.retryButtonText}>Retry</Text>
            </TouchableOpacity>
        </View>
    );

    return (
        <View style={[styles.container, { paddingTop: insets.top }]}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => {
                    if (router.canGoBack()) {
                        router.back();
                    } else {
                        router.replace("/(main)/chat");
                    }
                }} style={styles.backButton}>
                    <Ionicons name="chevron-back" size={24} color="#1a1a2e" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Owner Console</Text>
                <TouchableOpacity onPress={onRefresh} style={styles.backButton}>
                    <Ionicons name="refresh" size={20} color="#666" />
                </TouchableOpacity>
            </View>

            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tabScroll} contentContainerStyle={styles.tabBarScroll}>
                {(["overview", "chat", "mood", "revenue", "retention", "feedback"] as const).map((tab) => (
                    <TouchableOpacity
                        key={tab}
                        onPress={() => setActiveTab(tab)}
                        style={[styles.tab, activeTab === tab && styles.activeTab]}
                    >
                        <Text style={[styles.tabText, activeTab === tab && styles.activeTabText]}>
                            {tab.charAt(0).toUpperCase() + tab.slice(1)}
                        </Text>
                    </TouchableOpacity>
                ))}
            </ScrollView>

            <ScrollView
                style={styles.content}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
                contentContainerStyle={{ paddingBottom: insets.bottom + 40 }}
            >
                {activeTab === "overview" && (
                    <View style={styles.statsGrid}>
                        {renderCard("Total Users", data.overview.totalUsers, "people", "#4361EE")}
                        {renderCard("New Today", data.overview.newUsersToday, "add-circle", "#4CC9F0")}
                        {renderCard("New This Week", data.overview.newUsersWeek, "calendar", "#4895EF")}
                        {renderCard("Total Messages", data.overview.totalMessages, "chatbubbles", "#7209B7")}
                        {renderCard("Premium Users", data.overview.premiumUsers, "star", "#F72585")}
                        {renderCard("Avg Rating", data.overview.avgRating, "star-half", "#FFB703")}
                    </View>
                )}

                {activeTab === "chat" && (
                    <View style={styles.tabContent}>
                        <View style={styles.sectionHeader}>
                            <Text style={styles.sectionTitle}>Chat Engagement</Text>
                        </View>
                        <View style={styles.miniChartBox}>
                            <Text style={styles.miniChartTitle}>Daily Message Volume (Last 30d)</Text>
                            <LineChart data={data.chat.dailyMsgData.map(d => d.count)} color="#4361EE" />
                        </View>
                        <View style={styles.statsGrid}>
                            {renderCard("Avg Msgs/User", data.chat.avgMessagesPerUser.toFixed(1), "stats-chart", "#3A0CA3")}
                            {renderCard("Peak Hour", `${data.chat.peakHour}:00`, "time", "#3F37C9")}
                        </View>
                        <View style={styles.listSection}>
                            <Text style={styles.listSectionTitle}>Top 5 Active Companions</Text>
                            {data.chat.topUsers.map((u, i) => (
                                <View key={i} style={styles.listItem}>
                                    <View style={styles.listItemRank}>
                                        <Text style={styles.rankText}>#{i + 1}</Text>
                                    </View>
                                    <Text style={styles.listItemText}>{u.companion_name || "Unknown"}</Text>
                                    <View style={{ flex: 1 }} />
                                    <Ionicons name="flash" size={14} color="#FFB703" />
                                </View>
                            ))}
                        </View>
                    </View>
                )}

                {activeTab === "mood" && (
                    <View style={styles.tabContent}>
                        <View style={styles.miniChartBox}>
                            <Text style={styles.miniChartTitle}>Mood Trajectory (Avg Score)</Text>
                            <LineChart data={data.mood.moodTrendData.map(d => Number(d.avg_rating))} color="#EF476F" />
                        </View>
                        <View style={styles.miniChartBox}>
                            <Text style={styles.miniChartTitle}>Score Distribution (1-5)</Text>
                            {Object.entries(data.mood.moodBreakdown).map(([r, c]) => (
                                renderProgressBar(`${r} Stars`, (c / (data.overview.totalUsers || 1)) * 100, 100, "#06D6A0", r)
                            ))}
                        </View>
                        <View style={styles.statsGrid}>
                            {renderCard("Log Freq", data.mood.logPercentage + "%", "journal", "#118AB2", "Users logging daily")}
                        </View>
                    </View>
                )}

                {activeTab === "revenue" && (
                    <View style={styles.tabContent}>
                        <View style={styles.statsGrid}>
                            {renderCard("Conversion", data.revenue.conversionRate + "%", "cash", "#073B4C")}
                            {renderCard("Est. Monthly", `$${data.revenue.monthlyRevenue.toFixed(0)}`, "analytics", "#06D6A0")}
                        </View>
                        <View style={styles.miniChartBox}>
                            <Text style={styles.miniChartTitle}>Free vs Premium Ratio</Text>
                            <View style={{ flexDirection: "row", justifyContent: "space-around" }}>
                                <MiniPieChart percent={data.revenue.conversionRate} color="#F72585" />
                                <View style={styles.legend}>
                                    <View style={styles.legendItem}><View style={[styles.dot, { backgroundColor: "#F72585" }]} /><Text style={styles.legendText}>Premium</Text></View>
                                    <View style={styles.legendItem}><View style={[styles.dot, { backgroundColor: "#EEE" }]} /><Text style={styles.legendText}>Free</Text></View>
                                </View>
                            </View>
                        </View>
                        <View style={styles.miniChartBox}>
                            <Text style={styles.miniChartTitle}>Plan Comparison</Text>
                            {renderProgressBar("Monthly Plan", data.revenue.planSplit.monthly, 100, "#4361EE")}
                            {renderProgressBar("Annual Plan", data.revenue.planSplit.annual, 100, "#4CC9F0")}
                        </View>
                    </View>
                )}

                {activeTab === "retention" && (
                    <View style={styles.tabContent}>
                        <View style={styles.miniChartBox}>
                            <Text style={styles.miniChartTitle}>Retention Benchmarks</Text>
                            {renderProgressBar("Day 1 Retention", data.retention.d1, 100, "#4361EE")}
                            {renderProgressBar("Day 7 Retention", data.retention.d7, 100, "#3F37C9")}
                            {renderProgressBar("Day 30 Retention", data.retention.d30, 100, "#3A0CA3")}
                        </View>
                        <View style={styles.statsGrid}>
                            {renderCard("Active Streaks", data.retention.activeStreaks, "flame", "#FF9F1C")}
                            {renderCard("Churn Week", data.retention.churnedThisWeek, "exit", "#E71D36")}
                        </View>
                    </View>
                )}

                {activeTab === "feedback" && (
                    <View style={styles.tabContent}>
                        <View style={styles.listSection}>
                            <View style={styles.sectionHeader}>
                                <Text style={styles.sectionTitle}>User Experience Audit</Text>
                                <Text style={styles.sectionSubtitle}>{data.overview.avgRating} / 5.0 Average</Text>
                            </View>
                            {data.feedback.map((f) => (
                                <View key={f.id} style={styles.feedbackCard}>
                                    <View style={styles.feedbackTop}>
                                        <Text style={styles.feedbackStars}>{"⭐".repeat(f.rating)}</Text>
                                        <Text style={styles.feedbackTime}>{new Date(f.created_at).toLocaleDateString()}</Text>
                                    </View>
                                    <Text style={styles.feedbackText}>{f.message}</Text>
                                    {f.profiles && <Text style={styles.feedbackAuthor}>— {f.profiles.companion_name || "MoodMate User"}</Text>}
                                </View>
                            ))}
                        </View>
                    </View>
                )}
            </ScrollView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: "#F8FBFF",
    },
    centered: {
        flex: 1,
        justifyContent: "center",
        alignItems: "center",
        padding: 20,
    },
    header: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        paddingHorizontal: 16,
        paddingVertical: 12,
    },
    backButton: {
        padding: 8,
    },
    headerTitle: {
        fontSize: 20,
        fontFamily: "Manrope_700Bold",
        color: "#1a1a2e",
    },
    tabScroll: {
        maxHeight: 50,
        marginBottom: 10,
    },
    tabBarScroll: {
        paddingHorizontal: 20,
        height: 50,
        alignItems: "center",
    },
    tab: {
        paddingHorizontal: 16,
        paddingVertical: 8,
        marginRight: 8,
        borderRadius: 12,
        backgroundColor: "#F0F0F0",
    },
    activeTab: {
        backgroundColor: "#1a1a2e",
    },
    tabText: {
        fontFamily: "Inter_500Medium",
        color: "#666",
    },
    activeTabText: {
        color: "#FFF",
    },
    content: {
        flex: 1,
        paddingHorizontal: 20,
    },
    statsGrid: {
        flexDirection: "row",
        flexWrap: "wrap",
        justifyContent: "space-between",
    },
    statCard: {
        width: "48%",
        backgroundColor: "#FFF",
        borderRadius: 20,
        padding: 16,
        marginBottom: 16,
        borderWidth: 1,
        borderColor: "#F0F0F0",
    },
    statIconContainer: {
        width: 40,
        height: 40,
        borderRadius: 12,
        alignItems: "center",
        justifyContent: "center",
        marginBottom: 12,
    },
    statValue: {
        fontSize: 22,
        fontFamily: "Manrope_700Bold",
        color: "#1a1a2e",
    },
    statTitle: {
        fontSize: 12,
        fontFamily: "Inter_500Medium",
        color: "#888",
        marginTop: 4,
    },
    statSubtitle: {
        fontSize: 10,
        fontFamily: "Inter_400Regular",
        color: "#BBB",
        marginTop: 2,
    },
    sectionHeader: {
        marginBottom: 16,
    },
    sectionTitle: {
        fontSize: 18,
        fontFamily: "Manrope_700Bold",
        color: "#1a1a2e",
    },
    sectionSubtitle: {
        fontSize: 14,
        fontFamily: "Inter_500Medium",
        color: "#666",
        marginTop: 4,
    },
    tabContent: {
        flex: 1,
    },
    miniChartBox: {
        backgroundColor: "#FFF",
        borderRadius: 20,
        padding: 20,
        marginBottom: 20,
        borderWidth: 1,
        borderColor: "#F0F0F0",
    },
    miniChartTitle: {
        fontSize: 14,
        fontFamily: "Manrope_700Bold",
        color: "#1a1a2e",
        marginBottom: 16,
    },
    chartContainer: {
        width: "100%",
        justifyContent: "center",
    },
    chartLineArea: {
        flexDirection: "row",
        alignItems: "flex-end",
        height: "100%",
        gap: 4,
    },
    lineBarContainer: {
        flex: 1,
        height: "100%",
        justifyContent: "flex-end",
    },
    lineBar: {
        borderRadius: 4,
        width: "100%",
    },
    pieContainer: {
        alignItems: "center",
    },
    pieCircle: {
        width: 80,
        height: 80,
        borderRadius: 40,
        backgroundColor: "#EEE",
        overflow: "hidden",
        justifyContent: "center",
        alignItems: "center",
    },
    pieFill: {
        position: "absolute",
        left: 0,
        height: "100%",
    },
    pieLabel: {
        marginTop: 8,
        fontSize: 14,
        fontFamily: "Manrope_700Bold",
        color: "#1a1a2e",
    },
    legend: {
        justifyContent: "center",
    },
    legendItem: {
        flexDirection: "row",
        alignItems: "center",
        marginBottom: 8,
    },
    dot: {
        width: 10,
        height: 10,
        borderRadius: 5,
        marginRight: 8,
    },
    legendText: {
        fontSize: 12,
        fontFamily: "Inter_500Medium",
        color: "#666",
    },
    barItem: {
        marginBottom: 16,
    },
    barHeader: {
        flexDirection: "row",
        justifyContent: "space-between",
        marginBottom: 6,
    },
    barLabel: {
        fontSize: 12,
        fontFamily: "Inter_500Medium",
        color: "#666",
    },
    barValue: {
        fontSize: 12,
        fontFamily: "Manrope_700Bold",
        color: "#1a1a2e",
    },
    barBg: {
        height: 8,
        backgroundColor: "#F0F0F0",
        borderRadius: 4,
        overflow: "hidden",
    },
    barFill: {
        height: "100%",
        borderRadius: 4,
    },
    listSection: {
        marginBottom: 24,
    },
    listSectionTitle: {
        fontSize: 14,
        fontFamily: "Manrope_700Bold",
        color: "#1a1a2e",
        marginBottom: 12,
    },
    listItem: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        backgroundColor: "#FFF",
        padding: 16,
        borderRadius: 16,
        marginBottom: 8,
        borderWidth: 1,
        borderColor: "#F0F0F0",
    },
    listItemRank: {
        width: 32,
        height: 32,
        backgroundColor: "#F0F0F0",
        borderRadius: 16,
        justifyContent: "center",
        alignItems: "center",
        marginRight: 12,
    },
    rankText: {
        fontSize: 12,
        fontFamily: "Manrope_700Bold",
        color: "#666",
    },
    listItemText: {
        fontSize: 14,
        fontFamily: "Inter_500Medium",
        color: "#444",
    },
    feedbackCard: {
        backgroundColor: "#FFF",
        padding: 16,
        borderRadius: 20,
        marginBottom: 12,
        borderWidth: 1,
        borderColor: "#F0F0F0",
    },
    feedbackTop: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        marginBottom: 8,
    },
    feedbackStars: {
        fontSize: 12,
    },
    feedbackTime: {
        fontSize: 11,
        fontFamily: "Inter_400Regular",
        color: "#BBB",
    },
    feedbackText: {
        fontSize: 14,
        fontFamily: "Inter_400Regular",
        color: "#444",
        lineHeight: 20,
    },
    feedbackAuthor: {
        fontSize: 11,
        fontFamily: "Inter_500Medium",
        color: "#999",
        marginTop: 8,
        fontStyle: "italic",
    },
    loadingText: {
        marginTop: 12,
        fontFamily: "Inter_500Medium",
        color: "#888",
    },
    errorText: {
        fontSize: 16,
        fontFamily: "Inter_500Medium",
        color: "#FF6B6B",
        marginTop: 16,
        marginBottom: 24,
    },
    retryButton: {
        backgroundColor: "#1a1a2e",
        paddingHorizontal: 24,
        paddingVertical: 12,
        borderRadius: 12,
    },
    retryButtonText: {
        color: "#FFF",
        fontFamily: "Manrope_700Bold",
    },
});
