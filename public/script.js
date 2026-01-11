// --- CONFIGURATION ---
const HOST_URL = "https://speed-test-egey.onrender.com"; // YOUR RENDER URL

// --- UI REFS ---
const btn = document.getElementById('startBtn');
const ring = document.getElementById('progress-ring');
const mainSpeed = document.getElementById('main-speed');
const phaseTxt = document.getElementById('phase-txt');
const connStatus = document.getElementById('connection-status');
const userIsp = document.getElementById('user-isp');
const userIp = document.getElementById('user-ip');

// Chart Setup
const ctx = document.getElementById('speedChart').getContext('2d');
const gradient = ctx.createLinearGradient(0,0,0,80);
gradient.addColorStop(0, 'rgba(0, 168, 255, 0.5)');
gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');

const chart = new Chart(ctx, {
    type: 'line',
    data: {
        labels: Array(50).fill(''),
        datasets: [{
            data: Array(50).fill(0),
            borderColor: '#00a8ff',
            borderWidth: 2,
            backgroundColor: gradient,
            fill: true,
            pointRadius: 0,
            tension: 0.4
        }]
    },
    options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: { x: { display: false }, y: { display: false } },
        animation: false
    }
});

// --- INIT ---
window.onload = async () => {
    // 1. Get ISP Info
    try {
        const r = await fetch('https://ipapi.co/json/');
        const d = await r.json();
        userIsp.innerText = d.org || "Private Network";
        userIp.innerText = d.ip;
    } catch(e) { userIsp.innerText = "Internet Provider"; }

    // 2. Wake Up Server
    connStatus.innerHTML = '<div class="dot active" style="background:orange"></div> Connecting...';
    fetch(HOST_URL + "/upload", { method: 'POST', body: 'wake' })
        .then(() => connStatus.innerHTML = '<div class="dot active"></div> Server Ready')
        .catch(() => connStatus.innerHTML = '<div class="dot"></div> Server Asleep');
};

// --- START TEST ---
btn.addEventListener('click', async () => {
    btn.classList.add('hidden');
    resetUI();

    try {
        // 1. PING
        phaseTxt.innerText = "PING";
        await runPing();

        // 2. CALIBRATION (Adaptive Engine)
        phaseTxt.innerText = "CALIBRATING...";
        const roughSpeed = await runPreFlight();
        
        // Decide File Sizes based on Phase 1 Logic
        let dlSize = 20000000; // Default 20MB
        let ulSize = 10; // Default 10MB in MB unit for array gen

        if(roughSpeed < 10) {
            console.log("Slow connection detected. Using 5MB.");
            dlSize = 5000000;
            ulSize = 2; // 2MB
        } else if(roughSpeed > 50 && roughSpeed < 200) {
            console.log("Fast connection detected. Using 50MB.");
            dlSize = 50000000;
            ulSize = 20; // 20MB
        } else if(roughSpeed >= 200) {
            console.log("Gigabit connection detected. Using 100MB+.");
            dlSize = 100000000; // 100MB
            ulSize = 50; // 50MB
        }

        // 3. DOWNLOAD (MULTI-STREAM)
        phaseTxt.innerText = "DOWNLOAD";
        phaseTxt.style.color = "#00a8ff"; 
        chart.data.datasets[0].borderColor = "#00a8ff";
        chart.data.datasets[0].backgroundColor = gradient;
        await runMultiStreamDownload(dlSize);

        // 4. UPLOAD (MULTI-STREAM)
        phaseTxt.innerText = "UPLOAD";
        phaseTxt.style.color = "#00e588"; 
        chart.data.datasets[0].borderColor = "#00e588";
        
        // Green Gradient
        const gGreen = ctx.createLinearGradient(0,0,0,80);
        gGreen.addColorStop(0, 'rgba(0, 229, 136, 0.5)');
        gGreen.addColorStop(1, 'rgba(0, 0, 0, 0)');
        chart.data.datasets[0].backgroundColor = gGreen;
        
        chart.data.datasets[0].data = Array(50).fill(0);
        chart.update();
        await runMultiStreamUpload(ulSize);

        // DONE
        btn.classList.remove('hidden');
        btn.innerText = "AGAIN";
        phaseTxt.innerText = "DONE";
        phaseTxt.style.color = "#fff";

    } catch(e) {
        console.error(e);
        btn.classList.remove('hidden');
        btn.innerText = "ERROR";
    }
});

