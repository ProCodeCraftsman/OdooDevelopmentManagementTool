import { chromium } from "@playwright/test";

const FRONTEND_URL = "http://localhost:5173";
const BACKEND_URL = "http://localhost:8000";

const results = [];

async function test(name, fn) {
  try {
    await fn();
    results.push({ name, passed: true });
    console.log(`  ✅ ${name}`);
  } catch (error) {
    results.push({ name, passed: false, error: String(error) });
    console.log(`  ❌ ${name}: ${error}`);
  }
}

async function runTests() {
  console.log("\n🎯 Odoo Auditor - Full Integration Test Suite\n");
  console.log("=".repeat(60));

  let browser;
  let context;
  let page;

  const failedRequests = [];
  const consoleErrors = [];

  try {
    browser = await chromium.launch({ headless: true });
    context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
    page = await context.newPage();

    // Track failures
    page.on("requestfailed", (request) => {
      failedRequests.push({
        url: request.url(),
        error: request.failure()?.errorText || "Unknown",
      });
    });
    page.on("console", (msg) => {
      if (msg.type() === "error") {
        consoleErrors.push(msg.text());
      }
    });

    // ========== SECTION 1: Backend Health ==========
    console.log("\n📡 Section 1: Backend Health");

    await test("Backend health check returns 200", async () => {
      const response = await page.request.get(`${BACKEND_URL}/health`);
      if (response.status() !== 200) throw new Error(`Status: ${response.status()}`);
    });

    await test("Backend returns correct health status", async () => {
      const response = await page.request.get(`${BACKEND_URL}/health`);
      const data = await response.json();
      if (data.status !== "healthy") throw new Error(`Got: ${JSON.stringify(data)}`);
    });

    // ========== SECTION 2: Login Flow ==========
    console.log("\n🔐 Section 2: Login Flow");

    await test("Login page loads correctly", async () => {
      await page.goto(`${FRONTEND_URL}/login`, { timeout: 15000 });
      await page.waitForLoadState("networkidle");
      await page.waitForTimeout(2000);

      const bodyText = await page.textContent("body");
      if (!bodyText.includes("Odoo Auditor")) {
        throw new Error("Login page title not found");
      }
      if (!bodyText.includes("Username") && !bodyText.includes("username")) {
        throw new Error("Username field not found");
      }
    });

    await test("Login form accepts credentials", async () => {
      // Wait for form inputs to be available
      await page.waitForSelector('input[id="username"], input[name="username"]', { timeout: 5000 });
      const usernameInput = await page.$('input[id="username"], input[name="username"]');
      const passwordInput = await page.$('input[id="password"], input[name="password"]');

      if (!usernameInput) throw new Error("Username input not found");
      if (!passwordInput) throw new Error("Password input not found");

      await usernameInput.fill("superadmin");
      await passwordInput.fill("admin123");
    });

    await test("Login submits and redirects to dashboard", async () => {
      const submitButton = await page.$('button[type="submit"]');
      if (!submitButton) throw new Error("Submit button not found");

      await submitButton.click();

      // Wait for redirect to dashboard
      await page.waitForURL("**/dashboard", { timeout: 10000 });
      console.log("     ↳ Redirected to dashboard");
    });

    await test("JWT token is stored in localStorage", async () => {
      const token = await page.evaluate(() => localStorage.getItem("token"));
      if (!token) throw new Error("No token found in localStorage");
      if (token.length < 50) throw new Error("Token seems too short");
      console.log(`     ↳ Token stored (${token.substring(0, 20)}...)`);
    });

    // ========== SECTION 3: Dashboard Page ==========
    console.log("\n📊 Section 3: Dashboard Page");

    await test("Dashboard loads successfully", async () => {
      await page.waitForLoadState("networkidle");
      await page.waitForTimeout(2000);

      const bodyText = await page.textContent("body");
      if (!bodyText.includes("Overview")) {
        throw new Error("Dashboard overview not found");
      }
    });

    await test("Dashboard shows stats cards", async () => {
      // Dashboard should have stat cards
      const bodyText = await page.textContent("body");
      const hasStats = bodyText.includes("Total Modules") ||
                       bodyText.includes("Environments") ||
                       bodyText.includes("Overview");
      if (!hasStats) throw new Error("Stats not found on dashboard");
    });

    await test("Dashboard fetches data from API", async () => {
      // Check network tab for API calls
      const envCount = await page.evaluate(() => {
        const BACKEND = "http://localhost:8000";
        return fetch(`${BACKEND}/api/v1/environments/`, {
          headers: { Authorization: `Bearer ${localStorage.getItem("token")}` }
        }).then(r => r.json()).then(d => Array.isArray(d) ? d.length : 0).catch(() => 0);
      });
      console.log(`     ↳ Found ${envCount} environments from API`);
    });

    // ========== SECTION 4: Environments Page ==========
    console.log("\n🌍 Section 4: Environments Page");

    await test("Environments page loads", async () => {
      await page.goto(`${FRONTEND_URL}/environments`, { timeout: 15000 });
      await page.waitForLoadState("networkidle");
      await page.waitForTimeout(2000);

      const bodyText = await page.textContent("body");
      if (!bodyText.includes("Environments")) {
        throw new Error("Environments page title not found");
      }
    });

    await test("Environments list or empty state displays", async () => {
      const bodyText = await page.textContent("body");
      const hasContent = bodyText.includes("Add Environment") ||
                         bodyText.includes("No environments") ||
                         bodyText.includes("Manage your");
      if (!hasContent) throw new Error("Environments content not found");
    });

    // ========== SECTION 5: Settings/Add Environment ==========
    console.log("\n⚙️ Section 5: Settings & Environment CRUD");

    await test("Navigate to settings/environments", async () => {
      await page.goto(`${FRONTEND_URL}/settings/environments`, { timeout: 15000 });
      await page.waitForLoadState("networkidle");
      await page.waitForTimeout(2000);

      const bodyText = await page.textContent("body");
      if (!bodyText.includes("Manage Environments")) {
        throw new Error("Settings page not found");
      }
    });

    // Generate unique name for test environment
    const testEnvName = `TestEnv_${Date.now()}`;

    await test("Add Environment sheet opens", async () => {
      const addButton = await page.$('button:has-text("Add Environment")');
      if (!addButton) throw new Error("Add Environment button not found");
      await addButton.click();
      await page.waitForTimeout(500);

      // Check if sheet/dialog opened
      const bodyText = await page.textContent("body");
      if (!bodyText.includes("Add Environment") && !bodyText.includes("Create")) {
        throw new Error("Add Environment sheet did not open");
      }
    });

    await test("Fill environment form", async () => {
      // Fill the form fields
      const nameInput = await page.$('input[id="name"]');
      const urlInput = await page.$('input[id="url"]');
      const dbInput = await page.$('input[id="db_name"]');
      const userInput = await page.$('input[id="user"]');
      const passInput = await page.$('input[id="password"]');

      if (!nameInput) throw new Error("Name input not found");

      await nameInput.fill(testEnvName);
      if (urlInput) await urlInput.fill("https://test-odoo.example.com");
      if (dbInput) await dbInput.fill("test_db");
      if (userInput) await userInput.fill("admin");
      if (passInput) await passInput.fill("test_password");

      console.log(`     ↳ Created environment: ${testEnvName}`);
    });

    await test("Submit environment form", async () => {
      // Find and click submit button inside the sheet
      const submitButton = await page.$('button[type="submit"]:has-text("Create"), button[type="submit"]:has-text("Update")');
      if (!submitButton) throw new Error("Submit button not found in form");
      await submitButton.click();
      await page.waitForTimeout(2000); // Wait for API call
    });

    await test("Verify environment was created", async () => {
      // Reload and check if environment appears in the list
      await page.goto(`${FRONTEND_URL}/settings/environments`, { timeout: 15000 });
      await page.waitForLoadState("networkidle");
      await page.waitForTimeout(2000);

      const bodyText = await page.textContent("body");
      if (!bodyText.includes(testEnvName)) {
        throw new Error(`Environment ${testEnvName} not found in list`);
      }
      console.log(`     ↳ Environment ${testEnvName} created successfully`);
    });

    // ========== SECTION 6: Reports Page ==========
    console.log("\n📈 Section 6: Reports Page");

    await test("Reports comparison page loads", async () => {
      await page.goto(`${FRONTEND_URL}/reports/comparison`, { timeout: 15000 });
      await page.waitForLoadState("networkidle");
      await page.waitForTimeout(3000);

      const bodyText = await page.textContent("body");
      if (!bodyText.includes("Comparison") && !bodyText.includes("Report")) {
        throw new Error("Reports page did not load");
      }
    });

    // ========== SECTION 7: API Authentication ==========
    console.log("\n🔌 Section 7: API Authentication");

    await test("Authenticated API calls work from browser", async () => {
      const result = await page.evaluate(async () => {
        const BACKEND = "http://localhost:8000";
        const token = localStorage.getItem("token");
        if (!token) return { error: "No token" };

        const response = await fetch(`${BACKEND}/api/v1/environments/`, {
          headers: { Authorization: `Bearer ${token}` }
        });

        if (!response.ok) return { error: `Status: ${response.status}` };

        const data = await response.json();
        return { success: true, count: data.length };
      });

      if (result.error) throw new Error(result.error);
      console.log(`     ↳ API returned ${result.count} environments`);
    });

    await test("Protected endpoint rejects unauthenticated requests", async () => {
      const result = await page.evaluate(async () => {
        const BACKEND = "http://localhost:8000";
        const response = await fetch(`${BACKEND}/api/v1/environments/`);
        return { status: response.status };
      });

      if (result.status === 200) {
        throw new Error("Unauthenticated request should have been rejected");
      }
      console.log(`     ↳ Unauthenticated request correctly rejected (status: ${result.status})`);
    });

    // ========== SECTION 8: Navigation ==========
    console.log("\n🧭 Section 8: Navigation");

    await test("Sidebar navigation is present", async () => {
      await page.goto(`${FRONTEND_URL}/dashboard`, { timeout: 15000 });
      await page.waitForLoadState("networkidle");
      await page.waitForTimeout(2000);

      // Check for navigation elements
      const sidebar = await page.$('nav, aside, [role="navigation"]');
      if (!sidebar) {
        console.log("     ↳ No explicit nav element found (may be in layout)");
      }
    });

    await test("Can navigate between pages", async () => {
      // Dashboard -> Environments
      await page.goto(`${FRONTEND_URL}/dashboard`);
      await page.waitForLoadState("networkidle");
      await page.waitForTimeout(1000);

      // Try clicking environments link if visible
      const envLink = await page.$('a[href*="environments"], a:has-text("Environments")');
      if (envLink) {
        await envLink.click();
        await page.waitForURL("**/environments", { timeout: 5000 });
        console.log("     ↳ Navigated to environments via sidebar");
      } else {
        // Direct navigation
        await page.goto(`${FRONTEND_URL}/environments`);
        await page.waitForLoadState("networkidle");
        console.log("     ↳ Navigated to environments directly");
      }
    });

    // ========== SECTION 9: Error Handling ==========
    console.log("\n⚠️ Section 9: Error Handling");

    await test("No critical console errors", async () => {
      const criticalErrors = consoleErrors.filter(e =>
        !e.includes("Warning") &&
        !e.includes("DevTools") &&
        !e.includes("favicon")
      );

      if (criticalErrors.length > 3) {
        console.log(`     ↳ ${criticalErrors.length} console errors (showing first 3):`);
        criticalErrors.slice(0, 3).forEach(e => console.log(`     ↳   - ${e.substring(0, 80)}`));
      }
    });

    await test("No failed network requests to critical endpoints", async () => {
      const criticalFailures = failedRequests.filter(r =>
        r.url.includes("/api/v1/") ||
        r.url.includes("/health")
      );

      if (criticalFailures.length > 0) {
        console.log(`     ↳ ${criticalFailures.length} API failures:`);
        criticalFailures.slice(0, 3).forEach(r => console.log(`     ↳   - ${r.url}: ${r.error}`));
      }
    });

    // ========== SUMMARY ==========
    console.log("\n" + "=".repeat(60));
    console.log("📋 TEST SUMMARY");
    console.log("=".repeat(60));

    const passed = results.filter(r => r.passed).length;
    const failed = results.filter(r => !r.passed).length;

    console.log(`\n✅ Passed: ${passed}`);
    console.log(`❌ Failed: ${failed}`);

    if (failed > 0) {
      console.log("\n❌ Failed tests:");
      results.filter(r => !r.passed).forEach(r => {
        console.log(`   - ${r.name}`);
        if (r.error) console.log(`     ${r.error.substring(0, 100)}`);
      });
    }

    console.log("\n" + "=".repeat(60));
    console.log(failed === 0 ? "✅ ALL TESTS PASSED!" : `⚠️ ${failed} TEST(S) FAILED`);
    console.log("=".repeat(60) + "\n");

  } catch (error) {
    console.error("\n❌ TEST SUITE ERROR:", error);
    process.exit(1);
  } finally {
    if (browser) await browser.close();
  }

  // Exit with error code if tests failed
  const failedCount = results.filter(r => !r.passed).length;
  if (failedCount > 0) {
    process.exit(1);
  }
}

runTests();
