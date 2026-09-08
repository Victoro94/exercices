import { useState } from 'react';
import { DIV } from '../theme';
import { StatusBadge } from './StatusBadge';
import { api, type DepositRequest } from '../api/client';

function daysLeft(expiresAt: string): string {
  const d = Math.ceil((new Date(expiresAt).getTime() - Date.now()) / 86400000);
  if (d < 0) return 'expiré';
  if (d === 0) return "expire aujourd'hui";
  return `expire dans ${d} jour${d > 1 ? 's' : ''}`;
}

// datetime-local <-> ISO (heure locale du navigateur).
export function toLocalInput(iso: string): string {
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

export interface UpdateDraft {
  title: string;
  expectedDocs: number;
  expiresAt: string;
}

export function RequestCard({
  req,
  onCopy,
  onDelete,
  onSave,
}: {
  req: DepositRequest;
  onCopy: () => void;
  onDelete: () => void;
  onSave?: (dto: UpdateDraft) => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(req.title);
  const [expectedDocs, setExpectedDocs] = useState(String(req.expectedDocs));
  const [expiresAt, setExpiresAt] = useState(toLocalInput(req.expiresAt));
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [showFiles, setShowFiles] = useState(false);
  const [lawyerFiles, setLawyerFiles] = useState<
    Array<{ id: string; filename: string; mime: string; size: number }>
  >([]);
  const [filesLoading, setFilesLoading] = useState(false);
  const [filesError, setFilesError] = useState<string | null>(null);

  async function save() {
    if (!onSave) return;
    setSaving(true);
    setSaveError(null);
    try {
      await onSave({
        title,
        expectedDocs: Math.min(50, Math.max(1, parseInt(expectedDocs, 10) || req.expectedDocs)),
        expiresAt: new Date(expiresAt).toISOString(),
      });
      setEditing(false);
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : 'Enregistrement impossible');
    } finally {
      setSaving(false);
    }
  }

  async function toggleFiles() {
    if (showFiles) {
      setShowFiles(false);
      return;
    }
    setShowFiles(true);
    if (lawyerFiles.length > 0) return;
    setFilesLoading(true);
    setFilesError(null);
    try {
      setLawyerFiles(await api.getRequestFiles(req.id));
    } catch (e) {
      setFilesError(e instanceof Error ? e.message : 'Chargement impossible');
    } finally {
      setFilesLoading(false);
    }
  }

  async function downloadLawyerFile(fileId: string) {
    try {
      const r = await api.downloadRequestFile(req.id, fileId);
      window.open(r.downloadUrl, '_blank', 'noopener');
    } catch (e) {
      setFilesError(e instanceof Error ? e.message : 'Téléchargement impossible');
    }
  }
  const created = new Date(req.createdAt).toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'long',
  });
  return (
    <div className="div-card" style={{ padding: 16 }}>
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: 200 }}>
          <div style={{ fontWeight: 600, fontSize: 17 }}>{req.title}</div>
          <div style={{ color: DIV.gray, fontSize: 13, marginTop: 4 }}>
            Créé le {created}, {daysLeft(req.expiresAt)}
          </div>
          <div style={{ marginTop: 10, fontSize: 14 }}>
            {req.readyCount} pièce{req.readyCount > 1 ? 's' : ''} sur {req.expectedDocs}
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap', alignItems: 'center' }}>
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
                maxWidth: 220,
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
            {req.readyCount > 0 && (
              <button
                onClick={toggleFiles}
                style={{ border: 'none', background: 'transparent', color: DIV.primary, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
              >
                {showFiles ? 'Masquer les pièces' : `Voir les pièces (${req.readyCount})`}
              </button>
            )}
          </div>
        </div>
        <div className="req-actions">
          <StatusBadge status={req.status} />
          {onSave && !editing && (
            <button
              className="div-btn-small-primary"
              onClick={() => {
                setTitle(req.title);
                setExpectedDocs(String(req.expectedDocs));
                setExpiresAt(toLocalInput(req.expiresAt));
                setSaveError(null);
                setEditing(true);
              }}
            >
              Modifier
            </button>
          )}
          <button
            className="div-btn-small-danger"
            onClick={onDelete}
          >
            Supprimer
          </button>
        </div>
      </div>
      {editing && onSave ? (
        <div style={{ display: 'grid', gap: 8, marginTop: 12 }}>
          <label style={{ fontSize: 13, fontWeight: 600 }}>
            Intitulé
            <input
              aria-label="Intitulé"
              className="div-input"
              style={{ marginTop: 4 }}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </label>
          <div style={{ display: 'flex', gap: 8 }}>
            <label style={{ fontSize: 13, fontWeight: 600, flex: 1 }}>
              Pièces attendues
              <input
                aria-label="Pièces attendues"
                className="div-input"
                style={{ marginTop: 4 }}
                type="number"
                min={1}
                max={50}
                value={expectedDocs}
                onChange={(e) => setExpectedDocs(e.target.value)}
              />
            </label>
            <label style={{ fontSize: 13, fontWeight: 600, flex: 2 }}>
              Expire le
              <input
                aria-label="Expire le"
                className="div-input"
                style={{ marginTop: 4 }}
                type="datetime-local"
                value={expiresAt}
                onChange={(e) => setExpiresAt(e.target.value)}
              />
            </label>
          </div>
          {saveError && (
            <div style={{ background: DIV.dangerBg, color: DIV.danger, padding: '8px 12px', borderRadius: 8, fontSize: 13 }}>
              {saveError}
            </div>
          )}
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="div-btn-primary" disabled={saving} onClick={save}>
              {saving ? 'Enregistrement…' : 'Enregistrer'}
            </button>
            <button
              onClick={() => setEditing(false)}
              style={{ border: `1px solid ${DIV.border}`, background: '#fff', borderRadius: 999, padding: '14px 20px', cursor: 'pointer' }}
            >
              Annuler
            </button>
          </div>
        </div>
      ) : null}
      {showFiles && (
        <div style={{ marginTop: 12, display: 'grid', gap: 8 }}>
          {filesLoading && <div style={{ fontSize: 13, color: DIV.gray }}>Chargement des pièces…</div>}
          {filesError && (
            <div style={{ background: DIV.dangerBg, color: DIV.danger, padding: '8px 12px', borderRadius: 8, fontSize: 13 }}>
              {filesError}
            </div>
          )}
          {!filesLoading && !filesError && lawyerFiles.length === 0 && (
            <div style={{ fontSize: 13, color: DIV.gray }}>Aucune pièce à afficher.</div>
          )}
          {lawyerFiles.map((f) => (
            <div
              key={f.id}
              className="div-card"
              style={{ padding: '8px 12px', display: 'flex', alignItems: 'center', gap: 10 }}
            >
              <span style={{ fontSize: 14, flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {f.filename}
              </span>
              <button
                onClick={() => downloadLawyerFile(f.id)}
                aria-label={`Télécharger ${f.filename}`}
                style={{ border: 'none', background: 'transparent', color: DIV.primary, fontSize: 13, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap' }}
              >
                Télécharger
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
