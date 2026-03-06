# 🎯 Dynamic Paywall Implementation Guide

**Last Updated:** March 6, 2026  
**Status:** ✅ Fully Dynamic & Production-Ready

---

## Overview

Your paywall is now **fully dynamic** and follows RevenueCat best practices. All pricing, trial periods, and product configurations are pulled from RevenueCat/App Store/Play Store—**no hardcoded values**.

### ✅ What This Means

**You can now change from the RevenueCat dashboard:**

- Product prices ($9.99 → $12.99, etc.)
- Trial durations (3 days, 7 days, 14 days, or none)
- Number of products (2, 3, 4+ subscription tiers)
- Package types (monthly, annual, weekly, 6-month, etc.)
- Product names and descriptions
- Currency and localization

**Without touching any code!** 🎉

---

## Architecture

### Core Principles

1. **Use Default Package Types**
   - Uses `PACKAGE_TYPE.ANNUAL`, `PACKAGE_TYPE.MONTHLY`, etc.
   - No custom identifiers required
   - RevenueCat automatically maps to store products

2. **Dynamic Package Detection**
   - Fetches all available packages from current offering
   - Automatically sorts by best value (annual first)
   - Supports any number of products (1, 2, 5, 10+)

3. **Trial-Aware CTA**
   - Detects intro price from product metadata
   - Shows "Start 7-day Free Trial" if trial exists
   - Shows "Subscribe Now" if no trial
   - Automatically adjusts to trial duration

4. **Smart Pricing Display**
   - Uses `product.priceString` (always correct currency)
   - Never hardcodes "$9.99" or specific amounts
   - Calculates monthly equivalent dynamically
   - Shows savings percentage vs other packages

5. **Best Value Detection**
   - Calculates monthly equivalent for all packages
   - Auto-highlights package with lowest monthly cost
   - Compares across different durations fairly

---

## How It Works

### 1. Package Fetching

```typescript
const offerings = await Purchases.getOfferings();
const currentOffering = offerings.current;

// Get all packages (no hardcoded monthly/annual)
const packages = currentOffering.availablePackages;

// Sort by best value (annual preferred)
packages.sort((a, b) => {
  const typeOrder = {
    [PACKAGE_TYPE.ANNUAL]: 1,
    [PACKAGE_TYPE.MONTHLY]: 5,
    // ... etc
  };
  return typeOrder[a.packageType] - typeOrder[b.packageType];
});
```

### 2. Dynamic Labels

```typescript
const getPackageLabel = (pkg: PurchasesPackage): string => {
  // Use store product title if available
  if (pkg.product.title) return pkg.product.title;

  // Fallback to type-based labels
  switch (pkg.packageType) {
    case PACKAGE_TYPE.ANNUAL:
      return "Annual Plan";
    case PACKAGE_TYPE.MONTHLY:
      return "Monthly Plan";
    // ... handles all types
  }
};
```

### 3. Trial Detection

```typescript
const intro = pkg.product.introPrice;

if (intro && intro.price === 0) {
  const period = intro.periodUnit; // "day", "week", "month"
  const periodCount = intro.cycles; // 3, 7, 14, etc.

  return `Free for ${periodCount} ${period}s`;
}
```

### 4. Best Value Calculation

```typescript
// Calculate monthly equivalent for fair comparison
const monthlyEquiv = {
  annual: price / 12,
  sixMonth: price / 6,
  threeMonth: price / 3,
  monthly: price,
  weekly: price * 4.33,
};

// Find package with lowest monthly cost
const bestIndex = packages.reduce((bestIdx, pkg, idx) => {
  const monthly = getMonthlyEquiv(pkg);
  return monthly < bestPrice ? idx : bestIdx;
}, 0);
```

---

## Configuration Examples

### Example 1: Change Trial Duration

**RevenueCat Dashboard:**

1. Go to Products → Your Product
2. Edit "Introductory Offer"
3. Set to "7 days free"
4. Save

**Result in App:**

- CTA button: "Start 7-day Free Trial" ✅
- Package helper: "Free for 7 days" ✅
- Zero code changes needed

---

### Example 2: Add a 6-Month Plan

**RevenueCat Dashboard:**

1. Create new product in App Store Connect: `mood-buddy-pro-sixmonth`
2. Set price: $39.99
3. Add to RevenueCat offering
4. Set offering to CURRENT

**Result in App:**

- Automatically displays 3 packages ✅
- Calculates $6.67/month equivalent ✅
- Shows "Save 33%" if cheaper than monthly ✅
- Zero code changes needed

---

### Example 3: Change Pricing

