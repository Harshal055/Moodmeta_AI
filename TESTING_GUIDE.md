# Testing Guide: Mood Buddy Pro Features & Paywall

## Test Scenarios

### Test 1: Free User Flow

**Scenario**: User with free account tries to use Pro features

**Steps**:

1. Run app without signing in to Pro
2. Open Chat screen
3. Verify:
   - [ ] No voice playback button on AI messages
   - [ ] No export chat button in header
   - [ ] Ads appear (ad banner should be visible)
   - [ ] Max 20 messages limit enforced

**Expected**: Free features only, paywall shows after hitting limit

---

### Test 2: Paywall Display

**Scenario**: User taps to upgrade or hits message limit

**Steps**:

1. Open Chat and send 20+ messages
2. Paywall should pop up
3. Verify display shows:
   - [ ] "Start Your 2-Day Free Trial" title
   - [ ] Monthly ($9.99/month) and Annual ($69.99/year) options
   - [ ] "BEST VALUE" badge on annual
   - [ ] 12 Pro features listed
   - [ ] Privacy/Terms links work

**Expected**: Paywall displays correctly with both options

---

### Test 3: Purchase Flow (Android Sandbox)

**Scenario**: User completes a test purchase

**Prerequisites**:

- Rev RevenueCat sandbox mode enabled
- Google account added to License Testing

**Steps**:

1. Open paywall
2. Select **Annual** plan
3. Tap "Start Free Trial"
4. Complete Google Play flow:
   - [ ] "Subscribe to Mood Buddy Pro?" dialog
   - [ ] "2-day free trial" shown
   - [ ] Auto-renews message displayed
5. Verify success screen appears
6. Back to app, verify:
   - [ ] Voice button now visible on AI messages
   - [ ] Export chat button in header
   - [ ] Ads are hidden
   - [ ] 20+ messages allowed

**Expected**: Purchase succeeds, Pro features unlock immediately

---

### Test 4: Purchase Flow (iOS Sandbox)

**Scenario**: User completes a test purchase on iOS

**Prerequisites**:

- iOS sandbox tester account created in RevenueCat
- App built for iOS simulator

**Steps**:

1. Sign out of App Store (Settings → App Store → Sign Out)
2. Open Mood Buddy
3. Go to paywall
4. Tap "Start Free Trial"
5. Sign in with sandbox tester account
6. Complete purchase
7. Verify Pro features unlock

**Expected**: Sandbox purchase works, Pro features enable

---

### Test 5: Feature Gating

**Scenario**: Verify all Pro features are properly gated

**Free User**:

- [ ] Voice playback disabled (no button on AI messages)
- [ ] Chat export disabled (no export button)
- [ ] 20 message limit enforced
- [ ] Ad banner visible (if implemented)
- [ ] Settings show "Upgrade to Pro" for analytics/wellness

**Pro User**:

- [ ] Voice playback button visible and functional
- [ ] Can export chat via native Share API
- [ ] Unlimited messages
- [ ] No ads
- [ ] Full access to mood analytics & wellness hub
- [ ] Offline sync enabled
- [ ] AI memory service active

**Steps**:

1. Test as free user → verify restrictions
2. Make test purchase → verify all features unlock
3. Restore purchase → verify features remain unlocked

**Expected**: All features properly gated per subscription status

---

### Test 6: Restore Purchases

**Scenario**: User's subscription restores on app reinstall/new device

**Steps**:

1. After test purchase, close paywall
2. Go to Settings screen
3. Tap "Restore Purchases"
4. Verify:
   - [ ] Loading indicator shows
   - [ ] Success alert: "Purchases Restored"
   - [ ] Pro features remain active

**Expected**: Purchases restore successfully

---

### Test 7: Subscription Management

**Scenario**: User cancels subscription

**Steps**:

**Android**:

1. On device: Play Store app → Account → Subscriptions → Mood Buddy Pro
2. Tap "Manage subscription" → "Cancel subscription"
3. Confirm cancellation
4. Wait 2-3 seconds, restart app
5. Verify:
   - [ ] Player is reverted to free
   - [ ] Paywall shows again
   - [ ] Pro features disabled

