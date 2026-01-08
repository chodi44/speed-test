const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const path = require('path');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

// --- FIX 1: ENABLE CORS (Allow Vercel to talk to Render) ---
app.use((req, res, next) => {
    res.header("Access-Control-Allow-Origin", "*"); // Allow ANY website to connect
    res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
    res.header("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    if (req.method === 'OPTIONS') {
        return res.sendStatus(200);
    }
    next();
});

app.use(express.static(path.join(__dirname, 'public')));

// --- UPLOAD ENDPOINT ---
app.post('/upload', (req, res) => {
    req.on('data', (chunk) => { /* Receive data */ });
    req.on('end', () => { res.send('done'); });
});

// --- WEBSOCKETS (Ping & Download) ---
wss.on('connection', (ws) => {
    console.log("New Client Connected");
    
    ws.on('message', (message) => {
        let data;
        try { data = JSON.parse(message); } catch(e) { return; }

        if (data.action === 'ping') {
            ws.send(JSON.stringify({ action: 'pong', timestamp: data.timestamp }));
        }
        else if (data.action === 'download') {
            const chunkSize = 1024 * 50; 
            const garbage = Buffer.alloc(chunkSize, 'x');
            let start = Date.now();
            
            const sendLoop = () => {
                if (ws.readyState === WebSocket.OPEN && Date.now() - start < 10000) {
                    ws.send(garbage);
                    setImmediate(sendLoop);
                } else {
                    if (ws.readyState === WebSocket.OPEN) 
                        ws.send(JSON.stringify({ action: 'download_finish' }));
                }
            };
            sendLoop();
        }
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`✅ Server running on port ${PORT}`);
});