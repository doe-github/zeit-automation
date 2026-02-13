// scripts/run.js
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

// Env
const ZEIT_USER = process.env.ZEIT_USER;
const ZEIT_PASS = process.env.ZEIT_PASS;
const ZEIT_BASE_URL = process.env.ZEIT_BASE_URL || 'https://zeit.niceshops.cloud/';
const ACTION = process.env.ACTION || 'toggle';
const DEBUG = (process.env.DEBUG || '').toLowerCase() === 'true';

// Known selectors (from your earlier findings)
const SELECTORS = {
  username: 'input#txtuser-inputEl',
  password: 'input#txtpass-inputEl',
  loginBtn: 'a#loginbutton',

  // Post-login marker (adjust if needed)
  postLoginMarker: '#TilePanel0',

  // TODO: verify these are stable after login
  menuPkg: 'a#TileButtonPKG564',
  clockInOut: 'a#TileButtonCID31513_3',
};

function ensureDir(p) {
  fs.mkdirSync(p, { recursive: true });
}

async function saveDebugArtifacts(page, tag) {
  const artifactsDir = path.join(process.cwd(), 'artifacts');
  ensureDir(artifactsDir);
  const ts = new Date().toISOString().replace(/[:.]/g, '-');

  // screenshot (never block the run)
  try {
    await page.screenshot({ path: path.join(artifactsDir, `${tag}-${ts}.png`), fullPage: true, timeout: 5000 });
  } catch (e) {
    console.log(`Artifact screenshot failed (ignored): ${e.message}`);
  }

  // html dump (can fail while navigating)
  try {
    const html = await page.content();
    fs.writeFileSync(path.join(artifactsDir, `${tag}-${ts}.html`), html, 'utf-8');
  } catch (e) {
    console.log(`Artifact html dump failed (ignored): ${e.message}`);
  }
}

async function run() {
  if (!ZEIT_USER || !ZEIT_PASS) {
    console.error('Error: ZEIT_USER and ZEIT_PASS environment variables are required');
    process.exit(1);
  }

  console.log('Starting ZEIT automation...');
  console.log(`Base URL: ${ZEIT_BASE_URL}`);
  console.log(`Action: ${ACTION}`);
  console.log(`User: ${ZEIT_USER}`);
  console.log(`Debug: ${DEBUG}`);

  const browser = await chromium.launch({
    headless: true,
    args: ['--disable-dev-shm-usage', '--no-sandbox'],
  });

  const context = await browser.newContext({
    userAgent:
      'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36',
  });

  const page = await context.newPage();

  // Timeouts
  page.setDefaultNavigationTimeout(90_000);
  page.setDefaultTimeout(30_000);

  // Navigation / network debug
  page.on('requestfailed', (r) => console.log('REQ FAILED:', r.url(), r.failure()?.errorText));
  page.on('response', (r) => {
    const s = r.status();
    if (s >= 400) console.log('HTTP', s, r.url());
  });
  page.on('framenavigated', (f) => {
    if (f === page.mainFrame()) console.log('NAV ->', f.url());
  });

  try {
    console.log('Navigating to login page...');
    // commit is more tolerant than domcontentloaded/load (helps with SPAs / hanging resources)
    await page.goto(ZEIT_BASE_URL, { waitUntil: 'commit', timeout: 90_000 });
    await page.waitForSelector('html', { timeout: 30_000 });

    if (DEBUG) await saveDebugArtifacts(page, 'after-goto');

    console.log('Waiting for login inputs...');
    await page.locator(SELECTORS.username).waitFor({ state: 'visible', timeout: 60_000 });
    await page.locator(SELECTORS.password).waitFor({ state: 'visible', timeout: 60_000 });

    console.log('Logging in...');
    await page.fill(SELECTORS.username, ZEIT_USER);
    await page.fill(SELECTORS.password, ZEIT_PASS);
    await page.click(SELECTORS.loginBtn, { timeout: 30_000 });

    console.log('Waiting for post-login UI...');
    await page.locator(SELECTORS.postLoginMarker).waitFor({ state: 'visible', timeout: 60_000 });
    console.log('Login successful');

    if (DEBUG) await saveDebugArtifacts(page, 'after-login');

    if (ACTION === 'toggle') {
      console.log('Toggle: navigating to clock in/out...');
      await page.click(SELECTORS.menuPkg, { timeout: 30_000 });
      await page.waitForLoadState('domcontentloaded');

      await page.click(SELECTORS.clockInOut, { timeout: 30_000 });
      await page.waitForLoadState('domcontentloaded');

      console.log('Toggle action completed');
    } else if (ACTION === 'break') {
      console.log('Break: navigating to lunch/break...');
      // TODO: Replace with the actual break action selector once known.
      // For now this mirrors your navigation path.
      await page.click(SELECTORS.menuPkg, { timeout: 30_000 });
      await page.waitForLoadState('domcontentloaded');

      await page.click(SELECTORS.clockInOut, { timeout: 30_000 });
      await page.waitForLoadState('domcontentloaded');

      console.log('Break action completed (TODO: implement actual break click)');
    } else {
      throw new Error(`Unknown action: ${ACTION}. Valid actions are: toggle, break`);
    }

    console.log('Action completed successfully!');
    await browser.close();
  } catch (error) {
    console.error('Error occurred:', error);
    await saveDebugArtifacts(page, 'error');
    await browser.close();
    process.exit(1);
  }
}

run();