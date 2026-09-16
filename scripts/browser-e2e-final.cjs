/**
 * Final end-to-end browser verification:
 *   login → /time-cost-prediction → click "Analyze Local Market →" →
 *   verify context query params on /market-intelligence → click
 *   "Estimate Setup Time & Cost →" → verify project context preserved.
 * Real link clicks (anchor.click()), not URL forgery.
 */
const { spawn } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const PORT = 9225;
const BASE = 'http://localhost:5173';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function main() {
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'bi-e2e-'));
  const proc = spawn(CHROME, [
    '--headless=new', `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`,
    '--no-first-run', '--window-size=1440,1000', 'about:blank',
  ], { stdio: 'ignore' });
  try {
    let targets = null;
    for (let i = 0; i < 40; i++) {
      await sleep(500);
      try { targets = await (await fetch(`http://127.0.0.1:${PORT}/json`)).json(); break; } catch { /* retry */ }
    }
    if (!targets) throw new Error('CDP did not come up');
    const page = targets.find((t) => t.type === 'page');
    const ws = new WebSocket(page.webSocketDebuggerUrl);
    await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
    let id = 0;
    const pending = new Map();
    ws.onmessage = (ev) => {
      const m = JSON.parse(ev.data);
      if (m.id && pending.has(m.id)) { const p = pending.get(m.id); pending.delete(m.id); p(m.result); }
    };
    const send = (method, params = {}) => new Promise((res) => { pending.set(++id, res); ws.send(JSON.stringify({ id, method, params })); });
    const evalp = async (expression) => {
      const r = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
      if (r.exceptionDetails) throw new Error('page eval: ' + JSON.stringify(r.exceptionDetails).slice(0, 300));
      return r.result.value;
    };
    await send('Runtime.enable');
    await send('Page.enable');

    // 1. Boot + session restore via refresh cookie
    await send('Page.navigate', { url: BASE + '/' });
    await sleep(2000);
    const loginStatus = await evalp(`fetch('http://localhost:3001/auth/login',{method:'POST',headers:{'Content-Type':'application/json'},credentials:'include',body:JSON.stringify({email:'bi-demo@example.com',password:'Demo12345!'})}).then(r=>r.status)`);
    console.log('1. LOGIN:', loginStatus);
    if (loginStatus !== 200) throw new Error('login failed');

    // 2. Time & Cost page for the demo project
    const projId = fs.readFileSync('C:/tmp/bi-project.txt', 'utf8').trim();
    await send('Page.navigate', { url: BASE + '/time-cost-prediction?projectId=' + projId });
    await sleep(4500);
    const tcText = await evalp('document.body.innerText');
    const tcOk = /ESTIMATED LEGAL READINESS/i.test(tcText) && /210\s*[–-]\s*270/.test(tcText) && /ESTIMATED TOTAL COST/i.test(tcText);
    console.log('2. TIME-COST PAGE CONTENT OK:', tcOk);
    if (!tcOk) { console.log(tcText.slice(0, 800)); throw new Error('time-cost page missing expected sections'); }

    // 3. Click the real "Analyze Local Market →" link (first one, header)
    const marketUrl = await evalp(`(() => {
      const a = [...document.querySelectorAll('a')].find(a => /Analyze Local Market/.test(a.textContent));
      if (!a) return null;
      a.click();
      return a.getAttribute('href');
    })()`);
    console.log('3. CLICKED CROSS-LINK href:', marketUrl);
    if (!marketUrl) throw new Error('cross-link not found');
    await sleep(4000);
    const miUrl = await evalp('location.pathname + location.search');
    const miText = await evalp('document.body.innerText');
    const carried = /businessType=brewery/.test(miUrl) && /projectId/.test(miUrl);
    const onMarket = /Market & Competitor Intelligence/i.test(miText);
    console.log('4. LANDED ON MARKET PAGE:', onMarket, '| CONTEXT CARRIED (businessType+projectId):', carried);
    console.log('   final URL:', miUrl);
    const honestState = /not configured|Google Places/i.test(miText);
    console.log('   honest no-key state shown:', honestState);

    // 4. Click back to Time & Cost (header link always present; big CTA after analysis)
    const backUrl = await evalp(`(() => {
      const a = [...document.querySelectorAll('a')].find(a => /Estimate Setup Time|Time & Cost Prediction/.test(a.textContent));
      if (!a) return null;
      a.click();
      return a.getAttribute('href');
    })()`);
    console.log('5. CLICKED BACK-LINK href:', backUrl);
    if (!backUrl) throw new Error('no back-link found');
    await sleep(4000);
    const backPath = await evalp('location.pathname + location.search');
    const backText = await evalp('document.body.innerText');
    const backOk = /time-cost-prediction/.test(backPath) && /ESTIMATED LEGAL READINESS/i.test(backText);
    console.log('6. RETURNED TO TIME-COST WITH DATA:', backOk, '| URL:', backPath);

    console.log('\nE2E RESULT:', tcOk && carried && onMarket && (backUrl === null || backOk) ? 'PASS' : 'FAIL');
  } finally {
    proc.kill();
    await sleep(400);
  }
}

main().then(() => process.exit(0)).catch((e) => { console.error('E2E ERR:', e.message); process.exit(1); });
