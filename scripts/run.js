require('dotenv').config();

const { chromium, request } = require('playwright');
const fs = require('fs');
const path = require('path');
const dns = require('dns').promises;

// Env - Website Login Credentials
const ZEIT_USER = process.env.ZEIT_USER;        // Login Username für die Website
const ZEIT_PASS = process.env.ZEIT_PASS;        // Login Passwort für die Website

// Env - Mitarbeiter Credentials (für Buchung)
const MITARBEITER_USER = process.env.MITARBEITER_USER;  // Mitarbeiternummer (z.B. 508)
const MITARBEITER_PASS = process.env.MITARBEITER_PASS;  // Mitarbeiter-PIN (z.B. 2122)

const ZEIT_BASE_URL = process.env.ZEIT_BASE_URL || 'https://zeit.niceshops.cloud/';
const ACTION = (process.env.ACTION || 'normal').toLowerCase();  // 'normal' oder 'mittag'
const DEBUG = (process.env.DEBUG || '').toLowerCase() === 'true';
const HEADLESS = (process.env.HEADLESS || 'true').toLowerCase() !== 'false';
const SLOW_MO = parseInt(process.env.SLOW_MO || '0', 10);
const TIMEOUT_ACTION = parseInt(process.env.TIMEOUT_ACTION || '30000', 10);

// Login Selectors
const LOGIN_SELECTORS = {
  username: 'input#txtuser-inputEl',
  password: 'input#txtpass-inputEl',
  loginBtn: 'a#loginbutton',
  postLoginMarker: '#TilePanel0',  // Element das nach Login erscheint
};

// Buchungstyp Selectors
const BUCHUNG_SELECTORS = {
  normal: ' Normalbuchung (1)',    // gridcell name für Normalbuchung
  mittag: ' Mittagspause (2)',     // gridcell name für Mittagspause - ANPASSEN falls anders!
};

// If ZEIT_BASE_URL changes host, update this to match the real hostname.
const HOST = new URL(ZEIT_BASE_URL).hostname;

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
  try {
    const x = new URL(u);
    return `${x.protocol}//${x.host}${x.pathname}`;
  } catch {
    return u;
  }
}

