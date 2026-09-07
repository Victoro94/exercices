import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { FileRow } from './FileRow';

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
});
