import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { Dashboard } from './Dashboard';

vi.mock('../api/client', async (importOriginal) => {
  const mod = await importOriginal<typeof import('../api/client')>();
  return {
    ...mod,
    getLawyerToken: () => 'jwt-123',
    api: {
      listRequests: vi.fn(),
      createRequest: vi.fn(),
      deleteRequest: vi.fn(),
      updateRequest: vi.fn(),
    },
  };
});

const REQ = {
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

async function mockedApi() {
  return (await import('../api/client')).api as unknown as Record<string, ReturnType<typeof vi.fn>>;
}

function renderDashboard() {
  return render(
    <MemoryRouter>
      <Dashboard />
    </MemoryRouter>,
  );
}

describe('Dashboard', () => {
  it('liste les demandes et propose l’état vide sinon', async () => {
    const api = await mockedApi();
    api.listRequests.mockResolvedValue([REQ]);
    renderDashboard();
    expect(await screen.findByText('Dossier Martin')).toBeInTheDocument();
  });

  it('création : envoie pièces + expiration parsées et clampées', async () => {
    const api = await mockedApi();
    api.listRequests.mockResolvedValue([]);
    api.createRequest.mockResolvedValue({ ...REQ, id: 'r2' });
    const user = userEvent.setup();
    renderDashboard();
    const openers = screen.getAllByRole('button', { name: 'Créer une demande' });
    await user.click(openers[0]);
    fireEvent.change(screen.getByLabelText(/pièces attendues/i), { target: { value: '6' } });
    fireEvent.change(screen.getByLabelText(/expire dans/i), { target: { value: '14' } });
    await user.click(screen.getByRole('button', { name: /^créer$/i }));
    expect(api.createRequest).toHaveBeenCalledWith(
      expect.objectContaining({ expectedDocs: 6, expiresInDays: 14 }),
    );
  });

  it('erreur de chargement affichée avec réessai', async () => {
    const api = await mockedApi();
    api.listRequests.mockRejectedValueOnce(new Error('Réseau coupé'));
    api.listRequests.mockResolvedValue([]);
    const user = userEvent.setup();
    renderDashboard();
    expect(await screen.findByText(/réseau coupé/i)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /réessayer/i }));
    expect(await screen.findByText(/aucune demande en cours/i)).toBeInTheDocument();
  });
});
