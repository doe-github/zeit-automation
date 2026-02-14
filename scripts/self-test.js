/**
 * Self-test for trigger-server.js
 * Tests the HTTP endpoints without launching Playwright.
 */

const http = require('http');
const { createServer } = require('./trigger-server');

function request({ method, port, path, token }) {
  return new Promise((resolve, reject) => {
    const req = http.request(
      {
        method,
        host: '127.0.0.1',
        port,
        path,
        headers: token ? { 'x-zeit-token': token } : {},
      },
      (res) => {
        let body = '';
        res.on('data', (chunk) => {
          body += chunk.toString('utf-8');
        });
        res.on('end', () => {
          try {
            const parsed = body ? JSON.parse(body) : {};
            resolve({ status: res.statusCode, body: parsed });
          } catch (e) {
            resolve({ status: res.statusCode, body: body });
          }
        });
      }
    );
    req.on('error', reject);
    req.end();
  });
}

async function run() {
  console.log('\n=== Trigger Server Self-Test ===\n');

  const token = 'test-token';
  const { server } = createServer({ host: '127.0.0.1', port: 0, token, dryRun: true });

  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const port = server.address().port;
  console.log(`Server started on port ${port}`);

  let passed = 0;
  let failed = 0;

  // Test 1: Health endpoint
  try {
    const health = await request({ method: 'GET', port, path: '/health', token });
    if (health.status !== 200) throw new Error(`Expected 200, got ${health.status}`);
    if (!health.body.ok) throw new Error('Expected ok: true');
    console.log('✓ GET /health returns 200');
    passed++;
  } catch (e) {
    console.log(`✗ GET /health: ${e.message}`);
    failed++;
  }

  // Test 2: Status endpoint
  try {
    const status = await request({ method: 'GET', port, path: '/status', token });
    if (status.status !== 200) throw new Error(`Expected 200, got ${status.status}`);
    console.log('✓ GET /status returns 200');
    passed++;
  } catch (e) {
    console.log(`✗ GET /status: ${e.message}`);
    failed++;
  }

  // Test 3: Trigger with action=normal (dry run)
  try {
    const trigger = await request({ method: 'POST', port, path: '/trigger?action=normal&dry_run=1', token });
    if (trigger.status !== 202) throw new Error(`Expected 202, got ${trigger.status}`);
    if (!trigger.body.ok) throw new Error('Expected ok: true');
    if (!trigger.body.dryRun) throw new Error('Expected dryRun: true');
    console.log('✓ POST /trigger?action=normal&dry_run=1 returns 202');
    passed++;
  } catch (e) {
    console.log(`✗ POST /trigger?action=normal: ${e.message}`);
    failed++;
  }

  // Test 4: Trigger with action=mittag (dry run)
  try {
    const trigger = await request({ method: 'POST', port, path: '/trigger?action=mittag&dry_run=1', token });
    if (trigger.status !== 202) throw new Error(`Expected 202, got ${trigger.status}`);
    console.log('✓ POST /trigger?action=mittag&dry_run=1 returns 202');
    passed++;
  } catch (e) {
    console.log(`✗ POST /trigger?action=mittag: ${e.message}`);
    failed++;
  }

  // Test 5: Invalid action
  try {
    const trigger = await request({ method: 'POST', port, path: '/trigger?action=invalid', token });
    if (trigger.status !== 400) throw new Error(`Expected 400, got ${trigger.status}`);
    console.log('✓ POST /trigger?action=invalid returns 400');
    passed++;
  } catch (e) {
    console.log(`✗ POST /trigger?action=invalid: ${e.message}`);
    failed++;
  }

  // Test 6: Missing token (should fail with 401) -- only when DEFAULT_TOKEN set
  try {
    const trigger = await request({ method: 'POST', port, path: '/trigger?action=normal&dry_run=1' });
    if (trigger.status !== 401) throw new Error(`Expected 401, got ${trigger.status}`);
    console.log('✓ POST without token returns 401');
    passed++;
  } catch (e) {
    console.log(`✗ POST without token: ${e.message}`);
    failed++;
  }

  // Test 7: Wrong token (should fail with 401)
  try {
    const trigger = await request({ method: 'POST', port, path: '/trigger?action=normal&dry_run=1', token: 'wrong-token' });
    if (trigger.status !== 401) throw new Error(`Expected 401, got ${trigger.status}`);
    console.log('✓ POST with wrong token returns 401');
    passed++;
  } catch (e) {
    console.log(`✗ POST with wrong token: ${e.message}`);
    failed++;
  }

  // Test 8: 404 for unknown path
  try {
    const notFound = await request({ method: 'GET', port, path: '/unknown', token });
    if (notFound.status !== 404) throw new Error(`Expected 404, got ${notFound.status}`);
    console.log('✓ GET /unknown returns 404');
    passed++;
  } catch (e) {
    console.log(`✗ GET /unknown: ${e.message}`);
    failed++;
  }

  server.close();

  console.log('\n=== Test Summary ===');
  console.log(`Passed: ${passed}`);
  console.log(`Failed: ${failed}`);

  if (failed > 0) {
    process.exit(1);
  }
  console.log('\n✅ All self-tests passed!\n');
}

run().catch((error) => {
  console.error('Self-test failed:', error.message);
  process.exit(1);
});
