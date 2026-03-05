# Purchase Flow Architecture

## High-Level Flow

```
Free User
    ↓
Sends 20+ messages OR taps "Upgrade"
    ↓
[Paywall Modal] app/(modals)/paywall.tsx
    ├── Fetch offerings from RevenueCat
    ├── Display monthly/annual options
    └── User selects plan
        ↓
        "Start Free Trial" tap
        ↓
        Purchase initiated
        ↓
    ┌─────────────────────────────────┐
    │ Platform-Specific Flow          │
    ├─────────────────────────────────┤
    │ Android:                        │
    │  → Google Play billing dialog   │
    │  → Sandbox payment flow         │
    │                                 │
    │ iOS:                            │
    │  → App Store billing dialog     │
    │  → Sandbox tester login         │
    └─────────────────────────────────┘
        ↓
    Purchase completes
        ↓
[Success Modal] app/(modals)/upgrade-success.tsx
        ↓
    useAuth.setState({ isPremium: true })
        ↓
    Feature flags re-evaluate
        ↓
Pro Features Unlock:
  ✓ Voice playback
  ✓ Export chat
  ✓ Unlimited messages
  ✓ No ads
  ✓ Mood analytics
  ✓ Wellness hub
  ✓ Offline sync
  ✓ AI memory
```

## Code Flow

### 1. When Paywall Shows

```typescript
// app/(main)/chat.tsx
if (!isPremium && userMessageCount >= FREE_MESSAGE_LIMIT) {
  setHitLimit(true);
  router.push("/(modals)/paywall"); // ← Paywall opens
}

// app/(modals)/paywall.tsx
useEffect(() => {
  fetchOfferings(); // Get products from RevenueCat
}, []);
```

### 2. When User Purchases

```typescript
// app/(modals)/paywall.tsx
const handlePurchase = async () => {
  try {
    const pkgToBuy =
      selectedPackage === "monthly" ? packages.monthly : packages.yearly;

    // Purchase package (platform-specific)
    const { customerInfo } = await Purchases.purchasePackage(pkgToBuy);

    // Check entitlement
    const isPremium = revenueCatService.checkEntitlement(customerInfo);

    if (isPremium) {
      // Update app state ← CRITICAL!
      useAuth.setState({ isPremium: true });

      // Show success
      router.replace("/(modals)/upgrade-success");
    }
  } catch (error) {
    // Handle error
  }
};
```

### 3. Features Unlock (Feature Flags)

```typescript
// Component checks: isFeatureEnabled("feature_name", isPremium)

// utils/featureFlags.ts
export function isFeatureEnabled(feature: string, isPremium: boolean): boolean {
  const PRO_FEATURES = {
    voiceMessages: true,      // require Pro
    chatExport: true,          // require Pro
    moodAnalytics: true,       // require Pro
    wellnessHub: true,         // require Pro
    aiMemory: true,            // require Pro
    customCompanions: true,    // require Pro
    offline_chat_mode: true,   // require Pro
  };

  return isPremium && PRO_FEATURES[feature];
}

// Usage in components
{isPremium && isFeatureEnabled("voiceMessages", isPremium) && (
  <VoiceButton />
)}
```

## State Management

### useAuth Hook (Zustand Store)

```typescript
// hooks/useAuth.ts
interface AuthState {
  isPremium: boolean; // ← Updated after purchase
  currentUser: User | null;
  profile: Profile | null;
  // ... other properties
}

// Update after purchase
useAuth.setState({ isPremium: true });

// Subscribe to changes
useAuth.subscribe(
  (state) => state.isPremium,
  (isPremium) => {
    // Re-render components using feature flags
  },
);
```

## RevenueCat Integration

### Service Methods

```typescript
// services/revenueCatService.ts

// Initialize on app start
await revenueCatService.initialize();

// Get products
const { monthly, annual } = await revenueCatService.getOfferings();

// Check entitlement
const isPro = revenueCatService.checkEntitlement(customerInfo);

// Get subscription details
const details = revenueCatService.getSubscriptionDetails(customerInfo);
```

