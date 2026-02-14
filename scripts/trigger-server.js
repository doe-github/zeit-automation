require('dotenv').config();

const http = require('http');
const { spawn } = require('child_process');

const DEFAULT_HOST = process.env.ZEIT_SERVER_HOST || '0.0.0.0';
const DEFAULT_PORT = parseInt(process.env.ZEIT_SERVER_PORT || '8787', 10);
const DEFAULT_TOKEN = process.env.ZEIT_TRIGGER_TOKEN || '';
const DEFAULT_DRY_RUN = (process.env.ZEIT_DRY_RUN || '').toLowerCase() === 'true';

let inFlight = false;
let lastRun = null;

function json(res, status, body) {
  const payload = JSON.stringify(body, null, 2);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(payload),
  });
  res.end(payload);
}

function getUrl(req) {
  const host = req.headers.host || 'localhost';
  return new URL(req.url || '/', `http://${host}`);
}

function isAuthorized(req, url, token) {
  if (!token) return true;
  const headerToken = req.headers['x-zeit-token'];
  const queryToken = url.searchParams.get('token');
  return headerToken === token || queryToken === token;
}

function getAction(url) {
  const action = (url.searchParams.get('action') || 'normal').toLowerCase();
  if (action !== 'normal' && action !== 'mittag') return null;
  return action;
}

function shouldDryRun(url, defaultDryRun) {
  const q = url.searchParams.get('dry_run');
  if (q === null) return defaultDryRun;
  return q === '1' || q.toLowerCase() === 'true';
}

function requireCredentials() {
  const { ZEIT_USER, ZEIT_PASS, MITARBEITER_USER, MITARBEITER_PASS } = process.env;
  return Boolean(ZEIT_USER && ZEIT_PASS && MITARBEITER_USER && MITARBEITER_PASS);
}

function startRun(action) {
  const runId = `run-${Date.now()}`;
  const child = spawn(process.execPath, ['scripts/run.js'], {
    env: { ...process.env, ACTION: action },
    stdio: 'inherit',
  });

  inFlight = true;
  lastRun = {
    id: runId,
    action,
    startedAt: new Date().toISOString(),
    pid: child.pid,
    exitCode: null,
    finishedAt: null,
  };

  child.on('exit', (code) => {
    inFlight = false;
    if (lastRun && lastRun.id === runId) {
      lastRun.exitCode = code;
      lastRun.finishedAt = new Date().toISOString();
    }
  });

  return runId;
}

function handleRequest(req, res, config) {
  const url = getUrl(req);
  const path = url.pathname;

  if (path === '/health') {
    return json(res, 200, { ok: true, inFlight, lastRun });
  }

  if (path === '/status') {
    return json(res, 200, { inFlight, lastRun });
  }

  if (path === '/trigger') {
    if (req.method !== 'POST' && req.method !== 'GET') {
      return json(res, 405, { error: 'Method not allowed' });
    }

    if (!isAuthorized(req, url, config.token)) {
      return json(res, 401, { error: 'Unauthorized' });
    }

    const action = getAction(url);
    if (!action) {
      return json(res, 400, { error: 'Missing or invalid action. Use action=normal or action=mittag.' });
    }

    const dryRun = shouldDryRun(url, config.dryRun);
    if (!dryRun && !requireCredentials()) {
      return json(res, 400, { error: 'ZEIT_USER, ZEIT_PASS, MITARBEITER_USER and MITARBEITER_PASS must be set' });
    }

    if (inFlight) {
      return json(res, 409, { error: 'A run is already in progress', lastRun });
    }

    if (dryRun) {
      const runId = `dry-${Date.now()}`;
      lastRun = {
        id: runId,
        action,
        startedAt: new Date().toISOString(),
        finishedAt: new Date().toISOString(),
        exitCode: 0,
        dryRun: true,
      };
      return json(res, 202, { ok: true, runId, dryRun: true });
    }

    const runId = startRun(action);
    return json(res, 202, { ok: true, runId });
  }

  return json(res, 404, { error: 'Not found' });
}

function createServer(options = {}) {
  const config = {
    host: options.host || DEFAULT_HOST,
    port: typeof options.port === 'number' ? options.port : DEFAULT_PORT,
    token: typeof options.token === 'string' ? options.token : DEFAULT_TOKEN,
    dryRun: typeof options.dryRun === 'boolean' ? options.dryRun : DEFAULT_DRY_RUN,
  };

  const server = http.createServer((req, res) => {
    try {
      handleRequest(req, res, config);
    } catch (error) {
      json(res, 500, { error: 'Internal server error', detail: error.message });
    }
  });

  return { server, config };
}

if (require.main === module) {
  const { server, config } = createServer();
  server.listen(config.port, config.host, () => {
    console.log(`ZEIT trigger server listening on http://${config.host}:${config.port}`);
  });
}

module.exports = { createServer };
