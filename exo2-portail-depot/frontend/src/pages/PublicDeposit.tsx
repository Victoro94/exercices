import { useParams } from 'react-router-dom';
import { Dropzone } from '../components/Dropzone';
import { FileRow } from '../components/FileRow';
import { StatusBadge } from '../components/StatusBadge';
import { Reveal } from '../components/Reveal';
import { DIV } from '../theme';
import { usePublicDeposit } from './usePublicDeposit';

export function PublicDeposit() {
  const { token = '' } = useParams();
  const {
    meta,
    loading,
    error,
    pin,
    unlocked,
    unlockError,
    files,
    inputsRef,
    setDigit,
    unlock,
    removeFile,
    downloadFile,
    handleFiles,
  } = usePublicDeposit(token);

  if (loading) return <div style={{ maxWidth: 640, margin: '40px auto', padding: 16, color: DIV.gray }}>Chargement…</div>;
  if (error || !meta)
    return (
      <div style={{ maxWidth: 640, margin: '40px auto', padding: 16 }}>
        <div style={{ background: DIV.dangerBg, color: DIV.danger, padding: 14, borderRadius: 12 }}>
          Lien invalide ou expiré. Vérifie l’adresse reçue de ton avocat.
        </div>
      </div>
    );

  return (
    <div style={{ maxWidth: 640, margin: '0 auto', padding: 16 }}>
      <Reveal>
        <div className="div-card" style={{ padding: 24, marginTop: 24 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            <h1 style={{ fontSize: 20, fontWeight: 600, margin: 0 }}>{meta.title}</h1>
            <StatusBadge status={meta.status} />
          </div>
          <div style={{ fontSize: 13, color: DIV.gray, marginTop: 6 }}>
            {meta.readyCount} pièce{meta.readyCount > 1 ? 's' : ''} sur {meta.expectedDocs} — expire le{' '}
            {new Date(meta.expiresAt).toLocaleDateString('fr-FR')}
          </div>

          {!unlocked ? (
            <div style={{ marginTop: 20 }}>
              <div style={{ fontWeight: 600, fontSize: 14 }}>Code PIN à 4 chiffres</div>
              <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                {pin.map((d, i) => (
                  <input
                    key={i}
                    ref={(el) => {
                      inputsRef.current[i] = el;
                    }}
                    aria-label={`PIN chiffre ${i + 1}`}
                    className="pin-box mono"
                    inputMode="numeric"
                    value={d}
                    onChange={(e) => setDigit(i, e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Backspace' && !pin[i] && i > 0) inputsRef.current[i - 1]?.focus();
                    }}
                  />
                ))}
              </div>
              {unlockError && (
                <div style={{ background: DIV.dangerBg, color: DIV.danger, padding: '8px 12px', borderRadius: 8, fontSize: 13, marginTop: 12 }}>
                  {unlockError}
                </div>
              )}
              <button className="div-btn-primary" style={{ marginTop: 16 }} onClick={unlock} disabled={pin.join('').length !== 4}>
                Déverrouiller
              </button>
            </div>
          ) : (
            <div style={{ marginTop: 20, display: 'grid', gap: 12 }}>
              <Dropzone onFiles={handleFiles} disabled={meta.status === 'EXPIRED'} />
              {files.map((f, i) => (
                <FileRow
                  key={f.id ?? `${f.name}-${i}`}
                  file={f}
                  onDelete={f.done && f.id ? () => removeFile(f.id) : undefined}
                  onDownload={f.done && f.id ? () => downloadFile(f.id) : undefined}
                />
              ))}
            </div>
          )}
        </div>
      </Reveal>
    </div>
  );
}
