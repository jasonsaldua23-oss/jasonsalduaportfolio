import fs from 'node:fs/promises';

const [port, wsPath] = (await fs.readFile('C:/Users/Admin/AppData/Local/Google/Chrome/User Data/DevToolsActivePort', 'utf8')).trim().split(/\r?\n/);
const ws = new WebSocket(`ws://127.0.0.1:${port}${wsPath}`);
let id = 0;
const pending = new Map();
ws.onmessage = event => {
  const message = JSON.parse(event.data);
  if (message.id && pending.has(message.id)) {
    pending.get(message.id)(message);
    pending.delete(message.id);
  }
};
await new Promise((resolve, reject) => {
  ws.onopen = resolve;
  ws.onerror = reject;
});
const send = (method, params = {}, sessionId) => new Promise((resolve, reject) => {
  const messageId = ++id;
  pending.set(messageId, resolve);
  ws.send(JSON.stringify({ id: messageId, method, params, ...(sessionId ? { sessionId } : {}) }));
  setTimeout(() => reject(new Error(`Timeout: ${method}`)), 15000);
});
const targets = await send('Target.getTargets');
const target = targets.result.targetInfos.find(item => item.type === 'page' && item.url.includes('linkedin.com/in/jason-saldua-972494358/details/certifications'));
if (!target) throw new Error('LinkedIn certifications tab was not found.');
const attached = await send('Target.attachToTarget', { targetId: target.targetId, flatten: true });
const sessionId = attached.result.sessionId;
const expression = `JSON.stringify({
  title: document.title,
  url: location.href,
  images: [...document.images].map(img => ({src: img.currentSrc || img.src, alt: img.alt, width: img.naturalWidth, height: img.naturalHeight})),
  links: [...document.querySelectorAll('a')].filter(a => /credential|certificate/i.test((a.textContent || '') + ' ' + (a.href || ''))).map(a => ({text: a.textContent.trim(), href: a.href}))
})`;
const evaluated = await send('Runtime.evaluate', { expression, returnByValue: true }, sessionId);
console.log(evaluated.result.result.value);
ws.close();
