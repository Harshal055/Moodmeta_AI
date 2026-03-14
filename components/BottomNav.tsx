import { Ionicons } from "@expo/vector-icons";
import { usePathname, useRouter } from "expo-router";
import { Text, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export default function BottomNav() {
    const router = useRouter();
    const pathname = usePathname();
    const insets = useSafeAreaInsets();

    const navItems = [
        {
            id: "home",
            label: "Home",
            icon: "home",
            outlineIcon: "home-outline",
            route: "/dashboard"
        },
        {
            id: "chat",
            label: "Chat",
            icon: "chatbubble-ellipses",
            outlineIcon: "chatbubble-ellipses-outline",
            route: "/chat"
        },
        {
            id: "settings",
            label: "Settings",
            icon: "settings",
            outlineIcon: "settings-outline",
            route: "/settings"
        }
    ];

    return (
        <View style={{ position: "absolute", bottom: insets.bottom + 10, left: 24, right: 24 }}>
            <View
                style={{
                    backgroundColor: "rgba(255, 255, 255, 0.85)",
                    borderRadius: 40,
                    flexDirection: "row",
                    padding: 8,
                    shadowColor: "#000",
                    shadowOffset: { width: 0, height: 10 },
                    shadowOpacity: 0.1,
                    shadowRadius: 20,
                    elevation: 10,
                    borderWidth: 1,
                    borderColor: "rgba(255, 255, 255, 0.5)"
                }}
            >
                {navItems.map((item) => {
                    const isActive = pathname.startsWith(item.route);
                    return (
                        <TouchableOpacity
                            key={item.id}
                            onPress={() => {
                                if (!isActive) {
                                    router.replace(item.route as any);
                                }
                            }}
                            className={`w-[33.3%] items-center py-2 rounded-full ${isActive ? "bg-indigo-50/80" : ""}`}
                        >
                            <Ionicons
                                name={isActive ? (item.icon as any) : (item.outlineIcon as any)}
                                size={22}
                                color={isActive ? "#1337EC" : "#94A3B8"}
                            />
                            <Text
                                style={{
                                    fontFamily: isActive ? "Inter_700Bold" : "Inter_500Medium",
                                    fontSize: 10,
                                    color: isActive ? "#1337EC" : "#94A3B8",
                                    marginTop: 4,
                                    letterSpacing: 0.5
                                }}
                            >
                                {item.label.toUpperCase()}
                            </Text>
                        </TouchableOpacity>
                    );
                })}
            </View>
        </View>
    );
}
