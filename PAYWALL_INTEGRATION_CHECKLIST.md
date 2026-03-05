# Paywall Integration Checklist

## Before Testing

### Environment Setup

- [ ] Copy `.env.local` from template
- [ ] Add RevenueCat API keys to `.env.local`
  - [ ] EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY
  - [ ] EXPO_PUBLIC_REVENUECAT_IOS_API_KEY
- [ ] Verify keys are not committed to git (.env.local in .gitignore)

### RevenueCat Dashboard Setup

- [ ] Account created at app.revenuecat.com
- [ ] Project created ("MoodMateAI")
- [ ] Entitlement created ("MoodMate Pro")
- [ ] Products created:
  - [ ] Monthly (ID: `mood-buddy-pro-monthly`)
  - [ ] Annual (ID: `mood-buddy-pro-annual`)
- [ ] Offering created with both products
- [ ] Offering set to CURRENT

### App Store Integration (iOS)

- [ ] Account created in App Store Connect
- [ ] App created ("Mood Buddy")
- [ ] In-App Purchases configured:
  - [ ] Monthly subscription
  - [ ] Annual subscription
- [ ] RevenueCat linked to App Store:
  - [ ] Bundle ID: com.harshal.moodmateai
  - [ ] Shared Secret configured

### Google Play Integration (Android)

- [ ] Account created in Google Play Console
- [ ] App created ("Mood Buddy")
- [ ] Subscription products configured:
  - [ ] Monthly subscription
  - [ ] Annual subscription
- [ ] License testing enabled:
  - [ ] Test account added to License Testing
- [ ] RevenueCat linked to Google Play:
  - [ ] Package Name: com.harshal.moodmateai
  - [ ] Service Account JSON uploaded

## Feature Implementation

### Core Features

- [ ] Feature flags implemented for all Pro features
- [ ] `isFeatureEnabled()` used for gating features
- [ ] `isPremium` status tracked in useAuth hook
- [ ] Paywall screen implemented in `app/(modals)/paywall.tsx`

### Chat Screen (Pro Features)

- [ ] Voice playback button visible for Pro users
- [ ] Export chat button visible for Pro users
- [ ] Message limit enforced (20 for free, unlimited for Pro)
- [ ] Ad banner shown for free users

### Settings Screen (Pro Features)

- [ ] Mood Analytics shown for Pro users
- [ ] Wellness Hub shown for Pro users
- [ ] Pro Features summary shown for free users
- [ ] Paywall accessible from all upgrade prompts

### Paywall Flow

- [ ] Paywall pops up on message limit
- [ ] Monthly and annual options display correctly
- [ ] "Start Free Trial" button initiates purchase
- [ ] "Refresh Plans" button reloads offerings
- [ ] "Restore Purchases" button works
- [ ] Success screen shows after purchase
- [ ] Error handling for failed purchases

## Testing Checklist

### Test Environment - Android

- [ ] Device connected to sandbox Google account
- [ ] License Testing account configured
- [ ] Build runs: `npx expo run:android --device`

### Test Cases - Android

- [ ] Free user restrictions work (no voice, no export, ads visible)
- [ ] Paywall displays on message limit
- [ ] Can select monthly/annual plans
- [ ] "Start Free Trial" completes purchase
- [ ] Pro features unlock after purchase
- [ ] "Restore Purchases" works
- [ ] Can cancel subscription in Play Store
- [ ] Pro status reverts after cancellation

### Test Environment - iOS

- [ ] Sandbox tester account created in RevenueCat
- [ ] iOS simulator or device available
- [ ] Build runs: `npx expo run:ios`

### Test Cases - iOS

- [ ] Same tests as Android but on iOS
- [ ] Use sandbox tester credentials for purchase
- [ ] Cancel via Settings → Subscriptions

### Revenue Dashboard

- [ ] Log into RevenueCat dashboard
- [ ] Find test user in Customers list
- [ ] Verify entitlements show "MoodMate Pro"
- [ ] Verify subscription status and expiration
- [ ] Review MRR and lifetime value metrics

## Debugging

### Common Issues

**"Plans are temporarily unavailable"**

- [ ] Check internet connection
- [ ] Verify API key in .env.local
- [ ] Ensure offering is set to CURRENT in RevenueCat
- [ ] Check RevenueCat project is linked to app

**"Premium was not activated"**

- [ ] Verify entitlement exists and is linked to products
- [ ] Try "Restore Purchases"
- [ ] Check RevenueCat dashboard for customer record
- [ ] Review logs for any errors

**"Unable to make purchase"**

- [ ] Verify test account is added to License Testing (Android)
- [ ] Verify sandbox tester is added to RevenueCat (iOS)
- [ ] Check products are created in both RevenueCat and store
- [ ] Verify product IDs match exactly

**Ads not showing/hiding correctly**

- [ ] Check `isPremium` status is updated after purchase
- [ ] Verify `adService` is initialized
- [ ] Check feature flag for ads is correct
- [ ] Ensure useAuth hook updates after purchase

### Enable Logging

```typescript
// In revenueCatService.ts
Purchases.setLogLevel(LOG_LEVEL.VERBOSE); // For debugging
Purchases.setLogLevel(LOG_LEVEL.ERROR); // For production
```

### View Logs

```bash
npx expo logs
# or
npm start
```

## Final Verification

### Before Submitting Store

- [ ] All tests passed
- [ ] No test products/entitlements in production
- [ ] Error messages are user-friendly
- [ ] Privacy policy mentions auto-renewal
- [ ] Terms explain how to cancel subscription
- [ ] Cancellation instructions are accurate
- [ ] Paywall URLs (privacy/terms) are correct

### Legal

- [ ] Privacy Policy updated with subscription terms
- [ ] Terms of Service updated with auto-renewal disclosure
- [ ] Cancellation instructions included
- [ ] "Your subscription will auto-renew" message clear on paywall

## Launch Readiness

- [ ] All tests passing consistently
- [ ] No debug logs in production code
- [ ] Feature flags disabled in production (all features accessible via subscription)
- [ ] Error handling tested and working
- [ ] RevenueCat production API keys configured
- [ ] App Store and Google Play reviews passed
