'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

type PlayerChannel = {
  id: string;
  name: string;
  logoUrl?: string | null;
  groupTitle?: string | null;
  streamUrl: string;
  sourceType?: 'hls' | 'embed' | string;
};

type AspectPref = 'fit' | '16:9' | '4:3' | 'fill';
type QualityPref = 'auto' | '480p' | '720p' | '1080p' | '4k';

type Props = {
  channel: PlayerChannel;
  channels: PlayerChannel[];
  onChannelChange: (channel: PlayerChannel) => void;
  onClose: () => void;
  websiteName?: string;
  websiteUrl?: string;
  websiteLogoUrl?: string;
  showBranding?: boolean;
  brandPosition?: 'top'|'bottom';
  brandTextSize?: number;
  initialAspect?: AspectPref;
  preferSoundOn?: boolean;
  preferredQuality?: QualityPref;
  deviceType?: string;
};

type HlsLike = any;

const CONTROL_HIDE_MS = 7000;

function levelLabel(height?: number, bitrate?: number, index?: number) {
  if (height && height >= 2160) return '4K Ultra HD';
  if (height && height >= 1440) return '2K QHD';
  if (height) return `${height}p`;
  if (bitrate) return `${Math.round(bitrate / 1000)} kbps`;
  return `Level ${(index ?? 0) + 1}`;
}

function findLevelForQuality(levels: { index: number; height?: number }[], quality?: QualityPref) {
  if (!quality || quality === 'auto' || !levels.length) return -1;
  const target = quality === '4k' ? 2160 : quality === '1080p' ? 1080 : quality === '720p' ? 720 : 480;
  let best = -1; let bestDiff = Infinity;
  for (const lvl of levels) {
    if (!lvl.height) continue;
    const diff = Math.abs(lvl.height - target);
    if (diff < bestDiff) { bestDiff = diff; best = lvl.index; }
  }
  return best;
}

