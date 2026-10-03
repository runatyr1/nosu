import http from 'node:http';
import net from 'node:net';
import dgram from 'node:dgram';
import fs from 'node:fs';
import { randomBytes, timingSafeEqual } from 'node:crypto';

const PORT = Number(process.env.PORT || 3401);
const CONTROLLER_ORIGIN = process.env.CONTROLLER_ORIGIN;
const CONTROLLER_PIN = process.env.CONTROLLER_PIN || '';
const PUBLIC_DASHBOARD = process.env.PUBLIC_DASHBOARD === 'true';
if (!CONTROLLER_ORIGIN || !/^https?:\/\/[^/]+$/.test(CONTROLLER_ORIGIN)) throw new Error('CONTROLLER_ORIGIN must be an HTTP origin');
if (PUBLIC_DASHBOARD && !/^\d{4,12}$/.test(CONTROLLER_PIN)) throw new Error('CONTROLLER_PIN must contain 4 to 12 digits when the dashboard is public');
const sessionToken = randomBytes(32).toString('hex');
const html = fs.readFileSync(new URL('./index.html', import.meta.url));
const LOG_SERVICES = new Set(['nosu', 'groups', 'postgres', 'ingress', 'trending', 'ditto-relay', 'ditto-sync', 'opensearch']);
const logs = new Map([...LOG_SERVICES].map(name => [name, []]));
let nextLogId = 0;

// Docker forwards these services' stdout/stderr using its syslog driver. The
// collector never sees the Docker socket and retains only recent entries.
const syslog = dgram.createSocket('udp4');
syslog.on('message', (packet) => {
  const line = packet.toString('utf8');
  const match = /^<\d+>1 \S+ \S+ (\S+) \S+ \S+ - (.*)$/s.exec(line);
  if (!match || !LOG_SERVICES.has(match[1])) return;
  const entries = logs.get(match[1]);
  entries.push({ id: ++nextLogId, at: new Date().toISOString(), text: match[2].slice(0, 16000) });
  if (entries.length > 2000) entries.splice(0, entries.length - 2000);
});
syslog.on('error', error => console.error('Log collector error:', error));
syslog.bind(5514, '0.0.0.0');

async function checkHttp(url) {
  const start = Date.now();
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(4000), cache: 'no-store' });
    return { ok: response.ok, detail: `HTTP ${response.status}`, latencyMs: Date.now() - start };
  } catch (error) {
    return { ok: false, detail: error.cause?.code || error.name || 'Connection failed' };
  }
}

function checkTcp(host, port) {
  return new Promise((resolve) => {
    const socket = net.createConnection({ host, port });
    const start = Date.now();
    let finished = false;
    const done = (ok, detail) => {
      if (finished) return;
      finished = true;
      socket.destroy();
      resolve({ ok, detail, latencyMs: Date.now() - start });
    };
    socket.setTimeout(4000);
    socket.once('connect', () => done(true, 'TCP reachable'));
    socket.once('timeout', () => done(false, 'Timed out'));
    socket.once('error', (error) => done(false, error.code || 'Connection failed'));
  });
}

async function checkTrending() {
  try {
    const response = await fetch('http://nosu:3400/api/trending?hours=4', { signal: AbortSignal.timeout(4000), cache: 'no-store' });
    if (!response.ok) return { ok: false, detail: `HTTP ${response.status}` };
    const data = await response.json();
    if (!data.ready) return { ok: false, detail: 'Waiting for first snapshot' };
    const age = Number(data.ageSeconds);
    if (!Number.isFinite(age)) return { ok: false, detail: 'Snapshot age missing' };
    return { ok: age < 900, detail: `Last snapshot ${Math.round(age / 60)} min ago`, ageSeconds: age };
  } catch (error) {
    return { ok: false, detail: error.cause?.code || error.name || 'Connection failed' };
  }
}

