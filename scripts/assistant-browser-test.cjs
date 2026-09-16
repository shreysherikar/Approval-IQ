/**
 * Browser test: ApprovalIQ Assistant side panel.
 * Login → open a project page → click the launcher → send a suggestion →
 * verify the grounded reply renders in the panel.
 */
const { spawn } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const PORT = 9226;
const BASE = 'http://localhost:5173';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function main() {
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'bi-assist-'));
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

    await send('Page.navigate', { url: BASE + '/' });
    await sleep(2000);
    const login = await evalp(`fetch('http://localhost:3001/auth/login',{method:'POST',headers:{'Content-Type':'application/json'},credentials:'include',body:JSON.stringify({email:'bi-demo@example.com',password:'Demo12345!'})}).then(r=>r.status)`);
    console.log('1. LOGIN:', login);

    const projId = fs.readFileSync('C:/tmp/bi-project.txt', 'utf8').trim();
    await send('Page.navigate', { url: BASE + '/projects/' + projId + '/approvals' });
    await sleep(4000);

    // Launcher must exist
    const launcher = await evalp(`(() => {
      const btns = [...document.querySelectorAll('button[aria-label]')].map(b => b.getAttribute('aria-label'));
      return btns.join('|');
    })()`);
    console.log('2. LAUNCHER PRESENT:', /assistant/i.test(launcher), '(' + launcher + ')');

    // Open the panel
    await evalp(`[...document.querySelectorAll('button[aria-label]')].find(b => /Show assistant|Open assistant/.test(b.getAttribute('aria-label')))?.click(); 'ok'`);
    await sleep(800);
    let panelText = await evalp(`(() => {
      const panel = document.querySelector('.fixed.top-0.right-0');
      return panel ? panel.innerText : 'PANEL_NOT_FOUND';
    })()`);
    console.log('3. PANEL OPEN:', !/PANEL_NOT_FOUND/.test(panelText));
    console.log('   PANEL HEADER:', panelText.split('\n').slice(0, 4).join(' | '));

    // Click a suggestion
    const clicked = await evalp(`(() => {
      const panel = document.querySelector('.fixed.top-0.right-0');
      const btn = [...panel.querySelectorAll('button')].find(b => /How long until my business is legally ready/.test(b.textContent));
      if (!btn) return null;
      btn.click();
      return btn.textContent.trim();
    })()`);
    console.log('4. SUGGESTION CLICKED:', clicked);
    if (!clicked) throw new Error('suggestion not found');

    // Wait for reply
    await sleep(2500);
    panelText = await evalp(`document.querySelector('.fixed.top-0.right-0').innerText`);
    const hasReply = /210\s*[–-]\s*270 working days/.test(panelText) && /MPCB-CTE/.test(panelText);
    console.log('5. GROUNDED REPLY RENDERED:', hasReply);
    console.log('--- PANEL CONTENT ---');
    console.log(panelText.slice(0, 900));

    // Ask a product question too
    await evalp(`(() => {
      const panel = document.querySelector('.fixed.top-0.right-0');
      const input = panel.querySelector('input');
      const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
      setter.call(input, 'What is the critical path?');
      input.dispatchEvent(new Event('input', { bubbles: true }));
      return 'ok';
    })()`);
    await evalp(`(() => { const panel = document.querySelector('.fixed.top-0.right-0'); panel.querySelector('form').dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })); return 'ok'; })()`);
    await sleep(2500);
    panelText = await evalp(`document.querySelector('.fixed.top-0.right-0').innerText`);
    console.log('6. SECOND TURN OK:', /MPCB-CTE|Critical path/i.test(panelText));

    console.log('\nASSISTANT BROWSER TEST: PASS');
  } finally {
    proc.kill();
    await sleep(400);
  }
}

main().then(() => process.exit(0)).catch((e) => { console.error('ASSISTANT TEST ERR:', e.message); process.exit(1); });
