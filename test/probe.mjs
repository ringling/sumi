// node test/probe.mjs "<setup js>" "<screen|print>" "<eval js>"
// Loads sumi.html, runs the setup expression, emulates the media, prints the eval result.
import { spawn } from 'node:child_process';
const [setup, media, evalExpr] = process.argv.slice(2);
const chrome = spawn('/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  ['--headless=new', '--disable-gpu', '--no-first-run', '--remote-debugging-port=9335', '--user-data-dir=test/profile-probe', '--window-size=1400,900', 'about:blank'], { stdio: 'ignore' });
const sleep = ms => new Promise(r => setTimeout(r, ms));
let ws, id = 0, pending = new Map();
const send = (m, p = {}) => new Promise((res, rej) => { const i = ++id; pending.set(i, { res, rej }); ws.send(JSON.stringify({ id: i, method: m, params: p })); });
try {
  let t; for (let i = 0; i < 40; i++) { try { t = await (await fetch('http://127.0.0.1:9335/json')).json(); break; } catch { await sleep(250); } }
  ws = new WebSocket(t.find(x => x.type === 'page').webSocketDebuggerUrl); await new Promise(r => ws.onopen = r);
  ws.onmessage = e => { const m = JSON.parse(e.data); if (m.id && pending.has(m.id)) { const p = pending.get(m.id); pending.delete(m.id); m.error ? p.rej(new Error(m.error.message)) : p.res(m.result); } };
  await send('Page.enable'); await send('Runtime.enable');
  await send('Network.enable'); await send('Network.setCacheDisabled', { cacheDisabled: true });
  await send('Page.navigate', { url: 'http://localhost:8765/sumi.html' }); await sleep(1500);
  await send('Runtime.evaluate', { expression: 'localStorage.clear()' });
  if (setup) { await send('Runtime.evaluate', { expression: setup, awaitPromise: true }); await sleep(300); }
  if (media) { await send('Emulation.setEmulatedMedia', { media }); await sleep(200); }
  const r = await send('Runtime.evaluate', { expression: evalExpr, returnByValue: true, awaitPromise: true });
  console.log(typeof r.result.value === 'string' ? r.result.value : JSON.stringify(r.result.value));
} catch (e) { console.log('DRIVER ERROR', e.message); }
finally { chrome.kill(); process.exit(0); }
