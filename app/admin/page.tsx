'use client';
import '../globals.css';
import {useEffect,useMemo,useState} from 'react';
import {useRouter} from 'next/navigation';

type P={id:string;name:string;m3uUrl:string;logoUrl?:string|null;_count?:{channels:number}};
type Stats={playlists:number;totalChannels:number;activeChannels:number;inactiveChannels:number;checkingChannels:number;unknownChannels:number};
type C={id:string;name:string;streamUrl:string;streamUrlOverride?:string|null;logoUrl?:string|null;groupTitle?:string|null;healthStatus:string;healthError?:string|null;playlist:{id:string;name:string}};
const emptyForm={name:'',m3uUrl:'',logoUrl:''};

function BrandingForm({router}:{router:any}){
 const [f,setF]=useState<any>({websiteName:'LIVE TV',websiteUrl:'',websiteLogoUrl:'',showPlayerBrand:true,playerBrandPosition:'bottom',brandTextSize:9});
 const [status,setStatus]=useState('');
 useEffect(()=>{fetch('/api/v1/admin/settings').then(r=>r.ok?r.json():null).then(x=>x&&setF({...f,...x}));},[]);
 const save=async()=>{setStatus('Saving…');const r=await fetch('/api/v1/admin/settings',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify(f)});if(r.status===401){router.replace('/admin/login');return}const d=await r.json().catch(()=>({}));setStatus(r.ok?'Saved successfully':(d.error||'Failed'));};
 return <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4"><input className="field" placeholder="Website Name" value={f.websiteName} onChange={e=>setF({...f,websiteName:e.target.value})}/><input className="field" placeholder="Website URL" value={f.websiteUrl||''} onChange={e=>setF({...f,websiteUrl:e.target.value})}/><input className="field" placeholder="Logo URL" value={f.websiteLogoUrl||''} onChange={e=>setF({...f,websiteLogoUrl:e.target.value})}/><select className="field" value={f.playerBrandPosition} onChange={e=>setF({...f,playerBrandPosition:e.target.value})}><option value="bottom">Player brand: Bottom</option><option value="top">Player brand: Top</option></select><label className="flex items-center gap-2 text-sm text-slate-300"><input type="checkbox" checked={f.showPlayerBrand} onChange={e=>setF({...f,showPlayerBrand:e.target.checked})}/> Show player branding</label><label className="flex items-center gap-2 text-sm text-slate-300">Text size <input className="field w-20" type="number" min="7" max="16" value={f.brandTextSize} onChange={e=>setF({...f,brandTextSize:Number(e.target.value)})}/></label><button onClick={save} className="rounded-xl bg-indigo-500 px-4 py-2.5 text-sm font-semibold">Save Branding</button>{status&&<span className="self-center text-xs text-slate-400">{status}</span>}</div>
}

type AccessLink = {
  id: string;
  token: string;
  label: string | null;
  expiresAt: string;
  revoked: boolean;
  createdAt: string;
  lastUsedAt: string | null;
  useCount: number;
  maxDevices: number | null;
  activeDevices: number;
};

