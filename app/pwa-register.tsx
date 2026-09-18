'use client';
import {useEffect,useState} from 'react';

export default function PwaRegister(){
  const [installEvent,setInstallEvent]=useState<any>(null);
  const [online,setOnline]=useState(true);
  useEffect(()=>{
    setOnline(navigator.onLine);
    const onOnline=()=>setOnline(true), onOffline=()=>setOnline(false), onBefore=(e:any)=>{e.preventDefault();setInstallEvent(e)};
    window.addEventListener('online',onOnline); window.addEventListener('offline',onOffline); window.addEventListener('beforeinstallprompt',onBefore);
    if('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js').catch(()=>{});
    return ()=>{window.removeEventListener('online',onOnline);window.removeEventListener('offline',onOffline);window.removeEventListener('beforeinstallprompt',onBefore)};
  },[]);
  if(!online) return <div className="offline-banner" role="status">Offline mode — cached app shell available</div>;
  if(!installEvent) return null;
  return <button className="install-banner" onClick={async()=>{await installEvent.prompt();setInstallEvent(null)}}>Install Live TV</button>;
}
