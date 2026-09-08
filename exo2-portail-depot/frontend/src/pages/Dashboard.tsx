import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, clearLawyerToken, getLawyerToken, type DepositRequest } from '../api/client';
import { RequestCard } from '../components/RequestCard';
import { EmptyState } from '../components/EmptyState';
import { Reveal } from '../components/Reveal';
import { DIV } from '../theme';

function randomPin(): string {
  return String(Math.floor(1000 + Math.random() * 9000));
}

export function Dashboard() {
  const nav = useNavigate();
  const [items, setItems] = useState<DepositRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [title, setTitle] = useState('');
  const [pin, setPin] = useState(() => randomPin());
  const [expectedDocs, setExpectedDocs] = useState('4');
  const [expiresInDays, setExpiresInDays] = useState('7');
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
    if (title.trim().length < 3 || !/^\d{4}$/.test(pin)) return;
    setCreating(true);
    try {
      const n = Math.min(50, Math.max(1, parseInt(expectedDocs, 10) || 4));
      const days = Math.min(30, Math.max(1, parseInt(expiresInDays, 10) || 7));
      const r = await api.createRequest({ title: title.trim(), pin, expectedDocs: n, expiresInDays: days });
      setItems((p) => [r, ...p]);
      setShowForm(false);
      setTitle('');
      setPin(randomPin());
      setNotice(`Lien généré : ${window.location.origin}/d/${r.token} — PIN ${pin}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Création impossible');
    } finally {
      setCreating(false);
    }
  }

  return (
    <div style={{ maxWidth: 960, margin: '0 auto', padding: 16 }}>
      <div className="dash-head">
        <h1 style={{ fontSize: 22, fontWeight: 600, margin: 0 }}>Demandes de dépôt</h1>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            onClick={load}
            disabled={loading}
            style={{ border: `1px solid ${DIV.border}`, background: '#fff', borderRadius: 999, padding: '14px 20px', cursor: 'pointer' }}
          >
            Actualiser
          </button>
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
            <input
              className="div-input"
              style={{ marginTop: 6 }}
              placeholder="Dossier Martin, pièces 2026"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </label>
          <div>
            <div style={{ fontSize: 13, fontWeight: 600 }}>Code PIN proposé (4 chiffres)</div>
            <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
              <input
                aria-label="Code PIN"
                className="div-input mono"
                value={pin}
                onChange={(e) => setPin(e.target.value)}
                maxLength={4}
                style={{ flex: 1 }}
              />
              <button
                type="button"
                onClick={() => setPin(randomPin())}
                title="Générer un autre PIN"
                aria-label="Générer un autre PIN"
                style={{ border: `1px solid ${DIV.border}`, background: '#fff', borderRadius: 8, padding: '10px 14px', fontSize: 16, cursor: 'pointer' }}
              >
                ⟳
              </button>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <label style={{ fontSize: 13, fontWeight: 600, flex: 1 }}>
              Pièces attendues (1-50)
              <input
                className="div-input"
                style={{ marginTop: 6 }}
                type="number"
                min={1}
                max={50}
                value={expectedDocs}
                onChange={(e) => setExpectedDocs(e.target.value)}
              />
            </label>
            <label style={{ fontSize: 13, fontWeight: 600, flex: 1 }}>
              Expire dans (jours, 1-30)
              <input
                className="div-input"
                style={{ marginTop: 6 }}
                type="number"
                min={1}
                max={30}
                value={expiresInDays}
                onChange={(e) => setExpiresInDays(e.target.value)}
              />
            </label>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              className="div-btn-primary"
              disabled={creating || title.trim().length < 3 || !/^\d{4}$/.test(pin)}
              type="submit"
            >
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
              onSave={async (dto) => {
                const updated = await api.updateRequest(r.id, dto);
                setItems((p) => p.map((x) => (x.id === r.id ? updated : x)));
                setNotice(`Demande mise à jour : « ${updated.title} ».`);
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
