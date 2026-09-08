import { ALLOWED_MIMES, MAX_FILE_BYTES } from '../../src/storage/storage.service';

function validateUpload(mime: string, size: number): boolean {
  return ALLOWED_MIMES.includes(mime) && size > 0 && size <= MAX_FILE_BYTES;
}

describe('upload validation', () => {
  it('accepte PDF/JPG/PNG <= 20Mo', () => {
    expect(validateUpload('application/pdf', 1024)).toBe(true);
    expect(validateUpload('image/jpeg', 20 * 1024 * 1024)).toBe(true);
    expect(validateUpload('image/png', 1024)).toBe(true);
  });

  it('refuse exécutables, SVG, fichiers trop gros', () => {
    expect(validateUpload('application/x-msdownload', 1024)).toBe(false);
    expect(validateUpload('image/svg+xml', 1024)).toBe(false);
    expect(validateUpload('application/pdf', 21 * 1024 * 1024)).toBe(false);
  });
});