function AccessLinksSection({ router }: { router: any }) {
  const [maxDevices, setMaxDevices] = useState<string>('unlimited');
  const [links, setLinks] = useState<AccessLink[]>([]);
  const [label, setLabel] = useState('');
  const [expiresAt, setExpiresAt] = useState('');
  const [status, setStatus] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const load = async () => {
    const r = await fetch('/api/v1/admin/access-links');
    if (r.status === 401) { router.replace('/admin/login'); return; }
    const data = await r.json().catch(() => []);
    setLinks(Array.isArray(data) ? data : []);
  };

  useEffect(() => { load(); }, []);

  const generate = async () => {
    if (!expiresAt) { setStatus('Please choose an expiry date & time'); return; }
    setStatus('Generating…');
    const r = await fetch('/api/v1/admin/access-links', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        expiresAt: new Date(expiresAt).toISOString(),
        label: label || undefined,
        maxDevices: maxDevices === 'unlimited' ? null : Number(maxDevices),
      }),
    });
    if (r.status === 401) { router.replace('/admin/login'); return; }
    const d = await r.json().catch(() => ({}));
    if (!r.ok) { setStatus(d.error || 'Failed to generate link'); return; }
    setStatus('Link generated');
    setLabel('');
    setExpiresAt('');
    await load();
  };

  const revoke = async (id: string) => {
    if (!confirm('Revoke this access link? It will stop working immediately.')) return;
    const r = await fetch(`/api/v1/admin/access-links/${id}`, { method: 'PATCH' });
    if (r.status === 401) { router.replace('/admin/login'); return; }
    await load();
  };

  const remove = async (id: string) => {
    if (!confirm('Permanently delete this access link from the list? This cannot be undone.')) return;
    const r = await fetch(`/api/v1/admin/access-links/${id}`, { method: 'DELETE' });
    if (r.status === 401) { router.replace('/admin/login'); return; }
    await load();
  };

  const copyLink = (token: string, id: string) => {
    const url = `${window.location.origin}/access/${token}`;
    navigator.clipboard?.writeText(url).then(() => {
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    });
  };

  const linkStatus = (link: AccessLink) => {
    if (link.revoked) return { text: 'Revoked', cls: 'bg-rose-500/15 text-rose-300' };
    if (new Date(link.expiresAt).getTime() <= Date.now()) return { text: 'Expired', cls: 'bg-white/10 text-slate-400' };
    return { text: 'Active', cls: 'bg-emerald-500/15 text-emerald-300' };
  };

  return (
    <section className="mt-8 rounded-3xl border border-white/10 bg-white/[.035] p-5 shadow-xl">
      <div className="mb-4">
        <h2 className="font-semibold">Access Links</h2>
        <p className="text-xs text-slate-500">Generate a link that grants site access until the chosen expiry. Anyone can use the link until it expires or is revoked.</p>
      </div>

      <div className="grid gap-3 md:grid-cols-5">
        <input
          className="field"
          placeholder="Label (optional, e.g. Customer #1)"
          value={label}
          onChange={e => setLabel(e.target.value)}
        />
        <input
          className="field"
          type="datetime-local"
          value={expiresAt}
          onChange={e => setExpiresAt(e.target.value)}
        />
        <select className="field" value={maxDevices} onChange={e => setMaxDevices(e.target.value)}>
          <option value="1">1 Device</option>
          <option value="2">2 Devices</option>
          <option value="3">3 Devices</option>
          <option value="4">4 Devices</option>
          <option value="5">5 Devices</option>
          <option value="unlimited">Unlimited</option>
        </select>
        <button onClick={generate} className="rounded-xl bg-indigo-500 px-4 py-2.5 text-sm font-semibold">
          Generate Link
        </button>
        {status && <span className="self-center text-xs text-slate-400">{status}</span>}
      </div>

      <div className="mt-5 overflow-x-auto rounded-2xl border border-white/10 bg-white/[.025]">
        <table className="w-full min-w-[700px] text-left text-sm">
          <thead className="border-b border-white/10 text-xs uppercase tracking-wider text-slate-500">
            <tr>
              <th className="p-3">Label</th>
              <th className="p-3">Status</th>
              <th className="p-3">Devices</th>
              <th className="p-3">Expires</th>
              <th className="p-3">Used</th>
              <th className="p-3">Action</th>
            </tr>
          </thead>

          <tbody>
            {links.map(link => {
              const s = linkStatus(link);
              return (
                <tr key={link.id} className="border-b border-white/5">
                  <td className="p-3 font-medium">
                    {link.label || <span className="text-slate-500">—</span>}
                  </td>
                  <td className="p-3">
                    <span className={`rounded-full px-2 py-1 text-xs ${s.cls}`}>
                      {s.text}
                    </span>
                  </td>
                  <td className="p-3 text-slate-400">
                    {link.activeDevices} / {link.maxDevices ?? '∞'}
                  </td>
                  <td className="p-3 text-slate-400">
                    {new Date(link.expiresAt).toLocaleString()}
                  </td>
                  <td className="p-3 text-slate-400">
                    {link.useCount}×
                  </td>
                  <td className="p-3 flex gap-2">
                    <button
                      onClick={() => copyLink(link.token, link.id)}
                      className="rounded-lg bg-white/10 px-3 py-2 text-xs"
                    >
                      {copiedId === link.id ? 'Copied!' : 'Copy Link'}
                    </button>
                    {!link.revoked && (
                      <button
                        onClick={() => revoke(link.id)}
                        className="rounded-lg bg-amber-500/15 px-3 py-2 text-xs text-amber-200"
                      >
                        Revoke
                      </button>
                    )}
                    <button
                      onClick={() => remove(link.id)}
                      className="rounded-lg bg-rose-500/15 px-3 py-2 text-xs text-rose-200"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              );
            })}
            {links.length === 0 && (
              <tr>
                <td colSpan={6} className="p-4 text-center text-slate-500">
                  No access links yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
export default function Admin(){const router=useRouter();const[ready,setReady]=useState(false);const[items,setItems]=useState<P[]>([]);const[form,setForm]=useState(emptyForm);const[editing,setEditing]=useState<string|null>(null);const[msg,setMsg]=useState('');const[stats,setStats]=useState<Stats|null>(null);const[channels,setChannels]=useState<C[]>([]);const[q,setQ]=useState('');const[status,setStatus]=useState('ALL');const[channelEdit,setChannelEdit]=useState<C|null>(null);const[override,setOverride]=useState('');const[busy,setBusy]=useState(false);
const [importFile, setImportFile] = useState<File | null>(null);
const [importName, setImportName] = useState('');
const [importMsg, setImportMsg] = useState('');
const [importBusy, setImportBusy] = useState(false);

const importFromFile = async (e: React.FormEvent) => {
  e.preventDefault();
  if (!importFile) { setImportMsg('Please choose a .m3u file first'); return; }
  if (!importName.trim()) { setImportMsg('Please enter a playlist name'); return; }
  setImportBusy(true);
  setImportMsg('Uploading and importing…');
  const fd = new FormData();
  fd.append('file', importFile);
  fd.append('name', importName.trim());
  const r = await fetch('/api/v1/playlists/import', { method: 'POST', body: fd });
  const d = await r.json().catch(() => ({}));
  setImportBusy(false);
  if (r.status === 401) { router.replace('/admin/login'); return; }
  if (!r.ok) { setImportMsg(d.error || 'Import failed'); return; }
  setImportMsg(`Imported — ${d.channelCount ?? 0} channels added`);
  setImportFile(null);
  setImportName('');
  await load();
  loadChannels();
};
    const load=async()=>{const [p,s]=await Promise.all([fetch('/api/v1/playlists'),fetch('/api/v1/admin/stats')]);if(p.status===401||s.status===401){router.replace('/admin/login');return}setItems(await p.json());setStats(await s.json());setReady(true)};
 const loadChannels=async()=>{const p=new URLSearchParams();if(q)p.set('q',q);if(status!=='ALL')p.set('status',status);const r=await fetch('/api/v1/channels?'+p);if(r.status===401){router.replace('/admin/login');return}setChannels(await r.json())};
 useEffect(()=>{load();loadChannels()},[]);useEffect(()=>{const t=setTimeout(loadChannels,250);return()=>clearTimeout(t)},[q,status]);
 const save=async(e:React.FormEvent)=>{e.preventDefault();setMsg('Importing and syncing…');const url=editing?`/api/v1/playlists/${editing}`:'/api/v1/playlists';const r=await fetch(url,{method:editing?'PUT':'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(form)});const d=await r.json().catch(()=>({}));if(r.status===401){router.replace('/admin/login');return}if(!r.ok){setMsg(d.error||'Failed');return}setMsg(`Saved — ${d.channelCount??0} channels imported/synced`);setForm(emptyForm);setEditing(null);await load();loadChannels()};
 const edit=(p:P)=>{setEditing(p.id);setForm({name:p.name,m3uUrl:p.m3uUrl,logoUrl:p.logoUrl||''});window.scrollTo({top:0,behavior:'smooth'})};
 const del=async(id:string)=>{if(!confirm('Delete this playlist and its channels?'))return;await fetch(`/api/v1/playlists/${id}`,{method:'DELETE'});load();loadChannels()};
 const editChannel=(c:C)=>{setChannelEdit(c);setOverride(c.streamUrlOverride||'')};
 const saveChannel=async()=>{if(!channelEdit)return;setBusy(true);const r=await fetch(`/api/v1/channels/${channelEdit.id}`,{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({streamUrlOverride:override})});const d=await r.json().catch(()=>({}));setBusy(false);if(r.status===401){router.replace('/admin/login');return}if(!r.ok){alert(d.error||'Failed');return}setChannelEdit(null);await load();loadChannels()};
 const health=async()=>{setBusy(true);const r=await fetch('/api/v1/admin/health/check',{method:'POST'});const d=await r.json();setBusy(false);if(r.status===401){router.replace('/admin/login');return}alert(`Checked ${d.checked} channels: ${d.active} active, ${d.inactive} inactive`);load();loadChannels()};
 const logout=async()=>{await fetch('/api/v1/admin/auth/logout',{method:'POST'});router.replace('/admin/login')};
 const cards=useMemo(()=>stats?[['Total Channels',stats.totalChannels],['Active',stats.activeChannels],['Inactive',stats.inactiveChannels],['Pending',stats.checkingChannels+stats.unknownChannels]]:[],[stats]);
 if(!ready)return <main className="min-h-screen bg-[#05060a] text-white grid place-items-center">Loading Control Center…</main>;
 return <main className="min-h-screen bg-[#05060a] text-white"><div className="mx-auto max-w-7xl px-4 py-5 md:px-7 md:py-8"><header className="flex flex-wrap items-center justify-between gap-4"><div><div className="text-[11px] uppercase tracking-[.3em] text-indigo-300">Live TV Control Center</div><h1 className="mt-1 text-3xl font-bold tracking-tight md:text-4xl">Admin Panel</h1><p className="mt-1 text-sm text-slate-400">Manage playlists, channel health and stream overrides.</p></div><div className="flex gap-2"><button disabled={busy} onClick={health} className="rounded-xl bg-indigo-500 px-4 py-2.5 text-sm font-semibold shadow-lg shadow-indigo-950/40 disabled:opacity-50">{busy?'Checking…':'Run Health Check'}</button><button onClick={logout} className="rounded-xl border border-white/10 bg-white/[.05] px-4 py-2.5 text-sm">Logout</button></div></header>
 <div className="mt-7 grid grid-cols-2 gap-3 md:grid-cols-4">{cards.map(([label,value])=><div key={label as string} className="rounded-2xl border border-white/10 bg-white/[.045] p-4 backdrop-blur"><div className="text-xs uppercase tracking-wider text-slate-500">{label}</div><div className="mt-1 text-3xl font-bold">{value}</div></div>)}</div>
 <form onSubmit={save} className="mt-6 rounded-3xl border border-white/10 bg-white/[.035] p-5 shadow-xl"><div className="mb-4 flex items-center justify-between"><div><h2 className="font-semibold">{editing?'Update Playlist':'Add Playlist'}</h2><p className="text-xs text-slate-500">M3U import and channel sync happen automatically.</p></div>{editing&&<button type="button" onClick={()=>{setEditing(null);setForm(emptyForm)}} className="text-sm text-slate-400">Cancel edit</button>}</div><div className="grid gap-3 md:grid-cols-4"><input required className="field" placeholder="Playlist Name" value={form.name} onChange={e=>setForm({...form,name:e.target.value})}/><input required className="field" placeholder="M3U Playlist URL" value={form.m3uUrl} onChange={e=>setForm({...form,m3uUrl:e.target.value})}/><input className="field" placeholder="Playlist Logo URL" value={form.logoUrl} onChange={e=>setForm({...form,logoUrl:e.target.value})}/><button className="rounded-xl bg-white p-3 font-semibold text-slate-950 transition hover:bg-slate-200">{editing?'Update Playlist':'Save Playlist'}</button></div>{msg&&<p className="mt-3 text-sm text-slate-400">{msg}</p>}</form>
 <form onSubmit={importFromFile} className="mt-4 rounded-3xl border border-white/10 bg-white/[.025] p-5">
  <div className="mb-3">
    <h2 className="font-semibold">Import Playlist from File</h2>
    <p className="text-xs text-slate-500">Upload a .m3u or .m3u8 file directly from your computer.</p>
  </div>
  <div className="grid gap-3 md:grid-cols-3">
    <input
      required
      className="field"
      placeholder="Playlist Name"
      value={importName}
      onChange={e => setImportName(e.target.value)}
    />
    <input
      required
      type="file"
      accept=".m3u,.m3u8"
      className="field"
      onChange={e => setImportFile(e.target.files?.[0] || null)}
    />
    <button disabled={importBusy} className="rounded-xl bg-indigo-500 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50">
      {importBusy ? 'Importing…' : 'Import File'}
    </button>
  </div>
  {importMsg && <p className="mt-3 text-sm text-slate-400">{importMsg}</p>}
</form>
 <section className="mt-7"><div className="mb-3 flex items-end justify-between gap-3"><div><h2 className="text-xl font-semibold">Playlists</h2><p className="text-xs text-slate-500">Each saved playlist automatically creates its public source.</p></div></div><div className="grid gap-3 md:grid-cols-2">{items.map(p=><div key={p.id} className="flex items-center justify-between gap-4 rounded-2xl border border-white/10 bg-white/[.035] p-4"><div className="flex min-w-0 items-center gap-3">{p.logoUrl?<img src={p.logoUrl} className="h-11 w-11 rounded-xl bg-white object-contain"/>:<div className="grid h-11 w-11 place-items-center rounded-xl bg-white/10 text-xs">TV</div>}<div className="min-w-0"><div className="truncate font-semibold">{p.name}</div><div className="text-xs text-slate-500">{p._count?.channels??0} imported channels</div></div></div><div className="flex gap-2"><button onClick={()=>edit(p)} className="rounded-lg bg-white/10 px-3 py-2 text-sm">Edit</button><button onClick={()=>del(p.id)} className="rounded-lg bg-rose-500/15 px-3 py-2 text-sm text-rose-200">Delete</button></div></div>)}</div></section>
 <section className="mt-8 rounded-3xl border border-white/10 bg-white/[.035] p-5 shadow-xl"><div className="mb-4"><h2 className="font-semibold">Branding Settings</h2><p className="text-xs text-slate-500">These settings control the public website and the permanent player branding.</p></div><BrandingForm router={router}/></section>
 <AccessLinksSection router={router}/>
 <section className="mt-8"><div className="flex flex-wrap items-end justify-between gap-3"><div><h2 className="text-xl font-semibold">Channel Health</h2><p className="text-xs text-slate-500">Offline channels stay hidden publicly. Replace a dead stream URL here.</p></div><div className="flex gap-2"><input className="field w-52" placeholder="Search channels" value={q} onChange={e=>setQ(e.target.value)}/><select className="field w-32" value={status} onChange={e=>setStatus(e.target.value)}><option>ALL</option><option>ACTIVE</option><option>INACTIVE</option><option>CHECKING</option><option>UNKNOWN</option></select></div></div><div className="mt-3 overflow-x-auto rounded-2xl border border-white/10 bg-white/[.025]"><table className="w-full min-w-[850px] text-left text-sm"><thead className="border-b border-white/10 text-xs uppercase tracking-wider text-slate-500"><tr><th className="p-3">Channel</th><th className="p-3">Playlist</th><th className="p-3">Status</th><th className="p-3">Effective Stream</th><th className="p-3">Action</th></tr></thead><tbody>{channels.map(c=><tr key={c.id} className="border-b border-white/5"><td className="p-3 font-medium">{c.name}</td><td className="p-3 text-slate-400">{c.playlist.name}</td><td className="p-3"><span className={`rounded-full px-2 py-1 text-xs ${c.healthStatus==='ACTIVE'?'bg-emerald-500/15 text-emerald-300':c.healthStatus==='INACTIVE'?'bg-rose-500/15 text-rose-300':'bg-white/10 text-slate-300'}`}>{c.healthStatus}</span></td><td className="max-w-[320px] truncate p-3 text-slate-500">{c.streamUrlOverride||c.streamUrl}</td><td className="p-3"><button onClick={()=>editChannel(c)} className="rounded-lg bg-white/10 px-3 py-2">Edit URL</button></td></tr>)}</tbody></table></div></section>
 {channelEdit&&<div className="fixed inset-0 z-50 grid place-items-center bg-black/75 p-4"><div className="w-full max-w-xl rounded-3xl border border-white/10 bg-[#0b0d14] p-6 shadow-2xl"><h3 className="text-xl font-semibold">Update Stream URL</h3><p className="mt-1 text-sm text-slate-400">{channelEdit.name}</p><input className="field mt-5 w-full" placeholder="https://…/live.m3u8" value={override} onChange={e=>setOverride(e.target.value)}/><p className="mt-2 text-xs text-slate-500">The replacement is checked before the channel becomes publicly active.</p><div className="mt-5 flex justify-end gap-2"><button onClick={()=>setChannelEdit(null)} className="rounded-xl bg-white/10 px-4 py-2">Cancel</button><button disabled={busy} onClick={saveChannel} className="rounded-xl bg-indigo-500 px-4 py-2 font-semibold disabled:opacity-50">{busy?'Checking…':'Save & Check'}</button></div></div></div>}
 </div></main>}
