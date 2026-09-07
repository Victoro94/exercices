import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, clearLawyerToken, getLawyerToken, type DepositRequest } from '../api/client';
import { RequestCard } from '../components/RequestCard';
import { EmptyState } from '../components/EmptyState';
import { Reveal } from '../components/Reveal';
import { DIV } from '../theme';

export function Dashboard() {
  const nav = useNavigate();
  const [items, setItems] = useState<DepositRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [title, setTitle] = useState('Dossier Martin, pièces 2026');
  const [pin, setPin] = useState('4816');
  const [showForm, setShowForm] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setItems(await api.listRequests());
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Chargement impossible';
      if (msg.includes('401') || msg.includes('Unauthorized')) {
        clearLawyerToken();
        nav('/login');
        return;
      }
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [nav]);

  useEffect(() => {
    if (!getLawyerToken()) {
      nav('/login');
      return;
    }
    load();
  }, [load, nav]);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setCreating(true);
    try {
      const r = await api.createRequest({ title, pin, expectedDocs: 4, expiresInDays: 7 });
      setItems((p) => [r, ...p]);
      setShowForm(false);
      setNotice(`Lien généré : ${window.location.origin}/d/${r.token} — PIN ${pin}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Création impossible');
    } finally {
      setCreating(false);
    }
  }

  return (
    <div style={{ maxWidth: 960, margin: '0 auto', padding: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', margin: '24px 0' }}>
        <h1 style={{ fontSize: 22, fontWeight: 600, margin: 0 }}>Demandes de dépôt</h1>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="div-btn-primary" onClick={() => setShowForm((s) => !s)}>
            Créer une demande
          </button>
          <button
            onClick={() => {
              clearLawyerToken();
              nav('/login');
            }}
            style={{ border: `1px solid ${DIV.border}`, background: '#fff', borderRadius: 999, padding: '14px 20px', cursor: 'pointer' }}
          >
            Déconnexion
          </button>
        </div>
      </div>

      {notice && (
        <div style={{ background: DIV.infoBg, color: DIV.info, padding: '10px 14px', borderRadius: 8, fontSize: 13, marginBottom: 12 }}>
          {notice}
        </div>
      )}

      {showForm && (
        <form onSubmit={create} className="div-card" style={{ padding: 20, display: 'grid', gap: 12, marginBottom: 16 }}>
          <label style={{ fontSize: 13, fontWeight: 600 }}>
            Intitulé du dossier
            <input className="div-input" style={{ marginTop: 6 }} value={title} onChange={(e) => setTitle(e.target.value)} />
          </label>
          <label style={{ fontSize: 13, fontWeight: 600 }}>
            Code PIN (4 chiffres)
            <input className="div-input mono" style={{ marginTop: 6 }} value={pin} onChange={(e) => setPin(e.target.value)} maxLength={4} />
          </label>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="div-btn-primary" disabled={creating} type="submit">
              {creating ? 'Création…' : 'Créer'}
            </button>
            <button type="button" onClick={() => setShowForm(false)} style={{ border: `1px solid ${DIV.border}`, background: '#fff', borderRadius: 999, padding: '14px 20px', cursor: 'pointer' }}>
              Annuler
            </button>
          </div>
        </form>
      )}

      {loading && <div style={{ color: DIV.gray }}>Chargement des demandes…</div>}
      {error && (
        <div style={{ background: DIV.dangerBg, color: DIV.danger, padding: '10px 14px', borderRadius: 8, fontSize: 13 }}>
          {error} — <button onClick={load} style={{ textDecoration: 'underline', background: 'none', border: 'none', cursor: 'pointer', color: 'inherit' }}>Réessayer</button>
        </div>
      )}
      {!loading && !error && items.length === 0 && <EmptyState onCreate={() => setShowForm(true)} />}
      <div style={{ display: 'grid', gap: 12 }}>
        {items.map((r, i) => (
          <Reveal key={r.id} delay={Math.min(i * 60, 300)}>
            <RequestCard
              req={r}
              onCopy={async () => {
                const url = `${window.location.origin}/d/${r.token}`;
                try {
                  await navigator.clipboard.writeText(url);
                } catch {
                  /* presse-papiers indisponible (http, iframe) : on affiche quand même le lien */
                }
                setNotice(`Lien copié : ${url}`);
              }}
              onDelete={async () => {
                if (!confirm(`Supprimer « ${r.title} » ?`)) return;
                await api.deleteRequest(r.id);
                setItems((p) => p.filter((x) => x.id !== r.id));
              }}
            />
          </Reveal>
        ))}
      </div>
    </div>
  );
}
