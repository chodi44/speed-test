// --- CONFIGURATION ---
// 🔴 Your Render Backend URL
const HOST_URL = "https://speed-test-egey.onrender.com"; 

// 🔴 Test Configuration
const pingUrl = "https://www.google.com/favicon.ico"; 
const downloadUrl = "https://speed.cloudflare.com/__down?bytes=50000000"; // 50MB for accuracy

// --- UI ELEMENTS ---
const btn = document.getElementById('startBtn');
const gaugeProgress = document.getElementById('gauge-progress');
const mainSpeed = document.getElementById('main-speed');
const statusTxt = document.getElementById('status-txt');
const ispTxt = document.getElementById('isp-txt');

const ui = {
    ping: document.getElementById('ping-val'),
    jitter: document.getElementById('jitter-val'),
    down: document.getElementById('down-val'),
    up: document.getElementById('up-val')
};

// --- STATE ---
let isRunning = false;

// --- INITIALIZATION (Wake Up Server) ---
window.onload = function() {
    wakeUpServer();
}

function wakeUpServer() {
    statusTxt.innerText = "Waking up Server... (Please wait 30s)";
    ispTxt.innerText = "Connecting...";
    btn.disabled = true; // Lock button until server is ready

    // We send a simple request to your Render server to wake it up
    fetch(HOST_URL + "/upload", { method: 'POST', body: 'wake' })
        .then(() => {
            // Success! Server is awake
            statusTxt.innerText = "Server Ready";
            ispTxt.innerText = "Cloud Connected";
            btn.disabled = false;
            btn.innerText = "GO";
        })
        .catch(err => {
            console.log("Wake up failed (or CORS error if testing locally):", err);
            // Even if it fails (CORS), we enable the button so you can try
            statusTxt.innerText = "Ready to Test"; 
            btn.disabled = false;
            btn.innerText = "GO";
        });
}

// --- START BUTTON LISTENER ---
btn.addEventListener('click', async () => {
    if(isRunning) return;
    isRunning = true;
    btn.disabled = true;
    btn.style.transform = "scale(0.95)";
    resetUI();
    
    try {
        // 1. PING (Real Google Ping)
        updateStatus("Pinging...");
        await testRealPing();
        
        // 2. DOWNLOAD (Real Cloudflare DL)
        updateStatus("Downloading...");
        const downSpeed = await testRealDownload();
        
        // 3. UPLOAD (Real Upload to YOUR Render Server)
        updateStatus("Uploading...");
        await testRealUpload();
        
        updateStatus("COMPLETE");
        btn.innerHTML = "AGAIN";
    } catch (err) {
        console.error(err);
        updateStatus("Error");
    }

    isRunning = false;
    btn.disabled = false;
    btn.style.transform = "scale(1)";
});

function resetUI() {
    ui.ping.innerText = "--"; ui.jitter.innerText = "--";
    ui.down.innerText = "--"; ui.up.innerText = "--";
    updateGauge(0);
}

function updateStatus(text) {
    statusTxt.innerText = text;
}

// --- GAUGE LOGIC ---
function updateGauge(value) {
    const maxSpeed = 1000; // 1000 Mbps = Full Circle
    
    let degrees = (value / maxSpeed) * 360; 
    if (degrees > 360) degrees = 360;
    
    // Update Visual Ring
    gaugeProgress.style.background = `conic-gradient(var(--primary) ${degrees}deg, transparent 0deg)`;
    
    // Update Number
    if (value < 10) {
        mainSpeed.innerText = value.toFixed(2);
    } else {
        mainSpeed.innerText = Math.floor(value);
    }
}

// --- 1. REAL PING ---
async function testRealPing() {
    let pings = [];
    for(let i=0; i<5; i++) {
        const start = performance.now();
        try {
            await fetch(pingUrl + "?t=" + Math.random(), { mode: 'no-cors' });
            const duration = performance.now() - start;
            if(duration < 1000) pings.push(duration);
        } catch (e) {}
    }
    
    const minPing = Math.min(...pings);
    ui.ping.innerText = Math.round(minPing);
    
    // Jitter
    let jitterSum = 0;
    for(let i=0; i<pings.length-1; i++) jitterSum += Math.abs(pings[i] - pings[i+1]);
    let jitter = jitterSum / (pings.length-1);
    ui.jitter.innerText = (jitter || 0).toFixed(0);
}

// --- 2. REAL DOWNLOAD ---
function testRealDownload() {
    return new Promise((resolve) => {
        const xhr = new XMLHttpRequest();
        let startTime = null;
        
        xhr.open("GET", downloadUrl + "&t=" + Math.random(), true);
        xhr.responseType = "blob";

        xhr.onprogress = (event) => {
            if (!startTime) startTime = performance.now();
            const duration = (performance.now() - startTime) / 1000;
            
            if (duration > 0.1) {
                const bits = event.loaded * 8;
                const mbps = (bits / duration / 1000000);
                
                updateGauge(mbps);
                ui.down.innerText = mbps.toFixed(1);
            }
        };

        xhr.onload = () => {
            const duration = (performance.now() - startTime) / 1000;
            const bits = xhr.response.size * 8;
            const finalMbps = (bits / duration / 1000000);
            updateGauge(0);
            ui.down.innerText = finalMbps.toFixed(1);
            resolve(finalMbps);
        };

        xhr.onerror = () => {
            console.log("DL Error");
            resolve(0);
        };
        xhr.send();
    });
}

// --- 3. REAL UPLOAD (To Render) ---
function testRealUpload() {
    return new Promise((resolve) => {
        const xhr = new XMLHttpRequest();
        const startTime = performance.now();
        
        // Create 20MB of dummy data to push
        const heavyData = new Blob([new Array(20 * 1024 * 1024).fill('0').join('')]);

        // 🔴 UPDATED: Sends data to your Render URL, not Localhost
        xhr.open("POST", HOST_URL + "/upload", true);

        xhr.upload.onprogress = (event) => {
            const duration = (performance.now() - startTime) / 1000;
            if (duration > 0.1) {
                const bits = event.loaded * 8;
                const mbps = (bits / duration / 1000000);
                
                updateGauge(mbps);
                ui.up.innerText = mbps.toFixed(1);
            }
        };

        xhr.onload = () => {
            updateGauge(0);
            resolve();
        };

        xhr.onerror = () => {
            console.error("Upload Failed. Server might be sleeping or down.");
            ui.up.innerText = "Error";
            resolve();
        };

        xhr.send(heavyData);
    });
}