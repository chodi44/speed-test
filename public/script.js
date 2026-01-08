// --- CONFIGURATION ---
// 🔴 YOUR RENDER URL GOES HERE:
const HOST_URL = "https://speed-test-egey.onrender.com"; 

const btn = document.getElementById('startBtn');
const serverDot = document.getElementById('server-dot');
const serverStatus = document.getElementById('server-status');
const gaugeCircle = document.getElementById('gauge-circle');
const mainSpeed = document.getElementById('main-speed');
const phaseTxt = document.getElementById('phase-txt');
const dlBox = document.getElementById('dl-box');
const ulBox = document.getElementById('ul-box');

// Chart.js Setup
const ctx = document.getElementById('speedChart').getContext('2d');
let speedChart = new Chart(ctx, {
    type: 'line',
    data: {
        labels: Array(50).fill(''), // Empty labels for scrolling effect
        datasets: [{
            label: 'Speed (Mbps)',
            data: Array(50).fill(0),
            borderColor: '#00ffcc',
            borderWidth: 2,
            backgroundColor: 'rgba(0, 255, 204, 0.1)',
            fill: true,
            tension: 0.4,
            pointRadius: 0
        }]
    },
    options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
            x: { display: false },
            y: { 
                beginAtZero: true, 
                grid: { color: '#222' },
                ticks: { color: '#555' }
            }
        },
        animation: false
    }
});

// State
let isRunning = false;
const GAUGE_CIRCUMFERENCE = 420; // Matches CSS stroke-dasharray

// --- INIT ---
window.onload = function() {
    wakeUpServer();
    // Simulate IP fetch
    fetch('https://api.ipify.org?format=json')
        .then(res => res.json())
        .then(data => document.getElementById('client-ip').innerText = data.ip)
        .catch(() => {});
};

function wakeUpServer() {
    serverStatus.innerText = "WAKING SERVER...";
    serverDot.className = "status-dot";
    
    // Ping the backend
    fetch(HOST_URL + "/upload", { method: 'POST', body: 'wake' })
        .then(() => {
            serverStatus.innerText = "SERVER ONLINE";
            serverDot.className = "status-dot online";
        })
        .catch(() => {
            // Even if CORS fails initially, we allow user to try
            serverStatus.innerText = "READY (Wait 30s)";
            serverDot.className = "status-dot";
        });
}

// --- MAIN TEST FLOW ---
btn.addEventListener('click', async () => {
    if(isRunning) return;
    isRunning = true;
    btn.disabled = true;
    btn.innerHTML = "TESTING...";
    
    // Reset Graph
    speedChart.data.datasets[0].borderColor = '#00ffcc'; // Green for DL
    resetUI();

    try {
        // 1. PING
        setPhase("PING");
        await testPing();

        // 2. DOWNLOAD
        setPhase("DOWNLOAD");
        dlBox.classList.add('active-box');
        ulBox.classList.remove('active-box');
        speedChart.data.datasets[0].borderColor = '#00ffcc'; // Green
        await testDownload();

        // 3. UPLOAD
        setPhase("UPLOAD");
        dlBox.classList.remove('active-box');
        ulBox.classList.add('active-box');
        speedChart.data.datasets[0].borderColor = '#0088ff'; // Blue
        
        // Clear graph data for fresh Upload chart
        speedChart.data.datasets[0].data = Array(50).fill(0);
        speedChart.update();
        
        await testUpload();

        setPhase("COMPLETE");
        btn.innerHTML = "TEST AGAIN";

    } catch (e) {
        console.error(e);
        setPhase("ERROR");
        btn.innerHTML = "RETRY";
    }

    isRunning = false;
    btn.disabled = false;
});

function setPhase(txt) {
    phaseTxt.innerText = txt;
}

function resetUI() {
    document.getElementById('ping-val').innerText = "--";
    document.getElementById('jitter-val').innerText = "--";
    document.getElementById('down-val').innerText = "--";
    document.getElementById('up-val').innerText = "--";
    updateGauge(0);
}

// --- VISUALIZATIONS ---
function updateGauge(mbps) {
    // 1. Update Number
    mainSpeed.innerText = mbps < 10 ? mbps.toFixed(2) : Math.floor(mbps);
    
    // 2. Update Ring
    const maxVal = 1000; // 1Gbps scale
    let percent = mbps / maxVal;
    if(percent > 1) percent = 1;
    
    // Calculate offset (420 is full circle, we want to reduce offset to fill it)
    // We start at 420 (empty). 0 is full. 
    // But our gauge is a partial circle (270 deg).
    // Let's simplify: Scale offset from 420 down to 110 (which is full in our SVG)
    const offset = 420 - (percent * 310);
    gaugeCircle.style.strokeDashoffset = offset;

    // 3. Update Chart
    const data = speedChart.data.datasets[0].data;
    data.shift(); // Remove oldest
    data.push(mbps); // Add newest
    speedChart.update();
}

// --- TESTS ---

async function testPing() {
    // Simulating Ping for Demo (Browsers block real ICMP)
    // We use a fetch to Google as a proxy
    let pings = [];
    for(let i=0; i<5; i++) {
        let start = performance.now();
        await fetch("https://www.google.com/favicon.ico?t=" + Math.random(), {mode: 'no-cors'});
        pings.push(performance.now() - start);
    }
    const min = Math.min(...pings);
    document.getElementById('ping-val').innerText = Math.round(min);
    document.getElementById('jitter-val').innerText = Math.round(Math.random() * 5); // Simulated jitter
}

function testDownload() {
    return new Promise(resolve => {
        // Use Cloudflare 50MB file
        const xhr = new XMLHttpRequest();
        xhr.open("GET", "https://speed.cloudflare.com/__down?bytes=50000000", true);
        xhr.responseType = "blob";
        
        let start = null;
        xhr.onprogress = (e) => {
            if(!start) start = performance.now();
            let duration = (performance.now() - start) / 1000;
            if(duration > 0.2) {
                let mbps = (e.loaded * 8) / duration / 1000000;
                updateGauge(mbps);
                document.getElementById('down-val').innerText = mbps.toFixed(1);
            }
        };
        xhr.onload = () => {
            resolve();
            updateGauge(0); // Drop to 0 before next test
        };
        xhr.onerror = () => resolve();
        xhr.send();
    });
}

function testUpload() {
    return new Promise(resolve => {
        const xhr = new XMLHttpRequest();
        xhr.open("POST", HOST_URL + "/upload", true);
        
        // 20MB Payload
        const data = new Blob([new Array(20 * 1024 * 1024).fill('0').join('')]);
        
        let start = performance.now();
        xhr.upload.onprogress = (e) => {
            let duration = (performance.now() - start) / 1000;
            if(duration > 0.2) {
                let mbps = (e.loaded * 8) / duration / 1000000;
                updateGauge(mbps);
                document.getElementById('up-val').innerText = mbps.toFixed(1);
            }
        };
        xhr.onload = () => {
            resolve();
            updateGauge(0);
        };
        xhr.onerror = () => {
            alert("Upload Failed. Server asleep?");
            resolve();
        };
        xhr.send(data);
    });
}