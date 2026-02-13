const { chromium, request } = require('playwright');
const fs = require('fs');
const path = require('path');
const dns = require('dns').promises;

// Env
const ZEIT_USER = process.env.ZEIT_USER;
const ZEIT_PASS = process.env.ZEIT_PASS;
const ZEIT_BASE_URL = process.env.ZEIT_BASE_URL || 'https://zeit.niceshops.cloud/';
const ACTION = process.env.ACTION || 'toggle';
const DEBUG = (process.env.DEBUG || '').toLowerCase() === 'true';

// If ZEIT_BASE_URL changes host, update this to match the real hostname.
const HOST = 'zeit.niceshops.cloud';

// Selectors (known)
const SELECTORS = {
  username: 'input#txtuser-inputEl',
  password: 'input#txtpass-inputEl',
  loginBtn: 'a#loginbutton',
  postLoginMarker: '#TilePanel0',

  // TODO verify these remain stable:
  menuPkg: 'a#TileButtonPKG564',
  clockInOut: 'a#TileButtonCID31513_3',
};

function ensureDir(p) {
  fs.mkdirSync(p, { recursive: true });
}

async function saveArtifacts(page, tag) {
  const dir = path.join(process.cwd(), 'artifacts');
  ensureDir(dir);
  const ts = new Date().toISOString().replace(/[:.]/g, '-');

  try {
    await page.screenshot({ path: path.join(dir, `${tag}-${ts}.png`), fullPage: true, timeout: 5000 });
  } catch (e) {
    console.log(`Artifact screenshot failed (ignored): ${e.message}`);
  }

  try {
    const html = await page.content();
    fs.writeFileSync(path.join(dir, `${tag}-${ts}.html`), html, 'utf-8');
  } catch (e) {
    console.log(`Artifact html dump failed (ignored): ${e.message}`);
  }
}

function maskUrl(u) {
  // keep host visible for debugging; mask rest if needed
  try {
    const x = new URL(u);
    return `${x.protocol}//${x.host}${x.pathname}`;
  } catch {
    return u;
  }
}

async function run() {
  if (!ZEIT_USER || !ZEIT_PASS) {
    console.error('Error: ZEIT_USER and ZEIT_PASS environment variables are required');
    process.exit(1);
  }

  console.log('Starting ZEIT automation...');
  console.log(`Base URL: ${maskUrl(ZEIT_BASE_URL)}`);
  console.log(`Action: ${ACTION}`);
  console.log(`User: ${ZEIT_USER}`);
  console.log(`Debug: ${DEBUG}`);

  // 1) Resolve IPv4 to avoid IPv6 routing/timeouts differences
  let ipv4 = null;
  try {
    const ips = await dns.resolve4(HOST);
    ipv4 = ips && ips.length ? ips[0] : null;
    console.log(`DNS resolve4(${HOST}) -> ${ips.join(', ')}`);
  } catch (e) {
    console.log(`DNS resolve4 failed (continuing): ${e.message}`);
  }

  // 2) Playwright HTTP smoke test (no browser) – helps confirm reachability from runner
  try {
    const api = await request.newContext({
      userAgent: 'Mozilla/5.0',
      ignoreHTTPSErrors: true,
    });
    const resp = await api.get(ZEIT_BASE_URL, { timeout: 30_000 });
    console.log(`HTTP smoke test: status=${resp.status()} url=${maskUrl(resp.url())}`);
    await api.dispose();
  } catch (e) {
    console.log(`HTTP smoke test failed (continuing): ${e.message}`);
  }

  const launchArgs = ['--disable-dev-shm-usage', '--no-sandbox'];

  // Force hostname -> IPv4 mapping if we have it
  if (ipv4) {
    // Keep SNI/Host the same; Chrome will connect to the mapped IP.
    // EXCLUDE localhost prevents breaking local connections.
    launchArgs.push(`--host-resolver-rules=MAP ${HOST} ${ipv4},EXCLUDE localhost`);
    console.log(`Using host-resolver-rules to force IPv4: ${HOST} -> ${ipv4}`);
  } else {
    console.log('No IPv4 resolved; launching without host mapping.');
  }

  const browser = await chromium.launch({
    headless: true,
    args: launchArgs,
  });

  const context = await browser.newContext({
    userAgent:
      'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36',
    ignoreHTTPSErrors: true,
  });

  const page = await context.newPage();

  page.setDefaultNavigationTimeout(90_000);
  page.setDefaultTimeout(30_000);

  // Network diagnostics
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
    await page.goto(ZEIT_BASE_URL, { waitUntil: 'commit', timeout: 90_000 });
    await page.waitForSelector('html', { timeout: 30_000 });

    if (DEBUG) await saveArtifacts(page, 'after-goto');

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

    if (DEBUG) await saveArtifacts(page, 'after-login');

    if (ACTION === 'toggle') {
      console.log('Toggle: navigating to clock in/out...');
      await page.click(SELECTORS.menuPkg, { timeout: 30_000 });
      await page.waitForLoadState('domcontentloaded');

      await page.click(SELECTORS.clockInOut, { timeout: 30_000 });
      await page.waitForLoadState('domcontentloaded');

      console.log('Toggle action completed');
    } else if (ACTION === 'break') {
      console.log('Break: navigating to lunch/break...');
      // TODO: implement the real break click once known
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
    await saveArtifacts(page, 'error');
    await browser.close();
    process.exit(1);
  }
}

run();