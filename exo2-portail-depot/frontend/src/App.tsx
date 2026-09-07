import { BrowserRouter, Link, Route, Routes } from 'react-router-dom';
import { Login } from './pages/Login';
import { Dashboard } from './pages/Dashboard';
import { PublicDeposit } from './pages/PublicDeposit';
import { DIV } from './theme';

function Header() {
  return (
    <header
      style={{
        borderBottom: `1px solid ${DIV.border}`,
        background: '#fff',
        position: 'sticky',
        top: 0,
        zIndex: 10,
      }}
    >
      <div
        style={{
          maxWidth: 960,
          margin: '0 auto',
          padding: '12px 16px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <Link to="/" style={{ textDecoration: 'none', color: DIV.ink, fontWeight: 600 }}>
          <span style={{ color: DIV.primary }}>DIV</span> · Portail de dépôt
        </Link>
        <span style={{ fontSize: 12, color: DIV.gray }}>Formel. Froid. Technique.</span>
      </div>
    </header>
  );
}

export function App() {
  return (
    <BrowserRouter>
      <Header />
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/d/:token" element={<PublicDeposit />} />
        <Route path="/" element={<Dashboard />} />
        <Route path="*" element={<div style={{ padding: 24 }}>Page introuvable.</div>} />
      </Routes>
    </BrowserRouter>
  );
}
