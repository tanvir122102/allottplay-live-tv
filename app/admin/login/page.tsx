'use client';

import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';
import '../../globals.css';

export default function AdminLogin() {
  const router = useRouter();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();

    setBusy(true);
    setError('');

    try {
      const r = await fetch('/api/v1/admin/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email,
          password,
        }),
      });

      const d = await r.json().catch(() => ({}));

      if (!r.ok) {
        setError(d.error || 'Login failed');
        return;
      }

      router.replace('/admin');
      router.refresh();
    } catch {
      setError('Unable to connect to server');
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#05060a] text-white grid place-items-center p-5">
      <div className="w-full max-w-md rounded-3xl border border-white/10 bg-white/[.045] p-7 shadow-2xl backdrop-blur-xl">
        <div className="text-xs uppercase tracking-[.28em] text-indigo-300">
          Live TV Control Center
        </div>

        <h1 className="mt-2 text-3xl font-bold">
          Admin Sign In
        </h1>

        <p className="mt-2 text-sm text-slate-400">
          Secure access to playlists, channels and monitoring.
        </p>

        <form onSubmit={submit} className="mt-7 space-y-3">
          <input
            required
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            placeholder="Admin email"
            className="w-full rounded-2xl border border-white/10 bg-black/20 p-3.5 outline-none focus:border-indigo-400"
          />

          <input
            required
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            placeholder="Password"
            className="w-full rounded-2xl border border-white/10 bg-black/20 p-3.5 outline-none focus:border-indigo-400"
          />

          {error && (
            <p className="text-sm text-rose-300">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={busy}
            className="w-full rounded-2xl bg-indigo-500 p-3.5 font-semibold transition hover:bg-indigo-400 disabled:opacity-50"
          >
            {busy ? 'Signing in...' : 'Sign In'}
          </button>
        </form>
      </div>
    </main>
  );
}
