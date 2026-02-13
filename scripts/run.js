const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

// Read environment variables
const ZEIT_USER = process.env.ZEIT_USER;
const ZEIT_PASS = process.env.ZEIT_PASS;
const ZEIT_BASE_URL = process.env.ZEIT_BASE_URL || 'https://zeit.niceshops.cloud/';
const ACTION = process.env.ACTION || 'toggle';

async function run() {
  if (!ZEIT_USER || !ZEIT_PASS) {
    console.error('Error: ZEIT_USER and ZEIT_PASS environment variables are required');
    process.exit(1);
  }

  console.log(`Starting ZEIT automation...`);
  console.log(`Base URL: ${ZEIT_BASE_URL}`);
  console.log(`Action: ${ACTION}`);
  console.log(`User: ${ZEIT_USER}`);

  const browser = await chromium.launch({
    headless: true,
    args: ['--disable-dev-shm-usage', '--no-sandbox'],
  });

  const context = await browser.newContext();
  const page = await context.newPage();

  // Runner-friendly timeouts
  page.setDefaultNavigationTimeout(90_000);
  page.setDefaultTimeout(30_000);

  try {
    // Navigate to ZEIT login page (avoid waiting for full "load")
    console.log('Navigating to login page...');
    await page.goto(ZEIT_BASE_URL, { waitUntil: 'domcontentloaded', timeout: 90_000 });

    // Wait for login inputs to be visible
    console.log('Waiting for login inputs...');
    await page.locator('input#txtuser-inputEl').waitFor({ state: 'visible', timeout: 60_000 });
    await page.locator('input#txtpass-inputEl').waitFor({ state: 'visible', timeout: 60_000 });

    // Login
    console.log('Logging in...');
    await page.fill('input#txtuser-inputEl', ZEIT_USER);
    await page.fill('input#txtpass-inputEl', ZEIT_PASS);

    // Click login button (ExtJS sometimes needs the element, not necessarily a nested span)
    await page.click('a#loginbutton', { timeout: 30_000 });

    // Wait for post-login UI (prefer a concrete element over networkidle)
    console.log('Waiting for post-login UI...');
    await page.locator('#TilePanel0').waitFor({ state: 'visible', timeout: 60_000 });
    console.log('Login successful (TilePanel0 visible)');

    if (ACTION === 'toggle') {
      console.log('Clicking toggle button (in/out)...');

      // NOTE: consider replacing these waits with specific element waits if they become flaky
      await page.click('a#TileButtonPKG564', { timeout: 30_000 });
      await page.waitForLoadState('domcontentloaded');

      await page.click('a#TileButtonCID31513_3', { timeout: 30_000 });
      await page.waitForLoadState('domcontentloaded');

      console.log('successfully navigated to the clock-in/out page');
      console.log('Toggle action completed');
    } else if (ACTION === 'break') {
      console.log('Clicking break (lunch) button...');

      await page.click('a#TileButtonPKG564', { timeout: 30_000 });
      await page.waitForLoadState('domcontentloaded');

      await page.click('a#TileButtonCID31513_3', { timeout: 30_000 });
      await page.waitForLoadState('domcontentloaded');

      console.log('successfully navigated to the clock-in/out page');
      console.log('Break action completed');
    } else {
      throw new Error(`Unknown action: ${ACTION}. Valid actions are: toggle, break`);
    }

    console.log('Action completed successfully!');
  } catch (error) {
    console.error('Error occurred:', error);

    // Capture screenshot and HTML on failure (never let artifact capture block the job)
    const errorTimestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const artifactsDir = path.join(process.cwd(), 'artifacts');
    fs.mkdirSync(artifactsDir, { recursive: true });

    const screenshotPath = path.join(artifactsDir, `error-${errorTimestamp}.png`);
    const htmlPath = path.join(artifactsDir, `error-${errorTimestamp}.html`);

    try {
      await page.screenshot({ path: screenshotPath, fullPage: true, timeout: 5000 });
      console.log(`Screenshot saved: ${screenshotPath}`);
    } catch (e) {
      console.log(`Screenshot failed (ignored): ${e.message}`);
    }

    try {
      const html = await page.content();
      fs.writeFileSync(htmlPath, html, 'utf-8');
      console.log(`HTML saved: ${htmlPath}`);
    } catch (e) {
      console.log(`HTML dump failed (ignored): ${e.message}`);
    }

    await browser.close();
    process.exit(1);
  }

  await browser.close();
}

run();
