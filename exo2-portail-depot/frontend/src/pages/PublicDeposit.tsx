import { useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { api, putWithProgress, type PublicMeta } from '../api/client';
import { Dropzone } from '../components/Dropzone';
import { FileRow, type FileItem } from '../components/FileRow';
import { StatusBadge } from '../components/StatusBadge';
import { Reveal } from '../components/Reveal';
import { DIV } from '../theme';

const ACCEPT = ['application/pdf', 'image/jpeg', 'image/png'];

export function PublicDeposit() {
  const { token = '' } = useParams();
  const [meta, setMeta] = useState<PublicMeta | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pin, setPin] = useState<string[]>(['', '', '', '']);
  const [unlocked, setUnlocked] = useState(false);
  const [unlockError, setUnlockError] = useState<string | null>(null);
  const [files, setFiles] = useState<FileItem[]>([]);
  const inputsRef = useRef<Array<HTMLInputElement | null>>([]);

  useEffect(() => {
    api
      .publicMeta(token)
      .then(setMeta)
      .catch((e) => setError(e instanceof Error ? e.message : 'Lien invalide'))
      .finally(() => setLoading(false));
  }, [token]);

  function setDigit(i: number, v: string) {
    const d = v.replace(/\D/g, '').slice(-1);
    setPin((p) => {
      const n = [...p];
      n[i] = d;
      return n;
    });
    if (d && i < 3) inputsRef.current[i + 1]?.focus();
  }

  async function unlock() {
    setUnlockError(null);
    try {
      const r = await api.unlock(token, pin.join(''));
      sessionStorage.setItem(`div_public_${token}`, r.session);
      setMeta(r);
      setUnlocked(true);
    } catch (e) {
      setUnlockError(e instanceof Error ? e.message : 'PIN incorrect');
    }
  }

  async function handleFiles(list: File[]) {
    for (const f of list) {
      if (!ACCEPT.includes(f.type)) {
        setFiles((p) => [...p, { name: f.name, size: f.size, progress: 0, error: 'Type refusé (PDF, JPG, PNG)' }]);
        continue;
      }
      if (f.size > 20 * 1024 * 1024) {
        setFiles((p) => [...p, { name: f.name, size: f.size, progress: 0, error: '20 Mo maximum' }]);
        continue;
      }
      const item: FileItem = { name: f.name, size: f.size, progress: 0 };
      setFiles((p) => [...p, item]);
      try {
        const pre = await api.presign(token, { filename: f.name, mime: f.type, size: f.size });
        await putWithProgress(pre.uploadUrl, f, (pct) => {
          setFiles((p) => p.map((x) => (x.name === f.name && !x.done ? { ...x, progress: pct } : x)));
        });
        const done = await api.complete(token, pre.documentId);
        setMeta((m) => (m ? { ...m, readyCount: done.readyCount, status: done.status as PublicMeta['status'] } : m));
        setFiles((p) => p.map((x) => (x.name === f.name && !x.done ? { ...x, progress: 100, done: true } : x)));
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'Échec envoi';
        setFiles((p) => p.map((x) => (x.name === f.name && !x.done ? { ...x, error: msg } : x)));
      }
    }
  }

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
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
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
                <FileRow key={`${f.name}-${i}`} file={f} />
              ))}
            </div>
          )}
        </div>
      </Reveal>
    </div>
  );
}
