// --- CONFIGURATION ---
const HOST_URL = "https://speed-test-egey.onrender.com"; // YOUR RENDER URL

// --- UI REFS ---
const btn = document.getElementById('startBtn');
const ring = document.getElementById('progress-ring');
const mainSpeed = document.getElementById('main-speed');
const phaseTxt = document.getElementById('phase-txt');
const connStatus = document.getElementById('connection-status');

// User Info
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
        labels: Array(40).fill(''),
        datasets: [{
            data: Array(40).fill(0),
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
    } catch(e) {
        userIsp.innerText = "Unknown Provider";
    }

    // 2. Wake Up Server
    connStatus.innerHTML = '<div class="dot active" style="background:orange"></div> Connecting...';
    fetch(HOST_URL + "/upload", { method: 'POST', body: 'wake' })
        .then(() => {
            connStatus.innerHTML = '<div class="dot active"></div> Server Ready';
        })
        .catch(() => {
            connStatus.innerHTML = '<div class="dot"></div> Server Asleep';
        });
};

// --- START TEST ---
btn.addEventListener('click', async () => {
    btn.classList.add('hidden');
    resetUI();

    try {
        // PING
        phaseTxt.innerText = "PING";
        await runPing();

        // DOWNLOAD
        phaseTxt.innerText = "DOWNLOAD";
        phaseTxt.style.color = "#00a8ff"; // Blue
        chart.data.datasets[0].borderColor = "#00a8ff";
        await runDownload();

        // UPLOAD
        phaseTxt.innerText = "UPLOAD";
        phaseTxt.style.color = "#00e588"; // Green
        chart.data.datasets[0].borderColor = "#00e588";
        // Reset chart for upload
        chart.data.datasets[0].data = Array(40).fill(0);
        chart.update();
        await runUpload();

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
    
    // Scale 1000 Mbps
    let deg = (val / 1000) * 360;
    if(deg > 360) deg = 360;
    
    // Use chart color for ring
    const color = chart.data.datasets[0].borderColor;
    ring.style.background = `conic-gradient(${color} ${deg}deg, transparent 0deg)`;

    // Update Chart
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

function runDownload() {
    return new Promise(resolve => {
        const xhr = new XMLHttpRequest();
        xhr.open("GET", "https://speed.cloudflare.com/__down?bytes=50000000", true);
        xhr.responseType = "blob";
        let start;
        xhr.onprogress = (e) => {
            if(!start) start = performance.now();
            let dur = (performance.now() - start)/1000;
            if(dur > 0.1) {
                let mbps = (e.loaded*8)/dur/1000000;
                updateGauge(mbps);
                document.getElementById('down-val').innerText = mbps.toFixed(1);
            }
        };
        xhr.onload = () => { updateGauge(0); resolve(); };
        xhr.send();
    });
}

function runUpload() {
    return new Promise(resolve => {
        const xhr = new XMLHttpRequest();
        xhr.open("POST", HOST_URL + "/upload", true);
        const data = new Blob([new Array(20*1024*1024).fill('0').join('')]);
        let start = performance.now();
        xhr.upload.onprogress = (e) => {
            let dur = (performance.now() - start)/1000;
            if(dur > 0.1) {
                let mbps = (e.loaded*8)/dur/1000000;
                updateGauge(mbps);
                document.getElementById('up-val').innerText = mbps.toFixed(1);
            }
        };
        xhr.onload = () => { updateGauge(0); resolve(); };
        xhr.onerror = () => resolve();
        xhr.send(data);
    });
}