async function run() {
  // Validate ACTION
  if (ACTION !== 'normal' && ACTION !== 'mittag') {
    console.error(`Error: Invalid ACTION "${ACTION}". Use 'normal' or 'mittag'.`);
    process.exit(1);
  }

  if (!ZEIT_USER || !ZEIT_PASS) {
    console.error('Error: ZEIT_USER and ZEIT_PASS environment variables are required for website login');
    process.exit(1);
  }

  if (!MITARBEITER_USER || !MITARBEITER_PASS) {
    console.error('Error: MITARBEITER_USER (Mitarbeiternummer) and MITARBEITER_PASS (PIN) environment variables are required');
    process.exit(1);
  }

  const buchungTyp = ACTION === 'mittag' ? 'Mittagspause' : 'Normalbuchung';

  console.log('Starting ZEIT automation...');
  console.log(`Base URL: ${maskUrl(ZEIT_BASE_URL)}`);
  console.log(`Action: ${ACTION} (${buchungTyp})`);
  console.log(`Login User: ${ZEIT_USER}`);
  console.log(`Mitarbeiter: ${MITARBEITER_USER}`);
  console.log(`Debug: ${DEBUG}`);
  console.log(`Headless: ${HEADLESS}`);
  console.log(`SlowMo: ${SLOW_MO}ms`);

  // 1) Resolve IPv4 to avoid IPv6 routing/timeouts differences
  let ipv4 = null;
  try {
    const ips = await dns.resolve4(HOST);
    ipv4 = ips && ips.length ? ips[0] : null;
    console.log(`DNS resolve4(${HOST}) -> ${ips.join(', ')}`);
  } catch (e) {
    console.log(`DNS resolve4 failed (continuing): ${e.message}`);
  }

  // 2) HTTP smoke test
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

  if (ipv4) {
    launchArgs.push(`--host-resolver-rules=MAP ${HOST} ${ipv4},EXCLUDE localhost`);
    console.log(`Using host-resolver-rules to force IPv4: ${HOST} -> ${ipv4}`);
  }

  const browser = await chromium.launch({
    headless: HEADLESS,
    slowMo: SLOW_MO,
    args: launchArgs,
  });

  const context = await browser.newContext({
    userAgent:
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    ignoreHTTPSErrors: true,
  });

  const page = await context.newPage();
  page.setDefaultNavigationTimeout(90_000);
  page.setDefaultTimeout(TIMEOUT_ACTION);

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
    // ========== STEP 1: Navigate to ZEIT ==========
    console.log('Navigating to ZEIT...');
    await page.goto(ZEIT_BASE_URL, { waitUntil: 'domcontentloaded', timeout: 90_000 });

    if (DEBUG) await saveArtifacts(page, 'after-goto');

    // ========== STEP 2: Login ==========
    console.log('Waiting for login form...');
    await page.locator(LOGIN_SELECTORS.username).waitFor({ state: 'visible', timeout: 60_000 });
    await page.locator(LOGIN_SELECTORS.password).waitFor({ state: 'visible', timeout: 60_000 });

    console.log('Logging in...');
    await page.fill(LOGIN_SELECTORS.username, ZEIT_USER);
    await page.fill(LOGIN_SELECTORS.password, ZEIT_PASS);
    await page.click(LOGIN_SELECTORS.loginBtn, { timeout: TIMEOUT_ACTION });

    console.log('Waiting for post-login UI...');
    await page.locator(LOGIN_SELECTORS.postLoginMarker).waitFor({ state: 'visible', timeout: 60_000 });
    console.log('Login successful');

    if (DEBUG) await saveArtifacts(page, 'after-login');

    // ========== STEP 3: Click ZEIT button ==========
    console.log('Clicking ZEIT button...');
    await page.getByRole('button', { name: 'ZEIT', exact: true }).click();
    await page.waitForLoadState('domcontentloaded');

    if (DEBUG) await saveArtifacts(page, 'after-zeit-click');

    // ========== STEP 4: Click Buchen button ==========
    console.log('Clicking Buchen button...');
    await page.getByRole('button', { name: 'Buchen', exact: true }).click();
    await page.waitForLoadState('domcontentloaded');

    if (DEBUG) await saveArtifacts(page, 'after-buchen-click');

    // ========== STEP 5: Select Buchungstyp (Normalbuchung oder Mittagspause) ==========
    const buchungSelector = BUCHUNG_SELECTORS[ACTION];
    console.log(`Selecting ${buchungTyp}...`);
    await page.getByRole('gridcell', { name: buchungSelector }).getByRole('checkbox').click();

    if (DEBUG) await saveArtifacts(page, `after-${ACTION}-select`);

    // ========== STEP 6: Enter Mitarbeiternummer ==========
    console.log('Entering Mitarbeiternummer...');
    const mitarbeiterInput = page.locator('input[id*="CID4079551"]').first();
    await mitarbeiterInput.click();
    await mitarbeiterInput.fill(MITARBEITER_USER);
    await mitarbeiterInput.press('Enter');
    await page.waitForTimeout(500); // Kurz warten für Auto-Complete

    if (DEBUG) await saveArtifacts(page, 'after-mitarbeiternummer');

    // ========== STEP 7: Enter Passwort ==========
    console.log('Entering Mitarbeiter-PIN...');
    const passwortInput = page.locator('input[id*="CID4081960"]').first();
    await passwortInput.click();
    await passwortInput.fill(MITARBEITER_PASS);

    if (DEBUG) await saveArtifacts(page, 'after-passwort');

    // ========== STEP 8: Click Übernehmen ==========
    console.log('Clicking Übernehmen...');
    await page.getByTitle('Übernehmen').click();
    await page.waitForLoadState('domcontentloaded');

    if (DEBUG) await saveArtifacts(page, 'after-uebernehmen');

    // ========== STEP 9: Bestätigen (falls vorhanden) ==========
    console.log('Looking for confirmation button...');
    try {
      await page.waitForTimeout(1000);
      const confirmButton = page.getByRole('button', { name: /bestätigen|ok|ja|speichern/i }).first();
      if (await confirmButton.isVisible({ timeout: 3000 })) {
        console.log('Clicking confirmation button...');
        await confirmButton.click();
        await page.waitForLoadState('domcontentloaded');
      }
    } catch (e) {
      console.log('No confirmation button found (might not be needed)');
    }

    if (DEBUG) await saveArtifacts(page, 'final');

    console.log(`✅ ${buchungTyp} erfolgreich abgeschlossen!`);
    await browser.close();

  } catch (error) {
    console.error('❌ Error occurred:', error.message);
    await saveArtifacts(page, 'error');
    await browser.close();
    process.exit(1);
  }
}

run();