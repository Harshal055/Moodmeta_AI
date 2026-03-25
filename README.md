# MoodMateAI 🧠💙

> **Your AI-Powered Mental Wellness Companion**

MoodMateAI is a comprehensive mental wellness application built with **React Native (Expo)**, **Supabase**, and **OpenAI**. It provides users with a safe space to vent, track their moods, and engage in wellness activities like meditation and breathing exercises.

## ✨ App Preview

<div align="center">
  <table>
    <tr>
      <td align="center"><b>Onboarding</b></td>
      <td align="center"><b>Mood Selection</b></td>
      <td align="center"><b>Companion Setup</b></td>
    </tr>
    <tr>
      <td><img src="./assets/screenshots/onboarding.jpg" width="200" /></td>
      <td><img src="./assets/screenshots/mood_selection.jpg" width="200" /></td>
      <td><img src="./assets/screenshots/role_setup.jpg" width="200" /></td>
    </tr>
    <tr>
      <td align="center"><b>Dashboard</b></td>
      <td align="center"><b>Settings</b></td>
      <td align="center"><b>Premium Success</b></td>
    </tr>
    <tr>
      <td><img src="./assets/screenshots/dashboard.jpg" width="200" /></td>
      <td><img src="./assets/screenshots/settings.jpg" width="200" /></td>
      <td><img src="./assets/screenshots/premium_success.jpg" width="200" /></td>
    </tr>
  </table>
</div>

---

## 🚀 Key Features

- **💬 Intelligent AI Chat**: Personalized, context-aware conversations powered by GPT-4o-mini, supporting Hinglish/Multi-language and voice transcription.
- **📊 Mood Tracking**: Log daily moods and visualize emotional trends over time.
- **🧘 Wellness Hub**: Guided breathing exercises, meditation timers, and daily wellness challenges.
- **🧠 AI Memory**: Personalized experience where the AI remembers your preferences and previous interactions.
- **🛡️ Secure & Private**: Anonymous-first onboarding with optional account linking (Google/Email).
- **💸 Premium Experience**: Integrated subscription model via RevenueCat with features like ad-removal and enhanced memory.

---

## 🛠️ Tech Stack

- **Frontend**: React Native (Expo SDK 54), Expo Router, TailwindCSS (NativeWind), Zustand (State Management).
- **Backend**: Supabase (Auth, PostgreSQL, Realtime, Edge Functions).
- **AI**: OpenAI API (GPT-4o-mini, Whisper for voice).
- **Monetization**: RevenueCat (In-app purchases), Google AdMob.
- **Services**: Expo Notifications, Expo Speech (TTS), Expo AV (Audio).

---

## 🏗️ Architecture

The project follows a service-oriented architecture, ensuring a clean separation of concerns:

- **`/app`**: File-based routing using Expo Router.
- **`/services`**: Core business logic (AI orchestration, RevenueCat, Dashboard).
- **`/hooks`**: Custom React hooks for Auth and state.
- **`/utils`**: Reusable utilities for notifications, ads, and offline sync.
- **`/supabase`**: Edge functions and database schemas.

For a deep dive into the app flow, see [APP_FLOW_ARCHITECTURE.md](./APP_FLOW_ARCHITECTURE.md).

---

## 🏁 Getting Started

### Prerequisites
- [Node.js](https://nodejs.org/)
- [Expo Go](https://expo.dev/expo-go) on your physical device or an emulator.

### Installation
1. Clone the repository:
   ```bash
   git clone https://github.com/YourUsername/MoodMateAI.git
   cd MoodMateAI
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Configure Environment Variables:
   Create a `.env` file in the root based on `.env.example`:
   ```env
   EXPO_PUBLIC_SUPABASE_URL=your-supabase-url
   EXPO_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key
   ```
4. Start the development server:
   ```bash
   npx expo start
   ```

---

## 📄 License
This project is for demonstration/recruitment purposes. All rights reserved.

---

*Built with ❤️ to make mental wellness accessible to everyone.*
