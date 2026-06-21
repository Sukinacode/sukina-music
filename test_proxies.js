// Test which public CORS proxies work with NetEase API
const https = require('https');
const API_PATH = '/api/search/get?s=test&type=1&limit=1';

const PROXIES = [
  { name: 'corsproxy.io', url: 'https://corsproxy.io/?url=' + encodeURIComponent('https://music.163.com' + API_PATH) },
  { name: 'cors.eu.org', url: 'https://cors.eu.org/https://music.163.com' + API_PATH },
  { name: 'codetabs', url: 'https://api.codetabs.com/v1/proxy?quest=https://music.163.com' + API_PATH },
  { name: 'x2u.in', url: 'https://cors.x2u.in/https://music.163.com' + API_PATH },
  { name: 'allorigins', url: 'https://api.allorigins.win/raw?url=' + encodeURIComponent('https://music.163.com' + API_PATH) },
  { name: 'heroku', url: 'https://cors-anywhere.herokuapp.com/https://music.163.com' + API_PATH },
  { name: 'gimme', url: 'https://cors.gimme.pro/https://music.163.com' + API_PATH },
  { name: 'killcors', url: 'https://killcors.com/https://music.163.com' + API_PATH },
  { name: 'v4', url: 'https://cors.v4.kr/https://music.163.com' + API_PATH },
];

function test(proxy) {
  return new Promise((resolve) => {
    const start = Date.now();
    const req = https.get(proxy.url, { timeout: 6000, rejectUnauthorized: false }, (res) => {
      let body = '';
      res.on('data', c => body += c);
      res.on('end', () => {
        const ms = Date.now() - start;
        try {
          const data = JSON.parse(body);
          if (data && data.code === 200) {
            console.log(`OK   ${proxy.name.padEnd(16)} ${ms}ms  code=${data.code}`);
            resolve({ ok: true, name: proxy.name, ms });
          } else {
            console.log(`FAIL ${proxy.name.padEnd(16)} ${ms}ms  invalid response`);
            resolve({ ok: false });
          }
        } catch (e) {
          console.log(`FAIL ${proxy.name.padEnd(16)} ${ms}ms  parse err: ${body.substring(0, 50)}`);
          resolve({ ok: false });
        }
      });
    });
    req.on('error', (e) => {
      console.log(`FAIL ${proxy.name.padEnd(16)} ${(Date.now() - start)}ms  ${e.message.substring(0, 60)}`);
      resolve({ ok: false });
    });
    req.on('timeout', () => { req.destroy(); resolve({ ok: false }); });
  });
}

(async () => {
  console.log('Testing CORS proxies...\n');
  const results = await Promise.all(PROXIES.map(test));
  const ok = results.filter(r => r.ok).sort((a, b) => a.ms - b.ms);
  console.log(`\nWorking: ${ok.length}/${PROXIES.length}`);
  if (ok.length) ok.forEach(r => console.log(`  - ${r.name} (${r.ms}ms)`));
})();
