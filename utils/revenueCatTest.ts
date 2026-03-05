/**
 * RevenueCat Integration Test Utility
 * 
 * Use this to verify RevenueCat is properly configured and working
 * Run: npx ts-node utils/revenueCatTest.ts
 */

import { revenueCatService } from "../services/revenueCatService";
import Purchases from "react-native-purchases";

async function testRevenueCatIntegration() {
  console.log("\n🧪 RevenueCat Integration Test\n");
  console.log("═".repeat(50));

  try {
    // Test 1: Check environment variables
    console.log("\n✓ Test 1: Environment Variables");
    const androidKey = process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY;
    const iosKey = process.env.EXPO_PUBLIC_REVENUECAT_IOS_API_KEY;

    if (androidKey) {
      console.log(`  ✓ Android API Key: ${androidKey.substring(0, 6)}...${androidKey.substring(androidKey.length - 4)}`);
    } else {
      console.log("  ✗ Missing Android API Key");
    }

    if (iosKey) {
      console.log(`  ✓ iOS API Key: ${iosKey.substring(0, 6)}...${iosKey.substring(iosKey.length - 4)}`);
    } else {
      console.log("  ✗ Missing iOS API Key");
    }

    // Test 2: Initialize RevenueCat
    console.log("\n✓ Test 2: Initialize RevenueCat");
    try {
      await revenueCatService.initialize();
      console.log("  ✓ RevenueCat initialized successfully");
    } catch (e) {
      console.log(`  ✗ Failed to initialize: ${e}`);
      return;
    }

    // Test 3: Get Offerings
    console.log("\n✓ Test 3: Fetch Offerings");
    const { offering, monthly, annual } = await revenueCatService.getOfferings();

    if (offering) {
      console.log(`  ✓ Offering found: ${offering.identifier}`);
      if (monthly) {
        console.log(`    - Monthly: ${monthly.product.priceString}/month`);
      } else {
        console.log("    ✗ Monthly package missing");
      }
      if (annual) {
        console.log(`    - Annual: ${annual.product.priceString}/year`);
      } else {
        console.log("    ✗ Annual package missing");
      }
    } else {
      console.log("  ✗ No current offering found");
      console.log("    → Check RevenueCat dashboard and ensure:");
      console.log("      1. Products are created (monthly & annual)");
      console.log("      2. Offering is created with both products");
      console.log("      3. Offering is set to CURRENT");
    }

    // Test 4: Get Customer Info
    console.log("\n✓ Test 4: Get Customer Info");
    const customerInfo = await revenueCatService.getCustomerInfo();

    if (customerInfo) {
      const isPro = revenueCatService.checkEntitlement(customerInfo);
      console.log(`  ✓ Customer Info retrieved`);
      console.log(`    - Pro Status: ${isPro ? "✓ Active" : "✗ Not Active"}`);
      
      const subscriptionDetails = revenueCatService.getSubscriptionDetails(customerInfo);
      if (subscriptionDetails) {
        console.log(`    - Status: ${subscriptionDetails.isActive ? "Active" : "Inactive"}`);
        if (subscriptionDetails.expirationDate) {
          console.log(`    - Expires: ${subscriptionDetails.expirationDate.toLocaleDateString()}`);
        }
      }
    } else {
      console.log("  ⚠️  No customer info (expected for new users)");
    }

    console.log("\n" + "═".repeat(50));
    console.log("\n✅ RevenueCat Integration Test Complete\n");

  } catch (error) {
    console.error("\n❌ Test Failed:", error);
  }
}

// Run tests
testRevenueCatIntegration();
