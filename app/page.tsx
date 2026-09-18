'use client';
import './globals.css';
import { useCallback, useEffect, useMemo, useState } from 'react';
import LivePlayer from '../components/live-player';
import PwaRegister from './pwa-register';

type Channel = { id:string; name:string; logoUrl?:string|null; groupTitle?:string|null; streamUrl:string; playlistId:string; playlist?:{id:string;name:string;logoUrl?:string|null}|null };
type Category = { name:string; count:number };
type Playlist = { id:string; name:string; logoUrl?:string|null; activeChannelCount:number };

type DeviceType = 'auto'|'android'|'ios'|'windows'|'mac'|'appletv'|'samsungtv'|'lgtv'|'androidtv'|'firetv';
type QualityPref = 'auto'|'480p'|'720p'|'1080p'|'4k';
type AspectPref = 'fit'|'16:9'|'4:3'|'fill';

type UserPrefs = {
  device: DeviceType;
  quality: QualityPref;
  soundOn: boolean;
  aspect: AspectPref;
};

const FAVORITES_KEY = 'live-tv-favorites-v1';
const PREFS_KEY = 'live-tv-user-prefs-v1';

const DEFAULT_PREFS: UserPrefs = { device: 'auto', quality: 'auto', soundOn: true, aspect: 'fit' };

const DEVICE_OPTIONS: { value: DeviceType; label: string }[] = [
  { value: 'auto', label: 'Auto Detect' },
  { value: 'android', label: 'Android Phone / Tablet' },
  { value: 'ios', label: 'iPhone / iPad' },
  { value: 'windows', label: 'Windows PC' },
  { value: 'mac', label: 'Mac' },
  { value: 'appletv', label: 'Apple TV' },
  { value: 'samsungtv', label: 'Samsung TV (Tizen)' },
  { value: 'lgtv', label: 'LG TV (webOS)' },
  { value: 'androidtv', label: 'Android TV / Google TV' },
  { value: 'firetv', label: 'Amazon Fire TV' },
];

const QUALITY_OPTIONS: { value: QualityPref; label: string }[] = [
  { value: 'auto', label: 'Auto' },
  { value: '480p', label: '480p SD' },
  { value: '720p', label: '720p HD' },
  { value: '1080p', label: '1080p Full HD' },
  { value: '4k', label: '4K Ultra HD' },
];

const ASPECT_OPTIONS: { value: AspectPref; label: string }[] = [
  { value: 'fit', label: 'Fit (Recommended)' },
  { value: '16:9', label: '16:9 Widescreen' },
  { value: '4:3', label: '4:3 Standard' },
  { value: 'fill', label: 'Fill Screen' },
];

function detectDevice(): DeviceType {
  if (typeof navigator === 'undefined') return 'android';
  const ua = navigator.userAgent.toLowerCase();
  if (ua.includes('tizen')) return 'samsungtv';
  if (ua.includes('webos')) return 'lgtv';
  if (ua.includes('aft')) return 'firetv';
  if (ua.includes('appletv')) return 'appletv';
  if (/android.*(tv|googletv)/.test(ua)) return 'androidtv';
  if (ua.includes('android')) return 'android';
  if (/iphone|ipad|ipod/.test(ua)) return 'ios';
  if (ua.includes('macintosh')) return 'mac';
  if (ua.includes('windows')) return 'windows';
  return 'android';
}

