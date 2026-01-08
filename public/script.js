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

// --- CONFIGURATION ---
const pingUrl = "https://www.google.com/favicon.ico"; 
const downloadUrl = "https://speed.cloudflare.com/__down?bytes=50000000"; // 50MB for accuracy

// --- STATE ---
let isRunning = false;

window.onload = function() {
    ispTxt.innerText = "Ready to Test"; 
}

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
        
        // 3. UPLOAD (Real Local Upload to server.js)
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

// --- NEW GIGABIT GAUGE LOGIC ---
function updateGauge(value) {
    // We assume 1000 Mbps is a full circle for modern connections
    const maxSpeed = 1000; 
    
    let degrees = (value / maxSpeed) * 360; 
    if (degrees > 360) degrees = 360;
    
    // Update the Visual Ring
    gaugeProgress.style.background = `conic-gradient(var(--primary) ${degrees}deg, transparent 0deg)`;
    
    // Update the Number (Show decimals if under 10, whole numbers if over 10)
    if (value < 10) {
        mainSpeed.innerText = value.toFixed(2);
    } else {
        mainSpeed.innerText = Math.floor(value);
    }
}

// --- 1. REAL PING ---
async function testRealPing() {
    let pings = [];
    // Ping 5 times
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
    
    // Jitter Calculation
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
            updateGauge(0); // Reset gauge for next step
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

// --- 3. REAL UPLOAD (To Your Server) ---
function testRealUpload() {
    return new Promise((resolve) => {
        const xhr = new XMLHttpRequest();
        const startTime = performance.now();
        
        // Create 20MB of dummy data to push
        const heavyData = new Blob([new Array(20 * 1024 * 1024).fill('0').join('')]);

        xhr.open("POST", "/upload", true);

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
            console.error("Upload Failed (Is server.js running?)");
            resolve();
        };

        xhr.send(heavyData);
    });
}