**RevenueCat Dashboard:**

1. App Store Connect → Products → Edit Price
2. Change monthly from $9.99 → $12.99
3. Change annual from $69.99 → $79.99
4. Submit for review

**Result in App:**

- Displays new prices immediately ✅
- Recalculates savings percentage ✅
- Currency formatting automatic ✅
- Zero code changes needed

---

### Example 4: Remove Trial

**RevenueCat Dashboard:**

1. Products → Edit Introductory Offer
2. Set to "None"
3. Save

**Result in App:**

- CTA button: "Subscribe Now" ✅
- Package helper: Shows billing period ✅
- No "free trial" text anywhere ✅
- Zero code changes needed

---

## What's Configurable in Code

### Static UI Elements (PAYWALL_CONFIG)

These are the **only things** in code:

```typescript
const PAYWALL_CONFIG = {
  heroTitle: "Unlock Premium Features",
  heroEmoji: "✨",
  heroSubtitle: "Unlimited chats, premium companions...",
  features: [
    "Unlimited AI chats",
    "All premium companions",
    // ... 12 total features
  ],
  ctaDefault: "Start Your Free Trial",
  ctaNoTrial: "Subscribe Now",
  // ... UI strings only
};
```

**What's NOT in code:**

- ❌ Product prices
- ❌ Trial durations
- ❌ Product IDs
- ❌ Number of products
- ❌ Currency symbols

---

## Testing Different Configurations

### Test Scenario 1: Multiple Products

**Setup in RevenueCat:**

- Monthly: $9.99
- 3-Month: $24.99
- Annual: $69.99
- Lifetime: $199.99

**Expected Behavior:**

- Displays 4 packages ✅
- Annual marked "BEST VALUE" (lowest monthly equiv) ✅
- Lifetime shows "One-time payment" ✅
- All prices localized correctly ✅

---

### Test Scenario 2: International Pricing

**User in Spain:**

- Monthly: 9,99 €
- Annual: 69,99 €
- Currency: EUR

**User in UK:**

- Monthly: £8.99
- Annual: £59.99
- Currency: GBP

**Expected Behavior:**

- Shows correct currency symbol ✅
- Uses local price formatting ✅
- No hardcoded "$" anywhere ✅

---

### Test Scenario 3: Different Trial Types

| Product | Trial Setup  | Expected CTA              |
| ------- | ------------ | ------------------------- |
| Monthly | 3 days free  | "Start 3-day Free Trial"  |
| Monthly | 7 days free  | "Start 7-day Free Trial"  |
| Monthly | 14 days free | "Start 14-day Free Trial" |
| Monthly | None         | "Subscribe Now"           |
| Annual  | 7 days free  | "Start 7-day Free Trial"  |

All handled automatically! ✅

---

## Benefits of Dynamic Paywall

### 1. No App Updates for Pricing

Change prices anytime without resubmitting to app stores.

### 2. A/B Testing

- Create multiple offerings in RevenueCat
- Test different price points
- No code changes needed

### 3. Seasonal Promotions

- Add limited-time intro offers
- Run holiday sales
- All from dashboard

### 4. International Flexibility

- Different prices per territory
- Auto-handles currency conversion
- Respects local pricing

### 5. Easy Package Experiments

- Try weekly subscriptions
- Test 6-month plans
- Add lifetime options
- Just add to offering

---

## Common Mistakes Avoided

### ❌ Before (Static Paywall)

```typescript
// BAD: Hardcoded prices
const monthlyPrice = "$9.99";
const yearlyPrice = "$69.99";

// BAD: Hardcoded trial text
const ctaText = "Start 7-Day Free Trial";

// BAD: Fixed 2 products only
const packages = {
  monthly: offering.monthly,
  yearly: offering.annual,
};

// BAD: Hardcoded savings
const savings = "Save 42%";
```

**Problems:**

- App store reviewers see wrong currency
- Can't change pricing without app update
- Limited to 2 products only
- Trial text incorrect if changed

---

### ✅ After (Dynamic Paywall)

```typescript
// GOOD: Use store prices
const price = pkg.product.priceString; // "9,99 €" or "$9.99"

// GOOD: Detect trial from product
const intro = pkg.product.introPrice;
const ctaText = intro ? `Start ${intro.cycles}-day Free Trial` : "Subscribe";

// GOOD: Support any number of products
const packages = offering.availablePackages; // [monthly, annual, 6month, ...]

// GOOD: Calculate savings dynamically
const savings = Math.round(
  ((monthlyPrice - yearlyPrice / 12) / monthlyPrice) * 100,
);
```

**Benefits:**

