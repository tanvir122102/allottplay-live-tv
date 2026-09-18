'use client';

import { useEffect, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';

const WHATSAPP_NUMBER = '8801975186585';

export default function AccessDeniedContent() {
  const params = useSearchParams();
  const router = useRouter();

  const reason = params.get('reason');
  const token = params.get('token');
  const isLimit = reason === 'limit';

  const [checking, setChecking] = useState(false);

  useEffect(() => {
    if (!isLimit || !token) return;

    const interval = setInterval(async () => {
      setChecking(true);

      try {
        const r = await fetch(`/access/${token}`, {
          redirect: 'manual',
        });

        if (
          r.type === 'opaqueredirect' ||
          r.status === 0 ||
          r.status === 200
        ) {
          router.replace('/');
        }
      } catch {
        // Ignore polling errors.
      }

      setChecking(false);
    }, 5000);

    return () => clearInterval(interval);
  }, [isLimit, token, router]);

  const message = isLimit
    ? 'This access link has reached its device limit. Please contact the access provider to increase it.'
    : 'Your access has expired. Please contact the access provider to renew your subscription.';

  const whatsappMessage = isLimit
    ? 'Hi, my access link has reached its device limit. Please help increase it.'
    : "Hi, my access to ALL OTT PLAY has expired. I'd like to renew it.";

  const whatsappUrl =
    `https://wa.me/${WHATSAPP_NUMBER}?text=` +
    encodeURIComponent(whatsappMessage);

  return (
    <main
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#0a0a0f',
        color: '#fff',
        textAlign: 'center',
        padding: 20,
      }}
    >
      <div style={{ maxWidth: 420 }}>
        <div
          style={{
            fontWeight: 800,
            letterSpacing: 3,
            fontSize: 14,
            marginBottom: 22,
            background: 'linear-gradient(90deg,#a855f7,#6366f1)',
            WebkitBackgroundClip: 'text',
            backgroundClip: 'text',
            color: 'transparent',
          }}
        >
          ALL OTT PLAY
        </div>

        <h1 style={{ fontSize: 22, marginBottom: 12 }}>
          {isLimit ? 'Device Limit Reached' : 'Your access has expired'}
        </h1>

        <p
          style={{
            color: '#9d9dab',
            fontSize: 14,
            marginBottom: 20,
            lineHeight: 1.6,
          }}
        >
          {message}
        </p>

        {isLimit && (
          <p
            style={{
              color: '#6b7280',
              fontSize: 12,
              marginBottom: 20,
            }}
          >
            {checking
              ? 'Checking for an available slot…'
              : 'Waiting for a device slot to free up…'}
          </p>
        )}

        <a
          href={whatsappUrl}
          target="_blank"
          rel="noreferrer"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 10,
            background: '#25D366',
            color: '#0a0a0f',
            fontWeight: 700,
            fontSize: 14,
            padding: '12px 24px',
            borderRadius: 999,
            textDecoration: 'none',
          }}
        >
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="currentColor"
            aria-hidden="true"
          >
            <path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.75.46 3.45 1.32 4.95L2 22l5.29-1.39a9.9 9.9 0 0 0 4.75 1.21h.01c5.46 0 9.9-4.45 9.9-9.91 0-2.65-1.03-5.14-2.9-7.01A9.85 9.85 0 0 0 12.04 2Zm5.8 14.15c-.24.68-1.4 1.3-1.93 1.38-.5.08-1.12.11-1.8-.11-.42-.13-.96-.31-1.65-.6-2.9-1.25-4.8-4.17-4.94-4.36-.15-.19-1.18-1.57-1.18-3 0-1.42.75-2.12 1.01-2.41.27-.29.58-.36.78-.36.19 0 .39 0 .56.01.18.01.42-.07.65.5.24.58.83 2 .9 2.15.07.15.11.32.02.51-.09.19-.14.31-.28.48-.14.17-.29.37-.42.5-.14.14-.28.29-.12.57.16.29.71 1.17 1.53 1.9 1.05.94 1.94 1.23 2.22 1.37.29.14.46.12.63-.07.17-.2.72-.84.92-1.13.19-.29.39-.24.65-.14.27.09 1.7.8 1.99.95.29.14.48.21.55.33.07.13.07.72-.17 1.4Z" />
          </svg>

          Contact us on WhatsApp
        </a>
      </div>
    </main>
  );
}