async function checkSearch() {
  try {
    const response = await fetch('http://opensearch:9200/_cluster/health', { signal: AbortSignal.timeout(4000), cache: 'no-store' });
    if (!response.ok) return { ok: false, detail: `HTTP ${response.status}` };
    const health = await response.json();
    if (!['green', 'yellow'].includes(health.status)) return { ok: false, detail: `Cluster ${health.status || 'unknown'}` };
    const countResponse = await fetch('http://opensearch:9200/nostr-events/_count', { signal: AbortSignal.timeout(4000), cache: 'no-store' });
    if (!countResponse.ok) return { ok: false, detail: `Index HTTP ${countResponse.status}` };
    const count = (await countResponse.json()).count;
    return { ok: true, detail: `${count} indexed events (${health.status})`, count };
  } catch (error) {
    return { ok: false, detail: error.cause?.code || error.name || 'Connection failed' };
  }
}

async function checkDitto() {
  const relay = await checkHttp('http://ditto-relay:13131/');
  if (!relay.ok) return relay;
  try {
    const response = await fetch('http://ditto-sync:13132/status', { signal: AbortSignal.timeout(4000), cache: 'no-store' });
    if (!response.ok) throw new Error('Sync unavailable');
    const sync = await response.json();
    if (sync.lastError) return { ok: false, detail: 'Relay available; sync needs attention' };
    if (sync.paused) return { ok: true, detail: 'Relay available; sync paused' };
    if (!sync.connected?.local || !sync.connected?.peer) return { ok: false, detail: 'Relay available; sync disconnected' };
    return { ok: true, detail: `Relay available; sync ${sync.phase || 'running'}` };
  } catch {
    return { ok: false, detail: 'Relay available; sync unavailable' };
  }
}

function json(res, status, value) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(value));
}

function sameText(left, right) {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  return a.length === b.length && timingSafeEqual(a, b);
}

function isAuthenticated(req) {
  if (!PUBLIC_DASHBOARD) return true;
  const cookie = String(req.headers.cookie || '').split(';').map(value => value.trim());
  const session = cookie.find(value => value.startsWith('nosu_controller_session='))?.slice('nosu_controller_session='.length) || '';
  return sameText(session, sessionToken);
}

function loginPage(res, failed = false) {
  res.writeHead(failed ? 401 : 200, { 'Content-Type': 'text/html; charset=utf-8' });
  res.end(`<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Nosu Controller</title><style>html{color-scheme:dark}body{font:16px system-ui;background:#08111d;color:#e8eef5;min-height:100vh;display:grid;place-items:center;margin:0}.card{width:min(340px,calc(100% - 40px));padding:28px;border:1px solid #26384c;border-radius:16px;background:#101c2a}h1{font-size:1.35rem;margin:0 0 8px}p{color:#a9b9cb}label{display:grid;gap:8px}input,button{font:inherit;padding:11px 12px;border-radius:9px;border:1px solid #38506a}button{margin-top:14px;width:100%;background:#2d7ef7;color:white;cursor:pointer}.bad{color:#ff9c9c}</style><main class="card"><h1>Nosu Controller</h1><p>Enter the deployment PIN.</p>${failed ? '<p class="bad" role="alert">Incorrect PIN.</p>' : ''}<form method="post" action="/dashboard/login"><label>PIN<input name="pin" type="password" inputmode="numeric" pattern="[0-9]{4,12}" autocomplete="current-password" required autofocus></label><button type="submit">Open dashboard</button></form></main></html>`);
}

async function login(req, res) {
  if (!PUBLIC_DASHBOARD) return json(res, 404, { error: 'Not found' });
  let size = 0;
  const chunks = [];
  for await (const chunk of req) {
    size += chunk.length;
    if (size > 256) return json(res, 413, { error: 'Request too large' });
    chunks.push(chunk);
  }
  const value = new URLSearchParams(Buffer.concat(chunks).toString('utf8'));
  if (!sameText(value.get('pin') || '', CONTROLLER_PIN)) return loginPage(res, true);
  res.writeHead(303, {
    Location: '/dashboard/',
    'Set-Cookie': `nosu_controller_session=${sessionToken}; HttpOnly; Secure; SameSite=Strict; Path=/dashboard; Max-Age=43200`,
  });
  res.end();
}

