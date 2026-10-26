'use strict';
const start=document.getElementById('start'),statusText=document.getElementById('status'),canvas=document.getElementById('screen');
start.onclick=async()=>{start.disabled=true;statusText.textContent='Preparando emulador…';try{
 const dos=await Dos(canvas,{wdosboxUrl:'wdosbox.js',cycles:'max',autolock:false,onprogress:(stage,total,loaded)=>{statusText.textContent=`Cargando emulador… ${total?Math.min(100,Math.round(loaded/total*100)):0}%`;}});
 statusText.textContent='Cargando DOOM shareware…';await dos.fs.extract('doom-shareware.zip');
 const ci=await dos.main(['-c','doom.exe -noserial -noipx']);
 document.getElementById('launch').hidden=true;canvas.focus();canvas.onclick=()=>canvas.focus();
 window.addEventListener('pagehide',()=>ci.exit());
 }catch(error){statusText.textContent='No se pudo iniciar el juego. Recarga y comprueba que se publicó la carpeta game completa.';start.disabled=false;console.error(error);}};