export default function LivePlayer({
  channel,
  channels,
  onChannelChange,
  onClose,
  websiteName = 'ALL OTT PLAY',
  websiteUrl,
  websiteLogoUrl,
  showBranding = true,
  brandPosition = 'bottom',
  brandTextSize = 9,
  initialAspect = 'fit',
  preferSoundOn = true,
  preferredQuality = 'auto',
  deviceType = 'android',
}: Props) {
  const isEmbed = channel.sourceType === 'embed';

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const shellRef = useRef<HTMLDivElement | null>(null);
  const hlsRef = useRef<HlsLike | null>(null);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wakeLockRef = useRef<any>(null);
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const desiredMutedRef = useRef(preferSoundOn === false);
  const rawLevelsRef = useRef<{ index: number; height?: number }[]>([]);
  const unmuteGestureCleanupRef = useRef<(() => void) | null>(null);

  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(desiredMutedRef.current);
  const [volume, setVolume] = useState(1);
  const [controls, setControls] = useState(true);
  const [buffering, setBuffering] = useState(true);
  const [error, setError] = useState('');
  const [fullscreen, setFullscreen] = useState(false);
  const [pip, setPip] = useState(false);
  const [zoom, setZoom] = useState(100);
  const [aspect, setAspect] = useState<AspectPref>(initialAspect);
  const [levels, setLevels] = useState<{ index: number; label: string }[]>([]);
  const [level, setLevel] = useState(-1);
  const [audioTracks, setAudioTracks] = useState<any[]>([]);
  const [audioTrack, setAudioTrack] = useState(-1);
  const [subtitleTracks, setSubtitleTracks] = useState<any[]>([]);
  const [subtitleTrack, setSubtitleTrack] = useState(-1);
  const [showSettings, setShowSettings] = useState(false);
  const [showChannelList, setShowChannelList] = useState(false);

  const index = useMemo(() => channels.findIndex(c => c.id === channel.id), [channels, channel.id]);
  const nextChannel = useCallback(() => channels.length && onChannelChange(channels[(index + 1 + channels.length) % channels.length]), [channels, index, onChannelChange]);
  const prevChannel = useCallback(() => channels.length && onChannelChange(channels[(index - 1 + channels.length) % channels.length]), [channels, index, onChannelChange]);

  const wakeLock = useCallback(async () => {
    try {
      if ('wakeLock' in navigator && document.visibilityState === 'visible' && !wakeLockRef.current) {
        wakeLockRef.current = await (navigator as any).wakeLock.request('screen');
      }
    } catch {}
  }, []);
  const releaseWakeLock = useCallback(async () => {
    try { await wakeLockRef.current?.release(); } catch {}
    wakeLockRef.current = null;
  }, []);

  const showControls = useCallback(() => {
    setControls(true);
    if (hideTimer.current) clearTimeout(hideTimer.current);
    hideTimer.current = setTimeout(() => setControls(false), CONTROL_HIDE_MS);
  }, []);

  const armUnmuteOnNextGesture = useCallback((v: HTMLVideoElement) => {
    unmuteGestureCleanupRef.current?.();
    const cleanup = () => {
      window.removeEventListener('pointerdown', unmute);
      window.removeEventListener('keydown', unmute);
      unmuteGestureCleanupRef.current = null;
    };
    const unmute = () => {
      v.muted = false;
      desiredMutedRef.current = false;
      setMuted(false);
      cleanup();
    };
    window.addEventListener('pointerdown', unmute, { once: true });
    window.addEventListener('keydown', unmute, { once: true });
    unmuteGestureCleanupRef.current = cleanup;
  }, []);

  const attemptPlaybackWithSound = useCallback(async (v: HTMLVideoElement) => {
    v.muted = desiredMutedRef.current;
    try {
      await v.play();
      setMuted(v.muted);
      return;
    } catch {
      if (!v.muted) {
        v.muted = true;
        setMuted(true);
        try { await v.play(); } catch {}
        armUnmuteOnNextGesture(v);
      }
    }
  }, [armUnmuteOnNextGesture]);

  const reconnect = useCallback(() => {
    setError('');
    setBuffering(true);
    if (isEmbed) {
      // Force iframe remount by toggling a key-driving state via buffering/error reset;
      // actual remount happens because React re-renders with same src but we bump a nonce.
      setEmbedReloadNonce((n) => n + 1);
      return;
    }
    const v = videoRef.current;
    if (!v) return;
    try { v.pause(); } catch {}
    if (hlsRef.current) {
      try { hlsRef.current.stopLoad(); hlsRef.current.startLoad(-1); } catch {}
    } else {
      const src = v.currentSrc || channel.streamUrl;
      v.src = '';
      v.src = src;
      void attemptPlaybackWithSound(v);
    }
  }, [channel.streamUrl, attemptPlaybackWithSound, isEmbed]);

  const [embedReloadNonce, setEmbedReloadNonce] = useState(0);

  // --- HLS / native video setup (unchanged, only runs when NOT embed) ---
  useEffect(() => {
    if (isEmbed) return;
    let cancelled = false;
    const v = videoRef.current;
    if (!v) return;
    setError(''); setBuffering(true); setPlaying(false); setLevels([]); setLevel(-1); setAudioTracks([]); setSubtitleTracks([]); setShowSettings(false); setShowChannelList(false);
    rawLevelsRef.current = [];
    if (hlsRef.current) { try { hlsRef.current.destroy(); } catch {} hlsRef.current = null; }
    v.removeAttribute('src');
    v.load();

    const setup = async () => {
      const isHls = /\.m3u8(?:$|[?#])/i.test(channel.streamUrl);
      if (isHls) {
        try {
          const mod = await import('hls.js');
          const Hls = mod.default;
          if (!cancelled && Hls.isSupported()) {
            const hls = new Hls({
              enableWorker: true,
              lowLatencyMode: false,
              startLevel: 0,
              testBandwidth: false,
              maxBufferLength: 15,
              maxMaxBufferLength: 30,
              backBufferLength: 30,
              maxBufferHole: 0.5,
              liveSyncDurationCount: 3,
              capLevelToPlayerSize: true,
              fragLoadingMaxRetry: 2,
              fragLoadingRetryDelay: 500,
              fragLoadingMaxRetryTimeout: 8000,
              manifestLoadingMaxRetry: 2,
              manifestLoadingRetryDelay: 500,
              manifestLoadingMaxRetryTimeout: 8000,
              levelLoadingMaxRetry: 2,
              levelLoadingRetryDelay: 500,
              levelLoadingMaxRetryTimeout: 8000,
            });
            hlsRef.current = hls;
            hls.attachMedia(v);
            hls.on(Hls.Events.MEDIA_ATTACHED, () => hls.loadSource(channel.streamUrl));
            hls.on(Hls.Events.MANIFEST_PARSED, (_: any, data: any) => {
              const rawLevels = (data.levels || []).map((x: any, i: number) => ({ index: i, height: x.height, bitrate: x.bitrate }));
              rawLevelsRef.current = rawLevels;
              setLevels(rawLevels.map((x: any) => ({ index: x.index, label: levelLabel(x.height, x.bitrate, x.index) })));
              setAudioTracks(hls.audioTracks || []);
              setSubtitleTracks(hls.subtitleTracks || []);
              const preferredIndex = findLevelForQuality(rawLevels, preferredQuality);
              if (preferredIndex >= 0) { hls.currentLevel = preferredIndex; setLevel(preferredIndex); }
              void attemptPlaybackWithSound(v);
            });
            hls.on(Hls.Events.LEVEL_SWITCHED, (_: any, data: any) => setLevel(data.level));
            hls.on(Hls.Events.ERROR, (_: any, data: any) => {
              if (data.fatal) {
                if (data.type === Hls.ErrorTypes.NETWORK_ERROR) {
                  setError('Stream reconnecting…');
                  try { hls.startLoad(); } catch {}
                  if (reconnectTimer.current) clearTimeout(reconnectTimer.current);
                  reconnectTimer.current = setTimeout(() => { try { hls.loadSource(channel.streamUrl); hls.startLoad(-1); } catch {} }, 1800);
                } else if (data.type === Hls.ErrorTypes.MEDIA_ERROR) {
                  setError('Playback error — recovering…');
                  try { hls.recoverMediaError(); } catch {}
                } else setError('Unable to play this stream.');
              }
            });
            return;
          }
        } catch {}
      }
      if (!cancelled) {
        v.src = channel.streamUrl;
        v.load();
        void attemptPlaybackWithSound(v);
      }
    };
    setup();
    wakeLock();
    showControls();
    return () => {
      cancelled = true;
      if (reconnectTimer.current) clearTimeout(reconnectTimer.current);
      if (hlsRef.current) { try { hlsRef.current.destroy(); } catch {} hlsRef.current = null; }
      unmuteGestureCleanupRef.current?.();
      void releaseWakeLock();
    };
  }, [channel.id, channel.streamUrl, isEmbed, releaseWakeLock, showControls, wakeLock, attemptPlaybackWithSound, preferredQuality]);

  // --- Embed setup: reset state on channel change ---
  useEffect(() => {
    if (!isEmbed) return;
    setError('');
    setBuffering(true);
    setPlaying(false);
    setShowSettings(false);
    setShowChannelList(false);
    wakeLock();
    showControls();
    return () => {
      void releaseWakeLock();
    };
  }, [channel.id, isEmbed, wakeLock, releaseWakeLock, showControls]);

  useEffect(() => {
    if (isEmbed) return;
    const v = videoRef.current;
    if (!v) return;
    const onPlay = () => { setPlaying(true); setBuffering(false); setError(''); void wakeLock(); };
    const onPause = () => setPlaying(false);
    const onWaiting = () => setBuffering(true);
    const onPlaying = () => { setBuffering(false); setError(''); };
    const onError = () => { if (v.error) setError('Stream could not be played.'); setBuffering(false); };
    const onVolume = () => { setVolume(v.volume); setMuted(v.muted); };
    v.addEventListener('play', onPlay); v.addEventListener('pause', onPause); v.addEventListener('waiting', onWaiting); v.addEventListener('playing', onPlaying); v.addEventListener('error', onError); v.addEventListener('volumechange', onVolume);
    return () => { v.removeEventListener('play', onPlay); v.removeEventListener('pause', onPause); v.removeEventListener('waiting', onWaiting); v.removeEventListener('playing', onPlaying); v.removeEventListener('error', onError); v.removeEventListener('volumechange', onVolume); };
  }, [isEmbed, wakeLock]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      showControls();
      const target = e.target as HTMLElement | null;
      const editing = Boolean(target && (target.tagName === 'INPUT' || target.tagName === 'SELECT' || target.tagName === 'TEXTAREA'));
      if (e.key === 'ArrowUp' || e.key === 'ChannelUp' || e.key === 'PageUp') { e.preventDefault(); prevChannel(); return; }
      if (e.key === 'ArrowDown' || e.key === 'ChannelDown' || e.key === 'PageDown') { e.preventDefault(); nextChannel(); return; }
      if (e.key === 'VolumeUp') { e.preventDefault(); if (isEmbed) return; const v=videoRef.current; if(v){ const nv=Math.min(1,(v.muted?0:v.volume)+0.05); v.muted=false; v.volume=nv; desiredMutedRef.current=false; } return; }
      if (e.key === 'VolumeDown') { e.preventDefault(); if (isEmbed) return; const v=videoRef.current; if(v){ const nv=Math.max(0,(v.muted?0:v.volume)-0.05); v.volume=nv; if(nv===0){v.muted=true; desiredMutedRef.current=true;} } return; }
      if ((e.key === 'Enter' || e.key === ' ') && !editing) { e.preventDefault(); if (isEmbed) return; const v=videoRef.current; if (v) v.paused ? v.play().catch(()=>{}) : v.pause(); return; }
      if (e.key === 'Escape' || e.key === 'Backspace') { e.preventDefault(); if (showChannelList) { setShowChannelList(false); return; } if (document.fullscreenElement) void document.exitFullscreen(); else onClose(); return; }
      if ((e.key === 'ChannelList' || e.key.toLowerCase() === 'c') && !editing) { e.preventDefault(); setShowChannelList(x=>!x); return; }
      if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
        if (showChannelList || isEmbed) return;
        const v = videoRef.current;
        const isLive = !(v && Number.isFinite(v.duration) && v.duration > 0 && v.seekable.length > 0);
        e.preventDefault();
        if (isLive) {
          if (!v) return;
          const delta = e.key === 'ArrowRight' ? 0.05 : -0.05;
          const nv = Math.min(1, Math.max(0, (v.muted ? 0 : v.volume) + delta));
          v.muted = nv === 0;
          v.volume = nv;
          desiredMutedRef.current = v.muted;
          return;
        }
        if (v) v.currentTime += e.key === 'ArrowRight' ? 10 : -10;
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [nextChannel, onClose, prevChannel, showControls, showChannelList, isEmbed]);

  useEffect(() => {
    const onFs = () => setFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener('fullscreenchange', onFs);
    return () => document.removeEventListener('fullscreenchange', onFs);
  }, []);

  const togglePlay = () => { if (isEmbed) return; const v=videoRef.current; if (!v) return; v.paused ? v.play().catch(()=>{}) : v.pause(); showControls(); };
  const toggleMute = () => { if (isEmbed) return; const v=videoRef.current; if (!v) return; v.muted=!v.muted; desiredMutedRef.current=v.muted; showControls(); };
  const changeVolume = (n:number) => { if (isEmbed) return; const v=videoRef.current; if (!v) return; v.volume=n; v.muted=n===0; desiredMutedRef.current=v.muted; showControls(); };
  const toggleFullscreen = async () => { try { if (!document.fullscreenElement) await shellRef.current?.requestFullscreen(); else await document.exitFullscreen(); } catch {} showControls(); };
  const togglePip = async () => { if (isEmbed) return; const v=videoRef.current as any; try { if (document.pictureInPictureElement) await (document as any).exitPictureInPicture(); else if (v?.requestPictureInPicture) await v.requestPictureInPicture(); } catch {} setPip(Boolean(document.pictureInPictureElement)); showControls(); };

  const changeLevel = (value:number) => { if (hlsRef.current) { hlsRef.current.currentLevel=value; setLevel(value); } setShowSettings(false); };
  const changeAudio = (value:number) => { if (hlsRef.current) hlsRef.current.audioTrack=value; setAudioTrack(value); setShowSettings(false); };
  const changeSubtitle = (value:number) => { if (hlsRef.current) hlsRef.current.subtitleTrack=value; setSubtitleTrack(value); setShowSettings(false); };
  const selectChannel = (next: PlayerChannel) => { setShowChannelList(false); onChannelChange(next); };

  const handleShellInteract = () => {
    showControls();
    if (showChannelList) setShowChannelList(false);
  };

  const handleEmbedLoad = () => {
    setBuffering(false);
    setError('');
  };
  const handleEmbedError = () => {
    setBuffering(false);
    setError('Channel unavailable. Please try again later.');
  };

  return <div ref={shellRef} className={`live-player device-${deviceType} ${controls ? 'controls-visible' : 'controls-hidden'}`} onMouseMove={showControls} onTouchStart={handleShellInteract} onClick={handleShellInteract}>
    {isEmbed ? (
      <iframe
        key={`${channel.id}-${embedReloadNonce}`}
        src={channel.streamUrl}
        className={`live-video aspect-${aspect}`}
        style={{ border: 'none', width: '100%', height: '100%' }}
        allow="autoplay; fullscreen; encrypted-media; picture-in-picture"
        allowFullScreen
        sandbox="allow-scripts allow-same-origin allow-presentation allow-popups allow-forms"
        referrerPolicy="no-referrer"
        onLoad={handleEmbedLoad}
        onError={handleEmbedError}
      />
    ) : (
      <video ref={videoRef} className={`live-video aspect-${aspect}`} style={{transform:`scale(${zoom/100})`}} playsInline autoPlay muted={muted} />
    )}
    <div className={`player-branding branding-${brandPosition}`} style={{fontSize:brandTextSize}}>
      {showBranding && (
        websiteUrl
          ? <a href={websiteUrl} target="_blank" rel="noreferrer" className="brand-shimmer-text">{websiteName}</a>
          : <span className="brand-shimmer-text">{websiteName}</span>
      )}
    </div>
    <div className="player-topbar player-control-layer" onClick={e=>e.stopPropagation()}>
      <button onClick={onClose} className="player-icon" aria-label="Close">←</button>
      <div className="player-title"><strong>{channel.name}</strong><span>{channel.groupTitle || 'Live TV'} · {index + 1}/{channels.length}</span></div>
      <button onClick={()=>{setShowChannelList(x=>!x);showControls();}} className="player-icon player-channel-list-button" aria-label="Channel list">☰</button>
      <button onClick={toggleFullscreen} className="player-icon">⛶</button>
    </div>
    <div className="player-center">
      {buffering && <div className="buffering brand-loading-overlay">
        <div className="brand-loader brand-loader-animate">{channel.logoUrl ? <img src={channel.logoUrl} alt=""/> : (websiteLogoUrl ? <img src={websiteLogoUrl} alt=""/> : <span>▶</span>)}</div>
        <div className="brand-loading-text">{websiteName}</div>
        <span className="loading-message">{isEmbed ? 'Server is working. Please wait… Preparing your viewing session.' : 'Loading channel…'}</span>
      </div>}
      {error && <div className="player-error" onClick={e=>e.stopPropagation()}><strong>{error}</strong><button onClick={reconnect}>Reconnect</button></div>}
    </div>
    <div className="player-bottom player-control-layer" onClick={e=>e.stopPropagation()}>
      <div className="player-actions">
        <button onClick={togglePlay} disabled={isEmbed} style={isEmbed?{opacity:.35,cursor:'not-allowed'}:undefined}>{playing?'❚❚':'▶'}</button>
        <button onClick={prevChannel}>CH−</button>
        <button onClick={nextChannel}>CH+</button>
        <button onClick={toggleMute} disabled={isEmbed} style={isEmbed?{opacity:.35,cursor:'not-allowed'}:undefined}>{muted||volume===0?'🔇':'🔊'}</button>
        <input aria-label="Volume" type="range" min="0" max="1" step="0.05" value={muted?0:volume} onChange={e=>changeVolume(Number(e.target.value))} disabled={isEmbed} style={isEmbed?{opacity:.35}:undefined}/>
        <span className="player-spacer"/>
        <button onClick={togglePip} disabled={isEmbed} style={isEmbed?{opacity:.35,cursor:'not-allowed'}:undefined}>PiP</button>
        <button onClick={()=>setShowSettings(x=>!x)}>⚙</button>
        <button onClick={toggleFullscreen}>⛶</button>
      </div>
      <div className="player-settings">
        <button onClick={()=>setZoom(z=>Math.min(200,z+25))} disabled={isEmbed}>Zoom +</button>
        <button onClick={()=>setZoom(z=>Math.max(75,z-25))} disabled={isEmbed}>Zoom −</button>
        <button onClick={()=>setZoom(100)} disabled={isEmbed}>Reset</button>
        <select value={aspect} onChange={e=>setAspect(e.target.value as AspectPref)}><option value="fit">Fit</option><option value="16:9">16:9</option><option value="4:3">4:3</option><option value="fill">Fill</option></select>
        {!isEmbed && levels.length>0&&<select value={level} onChange={e=>changeLevel(Number(e.target.value))}><option value={-1}>Auto quality</option>{levels.map(x=><option key={x.index} value={x.index}>{x.label}</option>)}</select>}
        {!isEmbed && audioTracks.length>0&&<select value={audioTrack} onChange={e=>changeAudio(Number(e.target.value))}><option value={-1}>Audio</option>{audioTracks.map((x,i)=><option key={i} value={i}>{x.name||x.lang||`Track ${i+1}`}</option>)}</select>}
        {!isEmbed && subtitleTracks.length>0&&<select value={subtitleTrack} onChange={e=>changeSubtitle(Number(e.target.value))}><option value={-1}>Subtitles off</option>{subtitleTracks.map((x,i)=><option key={i} value={i}>{x.name||x.lang||`Subtitle ${i+1}`}</option>)}</select>}
      </div>
    </div>
    {showSettings && <div className="settings-popover" onClick={e=>e.stopPropagation()}><strong>Player settings</strong><span>Zoom: {zoom}%</span><span>Aspect: {aspect}</span>{!isEmbed && levels.length>0&&<span>Quality: {level<0?'Auto':levels[level]?.label}</span>}</div>}
    {showChannelList && <aside className="tv-channel-drawer" role="dialog" aria-label="Channel list" onClick={e=>e.stopPropagation()}><div className="tv-drawer-head"><strong>Channels</strong><button onClick={()=>setShowChannelList(false)} aria-label="Close channel list">×</button></div><div className="tv-channel-list">{channels.map((item,i)=><button key={item.id} className={item.id===channel.id?'tv-channel-item is-current':'tv-channel-item'} onClick={()=>selectChannel(item)} autoFocus={item.id===channel.id}><span className="tv-channel-number">{i+1}</span>{item.logoUrl?<img src={item.logoUrl} alt="" loading="lazy"/>:(websiteLogoUrl?<img src={websiteLogoUrl} alt="" loading="lazy"/>:<span className="tv-channel-fallback">TV</span>)}<span className="tv-channel-name">{item.name}</span>{item.id===channel.id&&<span className="tv-channel-playing">PLAYING</span>}</button>)}</div></aside>}
  </div>;
}