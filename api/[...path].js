// Vercel Serverless Function - 网易云音乐 API 代理 + Meting URL 解析
// 部署后访问: https://你的项目名.vercel.app/api/cloudsearch/pc?s=...
const https = require('https');
const http = require('http');

const TARGET_HOST = 'music.163.com';

// 服务端跟随重定向，返回最终URL（最多跟3次）
function followRedirect(url, maxFollows = 3) {
    return new Promise((resolve, reject) => {
        if (maxFollows <= 0) return reject(new Error('Too many redirects'));
        const parsed = new URL(url);
        const mod = parsed.protocol === 'https:' ? https : http;
        const opts = {
            hostname: parsed.hostname,
            port: parsed.port || (parsed.protocol === 'https:' ? 443 : 80),
            path: parsed.pathname + parsed.search,
            method: 'HEAD',
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
                'Referer': 'https://music.163.com/',
                'Accept': '*/*',
            },
            rejectUnauthorized: false,
        };
        const req = mod.request(opts, (response) => {
            if (response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
                const redirectUrl = new URL(response.headers.location, url).href;
                return followRedirect(redirectUrl, maxFollows - 1).then(resolve).catch(reject);
            }
            resolve(url); // 返回当前URL
        });
        req.on('error', reject);
        req.setTimeout(10000, () => { req.destroy(); reject(new Error('Timeout')); });
        req.end();
    });
}

module.exports = async (req, res) => {
    // CORS 预检
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Cookie, Referer, X-Real-IP');
    if (req.method === 'OPTIONS') {
        res.setHeader('Access-Control-Max-Age', '86400');
        res.status(204).end();
        return;
    }

    // ── 特殊路径: meting-url → 解析 Meting API 302 重定向，返回真实 MP3 URL ──
    if (req.query.path === 'meting-url') {
        const songId = req.query.id;
        if (!songId) {
            res.status(400).json({ code: -1, error: 'Missing id' });
            return;
        }
        const metingUrl = `https://api.injahow.cn/meting/?server=netease&type=url&id=${songId}`;
        try {
            const finalUrl = await followRedirect(metingUrl);
            res.status(200).json({ code: 200, url: finalUrl });
        } catch (e) {
            console.error('[Meting Error]', e.message);
            res.status(502).json({ code: -1, error: 'Meting proxy error: ' + e.message });
        }
        return;
    }

    // ── 常规路径: 代理到 music.163.com ──
    let apiPath = '/api/' + (req.query.path || 'search/hot');
    const params = new URLSearchParams(req.query);
    params.delete('path');
    const qs = params.toString();
    const targetPath = apiPath + (qs ? '?' + qs : '');

    const isPlayerUrl = apiPath.includes('/song/enhance/player/url');

    return new Promise((resolve) => {
        const options = {
            hostname: TARGET_HOST,
            port: 443,
            path: targetPath,
            method: req.method,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
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

        proxyReq.setTimeout(isPlayerUrl ? 25000 : 12000, () => {
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
