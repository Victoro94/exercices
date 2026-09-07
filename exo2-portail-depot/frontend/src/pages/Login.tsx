import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, setLawyerToken } from '../api/client';
import { Reveal } from '../components/Reveal';
import { DIV } from '../theme';

export function Login() {
  const nav = useNavigate();
  const [email, setEmail] = useState('avocat@example.test');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const r = await api.login(email, password);
      setLawyerToken(r.access_token);
      nav('/');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Connexion impossible');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ maxWidth: 440, margin: '60px auto', padding: 16 }}>
      <Reveal>
        <div className="div-card" style={{ padding: 28 }}>
          <div style={{ fontWeight: 600, fontSize: 22 }}>Connexion avocat</div>
          <div style={{ color: DIV.gray, fontSize: 14, marginTop: 4 }}>
            Accède à ton dashboard de demandes.
          </div>
          <form onSubmit={submit} style={{ display: 'grid', gap: 12, marginTop: 20 }}>
            <label style={{ fontSize: 13, fontWeight: 600 }}>
              Email
              <input className="div-input" style={{ marginTop: 6 }} value={email} onChange={(e) => setEmail(e.target.value)} />
            </label>
            <label style={{ fontSize: 13, fontWeight: 600 }}>
              Mot de passe
              <input
                className="div-input"
                style={{ marginTop: 6 }}
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </label>
            {error && (
              <div style={{ background: DIV.dangerBg, color: DIV.danger, padding: '8px 12px', borderRadius: 8, fontSize: 13 }}>
                {error}
              </div>
            )}
            <button className="div-btn-primary" disabled={loading} type="submit">
              {loading ? 'Connexion…' : 'Se connecter'}
            </button>
          </form>
        </div>
      </Reveal>
    </div>
  );
}
