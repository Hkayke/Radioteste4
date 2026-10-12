const socket = io();
const audio = document.getElementById("remoteAudio");
const listenBtn = document.getElementById("listenBtn");
const listenMessage = document.getElementById("listenMessage");
const liveLabel = document.getElementById("liveLabel");
const livePill = document.querySelector(".live-pill");
const trackTitle = document.getElementById("trackTitle");
const trackSub = document.getElementById("trackSub");
const listenerCount = document.getElementById("listenerCount");
document.getElementById("shareUrl").value = location.origin;
let pc = null, djId = null, joined = false;

function setMessage(msg){ listenMessage.textContent = msg; }
async function connectListener(){
  if (!joined) { socket.emit("listener:join"); joined = true; }
  if (!djId) { setMessage("A rádio ainda não está transmitindo. Tente novamente em instantes."); return; }
  try {
    if (pc) pc.close();
    pc = new RTCPeerConnection({ iceServers: [{ urls: "stun:stun.l.google.com:19302" }] });
    pc.ontrack = e => {
      audio.srcObject = e.streams[0];
      audio.play().then(() => setMessage("Conectado! Aproveite a programação.")).catch(() => setMessage("Conectado. Toque em Ouvir ao vivo para liberar o áudio."));
    };
    pc.onicecandidate = e => { if(e.candidate) socket.emit("signal:ice",{target:djId,candidate:e.candidate}); };
    const offer = await pc.createOffer({offerToReceiveAudio:true,offerToReceiveVideo:false});
    await pc.setLocalDescription(offer);
    socket.emit("signal:offer",{target:djId,offer});
    setMessage("Conectando à transmissão…");
  } catch(e) { setMessage("Não foi possível conectar. Atualize a página e tente novamente."); }
}
listenBtn.addEventListener("click", async () => {
  try { await audio.play().catch(()=>{}); } catch {}
  if (!joined || !pc) connectListener();
  else if (audio.srcObject) audio.play().then(()=>setMessage("Reprodução ativa.")).catch(()=>setMessage("Toque novamente para liberar o áudio."));
});
socket.on("radio:status", info => {
  document.getElementById("radioName").innerHTML = `${escapeHtml(info.name || "CONEXÃO")} <b>FM</b><small>RÁDIO ONLINE</small>`;
  liveLabel.textContent = info.live ? "TRANSMITINDO AO VIVO" : "AGUARDANDO TRANSMISSÃO";
  livePill.classList.toggle("on", !!info.live);
  trackTitle.textContent = info.track || "Conexão FM";
  trackSub.textContent = info.live ? "A programação está no ar agora." : "Sua rádio, sua conexão.";
  listenerCount.textContent = info.listeners ?? 0;
  if(info.live && joined && !pc) connectListener();
});
socket.on("radio:ended", () => { djId=null; if(pc){pc.close();pc=null;} setMessage("A transmissão foi encerrada."); });
socket.on("signal:offer", async ({from,offer}) => {
  djId=from;
  try {
    if(pc) pc.close();
    pc=new RTCPeerConnection({iceServers:[{urls:"stun:stun.l.google.com:19302"}]});
    pc.ontrack=e=>{audio.srcObject=e.streams[0];audio.play().then(()=>setMessage("Conectado! Aproveite a programação.")).catch(()=>setMessage("Conectado. Toque em Ouvir ao vivo para liberar o áudio."));};
    pc.onicecandidate=e=>{if(e.candidate)socket.emit("signal:ice",{target:djId,candidate:e.candidate});};
    await pc.setRemoteDescription(offer);
    const answer=await pc.createAnswer(); await pc.setLocalDescription(answer);
    socket.emit("signal:answer",{target:djId,answer});
  }catch(e){setMessage("Falha na conexão de áudio. Tente tocar novamente.");}
});
socket.on("signal:ice", async ({from,candidate}) => {
  if(pc && (from===djId)) try{await pc.addIceCandidate(candidate);}catch{}
});
document.getElementById("copyBtn").addEventListener("click", async()=>{
  try{await navigator.clipboard.writeText(location.origin);document.getElementById("copyMessage").textContent="Link copiado!";}catch{document.getElementById("shareUrl").select();document.getElementById("copyMessage").textContent="Selecione e copie o link acima.";}
});
document.getElementById("shareBtn").addEventListener("click", async()=>{
  const data={title:"Conexão FM",text:"Ouça a rádio ao vivo:",url:location.origin};
  if(navigator.share){try{await navigator.share(data);}catch{}}
  else {try{await navigator.clipboard.writeText(location.origin);document.getElementById("copyMessage").textContent="Link copiado!";}catch{document.getElementById("shareUrl").select();}}
});
function escapeHtml(s){return String(s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));}
