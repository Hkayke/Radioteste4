const socket=io();
const $=id=>document.getElementById(id);
let authenticated=false, audioCtx=null, musicSource=null, musicGain=null, micGain=null, micStream=null, micSource=null, bassFilter=null, delayNode=null, delayGain=null, mixDest=null, mixStream=null, playlist=[], currentIndex=0, peers=new Map(), transmitting=false, ptt=false, micEnabled=false;
const musicAudio=$("musicAudio");
$("adminShareUrl").value=location.origin;

$("loginForm").addEventListener("submit",e=>{
  e.preventDefault();
  socket.emit("admin:login",$("password").value,result=>{
    if(result?.ok){authenticated=true;$("loginPanel").hidden=true;$("dashboard").hidden=false;$("loginMessage").textContent=""; }
    else $("loginMessage").textContent=result?.message||"Não foi possível entrar.";
  });
});
socket.on("admin:authenticated",()=>{authenticated=true;});
socket.on("listener:joined",({id})=>{if(transmitting) createPeer(id);});
socket.on("signal:answer",async({from,answer})=>{const pc=peers.get(from);if(pc)try{await pc.setRemoteDescription(answer);}catch{}});
socket.on("signal:ice",async({from,candidate})=>{const pc=peers.get(from);if(pc)try{await pc.addIceCandidate(candidate);}catch{}});
socket.on("disconnect",()=>{setState(false);$("broadcastMessage").textContent="Conexão com o servidor perdida. Verifique a internet.";});
socket.on("dj:replaced",()=>{stopBroadcast();$("broadcastMessage").textContent="Outro painel iniciou uma transmissão.";});
socket.on("radio:status",info=>{if(authenticated && !transmitting && info.live)$("broadcastMessage").textContent="Há outra transmissão ativa no momento.";});

