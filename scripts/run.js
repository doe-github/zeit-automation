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

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    // Navigate to ZEIT login page
    console.log('Navigating to login page...');
    await page.goto(ZEIT_BASE_URL);

    // TODO: Update these selectors based on actual ZEIT login page structure
    // Login
    console.log('Logging in...');
    await page.fill('input#txtuser-inputEl', ZEIT_USER);
    await page.fill('input#txtpass-inputEl', ZEIT_PASS);
    await page.click('a#loginbutton');
    
    // Wait for navigation after login
    await page.waitForLoadState('networkidle');
    console.log('Login successful');

    if (ACTION === 'toggle') {
      // TODO: Update selector for toggle button
      console.log('Clicking toggle button (in/out)...');
      await page.click('a#TileButtonPKG564');
      await page.waitForLoadState('networkidle')
      await page.click('a#TileButtonCID31513_3')
      console.log('successfully navigated to the clock-in/out page')
      // TODO: Replace with page.waitForSelector() for success indicator
      // Example: await page.waitForSelector('.success-message', { timeout: 5000 });
      await page.waitForLoadState('networkidle');
      console.log('Toggle action completed');
    } else if (ACTION === 'break') {
      // TODO: Update selector for break/lunch button
      console.log('Clicking break (lunch) button...');
      await page.click('button[data-action="break"]');
      // TODO: Replace with page.waitForSelector() for success indicator
      // Example: await page.waitForSelector('.break-confirmation', { timeout: 5000 });
      await page.waitForLoadState('networkidle');
      console.log('Break action completed');
    } else {
      throw new Error(`Unknown action: ${ACTION}. Valid actions are: toggle, break`);
    }

    console.log('Action completed successfully!');

  } catch (error) {
    console.error('Error occurred:', error);

    // Capture screenshot and HTML on failure
    const errorTimestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const screenshotPath = path.join(process.cwd(), `error-screenshot-${errorTimestamp}.png`);
    const htmlPath = path.join(process.cwd(), `error-page-${errorTimestamp}.html`);

    try {
      await page.screenshot({ path: screenshotPath, fullPage: true });
      console.log(`Screenshot saved to: ${screenshotPath}`);

      const html = await page.content();
      fs.writeFileSync(htmlPath, html);
      console.log(`HTML saved to: ${htmlPath}`);
    } catch (captureError) {
      console.error('Failed to capture error artifacts:', captureError);
    }

    await browser.close();
    process.exit(1);
  }

  await browser.close();
}

run();
