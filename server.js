const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const path = require('path');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

// 1. Serve static files (HTML/CSS/JS)
app.use(express.static(path.join(__dirname, 'public')));

// 2. REAL UPLOAD ENDPOINT (HTTP POST)
// This handles the "Real" upload test efficiently
app.post('/upload', (req, res) => {
    // We consume the data stream but don't save it
    // This accurately measures network speed without filling your hard drive
    req.on('data', (chunk) => { 
        // Data is flowing... 
    });
    
    req.on('end', () => {
        res.send('done');
    });
});

// 3. WEBSOCKET ENDPOINTS (Ping & Download)
wss.on('connection', (ws) => {
    ws.on('message', (message) => {
        let data;
        try {
            data = JSON.parse(message);
        } catch (e) { return; } // Ignore non-JSON

        // --- PING TEST ---
        if (data.action === 'ping') {
            ws.send(JSON.stringify({ action: 'pong', timestamp: data.timestamp }));
        }
        
        // --- DOWNLOAD TEST ---
        else if (data.action === 'download') {
            // Send garbage data for 10 seconds
            const chunkSize = 1024 * 50; // 50KB chunks
            const garbage = Buffer.alloc(chunkSize, 'x');
            let start = Date.now();
            
            const sendLoop = () => {
                // Stop after 10 seconds or if connection closes
                if (ws.readyState === WebSocket.OPEN && Date.now() - start < 10000) {
                    ws.send(garbage);
                    // Use setImmediate to send as fast as possible without blocking
                    setImmediate(sendLoop);
                } else {
                    if (ws.readyState === WebSocket.OPEN) {
                        ws.send(JSON.stringify({ action: 'download_finish' }));
                    }
                }
            };
            sendLoop();
        }
    });
});

server.listen(3000, () => {
    console.log('✅ Server is running! Open http://localhost:3000');
});