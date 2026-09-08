import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { Dropzone } from '../../src/components/Dropzone';

describe('Dropzone', () => {
  it('affiche les consignes et transmet les fichiers choisis', () => {
    const onFiles = vi.fn();
    const { container } = render(<Dropzone onFiles={onFiles} />);
    expect(screen.getByText(/dépose tes pièces ici/i)).toBeInTheDocument();
    expect(screen.getByText(/20 mo maximum/i)).toBeInTheDocument();
    const input = container.querySelector('input[type="file"]') as HTMLInputElement;
    expect(input.accept).toContain('application/pdf');
    fireEvent.change(input, { target: { files: [new File(['x'], 'a.pdf', { type: 'application/pdf' })] } });
    expect(onFiles).toHaveBeenCalledTimes(1);
    expect(onFiles.mock.calls[0][0][0].name).toBe('a.pdf');
  });

  it('désactivée : atténuée et sans action', () => {
    const onFiles = vi.fn();
    const { container } = render(<Dropzone onFiles={onFiles} disabled />);
    expect((container.firstChild as HTMLElement).style.opacity).toBe('0.5');
  });
});