function setState(live){$("studioState").textContent=live?"● AO VIVO":"● OFFLINE";$("studioState").style.color=live?"#3ce0a2":"#9eafc4";$("startBtn").disabled=live;$("stopBtn").disabled=!live;}
function report(msg){$("broadcastMessage").textContent=msg;}
async function setupAudio(){
  if(audioCtx) {if(audioCtx.state==="suspended")await audioCtx.resume();return;}
  audioCtx=new (window.AudioContext||window.webkitAudioContext)();
  musicSource=audioCtx.createMediaElementSource(musicAudio);
  musicGain=audioCtx.createGain();musicGain.gain.value=+$("musicVolume").value/100;
  musicSource.connect(musicGain);musicGain.connect(audioCtx.destination);
  // The same music is also sent to the online broadcast.
  const musicBus=audioCtx.createGain();musicGain.connect(musicBus);
  micGain=audioCtx.createGain();micGain.gain.value=0;
  bassFilter=audioCtx.createBiquadFilter();bassFilter.type="lowshelf";bassFilter.frequency.value=180;
  delayNode=audioCtx.createDelay(1);delayNode.delayTime.value=.22;
  delayGain=audioCtx.createGain();delayGain.gain.value=0;
  const micBus=audioCtx.createGain();
  micGain.connect(bassFilter);bassFilter.connect(micBus);micBus.connect(audioCtx.destination);
  bassFilter.connect(delayNode);delayNode.connect(delayGain);delayGain.connect(micBus);
  mixDest=audioCtx.createMediaStreamDestination();
  musicBus.connect(mixDest);
  micBus.connect(mixDest);
  // Pitch control is presented as a voice tone control; browser-native Web Audio does not provide pitch-shifting.
  $("pitchOut").textContent="Normal";
  updateMusicVolume();
}
async function activateMic(){
  try{
    await setupAudio();
    if(!micStream){
      micStream=await navigator.mediaDevices.getUserMedia({audio:{echoCancellation:true,noiseSuppression:true,autoGainControl:true},video:false});
      micSource=audioCtx.createMediaStreamSource(micStream);micSource.connect(micGain);
    }
    micEnabled=true;$("micBtn").textContent="Microfone ativado";$("pttBtn").disabled=false;$("pttStatus").textContent="Pronto para falar — segure o botão.";
    report("Microfone ativado. Use o botão de falar enquanto estiver ao vivo.");
  }catch(e){report("Não foi possível acessar o microfone. Verifique a permissão do navegador e use HTTPS.");}
}
$("micBtn").addEventListener("click",activateMic);
function setPtt(on){
  if(!micEnabled||!micGain)return;
  ptt=on;micGain.gain.setTargetAtTime(on?(+$("micVolume").value/100):0,audioCtx.currentTime,.025);
  $("pttBtn").classList.toggle("active",on);$("pttStatus").textContent=on?"MICROFONE ABERTO — NO AR":"Microfone silenciado";
}
$("pttBtn").addEventListener("pointerdown",e=>{e.preventDefault();if(transmitting)setPtt(true);else report("Inicie a transmissão antes de falar.");});
["pointerup","pointerleave","pointercancel"].forEach(ev=>$("pttBtn").addEventListener(ev,()=>setPtt(false)));
$("pttBtn").addEventListener("contextmenu",e=>e.preventDefault());
$("musicFiles").addEventListener("change",e=>{
  const files=[...e.target.files].filter(f=>f.type.startsWith("audio/"));
  files.forEach(file=>playlist.push({name:file.name,url:URL.createObjectURL(file)}));
  renderPlaylist();if(playlist.length && !musicAudio.src)loadTrack(0);e.target.value="";
});
function renderPlaylist(){
  const root=$("playlist");root.innerHTML="";
  if(!playlist.length){root.className="playlist empty-state";root.textContent="Adicione músicas para montar sua fila.";return;}
  root.className="playlist";
  playlist.forEach((song,i)=>{
    const row=document.createElement("div");row.className="playlist-item"+(i===currentIndex?" active":"");
    const name=document.createElement("span");name.className="song-name";name.textContent=`${i+1}. ${song.name}`;
    const play=document.createElement("button");play.textContent="▶";play.setAttribute("aria-label","Tocar "+song.name);play.onclick=()=>loadTrack(i,true);
    const remove=document.createElement("button");remove.textContent="×";remove.setAttribute("aria-label","Remover "+song.name);remove.onclick=()=>{const wasCurrent=i===currentIndex;URL.revokeObjectURL(song.url);playlist.splice(i,1);if(i<currentIndex)currentIndex--;if(wasCurrent){musicAudio.pause();musicAudio.removeAttribute("src");if(playlist.length)loadTrack(Math.min(i,playlist.length-1));}renderPlaylist();};
    row.append(name,play,remove);root.append(row);
  });
}
async function loadTrack(i,autoplay=false){
  if(!playlist.length)return;
  currentIndex=(i+playlist.length)%playlist.length;musicAudio.src=playlist[currentIndex].url;$("nowPlaying").textContent=playlist[currentIndex].name;renderPlaylist();
  socket.emit("dj:track",playlist[currentIndex].name);
  if(autoplay){try{await setupAudio();await musicAudio.play();$("playBtn").textContent="Ⅱ";}catch{$("broadcastMessage").textContent="Toque em reproduzir para iniciar o áudio.";}}
  else $("playBtn").textContent="▶";
}
$("playBtn").addEventListener("click",async()=>{
  if(!playlist.length)return report("Adicione pelo menos uma música.");
  await setupAudio();
  if(musicAudio.paused){try{await musicAudio.play();$("playBtn").textContent="Ⅱ";}catch{report("Não foi possível reproduzir esta faixa.");}}
  else{musicAudio.pause();$("playBtn").textContent="▶";}
});
$("nextBtn").addEventListener("click",()=>loadTrack(currentIndex+1,true));
$("prevBtn").addEventListener("click",()=>loadTrack(currentIndex-1,true));
musicAudio.addEventListener("ended",()=>{if(playlist.length>1)loadTrack(currentIndex+1,true);else{$("playBtn").textContent="▶";}});
$("musicVolume").addEventListener("input",updateMusicVolume);
function updateMusicVolume(){const v=+$("musicVolume").value;$("musicVolumeOut").textContent=v+"%";if(musicGain)musicGain.gain.setTargetAtTime(v/100,audioCtx.currentTime,.03);}
$("micVolume").addEventListener("input",()=>{$("micVolumeOut").textContent=$("micVolume").value+"%";if(ptt&&micGain)micGain.gain.setTargetAtTime(+$("micVolume").value/100,audioCtx.currentTime,.03);});
$("pitch").addEventListener("input",()=>{$("pitchOut").textContent=+$("pitch").value===0?"Normal":(+$("pitch").value>0?"+":"")+$("pitch").value+" semitons";});
$("echo").addEventListener("input",()=>{const v=+$("echo").value;$("echoOut").textContent=v+"%";if(delayGain)delayGain.gain.setTargetAtTime(v/100,audioCtx.currentTime,.03);});
$("bass").addEventListener("input",()=>{const v=+$("bass").value;$("bassOut").textContent=(v>0?"+":"")+v+" dB";if(bassFilter)bassFilter.gain.setTargetAtTime(v,audioCtx.currentTime,.03);});
async function createPeer(id){
  if(!mixStream||peers.has(id))return;
  const pc=new RTCPeerConnection({iceServers:[{urls:"stun:stun.l.google.com:19302"}]});
  peers.set(id,pc);
  mixStream.getAudioTracks().forEach(track=>pc.addTrack(track,mixStream));
  pc.onicecandidate=e=>{if(e.candidate)socket.emit("signal:ice",{target:id,candidate:e.candidate});};
  pc.onconnectionstatechange=()=>{if(["failed","closed","disconnected"].includes(pc.connectionState)){pc.close();peers.delete(id);}};
  try{const offer=await pc.createOffer();await pc.setLocalDescription(offer);socket.emit("signal:offer",{target:id,offer});}catch(e){pc.close();peers.delete(id);}
}
$("startBtn").addEventListener("click",async()=>{
  if(!authenticated)return;
  try{
    await setupAudio();
    mixStream=mixDest.stream;
    transmitting=true;socket.emit("dj:start",{name:"Conexão FM"});
    setState(true);report("Rádio no ar! Os ouvintes podem abrir o link público.");
    $("pttBtn").disabled=!micEnabled;
    for(const [id,s] of socket.io.engine ? [] : []){} // no-op; new listeners connect via listener:joined
  }catch(e){report("Não foi possível iniciar o áudio. Interaja com a página e tente novamente.");}
});
function stopBroadcast(){
  transmitting=false;setPtt(false);peers.forEach(pc=>pc.close());peers.clear();mixStream=null;
  socket.emit("dj:stop");setState(false);$("pttBtn").disabled=!micEnabled;
}
$("stopBtn").addEventListener("click",()=>{stopBroadcast();report("Transmissão encerrada.");});
$("adminCopyBtn").addEventListener("click",async()=>{try{await navigator.clipboard.writeText(location.origin);report("Link público copiado!");}catch{$("adminShareUrl").select();report("Selecione e copie o link.");}});
