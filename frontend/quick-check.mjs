import { chromium } from "@playwright/test";

async function quickTest() {
  console.log("🔍 Quick Frontend Check\n");

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  try {
    console.log("1. Checking frontend login page...");
    const response = await page.goto("http://localhost:5173/login", { timeout: 15000 });
    console.log(`   Status: ${response.status()}`);

    await page.waitForLoadState("networkidle", { timeout: 10000 });
    console.log("   Page loaded");

    // Get page HTML
    const html = await page.content();
    console.log(`   HTML length: ${html.length} chars`);

    // Check for specific elements
    const title = await page.title();
    console.log(`   Page title: "${title}"`);

    // Try to find form elements
    const inputs = await page.$$("input");
    console.log(`   Input fields found: ${inputs.length}`);

    const buttons = await page.$$("button");
    console.log(`   Buttons found: ${buttons.length}`);

    // Check if there's a visible error in the page
    const bodyText = await page.textContent("body");
    console.log(`   Body text preview: "${bodyText.substring(0, 200)}..."`);

    // Check for any console errors
    const consoleLogs = [];
    page.on("console", (msg) => consoleLogs.push(msg.text()));

    console.log("\n2. Testing API call directly from page context...");
    const apiResult = await page.evaluate(async () => {
      try {
        const response = await fetch("http://localhost:8000/health");
        const data = await response.json();
        return { status: response.status, data };
      } catch (e) {
        return { error: e.message };
      }
    });
    console.log(`   API Result: ${JSON.stringify(apiResult)}`);

    if (consoleLogs.length > 0) {
      console.log("\n3. Console logs captured:");
      consoleLogs.forEach((log) => console.log(`   - ${log}`));
    }

    console.log("\n✅ Quick check complete!");

  } catch (error) {
    console.error("\n❌ Error:", error.message);
  } finally {
    await browser.close();
  }
}

quickTest();
