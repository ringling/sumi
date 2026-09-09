// Minimal DevTools-protocol driver: node test/cdp.mjs <harness-url> [screenshot.png]
// Launches headless Chrome, loads the page, and prints #out once it ends in DONE or ERROR.
import { spawn } from 'node:child_process';
const url = process.argv[2], shot = process.argv[3];
const chrome = spawn('/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  ['--headless=new', '--disable-gpu', '--no-first-run', '--remote-debugging-port=9333',
   '--user-data-dir=test/profile', '--window-size=1400,900', 'about:blank'],
  { stdio: 'ignore' });
const sleep = ms => new Promise(r => setTimeout(r, ms));
let ws, id = 0, pending = new Map();
const send = (method, params = {}) => new Promise((res, rej) => {
  const i = ++id; pending.set(i, { res, rej }); ws.send(JSON.stringify({ id: i, method, params }));
});
try {
  let targets;
  for (let i = 0; i < 40; i++) { try { targets = await (await fetch('http://127.0.0.1:9333/json')).json(); break; } catch { await sleep(250); } }
  const page = targets.find(t => t.type === 'page');
  ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise(r => ws.onopen = r);
  ws.onmessage = e => {
    const m = JSON.parse(e.data);
    if (m.id && pending.has(m.id)) { const p = pending.get(m.id); pending.delete(m.id); m.error ? p.rej(new Error(m.error.message)) : p.res(m.result); }
  };
  await send('Page.enable'); await send('Runtime.enable');
  await send('Network.enable'); await send('Network.setCacheDisabled', { cacheDisabled: true });
  await send('Page.navigate', { url });
  let text = '';
  for (let i = 0; i < 120; i++) {
    await sleep(500);
    const r = await send('Runtime.evaluate', { expression: "(document.getElementById('out')||{}).textContent||''", returnByValue: true });
    text = r.result.value;
    if (/\n(DONE|ERROR)/.test(text)) break;
  }
  if (shot) { const r = await send('Page.captureScreenshot', { format: 'png' }); (await import('node:fs')).writeFileSync(shot, Buffer.from(r.data, 'base64')); }
  console.log(text || 'NO OUTPUT');
} catch (e) { console.log('DRIVER ERROR', e.message); }
finally { chrome.kill(); process.exit(0); }
