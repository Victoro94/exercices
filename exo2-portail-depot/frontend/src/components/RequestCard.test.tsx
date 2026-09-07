import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { RequestCard } from './RequestCard';
import type { DepositRequest } from '../api/client';

const REQ: DepositRequest = {
  id: 'r1',
  title: 'Dossier Martin',
  token: '8f3a2c1b',
  expectedDocs: 4,
  readyCount: 2,
  status: 'PENDING',
  expiresAt: new Date(Date.now() + 86400000).toISOString(),
  createdAt: new Date().toISOString(),
  publicUrlPath: '/d/8f3a2c1b',
};

describe('RequestCard', () => {
  it('affiche titre, compteur et lien tronqué', () => {
    render(<RequestCard req={REQ} onCopy={() => undefined} onDelete={() => undefined} />);
    expect(screen.getByText('Dossier Martin')).toBeInTheDocument();
    expect(screen.getByText(/2 pièces sur 4/)).toBeInTheDocument();
    expect(screen.getByText(/8f3a2c1b/)).toBeInTheDocument();
  });

  it('copie et suppression appellent les callbacks', () => {
    const onCopy = vi.fn();
    const onDelete = vi.fn();
    render(<RequestCard req={REQ} onCopy={onCopy} onDelete={onDelete} />);
    fireEvent.click(screen.getByRole('button', { name: /copier le lien/i }));
    fireEvent.click(screen.getByRole('button', { name: /supprimer/i }));
    expect(onCopy).toHaveBeenCalledTimes(1);
    expect(onDelete).toHaveBeenCalledTimes(1);
  });
});
