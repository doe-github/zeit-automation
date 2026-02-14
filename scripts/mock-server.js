/**
 * Mock server that simulates the ZEIT login page for local testing.
 * Run with: npm run mock-server
 * Then test with: npm run toggle:mock
 */

const http = require('http');

const PORT = 3333;

// Simulated state
let isLoggedIn = false;
let isClockedIn = false;

const LOGIN_PAGE = `
<!DOCTYPE html>
<html>
<head><title>ZEIT Login (MOCK)</title></head>
<body style="font-family: sans-serif; padding: 40px; background: #f0f0f0;">
  <h1>🧪 ZEIT Mock Server - Login</h1>
  <form method="POST" action="/login">
    <div style="margin: 20px 0;">
      <label>Username:</label><br>
      <input type="text" id="txtuser-inputEl" name="username" style="padding: 10px; width: 200px;">
    </div>
    <div style="margin: 20px 0;">
      <label>Password:</label><br>
      <input type="password" id="txtpass-inputEl" name="password" style="padding: 10px; width: 200px;">
    </div>
    <a href="#" id="loginbutton" onclick="document.forms[0].submit(); return false;" 
       style="display: inline-block; padding: 10px 20px; background: #007bff; color: white; text-decoration: none; border-radius: 4px;">
      Login
    </a>
  </form>
  <p style="color: #666; margin-top: 40px;">This is a mock server for testing. Use any username/password.</p>
</body>
</html>
`;

function getDashboardPage() {
  return `
<!DOCTYPE html>
<html>
<head><title>ZEIT Dashboard (MOCK)</title></head>
<body style="font-family: sans-serif; padding: 40px; background: #e8f5e9;">
  <h1>🧪 ZEIT Mock Server - Dashboard</h1>
  <div id="TilePanel0" style="padding: 20px; background: white; border-radius: 8px; margin: 20px 0;">
    <p><strong>Status:</strong> ${isClockedIn ? '🟢 Eingestempelt' : '🔴 Ausgestempelt'}</p>
  </div>
  
  <div style="margin: 20px 0;">
    <a href="/menu" id="TileButtonPKG564" 
       style="display: inline-block; padding: 15px 30px; background: #28a745; color: white; text-decoration: none; border-radius: 4px; margin-right: 10px;">
      📋 Menü
    </a>
  </div>
  
  <p style="color: #666;">Logged in successfully! This is the mock dashboard.</p>
</body>
</html>
`;
}

function getMenuPage() {
  return `
<!DOCTYPE html>
<html>
<head><title>ZEIT Menu (MOCK)</title></head>
<body style="font-family: sans-serif; padding: 40px; background: #fff3e0;">
  <h1>🧪 ZEIT Mock Server - Menü</h1>
  <div id="TilePanel0" style="padding: 20px; background: white; border-radius: 8px; margin: 20px 0;">
    <p><strong>Status:</strong> ${isClockedIn ? '🟢 Eingestempelt' : '🔴 Ausgestempelt'}</p>
  </div>
  
  <div style="margin: 20px 0;">
    <a href="/toggle" id="TileButtonCID31513_3" 
       style="display: inline-block; padding: 15px 30px; background: ${isClockedIn ? '#dc3545' : '#007bff'}; color: white; text-decoration: none; border-radius: 4px;">
      ${isClockedIn ? '⏹️ Ausstempeln' : '▶️ Einstempeln'}
    </a>
  </div>
  
  <p><a href="/dashboard">← Zurück zum Dashboard</a></p>
</body>
</html>
`;
}

function getToggleResultPage() {
  return `
<!DOCTYPE html>
<html>
<head><title>ZEIT Toggle (MOCK)</title></head>
<body style="font-family: sans-serif; padding: 40px; background: #e3f2fd;">
  <h1>🧪 ZEIT Mock Server - Aktion ausgeführt</h1>
  <div id="TilePanel0" style="padding: 20px; background: white; border-radius: 8px; margin: 20px 0;">
    <p><strong>✅ Erfolgreich!</strong></p>
    <p><strong>Neuer Status:</strong> ${isClockedIn ? '🟢 Eingestempelt' : '🔴 Ausgestempelt'}</p>
  </div>
  
  <p><a href="/dashboard">← Zurück zum Dashboard</a></p>
</body>
</html>
`;
}

function parseFormData(body) {
  const params = new URLSearchParams(body);
  return {
    username: params.get('username'),
    password: params.get('password'),
  };
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  const path = url.pathname;

  console.log(`[MOCK] ${req.method} ${path}`);

  // Handle POST login
  if (req.method === 'POST' && path === '/login') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      const { username, password } = parseFormData(body);
      console.log(`[MOCK] Login attempt: user=${username}`);
      isLoggedIn = true;
      res.writeHead(302, { Location: '/dashboard' });
      res.end();
    });
    return;
  }

  // Routes
  if (path === '/' || path === '/login') {
    isLoggedIn = false;
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(LOGIN_PAGE);
    return;
  }

  if (path === '/dashboard') {
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(getDashboardPage());
    return;
  }

  if (path === '/menu') {
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(getMenuPage());
    return;
  }

  if (path === '/toggle') {
    isClockedIn = !isClockedIn;
    console.log(`[MOCK] Toggle! Now: ${isClockedIn ? 'clocked IN' : 'clocked OUT'}`);
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(getToggleResultPage());
    return;
  }

  // 404
  res.writeHead(404, { 'Content-Type': 'text/plain' });
  res.end('Not found');
});

server.listen(PORT, () => {
  console.log(`\n🧪 ZEIT Mock Server running at http://localhost:${PORT}\n`);
  console.log('To test with Playwright, run in another terminal:');
  console.log('  npm run toggle:mock\n');
});

