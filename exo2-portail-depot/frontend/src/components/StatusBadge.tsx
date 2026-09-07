import { DIV } from '../theme';

const MAP: Record<string, { label: string; color: string; bg: string }> = {
  PENDING: { label: 'En attente', color: DIV.warning, bg: DIV.warningBg },
  COMPLETE: { label: 'Complète', color: DIV.success, bg: DIV.successBg },
  EXPIRED: { label: 'Expirée', color: DIV.danger, bg: DIV.dangerBg },
};

export function StatusBadge({ status }: { status: keyof typeof MAP }) {
  const s = MAP[status] ?? MAP.PENDING;
  return (
    <span
      style={{
        display: 'inline-block',
        padding: '4px 12px',
        borderRadius: 999,
        fontSize: 13,
        fontWeight: 600,
        color: s.color,
        background: s.bg,
      }}
    >
      {s.label}
    </span>
  );
}
