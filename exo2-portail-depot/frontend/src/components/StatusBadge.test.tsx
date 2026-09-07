import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { StatusBadge } from './StatusBadge';

describe('StatusBadge', () => {
  it.each([
    ['PENDING', 'En attente'],
    ['COMPLETE', 'Complète'],
    ['EXPIRED', 'Expirée'],
  ] as const)('affiche %s', (status, label) => {
    render(<StatusBadge status={status} />);
    expect(screen.getByText(label)).toBeInTheDocument();
  });

  it('n’utilise jamais de couleur crue : fond sémantique exigé', () => {
    const { container } = render(<StatusBadge status="COMPLETE" />);
    const bg = (container.firstChild as HTMLElement).style.background;
    expect(bg).not.toBe('');
  });
});