- Works in all currencies
- Adapts to any price change
- Supports unlimited products
- Accurate savings calculation

---

## Troubleshooting

### Issue: "Plans unavailable" error

**Cause:** No offering set to CURRENT in RevenueCat

**Fix:**

1. Go to RevenueCat dashboard
2. Offerings → [Your Offering]
3. Check "Set as CURRENT" ✅
4. Save

---

### Issue: Wrong trial text showing

**Cause:** Trial configured in store but not in RevenueCat

**Fix:**

1. App Store Connect / Play Console
2. Edit product → Introductory Offer
3. Make sure it matches RevenueCat
4. Wait for sync (can take hours)

---

### Issue: Package not appearing

**Cause:** Product not in current offering

**Fix:**

1. RevenueCat → Offerings
2. Edit offering → Add product
3. Set offering to CURRENT
4. Products refresh in app

---

### Issue: Wrong "Best Value" badge

**Cause:** Calculation based on monthly equivalent

**Expected:** Annual plans typically best value per month

**Check:** Verify your math:

- Monthly $9.99/mo = $9.99/mo
- Annual $69.99/yr = $5.83/mo ← Best value ✅

---

## Best Practices

### 1. Always Use Default Package Types

```typescript
// GOOD
offering.annual;
offering.monthly;
offering.sixMonth;

// AVOID
offering.availablePackages.find((p) => p.identifier === "pro_yearly");
```

### 2. Never Hardcode Currency

```typescript
// GOOD
<Text>{pkg.product.priceString}</Text>

// BAD
<Text>${pkg.product.price}</Text>
```

### 3. Check for Intro Price

```typescript
// GOOD
const hasFreeTrial = pkg.product.introPrice?.price === 0;

// BAD
const hasFreeTrial = true; // assumption
```

### 4. Support Any Number of Products

```typescript
// GOOD
packages.map((pkg, index) => <PackageCard key={pkg.identifier} />)

// BAD
<MonthlyCard /> + <YearlyCard /> // fixed 2 only
```

### 5. Calculate Best Value Dynamically

```typescript
// GOOD
const bestIdx = packages.reduce(
  (best, pkg, idx) =>
    getMonthlyEquiv(pkg) < getMonthlyEquiv(packages[best]) ? idx : best,
  0,
);

// BAD
const bestIdx = 1; // assume yearly is always best
```

---

## Migration Guide

### If You Have a Static Paywall

**Step 1:** Replace hardcoded prices

```diff
- const price = "$9.99";
+ const price = pkg.product.priceString;
```

**Step 2:** Support multiple packages

```diff
- const [selected, setSelected] = useState<"monthly"|"yearly">("yearly");
+ const [selectedIndex, setSelectedIndex] = useState(0);
```

**Step 3:** Detect trials dynamically

```diff
- const ctaText = "Start 7-Day Free Trial";
+ const ctaText = pkg.product.introPrice ? `Start ${intro.cycles}-day Free Trial` : "Subscribe";
```

**Step 4:** Remove fixed package logic

```diff
- const monthly = offering.monthly;
- const yearly = offering.annual;
+ const packages = offering.availablePackages;
```

---

## Implementation Checklist

- [x] Use `offerings.current.availablePackages` (not fixed monthly/annual)
- [x] Display `product.priceString` (not hardcoded "$9.99")
- [x] Check `product.introPrice` for trial info
- [x] Support any number of products (1, 2, 3, 5+)
- [x] Calculate best value based on monthly equivalent
- [x] Use default package types (ANNUAL, MONTHLY, etc.)
- [x] Handle missing offerings gracefully
- [x] Show loading state while fetching
- [x] Allow refresh if offering fails to load
- [x] Dynamic CTA text based on trial availability

---

## Summary

Your paywall is now **100% dynamic**:

✅ **Pricing:** Pulled from stores, not hardcoded  
✅ **Trials:** Detected automatically from product metadata  
✅ **Products:** Supports 1, 2, 5, or unlimited packages  
✅ **Currency:** Auto-localized for all regions  
✅ **Best Value:** Calculated dynamically  
✅ **CTA Text:** Adapts to trial duration

**Result:** Change anything from RevenueCat dashboard without touching code! 🚀

---

## Further Reading

- [RevenueCat Best Practices](https://www.revenuecat.com/docs/displaying-products)
- [iOS Subscription Best Practices](https://developer.apple.com/app-store/subscriptions/)
- [Google Play Billing Best Practices](https://developer.android.com/google/play/billing/integrate)

---

**Need Help?** Check `REVENUECAT_SETUP.md` for configuration steps.
