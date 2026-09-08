import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { FileRow } from '../../src/components/FileRow';

describe('FileRow', () => {
  it('affiche la progression en cours', () => {
    render(<FileRow file={{ name: 'piece.jpg', size: 1024, progress: 62 }} />);
    expect(screen.getByText('piece.jpg')).toBeInTheDocument();
    expect(screen.getByText(/62%/)).toBeInTheDocument();
  });

  it('affiche l’échec avec le motif', () => {
    render(
      <FileRow file={{ name: 'a.exe', size: 10, progress: 0, error: 'Type refusé' }} />,
    );
    expect(screen.getByText(/Type refusé/)).toBeInTheDocument();
  });

  it('affiche le succès déposé', () => {
    render(
      <FileRow file={{ name: 'contrat.pdf', size: 2048, progress: 100, done: true }} />,
    );
    expect(screen.getByText(/déposé/)).toBeInTheDocument();
  });

  it('propose Supprimer seulement pour un fichier déposé', async () => {
    const onDelete = vi.fn();
    const user = userEvent.setup();
    const { rerender } = render(
      <FileRow file={{ name: 'a.pdf', size: 10, progress: 40 }} onDelete={onDelete} />,
    );
    expect(screen.queryByRole('button', { name: /supprimer/i })).not.toBeInTheDocument();

    rerender(
      <FileRow
        file={{ id: 'd1', name: 'a.pdf', size: 10, progress: 100, done: true }}
        onDelete={onDelete}
      />,
    );
    await user.click(screen.getByRole('button', { name: /supprimer a\.pdf/i }));
    expect(onDelete).toHaveBeenCalledTimes(1);
  });

  it('propose Télécharger pour un fichier déposé', async () => {
    const onDownload = vi.fn();
    const user = userEvent.setup();
    render(
      <FileRow
        file={{ id: 'd1', name: 'a.pdf', size: 10, progress: 100, done: true }}
        onDownload={onDownload}
      />,
    );
    await user.click(screen.getByRole('button', { name: /télécharger a\.pdf/i }));
    expect(onDownload).toHaveBeenCalledTimes(1);
  });
});
