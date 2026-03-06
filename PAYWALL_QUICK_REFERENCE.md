# 📱 Dynamic Paywall Quick Reference

**Your paywall is 100% dynamic** - change products, pricing, and trials from RevenueCat dashboard only!

---

## ✅ What You Can Change (Without Code)

| Change                      | Where                    | Effect in App                         |
| --------------------------- | ------------------------ | ------------------------------------- |
| **Price** ($9.99 → $12.99)  | App Store / Play Console | Shows new price automatically ✅      |
| **Trial** (3 days → 7 days) | Store product settings   | CTA: "Start 7-day Free Trial" ✅      |
| **Remove trial**            | Store product settings   | CTA: "Subscribe Now" ✅               |
| **Add product** (6-month)   | RevenueCat offering      | Displays 3rd package automatically ✅ |
| **Remove product**          | RevenueCat offering      | Hides from paywall ✅                 |
| **Product name**            | Store product title      | Shows custom name ✅                  |
| **Currency**                | Store territory settings | Auto-localizes (€, £, $, etc.) ✅     |

---

## 🚫 What's NOT in Code

❌ No hardcoded "$9.99" or specific amounts  
❌ No hardcoded trial durations ("7-day", "14-day")  
❌ No fixed monthly/annual only  
❌ No hardcoded currency symbols  
❌ No fixed number of products (supports 1-10+)  
❌ No hardcoded savings percentages

---

## 📝 What's Still in Code (Static UI)

✅ `heroTitle`: "Unlock Premium Features"  
✅ `heroEmoji`: "✨"  
✅ `heroSubtitle`: Marketing copy  
✅ `features`: List of 12 Pro features  
✅ Button labels: "Restore Purchases", "Refresh Plans"

---

## 🔧 How it Works

```typescript
// 1. Fetch all available packages
const offerings = await Purchases.getOfferings();
const packages = offerings.current.availablePackages;

// 2. Use store pricing (never hardcoded)
const price = pkg.product.priceString; // "9,99 €" or "$9.99"

// 3. Detect trial from product metadata
const intro = pkg.product.introPrice;
const hasTrial = intro && intro.price === 0;

// 4. Generate CTA dynamically
const ctaText = hasTrial
  ? `Start ${intro.cycles}-${intro.periodUnit} Free Trial`
  : "Subscribe Now";

// 5. Calculate best value
const monthlyEquiv = pkg.product.price / 12; // for annual
const bestValueIndex = findLowestMonthlyEquiv(packages);

// 6. Render all packages
packages.map((pkg, index) => (
  <PackageCard
    key={pkg.identifier}
    label={getPackageLabel(pkg)}
    price={pkg.product.priceString}
    helper={getPackageHelper(pkg)}
    isBestValue={index === bestValueIndex}
  />
))
```

---

## 🧪 Testing Checklist

### Change Price Test

1. App Store Connect → Products → Edit Price
2. Set monthly to $12.99
3. Open app paywall
4. ✅ Should show "$12.99" automatically

### Change Trial Test

1. App Store Connect → Product → Introductory Offer
2. Set to "7 days free"
3. Open app paywall
4. ✅ CTA should say "Start 7-day Free Trial"

### Add Product Test

1. Create new product: `mood-buddy-pro-sixmonth` ($39.99)
2. Add to RevenueCat offering
3. Set offering to CURRENT
4. Open app paywall
5. ✅ Should show 3 packages now

### Currency Test

1. Change device region to Spain
2. Open paywall
3. ✅ Should show "9,99 €" (not "$9.99")

---

## 🔍 Key Functions

### `getPackageLabel(pkg)`

Returns display name for package.

**Logic:**

1. Use `pkg.product.title` if available
2. Else map package type to label:
   - `ANNUAL` → "Annual Plan"
   - `MONTHLY` → "Monthly Plan"
   - `SIX_MONTH` → "6-Month Plan"

### `getPackageHelper(pkg)`

Returns subtitle with trial/billing info.

**Logic:**

1. If `introPrice` exists: "Free for X days"
2. Else return billing period: "Billed yearly"

### `getBestValueIndex()`

Finds package with lowest monthly equivalent cost.

**Logic:**

1. Calculate monthly equiv for each package
2. Annual: `price / 12`
3. 6-Month: `price / 6`
4. Weekly: `price * 4.33`
5. Return index with lowest value

### `calculateSavings(pkgIndex, comparisonIndex)`

Calculates savings % vs another package.

**Logic:**

1. Get monthly equiv for both
2. Return `((comparison - pkg) / comparison) * 100`

### `getCtaText()`

Returns CTA button text based on trial.

**Logic:**

1. Get selected package
2. Check `introPrice`
3. If free trial: "Start X-day Free Trial"
4. Else: "Subscribe Now"

---

## 📊 Supported Package Types

| Type          | Example Duration | Monthly Equiv Calculation        |
| ------------- | ---------------- | -------------------------------- |
| `ANNUAL`      | 12 months        | `price / 12`                     |
| `SIX_MONTH`   | 6 months         | `price / 6`                      |
| `THREE_MONTH` | 3 months         | `price / 3`                      |
| `TWO_MONTH`   | 2 months         | `price / 2`                      |
| `MONTHLY`     | 1 month          | `price`                          |
| `WEEKLY`      | 1 week           | `price * 4.33`                   |
| `LIFETIME`    | Forever          | `price / 60` (amortized 5 years) |
| `CUSTOM`      | Varies           | `price`                          |

---

## 🎯 Best Practices

### ✅ DO

- Use `product.priceString` for display
- Use `PACKAGE_TYPE` constants
- Support any number of products
- Calculate best value dynamically
- Detect trials from product metadata
- Handle loading/error states

### ❌ DON'T

- Hardcode "$9.99" or specific amounts
- Hardcode "7-day trial" text
- Assume only 2 products exist
- Hardcode "Save 42%" percentages
- Use custom package identifiers
- Skip error handling

---

## 🐛 Common Issues

### "Plans unavailable"

**Fix:** Set offering to CURRENT in RevenueCat dashboard

### Wrong trial text

**Fix:** Sync intro offer between store and RevenueCat

### Best value wrong package

**Check:** Verify monthly equivalent calculation

### Missing package

**Fix:** Add product to current offering in RevenueCat

---

## 📚 Documentation

- **Full Guide:** `DYNAMIC_PAYWALL_GUIDE.md` (500+ lines)
- **Migration:** `PAYWALL_MIGRATION_SUMMARY.md`
- **Setup:** `REVENUECAT_SETUP.md`
- **Testing:** `TESTING_GUIDE.md`

---

## 🚀 Quick Start

1. **Create products in stores** (App Store Connect, Play Console)
2. **Add to RevenueCat** (Set offering to CURRENT)
3. **Test in app** (Prices/trials appear automatically)
4. **Change anytime** (No code changes needed)

---

**Next:** See `DYNAMIC_PAYWALL_GUIDE.md` for detailed examples and configuration scenarios.
