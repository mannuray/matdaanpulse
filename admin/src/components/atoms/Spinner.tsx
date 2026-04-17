export default function Spinner({ size = 32, label }: { size?: number; label?: string }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12 }}>
      <div 
        className="spinner" 
        style={{ width: size, height: size, borderWidth: 3 }} 
      />
      {label && <span style={{ fontSize: '13px', color: 'var(--text-secondary)', fontWeight: 500 }}>{label}</span>}
    </div>
  );
}
