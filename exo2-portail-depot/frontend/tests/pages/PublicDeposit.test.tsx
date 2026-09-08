import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { PublicDeposit } from '../../src/pages/PublicDeposit';

vi.mock('../../src/api/client', async (importOriginal) => {
  const mod = await importOriginal<typeof import('../../src/api/client')>();
  return {
    ...mod,
    api: {
      publicMeta: vi.fn(),
      unlock: vi.fn(),
      listFiles: vi.fn(),
      presign: vi.fn(),
      complete: vi.fn(),
      deleteFile: vi.fn(),
      downloadFile: vi.fn(),
    },
  };
});

const META = {
  title: 'Dossier Martin',
  expectedDocs: 4,
  readyCount: 0,
  status: 'PENDING',
  expiresAt: new Date(Date.now() + 86400000).toISOString(),
};

async function mockedApi() {
  return (await import('../../src/api/client')).api as unknown as Record<string, ReturnType<typeof vi.fn>>;
}

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/d/tok123']}>
      <Routes>
        <Route path="/d/:token" element={<PublicDeposit />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('PublicDeposit', () => {
  afterEach(() => {
    sessionStorage.clear();
    vi.restoreAllMocks();
  });

  it('déverrouille au bon PIN puis affiche la zone de dépôt', async () => {
    const api = await mockedApi();
    api.publicMeta.mockResolvedValue(META);
    api.unlock.mockResolvedValue({ session: 's', ...META });
    api.listFiles.mockResolvedValue([]);
    const user = userEvent.setup();
    renderPage();

    const boxes = await screen.findAllByLabelText(/pin chiffre/i);
    expect(boxes).toHaveLength(4);
    for (let i = 0; i < 4; i++) fireEvent.change(boxes[i], { target: { value: String(i + 1) } });
    await user.click(screen.getByRole('button', { name: /déverrouiller/i }));
    expect(api.unlock).toHaveBeenCalledWith('tok123', '1234');
    expect(await screen.findByText(/dépose tes pièces ici/i)).toBeInTheDocument();
  });

  it('PIN faux affiché sans débloquer', async () => {
    const api = await mockedApi();
    api.publicMeta.mockResolvedValue(META);
    api.unlock.mockRejectedValue(new Error('PIN incorrect'));
    const user = userEvent.setup();
    renderPage();
    const boxes = await screen.findAllByLabelText(/pin chiffre/i);
    for (let i = 0; i < 4; i++) fireEvent.change(boxes[i], { target: { value: '0' } });
    await user.click(screen.getByRole('button', { name: /déverrouiller/i }));
    expect(await screen.findByText(/pin incorrect/i)).toBeInTheDocument();
    expect(screen.queryByText(/dépose tes pièces ici/i)).not.toBeInTheDocument();
  });

  it('session existante : fichiers déjà déposés affichés sans PIN', async () => {
    const api = await mockedApi();
    sessionStorage.setItem('div_public_tok123', 'sess');
    api.publicMeta.mockResolvedValue({ ...META, readyCount: 1 });
    api.listFiles.mockResolvedValue([
      { id: 'd1', filename: 'a.pdf', mime: 'application/pdf', size: 10, createdAt: new Date().toISOString() },
    ]);
    renderPage();
    expect(await screen.findByText('a.pdf')).toBeInTheDocument();
    expect(screen.queryByLabelText(/pin chiffre/i)).not.toBeInTheDocument();
  });

  it('suppression confirmée retire le fichier', async () => {
    const api = await mockedApi();
    sessionStorage.setItem('div_public_tok123', 'sess');
    api.publicMeta.mockResolvedValue({ ...META, readyCount: 1 });
    api.listFiles.mockResolvedValue([
      { id: 'd1', filename: 'a.pdf', mime: 'application/pdf', size: 10, createdAt: new Date().toISOString() },
    ]);
    api.deleteFile.mockResolvedValue({ readyCount: 0, expectedDocs: 4, status: 'PENDING' });
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    const user = userEvent.setup();
    renderPage();
    await user.click(await screen.findByRole('button', { name: /supprimer a\.pdf/i }));
    expect(api.deleteFile).toHaveBeenCalledWith('tok123', 'd1');
    expect(screen.queryByText('a.pdf')).not.toBeInTheDocument();
  });
});
