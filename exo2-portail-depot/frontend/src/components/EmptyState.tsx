export function EmptyState({ onCreate }: { onCreate: () => void }) {
  return (
    <div className="div-card" style={{ padding: 40, textAlign: 'center' }}>
      <div
        style={{
          width: 48,
          height: 48,
          borderRadius: 999,
          background: '#F7F6FF',
          color: '#5100FF',
          fontSize: 28,
          lineHeight: '48px',
          margin: '0 auto',
        }}
      >
        +
      </div>
      <div style={{ fontWeight: 600, marginTop: 12 }}>Aucune demande en cours</div>
      <div style={{ color: '#585858', fontSize: 14, marginTop: 4 }}>
        Crée une demande pour recevoir des pièces de ton client.
      </div>
      <button className="div-btn-primary" style={{ marginTop: 16 }} onClick={onCreate}>
        Créer une demande
      </button>
    </div>
  );
}
