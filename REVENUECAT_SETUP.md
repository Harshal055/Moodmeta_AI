# RevenueCat Setup Guide for Mood Buddy Pro

## Overview

RevenueCat handles in-app subscriptions for Mood Buddy Pro. This guide will walk you through setting up products, testing, and verifying purchases.

## Step 1: Create RevenueCat Account & Project

1. Go to [RevenueCat Dashboard](https://app.revenuecat.com/dashboard)
2. Sign up or log in
3. Create a new project: "MoodMateAI"
4. Select your app platforms: iOS and Android

## Step 2: Get API Keys

1. Go to **Settings → API Keys**
2. Copy both:
   - **iOS API Key** → `EXPO_PUBLIC_REVENUECAT_IOS_API_KEY`
   - **Android API Key** → `EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY`
3. Paste into `.env.local`:

```env
EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY=goog_AbCdEfGhIjKlMnOpQrStUvWxYz
EXPO_PUBLIC_REVENUECAT_IOS_API_KEY=appl_XyZaBcDeFgHiJkLmNoPqRsTuVw
```

## Step 3: Configure Products

### 3.1 Create Entitlement

1. Go to **Products → Entitlements** (left sidebar)
2. Click **+ New Entitlement**
3. Name: `MoodMate Pro`
4. Save

### 3.2 Create Products

#### Product 1: Monthly Subscription

1. Go to **Products → Products**
2. Click **+ New Product**
3. Fill in:
   - **Display Name**: `Mood Buddy Pro - Monthly`
   - **Type**: `Subscription`
   - **Base Plan ID**: `mood-buddy-pro-monthly` (use this exact ID)
4. Go to **Pricing** tab:
   - Select your currency (e.g., USD)
   - Set price: **$9.99/month** (suggested)
5. Go to **Entitlements** tab:
   - Select: `MoodMate Pro`
6. Save

#### Product 2: Annual Subscription

1. Click **+ New Product**
2. Fill in:
   - **Display Name**: `Mood Buddy Pro - Annual`
   - **Type**: `Subscription`
   - **Base Plan ID**: `mood-buddy-pro-annual` (use this exact ID)
3. Go to **Pricing** tab:
   - Set price: **$69.99/year** (~40% discount vs monthly)
4. Go to **Entitlements** tab:
   - Select: `MoodMate Pro`
5. Save

### 3.3 Create Offering

1. Go to **Products → Offerings**
2. Click **+ New Offering**
3. Name: `default` (this is what the app looks for)
4. Add both products:
   - Monthly: Select `Mood Buddy Pro - Monthly`
   - Annual: Select `Mood Buddy Pro - Annual`
5. **Check the box to set as CURRENT** (this is critical!)
6. Save

## Step 4: iOS Configuration

### 4.1 Set Up App Store Connect

1. Go to [App Store Connect](https://appstoreconnect.apple.com)
2. Create new app: "Mood Buddy"
3. In **In-App Purchases** section:
   - Create 2 products matching your RevenueCat products
   - Set exact prices: $9.99/month and $69.99/year

### 4.2 Link to RevenueCat

1. In RevenueCat dashboard, go to **Integrations**
2. Add **Apple App Store**
3. Enter:
   - Bundle ID: `com.harshal.moodmateai`
   - Shared Secret: (get from App Store Connect → App Information)

## Step 5: Android Configuration

### 5.1 Set Up Google Play Console

1. Go to [Google Play Console](https://play.google.com/console)
2. Create new app: "Mood Buddy"
3. In **Monetization → In-App Products** section:
   - Create 2 subscription products
   - Match RevenueCat product IDs exactly

### 5.2 Link to RevenueCat

1. In RevenueCat dashboard, go to **Integrations**
2. Add **Google Play Store**
3. Enter:
   - Package Name: `com.harshal.moodmateai`
   - Service Account JSON: (download from Google Play Console)

## Step 6: Testing

### Environment Setup

```bash
# Copy .env.local template
cp .env.local.example .env.local

# Fill in your API keys
EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY=your_key_here
EXPO_PUBLIC_REVENUECAT_IOS_API_KEY=your_key_here
```

### Test on Android

#### Using Sandbox Account (Recommended)

1. In RevenueCat dashboard → **Integrations → Google Play**:
   - Add your Google account to **License Testing Accounts**

2. Sign up for Google Play testing:

   ```
   - Go to Play Console → Settings → License Testing
   - Add your test account email
   ```

3. On Android device:
   - Go to Settings → Accounts
   - Add Google account (the license test account)
   - Run: `npx expo run:android --device`

4. In the paywall:
   - Tap "Start Free Trial"
   - Complete the purchase flow
   - You WON'T be charged (sandbox environment)

#### Test Purchase Scenarios

1. **Successful Purchase**:
   - Select monthly/yearly plan
   - Complete payment
   - Verify "Upgrade Success" screen appears
   - Check that Pro features unlock

2. **Restore Purchase**:
   - Navigate back to paywall
   - Tap "Restore Purchases"
   - Verify Pro status is restored

3. **Cancel Free Trial**:
   - Complete purchase
   - Go to Google Play Store app → Account → Subscriptions
   - Select "Mood Buddy Pro"
   - Tap "Cancel Subscription"
   - Verify paywall reappears when opening app

### Test on iOS

#### Using Sandbox Account (Recommended)

1. In RevenueCat dashboard → **Integrations → Apple App Store**:
   - Add sandbox tester account

2. On iOS device:
   - Settings → App Store → Sign Out
   - Launch app
   - Tap paywall → "Start Free Trial"
   - Use sandbox tester credentials
   - Complete purchase (won't charge)

3. Verify Pro features unlock

## Step 7: Production Checklist

Before submitting to stores:

- [ ] API keys configured in `.env.local`
- [ ] Products created in both RevenueCat AND App Store Connect / Google Play
- [ ] Product IDs match exactly
- [ ] Offering set to CURRENT in RevenueCat
- [ ] Entitlements created and linked
- [ ] Test purchase completed successfully
- [ ] Pro features verify unlock on purchase
- [ ] Privacy policy updated with subscription terms
- [ ] Paywall URLs point to correct privacy/terms pages

## Step 8: Monitoring & Debugging

### Check Active Subscriptions

1. In RevenueCat dashboard → **Customers**
2. Search for your test user
3. Expand customer info to see:
   - Active entitlements
   - Subscription details
   - Purchase history

### Enable Debug Logging (Dev Only)

In `services/revenueCatService.ts`:

```typescript
Purchases.setLogLevel(LOG_LEVEL.VERBOSE); // Enable detailed logs
Purchases.setLogLevel(LOG_LEVEL.INFO); // Info level
Purchases.setLogLevel(LOG_LEVEL.ERROR); // Production (errors only)
```

### Common Issues

#### "Plans are temporarily unavailable"

- Check internet connection
- Verify API key is correct
- Ensure at least one offering is set to CURRENT

#### "Premium was not activated"

- Check entitlements are linked to products
- Try "Restore Purchases"
- Check RevenueCat dashboard → Customers for user

#### Purchases appear but not on device

- Ensure SDK is initialized before showing paywall
- Check `checkEntitlement()` is using correct entitlement ID
- Verify customer info is fetched after purchase

## Revenue Metrics

After launch, monitor in RevenueCat dashboard:

- **MRR** (Monthly Recurring Revenue)
- **Churn Rate** (% of users canceling)
- **LTV** (Lifetime Value)
- **Conversion Rate** (% trying → purchasing)

## Support

- RevenueCat Docs: https://docs.revenuecat.com
- RevenueCat Support: support@revenuecat.com
- React Native Purchases: https://pub.dev/packages/react_native_purchases