async function syncProxy(req, res) {
  try {
    let body;
    if (req.method === 'POST') {
      const localHost = /^(localhost|127\.0\.0\.1|\[::1\])(?::\d+)?$/.test(req.headers.host || '');
      const expectedOrigin = PUBLIC_DASHBOARD ? CONTROLLER_ORIGIN : `http://${req.headers.host}`;
      if ((!PUBLIC_DASHBOARD && !localHost) || req.headers.origin !== expectedOrigin || !['same-origin', undefined].includes(req.headers['sec-fetch-site'])) {
        return json(res, 403, { error: 'Use the authenticated controller to control synchronization' });
      }
      if (!String(req.headers['content-type'] || '').startsWith('application/json')) return json(res, 415, { error: 'Expected JSON' });
      let size = 0;
      const chunks = [];
      for await (const chunk of req) {
        size += chunk.length;
        if (size > 1024) return json(res, 413, { error: 'Request too large' });
        chunks.push(chunk);
      }
      const value = JSON.parse(Buffer.concat(chunks).toString('utf8'));
      if (!value || !['pause', 'resume', 'backfill', 'retry'].includes(value.action) || Object.keys(value).length !== 1) {
        return json(res, 400, { error: 'Invalid synchronization action' });
      }
      body = JSON.stringify(value);
    }
    const upstream = await fetch(`http://ditto-sync:13132/${req.method === 'POST' ? 'control' : 'status'}`, {
      method: req.method, headers: body ? { 'Content-Type': 'application/json' } : undefined,
      body, signal: AbortSignal.timeout(5000), cache: 'no-store',
    });
    return json(res, upstream.status, await upstream.json());
  } catch (error) {
    return json(res, error instanceof SyntaxError ? 400 : 502, { error: error instanceof SyntaxError ? 'Invalid JSON' : 'Synchronization worker unavailable' });
  }
}

const server = http.createServer(async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Content-Security-Policy', "default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline'; connect-src 'self'; form-action 'self'; base-uri 'none'; frame-ancestors 'none'");
  if (req.method === 'GET' && req.url === '/health/live') return json(res, 200, { ok: true });
  if (req.method === 'POST' && req.url === '/login') return login(req, res);
  if (!isAuthenticated(req)) {
    if (req.method === 'GET' && ['/', '/ditto-relay', '/logs'].includes(req.url)) return loginPage(res);
    return json(res, 401, { error: 'Controller PIN required' });
  }
  if (req.method === 'GET' && ['/', '/ditto-relay', '/logs'].includes(req.url)) {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    return res.end(html);
  }
  if (['GET', 'POST'].includes(req.method) && req.url === '/api/ditto-sync') return syncProxy(req, res);
  if (req.method === 'GET' && req.url === '/api/status') {
    const [nosu, groups, postgres, ingress, trending, dittoRelay, opensearch] = await Promise.all([
      checkHttp('http://nosu:3400/api/health/ready'),
      checkHttp('http://groups/healthz'),
      checkTcp('postgres', 5432),
      checkHttp('http://ingress:8080/healthz'),
      checkTrending(),
      checkDitto(),
      checkSearch(),
    ]);
    return json(res, 200, { checkedAt: new Date().toISOString(), services: { nosu, groups, postgres, ingress, trending, 'ditto-relay': dittoRelay, opensearch } });
  }
  const logUrl = new URL(req.url || '/', 'http://localhost');
  const logMatch = /^\/api\/logs\/(nosu|groups|postgres|ingress|trending|ditto-relay|ditto-sync|opensearch)$/.exec(logUrl.pathname);
  if (req.method === 'GET' && logMatch) {
    const after = Number(logUrl.searchParams.get('after') || 0);
    const entries = logs.get(logMatch[1]);
    const latest = Number.isSafeInteger(after) && after > 0
      ? entries.filter(entry => entry.id > after)
      : entries.slice(-500);
    return json(res, 200, { service: logMatch[1], entries: latest.slice(-500) });
  }
  return json(res, 404, { error: 'Not found' });
});

server.listen(PORT, '0.0.0.0', () => console.log(`Nosu controller listening on ${PORT}`));