### Customer Info Flow

```
[RevenueCat Servers]
        ↓
[SDK Cache]
        ↓
[getCustomerInfo()]
        ↓
[checkEntitlement()]
        ↓
isPremium boolean
        ↓
useAuth.setState({ isPremium })
        ↓
Feature flags re-evaluate
        ↓
UI updates via React subscriptions
```

## Error Handling

### Purchase Errors

```
User taps purchase
    ↓
Try/catch block
    ├── User cancelled → Silent (no error shown)
    ├── Network error → "Could not connect..."
    ├── Billing error → "Payment failed..."
    └── Invalid product → "Plan unavailable..."
        ↓
    Show error message
    ↓
    User can retry
```

### Common Errors

| Error                   | Cause                | Fix                                   |
| ----------------------- | -------------------- | ------------------------------------- |
| "Plans unavailable"     | Offering not CURRENT | Set offering to CURRENT in RevenueCat |
| "Premium not activated" | Entitlement missing  | Link entitlement to products          |
| "Invalid product"       | Product ID mismatch  | Check IDs match exactly               |
| "Billing unavailable"   | Wrong test account   | Use sandbox tester account            |

## Real-Time Updates

### Customer Info Listener

```typescript
// Automatically triggered when subscription changes
Purchases.addCustomerInfoUpdateListener((customerInfo) => {
  const isPro = revenueCatService.checkEntitlement(customerInfo);
  // App can react to entitlement changes
});
```

### When Subscription Cancels

1. User cancels in app store
2. RevenueCat receives cancellation
3. Listener fires with updated customerInfo
4. isPro becomes false
5. Feature flags re-evaluate
6. Pro features hidden
7. Ads re-appear

## Entitlement Checking

### On App Launch

```typescript
// hooks/useAuth.ts (initialization)
useEffect(() => {
  if (!user) return;

  // Check RevenueCat subscription
  revenueCatService.login(user.id);

  const customerInfo = await revenueCatService.getCustomerInfo();
  const isPremium = revenueCatService.checkEntitlement(customerInfo);

  setState({ isPremium });
}, [user?.id]);
```

### Real-Time Check

```typescript
// After purchase
const { customerInfo } = await Purchases.purchasePackage(pkg);
const isPro = revenueCatService.checkEntitlement(customerInfo);
// Update state immediately
useAuth.setState({ isPremium: isPro });
```

## Data Flow Diagram

```
┌─────────────────────────────────┐
│    User Opens App               │
└────────────────┬────────────────┘
                 ↓
         ┌──────────────┐
         │ Initialize   │
         │ RevenueCat   │
         └──────┬───────┘
                ↓
    ┌───────────────────────┐
    │ Get Customer Info     │
    │ Check Entitlement     │
    └───────────┬───────────┘
                ↓
         ┌─────────────────┐
         │ Set isPremium   │
         │ in Zustand      │
         └────────┬────────┘
                  ↓
    ┌─────────────────────────┐
    │ Feature Flags Update    │
    │ UI Components Re-render │
    └─────────────────────────┘
```

## Testing Architecture

### Unit Tests (Recommended)

```typescript
describe("revenueCatService", () => {
  it("should detect active entitlement", () => {
    const customerInfo = {
      /* mock */
    };
    const isPro = revenueCatService.checkEntitlement(customerInfo);
    expect(isPro).toBe(true);
  });

  it("should return offerings", async () => {
    const { monthly, annual } = await revenueCatService.getOfferings();
    expect(monthly).toBeDefined();
    expect(annual).toBeDefined();
  });
});
```

### Integration Tests (Manual)

See `TESTING_GUIDE.md` for manual test scenarios.

## Production Checklist

- [ ] API keys configured (never in code)
- [ ] Products created in RevenueCat & stores
- [ ] Entitlements linked to products
- [ ] Offering set to CURRENT
- [ ] All tests passing
- [ ] Error messages user-friendly
- [ ] No debug logging in production
- [ ] Privacy policy mentions auto-renewal
- [ ] Cancellation instructions clear
