// Vercel Serverless Function - 网易云音乐 API 代理
// 部署后访问: https://你的项目名.vercel.app/api/cloudsearch/pc?s=...
const https = require('https');
const http = require('http');

const TARGET_HOST = 'music.163.com';

module.exports = async (req, res) => {
    // CORS 预检
    if (req.method === 'OPTIONS') {
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Cookie, Referer, X-Real-IP');
        res.setHeader('Access-Control-Max-Age', '86400');
        res.status(204).end();
        return;
    }

    // 从 query.path 获取实际 API 路径，加上 /api 前缀（NetEase API 路径结构）
    let apiPath = '/api/' + (req.query.path || 'search/hot');
    // 拼接其他 query 参数（排除 path 本身）
    const params = new URLSearchParams(req.query);
    params.delete('path');
    const qs = params.toString();
    const targetPath = apiPath + (qs ? '?' + qs : '');

    // 设置 CORS 响应头
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Cookie, Referer, X-Real-IP');

    // 判断是否播放链接请求，使用更宽松的超时
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

        // 播放链接接口给更长超时，其他接口较短
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