export default function Home(){
  const [channels,setChannels]=useState<Channel[]>([]);
  const [cats,setCats]=useState<Category[]>([]);
  const [playlists,setPlaylists]=useState<Playlist[]>([]);
  const [category,setCategory]=useState('ALL');
  const [playlist,setPlaylist]=useState('ALL');
  const [q,setQ]=useState('');
  const [selected,setSelected]=useState<Channel|null>(null);
  const [favorites,setFavorites]=useState<string[]>([]);
  const [showFavorites,setShowFavorites]=useState(false);
  const [loading,setLoading]=useState(true);
  const [settings,setSettings]=useState({websiteName:'LIVE TV',websiteUrl:'',websiteLogoUrl:'',showPlayerBrand:true,playerBrandPosition:'bottom',brandTextSize:9});
  const [prefs,setPrefs]=useState<UserPrefs>(DEFAULT_PREFS);
  const [prefsOpen,setPrefsOpen]=useState(false);
  const [resolvedDevice, setResolvedDevice] = useState<DeviceType>('android');

  useEffect(()=>{
    try { setFavorites(JSON.parse(localStorage.getItem(FAVORITES_KEY) || '[]')); } catch { setFavorites([]); }
    try {
      const saved = localStorage.getItem(PREFS_KEY);
      if (saved) setPrefs({ ...DEFAULT_PREFS, ...JSON.parse(saved) });
    } catch {}
    Promise.all([
      fetch('/api/v1/public/categories').then(r=>r.ok?r.json():[]),
      fetch('/api/v1/public/playlists').then(r=>r.ok?r.json():[]),
      fetch('/api/v1/public/settings').then(r=>r.ok?r.json():null),
    ]).then(([c,p,s])=>{setCats(c);setPlaylists(p);if(s)setSettings(s);}).catch(()=>{});
  },[]);

  useEffect(() => {                                                              // ← নতুন
    setResolvedDevice(prefs.device === 'auto' ? detectDevice() : prefs.device);
  }, [prefs.device]);

  useEffect(()=>{
    setLoading(true);
    const p=new URLSearchParams();
    if(category!=='ALL')p.set('category',category);
    if(q)p.set('q',q);
    fetch('/api/v1/public/channels?'+p).then(r=>r.json()).then(setChannels).catch(()=>setChannels([])).finally(()=>setLoading(false));
  },[category,q]);

  useEffect(() => {
  const ping = () => { fetch('/api/v1/access/heartbeat', { method: 'POST' }).catch(() => {}); };
  ping();
  const interval = setInterval(ping, 20_000);

  const release = () => { navigator.sendBeacon?.('/api/v1/access/release'); };
  window.addEventListener('beforeunload', release);
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') release(); });

  return () => {
    clearInterval(interval);
    window.removeEventListener('beforeunload', release);
  };
}, []);

  const visibleChannels = useMemo(()=>{
    let list = channels;
    if(playlist!=='ALL') list=list.filter(c=>c.playlistId===playlist);
    if(showFavorites) list=list.filter(c=>favorites.includes(c.id));
    return list;
  },[channels,playlist,showFavorites,favorites]);

  const groups=useMemo(()=>['ALL',...cats.map(x=>x.name)],[cats]);
  const toggleFavorite=(id:string)=>{
    const next=favorites.includes(id)?favorites.filter(x=>x!==id):[...favorites,id];
    setFavorites(next); localStorage.setItem(FAVORITES_KEY,JSON.stringify(next));
  };

  const updatePrefs = useCallback((patch: Partial<UserPrefs>) => {
    setPrefs(prev => {
      const next = { ...prev, ...patch };
      try { localStorage.setItem(PREFS_KEY, JSON.stringify(next)); } catch {}
      return next;
    });
  }, []);

  return <main className={`site-shell tv-navigation-root device-${resolvedDevice}`}><PwaRegister/>
    <div className="site-top-brand" aria-hidden="true"><span className="site-top-brand-text">ALL OTT PLAY</span></div>
    <header className="topbar">
      <div className="topbar-inner">
        <button className="brand" onClick={()=>{setCategory('ALL');setPlaylist('ALL');setShowFavorites(false)}} aria-label="Home">
  {settings.websiteLogoUrl
    ? <img src={settings.websiteLogoUrl} alt={settings.websiteName} className="brand-logo-img" />
    : <span className="brand-mark">▶</span>
  }
  <span>{settings.websiteName}</span>
</button>
        <nav className="main-nav" aria-label="Primary">
          <button className={!showFavorites?'nav-active':''} onClick={()=>setShowFavorites(false)}>Live TV</button>
          <button className={showFavorites?'nav-active':''} onClick={()=>setShowFavorites(true)}>Favorites <span className="fav-count">{favorites.length}</span></button>
        </nav>
        <div className="topbar-actions">
          <label className="search-box"><span>⌕</span><input placeholder="Search channels" value={q} onChange={e=>setQ(e.target.value)}/></label>
          <button className="prefs-trigger" onClick={()=>setPrefsOpen(true)} aria-label="Playback settings">⚙</button>
        </div>
      </div>
      <div className="category-row"><div className="category-scroll">
        {groups.map(g=><button key={g} onClick={()=>{setCategory(g);setShowFavorites(false)}} className={category===g&&!showFavorites?'category-active':''}>{g}{g!=='ALL'&&<small>{cats.find(c=>c.name===g)?.count}</small>}</button>)}
      </div></div>
    </header>

    <section className="hero">
      <div>
        <p className="eyebrow">LIVE STREAMING</p>
        {showFavorites && <h1>Your Favorites</h1>}
        <p className="hero-copy">{showFavorites ? 'Everything you have saved, in one place.' : 'Fast, clean and made for every screen.'}</p>
      </div>
      <div className="hero-glow"/>
    </section>

    {!showFavorites && <section className="playlist-section"><div className="section-heading"><div><h2>Playlists</h2><p>Browse channels by source</p></div></div><div className="playlist-scroll">
      <button className={`playlist-card ${playlist==='ALL'?'playlist-selected':''}`} onClick={()=>setPlaylist('ALL')}><div className="playlist-logo all-logo">ALL</div><div><strong>All Channels</strong><span>All active channels</span></div></button>
      {playlists.filter(p=>p.activeChannelCount>0).map(p=><button key={p.id} className={`playlist-card ${playlist===p.id?'playlist-selected':''}`} onClick={()=>setPlaylist(p.id)}><div className="playlist-logo">{p.logoUrl?<img src={p.logoUrl} alt="" loading="lazy"/>:<span>TV</span>}</div><div><strong>{p.name}</strong><span>{p.activeChannelCount} active channels</span></div></button>)}
    </div></section>}

    <section className="channels-section"><div className="section-heading"><div><h2>{showFavorites?'Favorites':category==='ALL'?'All Channels':category}</h2><p>{visibleChannels.length} channels</p></div></div>
      {loading?<div className="loading-grid">{Array.from({length:16}).map((_,i)=><div className="skeleton-card" key={i}><div className="skeleton-logo"/><div className="skeleton-line"/></div>)}</div>:visibleChannels.length?<div className="channel-grid">{visibleChannels.map((c,i)=><button key={c.id} onClick={()=>setSelected(c)} className="channel-card channel-card-animate" style={{animationDelay:`${Math.min(i,24)*35}ms`}} tabIndex={0} aria-label={`Play ${c.name}`}><div className="logo-wrap"><div className="live-badge"><span/>LIVE</div>{c.logoUrl?<img src={c.logoUrl} alt="" loading="lazy"/>:(settings.websiteLogoUrl?<img src={settings.websiteLogoUrl} alt="" className="brand-fallback-logo" loading="lazy"/>:<div className="logo-fallback">TV</div>)}<span className="play-overlay">▶</span></div><div className="channel-name">{c.name}</div><span className="favorite-dot" onClick={(e)=>{e.stopPropagation();toggleFavorite(c.id)}}>{favorites.includes(c.id)?'♥':'♡'}</span></button>)}</div>:<div className="empty-state"><div>♡</div><h3>{showFavorites?'No favorites yet':'No active channels available'}</h3><p>{showFavorites?'Tap the heart on a channel to save it.':'Try another category or search.'}</p></div>}
    </section>

    <footer className="site-footer">{settings.websiteName}</footer>

    {selected&&<div className="player-modal" role="dialog" aria-modal="true"><LivePlayer
  channel={selected}
  channels={visibleChannels.length?visibleChannels:channels}
  onChannelChange={(next)=>{const full=channels.find(c=>c.id===next.id);if(full)setSelected(full)}}
  onClose={()=>setSelected(null)}
  websiteName={settings.websiteName}
  websiteUrl={settings.websiteUrl || undefined}
  websiteLogoUrl={settings.websiteLogoUrl || undefined}
  showBranding={settings.showPlayerBrand}
  brandPosition={settings.playerBrandPosition as "top"|"bottom"}
  brandTextSize={settings.brandTextSize}
  initialAspect={prefs.aspect}
  preferSoundOn={prefs.soundOn}
  preferredQuality={prefs.quality}
  deviceType={resolvedDevice}
/></div>}

    {prefsOpen && <div className="prefs-overlay" role="dialog" aria-modal="true" onClick={()=>setPrefsOpen(false)}>
      <div className="prefs-modal" onClick={e=>e.stopPropagation()}>
        <div className="prefs-head"><h3>Playback Preferences</h3><button onClick={()=>setPrefsOpen(false)} aria-label="Close">×</button></div>
        <p className="prefs-sub">Customize how the player behaves on this device. Saved on this browser only.</p>

        <div className="prefs-row">
          <div><strong>Device</strong><span>Select your device for the best experience.</span></div>
          <select value={prefs.device} onChange={e=>updatePrefs({device:e.target.value as DeviceType})}>
            {DEVICE_OPTIONS.map(o=><option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>

        <div className="prefs-row">
          <div><strong>Video Quality</strong><span>Default playback resolution when available.</span></div>
          <select value={prefs.quality} onChange={e=>updatePrefs({quality:e.target.value as QualityPref})}>
            {QUALITY_OPTIONS.map(o=><option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>

        <div className="prefs-row">
          <div><strong>Sound on start</strong><span>Try to play channels with sound automatically.</span></div>
          <select value={prefs.soundOn ? 'on':'off'} onChange={e=>updatePrefs({soundOn:e.target.value==='on'})}>
            <option value="on">On</option>
            <option value="off">Off (start muted)</option>
          </select>
        </div>

        <div className="prefs-row">
          <div><strong>Aspect Ratio</strong><span>How the video fits your screen.</span></div>
          <select value={prefs.aspect} onChange={e=>updatePrefs({aspect:e.target.value as AspectPref})}>
            {ASPECT_OPTIONS.map(o=><option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>
      </div>
    </div>}

    <style jsx global>{`
    /* Brand logo fallback: cover the complete channel card */
    .channel-card:has(.brand-fallback-logo) { padding: 0; overflow: hidden; }
    .channel-card:has(.brand-fallback-logo) .logo-wrap { width: 100%; max-width: none; aspect-ratio: 1 / 1; margin: 0; border-radius: 10px 10px 0 0; background: transparent; box-shadow: none; }
    .channel-card:has(.brand-fallback-logo) .brand-fallback-logo { width: 100%; height: 100%; object-fit: cover; object-position: center; padding: 0; background: transparent; display: block; }
    .channel-card:has(.brand-fallback-logo) .channel-name { padding: 7px 8px 8px; }

    .brand-logo-img { height: 32px; width: auto; object-fit: contain; }
      .site-top-brand { width: 100%; text-align: center; padding: 6px 0 2px; }
      .site-top-brand-text { font-weight: 800; letter-spacing: 3px; font-size: 13px; background: linear-gradient(90deg,#a855f7,#6366f1); -webkit-background-clip: text; background-clip: text; color: transparent; }
      .topbar-actions { display:flex; align-items:center; gap:8px; }
      .prefs-trigger { background: rgba(255,255,255,0.08); border:1px solid rgba(255,255,255,0.15); color:inherit; border-radius:8px; width:36px; height:36px; cursor:pointer; font-size:16px; }
      .prefs-trigger:hover { background: rgba(255,255,255,0.16); }

      @keyframes channelCardIn { from { opacity:0; transform: translateY(14px) scale(.96);} to {opacity:1; transform:none;} }
      .channel-card-animate { animation: channelCardIn .45s cubic-bezier(.16,.84,.44,1) both; }

      .prefs-overlay { position:fixed; inset:0; background: rgba(0,0,0,.55); display:flex; align-items:center; justify-content:center; z-index:80; padding:16px; }
      .prefs-modal { background:#12121a; color:#f5f5f7; border-radius:14px; width:min(560px,100%); max-height:86vh; overflow:auto; padding:20px; border:1px solid rgba(255,255,255,.08); animation: playerPopIn .25s ease; }
      .prefs-head { display:flex; align-items:center; justify-content:space-between; }
      .prefs-head h3 { margin:0; font-size:18px; }
      .prefs-head button { background:transparent; border:none; color:inherit; font-size:20px; cursor:pointer; }
      .prefs-sub { color:#9d9dab; font-size:13px; margin:6px 0 18px; }
      .prefs-row { display:flex; align-items:center; justify-content:space-between; gap:16px; padding:14px 0; border-top:1px solid rgba(255,255,255,.08); }
      .prefs-row > div:first-child strong { display:block; font-size:14px; }
      .prefs-row > div:first-child span { display:block; font-size:12px; color:#9d9dab; margin-top:2px; }
      .prefs-row select { background:#1c1c26; color:#f5f5f7; border:1px solid rgba(255,255,255,.15); border-radius:8px; padding:8px 10px; font-size:13px; min-width:170px; }

      @keyframes playerPopIn { from {opacity:0; transform: scale(.94);} to {opacity:1; transform:scale(1);} }
      .live-player { animation: playerPopIn .32s cubic-bezier(.16,.84,.44,1); }

      @keyframes brandShimmerCycle {
        0%, 70% { opacity:.55; text-shadow:none; }
        80% { opacity:1; text-shadow: 0 0 8px rgba(168,85,247,.9), 0 0 16px rgba(99,102,241,.5); }
        88% { opacity:1; text-shadow: 0 0 10px rgba(168,85,247,1); }
        100% { opacity:.55; text-shadow:none; }
      }
      .brand-shimmer-text { display:inline-block; animation: brandShimmerCycle 9s ease-in-out infinite; }

      @keyframes brandLoaderPulse { 0%,100% { transform:scale(1); opacity:.85;} 50% { transform:scale(1.08); opacity:1;} }
      .brand-loader-animate { animation: brandLoaderPulse 1.6s ease-in-out infinite; }
      .brand-loading-text { font-weight:800; letter-spacing:2px; margin-top:10px; font-size:13px; background:linear-gradient(90deg,#a855f7,#6366f1); -webkit-background-clip:text; background-clip:text; color:transparent; }
      .loading-message { display:block; margin-top:6px; font-size:12px; color:#c7c7d1; }

      @keyframes drawerSlideIn { from {opacity:0; transform: translateX(24px);} to {opacity:1; transform:none;} }
      .tv-channel-drawer { animation: drawerSlideIn .28s ease; }

      .device-appletv .channel-card:focus-visible, .device-samsungtv .channel-card:focus-visible, .device-lgtv .channel-card:focus-visible, .device-androidtv .channel-card:focus-visible, .device-firetv .channel-card:focus-visible {
        outline: 3px solid #a855f7; outline-offset: 2px;
      }
    `}</style>
  </main>
}