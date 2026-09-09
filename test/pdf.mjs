// node test/pdf.mjs <sumi-url> <out.pdf>: load the editor, drop a long sample document, print it to PDF and report the page count.
import { spawn } from 'node:child_process'; import fs from 'node:fs';
const [url, outPdf] = process.argv.slice(2);
const chrome = spawn('/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  ['--headless=new','--disable-gpu','--no-first-run','--remote-debugging-port=9334','--user-data-dir=test/profile-pdf','--window-size=1400,900','about:blank'],{stdio:'ignore'});
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
let ws,id=0,pending=new Map();
const send=(method,params={})=>new Promise((res,rej)=>{const i=++id;pending.set(i,{res,rej});ws.send(JSON.stringify({id:i,method,params}));});
try{
  let targets; for(let i=0;i<40;i++){try{targets=await(await fetch('http://127.0.0.1:9334/json')).json();break;}catch{await sleep(250);}}
  ws=new WebSocket(targets.find(t=>t.type==='page').webSocketDebuggerUrl); await new Promise(r=>ws.onopen=r);
  ws.onmessage=e=>{const m=JSON.parse(e.data);if(m.id&&pending.has(m.id)){const p=pending.get(m.id);pending.delete(m.id);m.error?p.rej(new Error(m.error.message)):p.res(m.result);}};
  await send('Page.enable'); await send('Runtime.enable');
  await send('Page.navigate',{url}); await sleep(1500);
  // drop a long sample document into the editor, then print it
  const T='```', para='Aftaletyper og deres beskrivelser. Dette er en almindelig paragraf med nok tekst til at den ombrydes over flere linjer på en A4-side, så tætheden kan sammenlignes med Typora. '.repeat(2);
  let md=['# Aftaletyper — gennemgåede eksempler','',para,'',para,'','## Den ene bagside der ændrer alt','',para,'','- Understøttet: første punkt','- Overordnet: andet punkt','- Tredje punkt','','> Et citat i margenen.','',T+'js','const x = 1; // kode','function f(a){ return a+x }',T,'','| Type | Beskrivelse | Note |','|---|---|---|','| Alpha | tekst | 1 |','| Beta | tekst | 2 |',''].join('\n');
  for(let i=0;i<10;i++) md+='\n### Afsnit '+i+'\n\n'+para+'\n\n'+para+'\n';
  await send('Runtime.evaluate',{expression:`(()=>{const md=${JSON.stringify(md)}; const dt=new DataTransfer(); dt.items.add(new File([md],'t.md',{type:'text/markdown'})); dispatchEvent(new DragEvent('drop',{dataTransfer:dt,bubbles:true}));})()`});
  await sleep(1500);
  const r=await send('Page.printToPDF',{printBackground:true,preferCSSPageSize:true,paperWidth:8.27,paperHeight:11.69});
  fs.writeFileSync(outPdf,Buffer.from(r.data,'base64'));
  const pages=(fs.readFileSync(outPdf,'latin1').match(/\/Type\s*\/Page[^s]/g)||[]).length;
  console.log('pages',pages);
}catch(e){console.log('DRIVER ERROR',e.message);}finally{chrome.kill();process.exit(0);}
