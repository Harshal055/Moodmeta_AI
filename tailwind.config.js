/** @type {import('tailwindcss').Config} */
module.exports = {
    content: ["./app/**/*.{js,jsx,ts,tsx}", "./components/**/*.{js,jsx,ts,tsx}"],
    presets: [require("nativewind/preset")],
    theme: {
        extend: {
            fontFamily: {
                manrope: ["Manrope_500Medium"],
                "manrope-semibold": ["Manrope_600SemiBold"],
                "manrope-bold": ["Manrope_700Bold"],
                inter: ["Inter_400Regular"],
                "inter-medium": ["Inter_500Medium"],
            },
            colors: {
                dreamy: {
                    sky: "#B8C6F0",
                    pink: "#E8B4CB",
                    lavender: "#C9B8F0",
                    peach: "#F0D4C8",
                    cream: "#FFF8F0",
                },
                golden: {
                    light: "#FFE4A0",
                    DEFAULT: "#FFD166",
                    warm: "#F4B942",
                    glow: "rgba(255, 209, 102, 0.3)",
                },
                bubble: {
                    ai: "#F3EEFF",
                    user: "#E8EDFF",
                    "ai-border": "#E0D4FF",
                },
            },
        },
    },
    plugins: [],
};