**iOS**:

1. Go to Settings → [Your Name] → Subscriptions
2. Select "Mood Buddy"
3. Tap "Cancel Subscription"
4. Restart app
5. Verify paywall and subscription status

**Expected**: Subscription cancels, Pro features disable

---

### Test 8: Entitlements Check

**Scenario**: Verify backend knows about Pro status

**Steps**:

1. Open RevenueCat dashboard
2. Go to **Customers**
3. Search for your test user
4. Expand customer details
5. Verify:
   - [ ] Active entitlements shows: "MoodMate Pro"
   - [ ] Subscription type shows: Monthly/Annual
   - [ ] Renewable subscription: Yes
   - [ ] Original Purchase Date: Today

**Expected**: Customer shows correct entitlements

---

### Test 9: Free Trial

**Scenario**: Verify 2-day free trial works

**Steps**:

1. Complete test purchase
2. Make note of current date
3. Verify Pro works immediately
4. In RevenueCat dashboard:
   - Check subscription shows "trial" status
   - Verify trial end date is 2 days from now

**Expected**: Trial grants immediate access, expires in 2 days

---

### Test 10: Error Handling

**Scenario**: Test network errors and edge cases

**Disconnect Internet**:

1. Turn off Wi-Fi/mobile data
2. Open paywall
3. Verify error message: "Could not load subscription plans"
4. Turn internet back on
5. Tap "Refresh Plans"
6. Verify plans load

**Interrupted Purchase**:

1. Start purchase flow
2. Click back before completing
3. Return to paywall
4. Verify can retry

**Expected**: Graceful error handling, user can retry

---

## Checklist Before Launch

### Configuration

- [ ] RevenueCat account created
- [ ] API keys stored in `.env.local`
- [ ] Products created in RevenueCat (monthly & annual)
- [ ] Offering created and set to CURRENT
- [ ] Entitlements linked to products

### App Store (iOS)

- [ ] App created in App Store Connect
- [ ] In-App Purchases created (matching RevenueCat)
- [ ] RevenueCat linked to App Store

### Google Play (Android)

- [ ] App created in Play Console
- [ ] Subscription products created (matching RevenueCat)
- [ ] RevenueCat linked to Google Play
- [ ] Sandbox tested with license tester

### Code

- [ ] Feature flags implemented for all Pro features
- [ ] Paywall screens correctly
- [ ] Purchase handler updates user state
- [ ] Error handling for failed purchases
- [ ] Restore purchases functionality works

### Testing

- [ ] [x] Test 1: Free user restrictions verified
- [ ] [x] Test 2: Paywall displays correctly
- [ ] [x] Test 3: Purchase flow works (Android)
- [ ] [x] Test 4: Purchase flow works (iOS)
- [ ] [x] Test 5: Feature gating verified
- [ ] [x] Test 6: Restore purchases works
- [ ] [x] Test 7: Subscription cancellation works
- [ ] [x] Test 8: Entitlements visible in dashboard
- [ ] [x] Test 9: Free trial functions
- [ ] [x] Test 10: Error handling works

### Legal

- [ ] Privacy policy updated
- [ ] Terms updated with subscription terms
- [ ] Cancellation instructions clear
- [ ] Auto-renewal disclosure prominent

## Test User Accounts

### Android (Google Play Sandbox)

```
Email: your-test-account@gmail.com
Password: Test123!
```

### iOS (App Store Sandbox)

```
Email: iphone-test@example.com
Password: IPhoneTest123!
```

## Debugging Commands

```bash
# Enable verbose logging
export DEBUG=true

# Run with detailed RevenueCat logs
npm start

# Clear cache
npm install --save react-native-purchases@latest

# Check installed version
npm ls react-native-purchases
```

## Support

If tests fail:

1. Check RevenueCat dashboard for errors
2. Verify API keys are correct
3. Ensure products are in CURRENT offering
4. Check sandbox mode is enabled
5. View logs: `npx expo logs`
