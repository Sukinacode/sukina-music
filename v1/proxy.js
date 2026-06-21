// Local CORS proxy for NetEase Cloud Music API
// Usage: node proxy.js
// Listens on localhost:8765, forwards to music.163.com

const http = require('http');
const https = require('https');

const TARGET = 'music.163.com';
const PORT = 8765;

const server = http.createServer((req, res) => {
    // CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Cookie, Referer, X-Real-IP');

    if (req.method === 'OPTIONS') {
        res.writeHead(204);
        res.end();
        return;
    }

    const options = {
        hostname: TARGET,
        port: 443,
        path: req.url,
        method: req.method,
        headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
            'Referer': 'https://music.163.com/',
            'Accept': 'application/json, text/plain, */*',
            'Accept-Language': 'zh-CN,zh;q=0.9',
            'Cookie': 'os=pc; appver=2.10.0; NMTID=00O...;',
        },
        rejectUnauthorized: false,
    };

    const proxyReq = https.request(options, (proxyRes) => {
        // Strip restrictive headers that browsers don't like
        const headers = { ...proxyRes.headers };
        delete headers['content-security-policy'];
        delete headers['x-frame-options'];
        res.writeHead(proxyRes.statusCode, headers);
        proxyRes.pipe(res);
    });

    proxyReq.on('error', (e) => {
        console.error('[Proxy Error]', e.message);
        res.writeHead(502);
        res.end(JSON.stringify({ error: 'Proxy error: ' + e.message }));
    });

    req.pipe(proxyReq);
});

server.listen(PORT, () => {
    console.log(`Local proxy running at http://localhost:${PORT}`);
    console.log('Forwarding requests to https://' + TARGET);
    console.log('Keep this window open while using the music player.');
});
