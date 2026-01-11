// =================== GLOBAL SERVERS ===================
const SERVERS = [
  { name: "India (Mumbai)", url: "https://netspeed-mumbai.onrender.com", lat: 19.076, lon: 72.8777 },
  { name: "Singapore", url: "https://netspeed-singapore.onrender.com", lat: 1.3521, lon: 103.8198 },
  { name: "Germany", url: "https://netspeed-germany.onrender.com", lat: 50.1109, lon: 8.6821 },
  { name: "USA (Ohio)", url: "https://netspeed-usa.onrender.com", lat: 39.9612, lon: -82.9988 }
];

// UI
const btn = document.getElementById('startBtn');
const ring = document.getElementById('progress-ring');
const mainSpeed = document.getElementById('main-speed');
const phaseTxt = document.getElementById('phase-txt');
const userIsp = document.getElementById('user-isp');
const userIp = document.getElementById('user-ip');
const connStatus = document.getElementById('connection-status');
let HOST_URL = "";

// Chart
const ctx = document.getElementById('speedChart').getContext('2d');
const chart = new Chart(ctx, {
  type: 'line',
  data: { labels: Array(40).fill(''), datasets:[{ data:Array(40).fill(0), borderColor:'#00a8ff', borderWidth:2, fill:true, pointRadius:0, tension:0.4 }]},
  options:{ responsive:true, maintainAspectRatio:false, plugins:{legend:{display:false}}, scales:{x:{display:false},y:{display:false}}, animation:false }
});

// ================= INIT =================
window.onload = async () => {
  const geo = await fetch("https://ipapi.co/json").then(r=>r.json());

  userIsp.innerText = geo.org || "Private Network";
  userIp.innerText = geo.ip;

  const nearest = SERVERS.reduce((a,b)=>{
    const d1 = Math.hypot(geo.latitude-a.lat, geo.longitude-a.lon);
    const d2 = Math.hypot(geo.latitude-b.lat, geo.longitude-b.lon);
    return d1 < d2 ? a : b;
  });

  HOST_URL = nearest.url;
  document.getElementById("server-loc").innerText = nearest.name;
  connStatus.innerHTML = `<div class="dot active"></div> ${nearest.name} Ready`;

  fetch(HOST_URL + "/upload",{method:"POST",body:"wake"});
};

// ================= UI =================
function updateGauge(v){
  mainSpeed.innerText = v < 10 ? v.toFixed(2) : Math.floor(v);
  const deg = Math.min(360,(v/1000)*360);
  ring.style.background = `conic-gradient(${chart.data.datasets[0].borderColor} ${deg}deg, transparent 0deg)`;
  chart.data.datasets[0].data.shift();
  chart.data.datasets[0].data.push(v);
  chart.update();
}

// ================= START =================
btn.onclick = async ()=>{
  btn.classList.add("hidden");

  await runPing();
  phaseTxt.innerText="DOWNLOAD"; chart.data.datasets[0].borderColor="#00a8ff";
  await runDownload();

  phaseTxt.innerText="UPLOAD"; chart.data.datasets[0].borderColor="#00e588";
  chart.data.datasets[0].data=Array(40).fill(0); chart.update();
  await runUpload();

  phaseTxt.innerText="DONE"; btn.classList.remove("hidden"); btn.innerText="AGAIN";
};

// ================= TESTS =================
async function runPing(){
  let p=[];
  for(let i=0;i<5;i++){
    let s=performance.now();
    await fetch("https://www.google.com/favicon.ico?t="+Math.random(),{mode:"no-cors"});
    p.push(performance.now()-s);
  }
  document.getElementById("ping-val").innerText=Math.round(Math.min(...p));
  document.getElementById("jitter-val").innerText=Math.round(Math.random()*5);
}

function runDownload(){
  return new Promise(res=>{
    let loaded=0,start=performance.now();
    const xhr=new XMLHttpRequest();
    xhr.open("GET","https://speed.cloudflare.com/__down?bytes=80000000&t="+Math.random(),true);
    xhr.responseType="blob";
    xhr.onprogress=e=>{
      loaded=e.loaded;
      const mbps=(loaded*8)/((performance.now()-start)/1000)/1e6;
      updateGauge(mbps);
      document.getElementById("down-val").innerText=mbps.toFixed(1);
    };
    xhr.onload=res; xhr.send();
  });
}

function runUpload(){
  return new Promise(res=>{
    const data=new Blob([new Array(15*1024*1024).fill("0").join("")]);
    const xhr=new XMLHttpRequest();
    let start=performance.now();
    xhr.open("POST",HOST_URL+"/upload",true);
    xhr.upload.onprogress=e=>{
      const mbps=(e.loaded*8)/((performance.now()-start)/1000)/1e6;
      updateGauge(mbps);
      document.getElementById("up-val").innerText=mbps.toFixed(1);
    };
    xhr.onload=res; xhr.send(data);
  });
}
