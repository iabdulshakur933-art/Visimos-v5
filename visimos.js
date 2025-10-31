\
// Visimos V5 — Touch + Voice + Memory (No Camera)
// Calm soft presence companion. Works on any phone/browser.
// Controls:
//  - Tap: attention (orb moves to touch)
//  - Tap+hold: connection (orb grows, says 'I am here')
//  - Swipe left/right: intent (orb drifts and says 'Understood.' / 'Okay.')
// Memory: stored in localStorage.visimos_v5_profile

const STORAGE = "visimos_v5_profile";
const canvas = document.getElementById("stage");
const ctx = canvas.getContext("2d");
const status = document.getElementById("status");
const resetBtn = document.getElementById("reset");

let w = 0, h = 0;
function resize(){ w = canvas.width = window.innerWidth; h = canvas.height = window.innerHeight; draw(); }
window.addEventListener("resize", resize);
resize();

// orb state
let orb = { x: 0.5, y: 0.5, size: 0.18, baseSize: 0.18, targetSize: 0.18, color: [255,215,120] };
let vel = { x:0, y:0 };
let lastTap = 0;

// memory profile (balanced)
let profile = { visits:0, avgInteraction:0.25, warmth:0.5, lastSeen:null };
function loadProfile(){
  try{
    const raw = localStorage.getItem(STORAGE);
    if(raw){ Object.assign(profile, JSON.parse(raw)); speak("Welcome back."); status.textContent = "Welcome back — Visimos remembers you."; }
    else status.textContent = "Hello — tap the screen to interact.";
  }catch(e){ console.warn(e); }
}
function saveProfile(){
  profile.visits = (profile.visits||0) + 1;
  profile.lastSeen = new Date().toISOString();
  try{ localStorage.setItem(STORAGE, JSON.stringify(profile)); }catch(e){}
  status.textContent = "Memory saved ("+profile.visits+" visits)";
}

// speech util (calm female-ish)
let speakCooldown=false;
function speak(txt){
  if(!window.speechSynthesis) return;
  if(speakCooldown) return;
  const u = new SpeechSynthesisUtterance(txt);
  u.lang = "en-US"; u.pitch = 1.04; u.rate = 0.95; u.volume = 1;
  const voices = speechSynthesis.getVoices();
  const pref = voices.find(v => /female|google us|samantha|alloy/i.test(v.name));
  if(pref) u.voice = pref;
  speechSynthesis.speak(u);
  speakCooldown = true; setTimeout(()=>speakCooldown=false, 1400);
}

// drawing
function draw(){
  ctx.clearRect(0,0,w,h);
  // soft background halo
  const grd = ctx.createLinearGradient(0,0,w,h);
  grd.addColorStop(0,"#070707"); grd.addColorStop(1,"#0b0b0b");
  ctx.fillStyle = grd; ctx.fillRect(0,0,w,h);

  // orb glow
  const cx = orb.x * w, cy = orb.y * h, r = Math.min(w,h) * orb.size;
  const g = ctx.createRadialGradient(cx,cy,r*0.2,cx,cy,r);
  const col = orb.color;
  g.addColorStop(0,`rgba(${col[0]},${col[1]},${col[2]},1)`);
  g.addColorStop(1,`rgba(${col[0]},${col[1]},${col[2]},0)`);
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(cx,cy,r,0,Math.PI*2); ctx.fill();

  // rim
  ctx.beginPath();
  ctx.strokeStyle = "rgba(255,240,200,0.95)";
  ctx.lineWidth = Math.max(3, w*0.008);
  ctx.arc(cx,cy,r*0.55,0,Math.PI*2); ctx.stroke();
}

// physics loop
function step(){
  // relax towards target size
  orb.size += (orb.targetSize - orb.size)*0.08;
  // apply velocity
  orb.x += vel.x; orb.y += vel.y;
  // damping
  vel.x *= 0.88; vel.y *= 0.88;
  // clamp
  orb.x = Math.max(0.08, Math.min(0.92, orb.x));
  orb.y = Math.max(0.08, Math.min(0.92, orb.y));
  draw();
  requestAnimationFrame(step);
}

