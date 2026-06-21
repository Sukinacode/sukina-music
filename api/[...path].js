// Vercel Serverless Function - 网易云音乐 API 代理
const https = require('https');

const TARGET_HOST = 'music.163.com';

module.exports = async (req, res) => {
    if (req.method === 'OPTIONS') {
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Cookie, Referer, X-Real-IP');
        res.setHeader('Access-Control-Max-Age', '86400');
        res.status(204).end();
        return;
    }

    let apiPath = '/api/' + (req.query.path || 'search/hot');
    const params = new URLSearchParams(req.query);
    params.delete('path');
    const qs = params.toString();
    const targetPath = apiPath + (qs ? '?' + qs : '');

    res.setHeader('Access-Control-Allow-Origin', '*');

    return new Promise((resolve) => {
        const options = {
            hostname: TARGET_HOST, port: 443, path: targetPath, method: req.method,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/131.0.0.0 Safari/537.36',
                'Referer': 'https://music.163.com/',
                'Accept': 'application/json, text/plain, */*',
                'Accept-Language': 'zh-CN,zh;q=0.9',
                'Cookie': 'os=pc; appver=2.10.0; channel=netease;',
            },
            rejectUnauthorized: false,
        };

        const proxyReq = https.request(options, (proxyRes) => {
            const skipHeaders = ['content-security-policy', 'x-frame-options', 'strict-transport-security', 'access-control-allow-origin'];
            Object.keys(proxyRes.headers).forEach(key => {
                if (!skipHeaders.includes(key.toLowerCase())) {
                    res.setHeader(key, proxyRes.headers[key]);
                }
            });
            res.status(proxyRes.statusCode);
            proxyRes.pipe(res);
            proxyRes.on('end', resolve);
        });

        proxyReq.on('error', (e) => {
            console.error('[Proxy Error]', e.message);
            res.status(502).json({ code: -1, error: 'Proxy error: ' + e.message });
            resolve();
        });

        proxyReq.setTimeout(15000, () => {
            proxyReq.destroy();
            res.status(504).json({ code: -1, error: 'Upstream timeout' });
            resolve();
        });

        if (req.body && req.method === 'POST') {
            proxyReq.write(JSON.stringify(req.body));
        }
        proxyReq.end();
    });
};
