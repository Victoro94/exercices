import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { RequestCard } from '../../src/components/RequestCard';
import type { DepositRequest } from '../../src/api/client';

vi.mock('../../src/api/client', async (importOriginal) => {
  const mod = await importOriginal<typeof import('../../src/api/client')>();
  return {
    ...mod,
    api: { getRequestFiles: vi.fn(), downloadRequestFile: vi.fn() },
  };
});

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

  it('édition : Modifier ouvre le formulaire et Enregistrer appelle onSave', async () => {
    const user = userEvent.setup();
    const onSave = vi.fn().mockResolvedValue(undefined);
    render(<RequestCard req={REQ} onCopy={() => undefined} onDelete={() => undefined} onSave={onSave} />);
    fireEvent.click(screen.getByRole('button', { name: /modifier/i }));
    const title = screen.getByLabelText(/intitulé/i);
    fireEvent.change(title, { target: { value: 'Dossier Renommé' } });
    await user.click(screen.getByRole('button', { name: /enregistrer/i }));
    expect(onSave).toHaveBeenCalledTimes(1);
    expect(onSave.mock.calls[0][0]).toMatchObject({ title: 'Dossier Renommé' });
    expect(onSave.mock.calls[0][0].expiresAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it('avocat : Voir les pièces liste puis Télécharger ouvre l’URL', async () => {
    const { api } = await import('../../src/api/client');
    vi.mocked(api.getRequestFiles).mockResolvedValue([
      { id: 'd1', filename: 'a.pdf', mime: 'application/pdf', size: 10, createdAt: new Date().toISOString() },
    ]);
    vi.mocked(api.downloadRequestFile).mockResolvedValue({
      downloadUrl: 'http://minio/get',
      filename: 'a.pdf',
      mime: 'application/pdf',
      expiresIn: 300,
    });
    window.open = vi.fn();
    const user = userEvent.setup();
    render(<RequestCard req={REQ} onCopy={() => undefined} onDelete={() => undefined} />);
    await user.click(screen.getByRole('button', { name: /voir les pièces/i }));
    expect(await screen.findByText('a.pdf')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /télécharger a\.pdf/i }));
    expect(window.open).toHaveBeenCalledWith('http://minio/get', '_blank', 'noopener');
  });
});