// interactions
let touchStart = null, touchStartPos = null;
canvas.addEventListener("touchstart", e=>{
  e.preventDefault();
  const t = e.touches[0]; touchStart = Date.now(); touchStartPos = { x: t.clientX/w, y: t.clientY/h };
  lastTap = Date.now();
  // immediate attention: move orb toward touch
  orb.targetSize = orb.baseSize * 1.25;
  orb.color = [255,230,170];
  // nudge toward touch
  const nx = t.clientX / w, ny = t.clientY / h;
  vel.x += (nx - orb.x) * 0.12; vel.y += (ny - orb.y) * 0.12;
  // small speak on tap
  speak("I see you.");
}, { passive:false });

canvas.addEventListener("touchmove", e=>{
  e.preventDefault();
  const t = e.touches[0];
  const nx = t.clientX / w, ny = t.clientY / h;
  // follow finger smoothly
  vel.x += (nx - orb.x) * 0.09; vel.y += (ny - orb.y) * 0.09;
  orb.targetSize = orb.baseSize * 1.4;
  orb.color = [255,210,140];
}, { passive:false });

canvas.addEventListener("touchend", e=>{
  e.preventDefault();
  const dt = Date.now() - (touchStart || 0);
  if(dt > 700){
    // hold = connection
    orb.targetSize = orb.baseSize * 1.6;
    orb.color = [255,240,200];
    speak("I am here.");
    // update memory warmth a bit
    profile.warmth = Math.min(1, (profile.warmth||0.5) + 0.03);
  } else {
    // tap release: small pulse
    orb.targetSize = orb.baseSize;
    orb.color = [255,215,120];
  }
  touchStart = null;
  // record interaction for memory
  profile.avgInteraction = (profile.avgInteraction*0.92 + Math.min(1, dt/1000)*0.08);
  saveProfile();
}, { passive:false });

// mouse fallback for desktop testing
canvas.addEventListener("mousedown", e=>{
  const nx = e.clientX / w, ny = e.clientY / h;
  vel.x += (nx - orb.x) * 0.12; vel.y += (ny - orb.y) * 0.12;
  orb.targetSize = orb.baseSize * 1.25; orb.color=[255,230,170];
  speak("I see you.");
});
window.addEventListener("mouseup", e=>{ orb.targetSize = orb.baseSize; orb.color=[255,215,120]; saveProfile(); });

// swipe detection (direction intent)
let swipeStart = null;
canvas.addEventListener("touchstart", e=>{ swipeStart = e.touches[0]; }, { passive:false });
canvas.addEventListener("touchend", e=>{
  if(!swipeStart) return;
  const end = e.changedTouches[0];
  const dx = end.clientX - swipeStart.clientX;
  if(Math.abs(dx) > 80){
    if(dx > 0){ // swipe right
      vel.x += 0.2; speak("Okay."); profile.warmth = Math.max(0, profile.warmth - 0.02);
    } else { // swipe left
      vel.x -= 0.2; speak("Understood."); profile.warmth = Math.min(1, profile.warmth + 0.02);
    }
    saveProfile();
  }
  swipeStart = null;
}, { passive:false });

// reset memory
resetBtn.addEventListener("click", ()=>{ localStorage.removeItem(STORAGE); profile = { visits:0, avgInteraction:0.25, warmth:0.5, lastSeen:null }; status.textContent = "Memory reset."; speak("Memory cleared."); });

// voice reaction: on mic input (optional)
if(navigator.mediaDevices && navigator.mediaDevices.getUserMedia){
  try{
    navigator.mediaDevices.getUserMedia({ audio:true }).then(stream=>{
      const ctxAudio = new (window.AudioContext||window.webkitAudioContext)();
      const src = ctxAudio.createMediaStreamSource(stream);
      const analyser = ctxAudio.createAnalyser();
      src.connect(analyser);
      analyser.fftSize = 256;
      const data = new Uint8Array(analyser.frequencyBinCount);
      function audioLoop(){
        analyser.getByteFrequencyData(data);
        let sum=0; for(let i=0;i<data.length;i++) sum+=data[i];
        const level = sum / data.length;
        // respond to voice level
        if(level > 40){
          orb.targetSize = orb.baseSize * (1 + Math.min(0.8, (level-40)/120));
          orb.color = [255,230,180];
        }
        requestAnimationFrame(audioLoop);
      }
      audioLoop();
    }).catch(e=>{/*mic not allowed — that's fine*/});
  }catch(e){}
}

// startup
loadProfile();
step();

// let the orb breathe slowly
setInterval(()=>{ orb.baseSize = 0.18 + Math.sin(Date.now()/2000)*0.01; }, 3000);

// initial gentle nudge
vel.x = (Math.random()-0.5)*0.01; vel.y = (Math.random()-0.5)*0.01;
