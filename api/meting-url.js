// Vercel Serverless Function - Meting URL 解析
// 服务端调用 api.injahow.cn/meting 并跟随 302 重定向，返回真实 MP3 URL
const https = require('https');
const http = require('http');

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
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/131.0.0.0 Safari/537.36',
                'Referer': 'https://music.163.com/',
                'Accept': '*/*',
            },
            rejectUnauthorized: false,
        };
        const req = mod.request(opts, (response) => {
            if (response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
                const nextUrl = new URL(response.headers.location, url).href;
                return followRedirect(nextUrl, maxFollows - 1).then(resolve).catch(reject);
            }
            resolve(url);
        });
        req.on('error', reject);
        req.setTimeout(10000, () => { req.destroy(); reject(new Error('Timeout')); });
        req.end();
    });
}

module.exports = async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    if (req.method === 'OPTIONS') {
        res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
        res.setHeader('Access-Control-Max-Age', '86400');
        return res.status(204).end();
    }

    const songId = req.query.id;
    if (!songId) return res.status(400).json({ code: -1, error: 'Missing id' });

    try {
        const metingUrl = `https://api.injahow.cn/meting/?server=netease&type=url&id=${songId}`;
        const finalUrl = await followRedirect(metingUrl);
        res.status(200).json({ code: 200, url: finalUrl });
    } catch (e) {
        console.error('[Meting Error]', e.message);
        res.status(502).json({ code: -1, error: e.message });
    }
};
