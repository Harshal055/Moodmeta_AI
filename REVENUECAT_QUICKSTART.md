# RevenueCat Quick Start Guide

## 🚀 5-Minute Setup

### Step 1: Get API Keys (2 min)

1. Go to https://app.revenuecat.com/dashboard
2. Sign up or log in
3. Create project: "MoodMateAI"
4. Go to **Settings → API Keys**
5. Copy:
   - **Android Key** → `EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY`
   - **iOS Key** → `EXPO_PUBLIC_REVENUECAT_IOS_API_KEY`
6. Paste into `.env.local`:

```env
EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY=goog_AbCdEfGhIjKlMnOpQrStUvWxYz
EXPO_PUBLIC_REVENUECAT_IOS_API_KEY=appl_XyZaBcDeFgHiJkLmNoPqRsTuVw
```

### Step 2: Create Products (2 min)

In RevenueCat dashboard:

1. **Products → Products** → Create:
   - Name: `Mood Buddy Pro - Monthly`
   - ID: `mood-buddy-pro-monthly`
   - Price: $9.99/month
2. Create:
   - Name: `Mood Buddy Pro - Annual`
   - ID: `mood-buddy-pro-annual`
   - Price: $69.99/year

3. **Products → Entitlements** → Create:
   - Name: `MoodMate Pro`

4. Link products to entitlement

### Step 3: Create Offering (1 min)

1. **Products → Offerings** → Create:
   - Name: `default`
   - Add both products (monthly & annual)
   - **Check "Set as CURRENT"** ← IMPORTANT!

### Step 4: Test (∞ min)

```bash
# Add your API keys to .env.local first!

# Android
npx expo run:android --device

# iOS
npx expo run:ios
```

On device:

1. Open Chat
2. Send 20+ messages
3. Paywall should appear
4. Try "Start Free Trial" with test account
5. Verify Pro features unlock

## 🧪 Test on Android

1. Device Settings → Accounts → Add your Google account (sandbox tester)
2. Go to Play Console → License Testing → Add this account
3. Open Mood Buddy → Hit message limit → Paywall appears
4. Tap "Start Free Trial" → Complete purchase (won't charge!)
5. Pro features should unlock

## 🧪 Test on iOS

1. RevenueCat dashboard → Create sandbox tester account
2. Device: Settings → App Store → Sign out
3. Open Mood Buddy → Paywall → "Start Free Trial"
4. Sign in with sandbox account
5. Complete purchase (free in sandbox)
6. Pro features unlock

## ✅ Verify It Works

1. **In app**: Pro features should be visible/working
2. **In RevenueCat**:
   - Go to Customers
   - Find your test user
   - See "MoodMate Pro" entitlement
   - Verify subscription dates

## 🎯 What to Test

| Feature        | Free       | Pro       |
| -------------- | ---------- | --------- |
| Chat messages  | 20/session | Unlimited |
| Voice playback | ✗          | ✓         |
| Export chat    | ✗          | ✓         |
| Ads            | ✓          | ✗         |
| Mood analytics | ✗          | ✓         |
| Wellness hub   | ✗          | ✓         |
| Offline sync   | ✗          | ✓         |
| AI memory      | ✗          | ✓         |

## 💡 Common Issues

### "Plans unavailable"

→ Offering not set to CURRENT. Go to **Products → Offerings** and check the radio button.

### "Premium not activated"

→ Entitlement not linked. Go to each product and add "MoodMate Pro" entitlement.

### "Wrong prices showing"

→ Check product prices in **Products → Products**. Make sure they match your store prices.

### Ads not hiding for Pro

→ Check `useAuth.setState({ isPremium: true })` is called after purchase.

## 📖 Full Docs

- **Setup**: See `REVENUECAT_SETUP.md`
- **Testing**: See `TESTING_GUIDE.md`
- **Checklist**: See `PAYWALL_INTEGRATION_CHECKLIST.md`

## 🔗 Useful Links

- RevenueCat Dashboard: https://app.revenuecat.com/dashboard
- RevenueCat Docs: https://docs.revenuecat.com
- Google Play Console: https://play.google.com/console
- App Store Connect: https://appstoreconnect.apple.com

---

**Next Steps**:

1. ✅ Add API keys to `.env.local`
2. ✅ Create products in RevenueCat
3. ✅ Test on device
4. ✅ Read full setup guide before submitting to stores
