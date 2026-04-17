export default function LiveIndicator({ connected }: { connected: boolean }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, fontWeight: 600 }}>
      <span style={{
        width: 8, height: 8, borderRadius: '50%',
        background: connected ? '#ef4444' : '#9ca3af',
        animation: connected ? 'pulse-glow 2s ease-in-out infinite' : 'none',
      }} />
      {connected ? 'LIVE' : 'OFFLINE'}
    </span>
  );
}
