import { DIV } from '../theme';
import { StatusBadge } from './StatusBadge';
import type { DepositRequest } from '../api/client';

function daysLeft(expiresAt: string): string {
  const d = Math.ceil((new Date(expiresAt).getTime() - Date.now()) / 86400000);
  if (d < 0) return 'expiré';
  if (d === 0) return "expire aujourd'hui";
  return `expire dans ${d} jour${d > 1 ? 's' : ''}`;
}

export function RequestCard({
  req,
  onCopy,
  onDelete,
}: {
  req: DepositRequest;
  onCopy: () => void;
  onDelete: () => void;
}) {
  const created = new Date(req.createdAt).toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'long',
  });
  return (
    <div className="div-card" style={{ padding: 20 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start' }}>
        <div>
          <div style={{ fontWeight: 600, fontSize: 17 }}>{req.title}</div>
          <div style={{ color: DIV.gray, fontSize: 13, marginTop: 4 }}>
            Créé le {created}, {daysLeft(req.expiresAt)}
          </div>
        </div>
        <StatusBadge status={req.status} />
      </div>
      <div style={{ marginTop: 12, fontSize: 14 }}>
        {req.readyCount} pièce{req.readyCount > 1 ? 's' : ''} sur {req.expectedDocs}
      </div>
      <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
        <code
          className="mono"
          style={{
            background: DIV.accentBg,
            padding: '6px 10px',
            borderRadius: 8,
            fontSize: 12,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            maxWidth: 260,
          }}
        >
          /d/{req.token}
        </code>
        <button
          onClick={onCopy}
          style={{ border: `1px solid ${DIV.border}`, borderRadius: 999, padding: '6px 14px', fontSize: 13, cursor: 'pointer', background: '#fff' }}
        >
          Copier le lien
        </button>
        <button
          onClick={onDelete}
          style={{ border: 'none', background: 'transparent', color: DIV.danger, fontSize: 13, cursor: 'pointer' }}
        >
          Supprimer
        </button>
      </div>
    </div>
  );
}
