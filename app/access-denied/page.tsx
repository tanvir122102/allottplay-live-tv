import { Suspense } from 'react';
import AccessDeniedContent from './AccessDeniedContent';

function Loading() {
  return (
    <main
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#0a0a0f',
        color: '#fff',
      }}
    >
      Loading...
    </main>
  );
}

export default function AccessDeniedPage() {
  return (
    <Suspense fallback={<Loading />}>
      <AccessDeniedContent />
    </Suspense>
  );
}