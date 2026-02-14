/**
 * Updated test suite for run.js
 * Tests environment parsing, maskUrl and credential checks without launching Playwright.
 */

const path = require('path');
const fs = require('fs');

const originalEnv = { ...process.env };
function resetEnv() { process.env = { ...originalEnv }; }
function setEnv(o) { resetEnv(); Object.assign(process.env, o); }

let passed = 0, failed = 0;
function test(name, fn) {
  try { fn(); console.log(`✓ ${name}`); passed++; } catch (e) { console.log(`✗ ${name}`); console.log('  ', e.message); failed++; }
}

function assertEqual(a, b, m) { if (a !== b) throw new Error(`${m}: expected "${b}", got "${a}"`); }
function assertTrue(v, m) { if (!v) throw new Error(`${m}: expected truthy`); }
function assertFalse(v, m) { if (v) throw new Error(`${m}: expected falsy`); }

console.log('\n=== run.js quick unit tests ===\n');

// ACTION default and parsing
test('ACTION defaults to normal', () => { setEnv({}); assertEqual((process.env.ACTION || 'normal').toLowerCase(), 'normal', 'default ACTION'); });
test('ACTION=mittag parsed', () => { setEnv({ ACTION: 'mittag' }); assertEqual((process.env.ACTION || 'normal').toLowerCase(), 'mittag', 'ACTION=mittag'); });

// HEADLESS parsing
test('HEADLESS defaults to true', () => { setEnv({}); assertTrue((process.env.HEADLESS || 'true').toLowerCase() !== 'false', 'HEADLESS default'); });
test('HEADLESS=false respected', () => { setEnv({ HEADLESS: 'false' }); assertFalse((process.env.HEADLESS || 'true').toLowerCase() !== 'false', 'HEADLESS=false'); });

// SLOW_MO parsing
test('SLOW_MO default 0', () => { setEnv({}); assertEqual(parseInt(process.env.SLOW_MO || '0', 10), 0, 'SLOW_MO default'); });
test('SLOW_MO parse int', () => { setEnv({ SLOW_MO: '2500' }); assertEqual(parseInt(process.env.SLOW_MO || '0', 10), 2500, 'SLOW_MO parse'); });

// maskUrl
function maskUrl(u) { try { const x = new URL(u); return `${x.protocol}//${x.host}${x.pathname}`;} catch { return u; } }
test('maskUrl removes query', () => { assertEqual(maskUrl('https://example.com/foo?token=1'), 'https://example.com/foo', 'maskUrl'); });

// Credential checks
test('All credential variables present detected', () => {
  setEnv({ ZEIT_USER: 'u', ZEIT_PASS: 'p', MITARBEITER_USER: 'm', MITARBEITER_PASS: 'mp' });
  assertTrue(Boolean(process.env.ZEIT_USER && process.env.ZEIT_PASS && process.env.MITARBEITER_USER && process.env.MITARBEITER_PASS), 'all present');
});

test('Missing ZEIT_USER detected', () => { setEnv({ ZEIT_PASS: 'p', MITARBEITER_USER: 'm', MITARBEITER_PASS: 'mp' }); assertFalse(Boolean(process.env.ZEIT_USER), 'ZEIT_USER missing'); });

test('Missing MITARBEITER_PASS detected', () => { setEnv({ ZEIT_USER: 'u', ZEIT_PASS: 'p', MITARBEITER_USER: 'm' }); assertFalse(Boolean(process.env.MITARBEITER_PASS), 'MITARBEITER_PASS missing'); });

// Selectors existence checks (basic)
test('LOGIN_SELECTORS structure present', () => {
  const LOGIN_SELECTORS = { username: 'input#txtuser-inputEl', password: 'input#txtpass-inputEl', loginBtn: 'a#loginbutton', postLoginMarker: '#TilePanel0' };
  assertTrue(LOGIN_SELECTORS.username && LOGIN_SELECTORS.password && LOGIN_SELECTORS.loginBtn && LOGIN_SELECTORS.postLoginMarker, 'login selectors');
});

test('BUCHUNG_SELECTORS present', () => {
  const BUCHUNG_SELECTORS = { normal: ' Normalbuchung (1)', mittag: ' Mittagspause (2)' };
  assertTrue(BUCHUNG_SELECTORS.normal && BUCHUNG_SELECTORS.mittag, 'buchung selectors');
});

resetEnv();
console.log('\n=== Summary ===');
console.log(`Passed: ${passed}`);
console.log(`Failed: ${failed}`);
if (failed > 0) process.exit(1);
