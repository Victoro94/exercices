import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { EmptyState } from '../../src/components/EmptyState';

describe('EmptyState', () => {
  it('explique l’écran vide et propose de créer', () => {
    const onCreate = vi.fn();
    render(<EmptyState onCreate={onCreate} />);
    expect(screen.getByText('Aucune demande en cours')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /créer une demande/i }));
    expect(onCreate).toHaveBeenCalledTimes(1);
  });
});
