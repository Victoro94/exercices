import { useEffect, useRef, useState } from 'react';
import { api, putWithProgress, type PublicMeta } from '../api/client';
import type { FileItem } from '../components/FileRow';

const ACCEPT = ['application/pdf', 'image/jpeg', 'image/png'];
const MAX_BYTES = 20 * 1024 * 1024;

function toDoneItem(d: { id: string; filename: string; size: number }): FileItem {
  return { id: d.id, name: d.filename, size: d.size, progress: 100, done: true };
}

function applyStatus(
  meta: PublicMeta | null,
  r: { readyCount: number; status: string },
): PublicMeta | null {
  return meta
    ? { ...meta, readyCount: r.readyCount, status: r.status as PublicMeta['status'] }
    : meta;
}

/** Toute la logique du dépôt public : le composant ne fait que l'affichage. */
export function usePublicDeposit(token: string) {
  const [meta, setMeta] = useState<PublicMeta | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pin, setPin] = useState<string[]>(['', '', '', '']);
  const [unlocked, setUnlocked] = useState(false);
  const [unlockError, setUnlockError] = useState<string | null>(null);
  const [files, setFiles] = useState<FileItem[]>([]);
  const inputsRef = useRef<Array<HTMLInputElement | null>>([]);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const m = await api.publicMeta(token);
        if (cancelled) return;
        setMeta(m);
        // Session encore valide (même navigateur) ? On restaure sans re-saisir le PIN
        // et on affiche les fichiers déjà déposés.
        if (sessionStorage.getItem(`div_public_${token}`)) {
          try {
            const existing = await api.listFiles(token);
            if (cancelled) return;
            setFiles(existing.map(toDoneItem));
            setUnlocked(true);
          } catch {
            sessionStorage.removeItem(`div_public_${token}`);
          }
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Lien invalide');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
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
      const existing = await api.listFiles(token);
      setFiles(existing.map(toDoneItem));
      setUnlocked(true);
    } catch (e) {
      setUnlockError(e instanceof Error ? e.message : 'PIN incorrect');
    }
  }

  async function removeFile(id: string | undefined) {
    if (!id) return;
    if (!confirm('Supprimer ce fichier du dépôt ?')) return;
    setFiles((p) => p.map((x) => (x.id === id ? { ...x, deleting: true } : x)));
    try {
      const r = await api.deleteFile(token, id);
      setFiles((p) => p.filter((x) => x.id !== id));
      setMeta((m) => applyStatus(m, r));
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Suppression impossible';
      setFiles((p) => p.map((x) => (x.id === id ? { ...x, deleting: false, error: msg } : x)));
    }
  }

  async function downloadFile(id: string | undefined) {
    if (!id) return;
    try {
      const r = await api.downloadFile(token, id);
      window.open(r.downloadUrl, '_blank', 'noopener');
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Téléchargement impossible';
      setFiles((p) => p.map((x) => (x.id === id ? { ...x, error: msg } : x)));
    }
  }

  async function handleFiles(list: File[]) {
    for (const f of list) {
      if (!ACCEPT.includes(f.type)) {
        setFiles((p) => [...p, { name: f.name, size: f.size, progress: 0, error: 'Type refusé (PDF, JPG, PNG)' }]);
        continue;
      }
      if (f.size > MAX_BYTES) {
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
        setMeta((m) => applyStatus(m, done));
        setFiles((p) =>
          p.map((x) =>
            x.name === f.name && !x.done ? { ...x, progress: 100, done: true, id: pre.documentId } : x,
          ),
        );
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'Échec envoi';
        setFiles((p) => p.map((x) => (x.name === f.name && !x.done ? { ...x, error: msg } : x)));
      }
    }
  }

  return {
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
  };
}
