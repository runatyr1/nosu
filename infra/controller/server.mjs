import http from 'node:http';
import net from 'node:net';
import fs from 'node:fs';

const PORT = Number(process.env.PORT || 3401);
const html = fs.readFileSync(new URL('./index.html', import.meta.url));

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

function json(res, status, value) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(value));
}

const server = http.createServer(async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Content-Security-Policy', "default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline'; connect-src 'self'; base-uri 'none'; frame-ancestors 'none'");
  if (req.method === 'GET' && req.url === '/health/live') return json(res, 200, { ok: true });
  if (req.method === 'GET' && req.url === '/') {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    return res.end(html);
  }
  if (req.method === 'GET' && req.url === '/api/status') {
    const [nosu, groups, postgres, ingress, trending] = await Promise.all([
      checkHttp('http://nosu:3400/api/health/ready'),
      checkHttp('http://groups/healthz'),
      checkTcp('postgres', 5432),
      checkHttp('http://ingress/api/health/live'),
      checkTrending(),
    ]);
    return json(res, 200, { checkedAt: new Date().toISOString(), services: { nosu, groups, postgres, ingress, trending } });
  }
  return json(res, 404, { error: 'Not found' });
});

server.listen(PORT, '0.0.0.0', () => console.log(`Nosu controller listening on ${PORT}`));