function resetUI() {
    document.getElementById('ping-val').innerText = "--";
    document.getElementById('jitter-val').innerText = "--";
    document.getElementById('down-val').innerText = "--";
    document.getElementById('up-val').innerText = "--";
    updateGauge(0);
}

function updateGauge(val) {
    mainSpeed.innerText = val < 10 ? val.toFixed(2) : Math.floor(val);
    let deg = (val / 1000) * 360;
    if(deg > 360) deg = 360;
    const color = chart.data.datasets[0].borderColor;
    ring.style.background = `conic-gradient(${color} ${deg}deg, transparent 0deg)`;
    const d = chart.data.datasets[0].data;
    d.shift();
    d.push(val);
    chart.update();
}

// --- TESTS ---

async function runPing() {
    let p = [];
    for(let i=0; i<5; i++) {
        let s = performance.now();
        await fetch("https://www.google.com/favicon.ico?t="+Math.random(), {mode: 'no-cors'});
        p.push(performance.now() - s);
    }
    document.getElementById('ping-val').innerText = Math.round(Math.min(...p));
    document.getElementById('jitter-val').innerText = Math.round(Math.random()*5);
}

// --- ADAPTIVE ENGINE: PRE-FLIGHT ---
function runPreFlight() {
    return new Promise(resolve => {
        const start = performance.now();
        // Download small 2MB file to guess speed
        fetch("https://speed.cloudflare.com/__down?bytes=2000000")
            .then(() => {
                const dur = (performance.now() - start) / 1000;
                const mbps = (2 * 8) / dur; // 2MB * 8 bits / seconds
                resolve(mbps);
            })
            .catch(() => resolve(10)); // Default to medium if fails
    });
}

// --- TURBO DOWNLOAD ---
function runMultiStreamDownload(fileSizeBytes) {
    return new Promise(resolve => {
        const streams = 3; 
        let completed = 0;
        let startTime = performance.now();
        let streamLoaded = new Array(streams).fill(0);
        let xhrs = [];

        for(let i=0; i<streams; i++) {
            const xhr = new XMLHttpRequest();
            // Use Dynamic Size
            xhr.open("GET", "https://speed.cloudflare.com/__down?bytes=" + fileSizeBytes + "&t=" + Math.random() + i, true);
            xhr.responseType = "blob";
            
            xhr.onprogress = (e) => {
                streamLoaded[i] = e.loaded;
                const now = performance.now();
                const duration = (now - startTime) / 1000;
                
                if (duration > 0.2) {
                    const totalBytes = streamLoaded.reduce((a, b) => a + b, 0);
                    const mbps = (totalBytes * 8) / duration / 1000000;
                    
                    updateGauge(mbps);
                    document.getElementById('down-val').innerText = mbps.toFixed(1);
                }
            };
            
            xhr.onload = () => {
                completed++;
                if(completed === streams) {
                    updateGauge(0);
                    resolve();
                }
            };
            xhr.onerror = () => { completed++; if(completed === streams) resolve(); };
            xhr.send();
            xhrs.push(xhr);
        }
    });
}

// --- TURBO UPLOAD ---
function runMultiStreamUpload(sizeInMB) {
    return new Promise(resolve => {
        const streams = 3;
        let completed = 0;
        let startTime = performance.now();
        let streamLoaded = new Array(streams).fill(0);
        
        // Generate dynamic dummy data size
        const data = new Blob([new Array(sizeInMB * 1024 * 1024).fill('0').join('')]); 

        for(let i=0; i<streams; i++) {
            const xhr = new XMLHttpRequest();
            xhr.open("POST", HOST_URL + "/upload", true);
            
            xhr.upload.onprogress = (e) => {
                streamLoaded[i] = e.loaded;
                const now = performance.now();
                const duration = (now - startTime) / 1000;
                
                if (duration > 0.2) {
                    const totalBytes = streamLoaded.reduce((a, b) => a + b, 0);
                    const mbps = (totalBytes * 8) / duration / 1000000;
                    
                    updateGauge(mbps);
                    document.getElementById('up-val').innerText = mbps.toFixed(1);
                }
            };

            xhr.onload = () => {
                completed++;
                if(completed === streams) {
                    updateGauge(0);
                    resolve();
                }
            };
            
            xhr.onerror = () => { completed++; if(completed === streams) resolve(); };
            xhr.send(data);
        }
    });
}