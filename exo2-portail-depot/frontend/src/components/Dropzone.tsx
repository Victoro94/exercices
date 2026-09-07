import { useRef, useState } from 'react';
import { DIV } from '../theme';

export function Dropzone({ onFiles, disabled }: { onFiles: (f: File[]) => void; disabled?: boolean }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);
  return (
    <div
      className={`div-dropzone${over ? ' dragover' : ''}`}
      onClick={() => !disabled && inputRef.current?.click()}
      onDragOver={(e) => {
        e.preventDefault();
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setOver(false);
        if (!disabled) onFiles(Array.from(e.dataTransfer.files));
      }}
      style={{ opacity: disabled ? 0.5 : 1 }}
    >
      <div style={{ fontWeight: 600 }}>Dépose tes pièces ici</div>
      <div style={{ color: DIV.gray, fontSize: 13, marginTop: 4 }}>PDF, JPG ou PNG, 20 Mo maximum par fichier</div>
      <input
        ref={inputRef}
        type="file"
        multiple
        accept="application/pdf,image/jpeg,image/png"
        style={{ display: 'none' }}
        onChange={(e) => {
          onFiles(Array.from(e.target.files ?? []));
          e.target.value = '';
        }}
      />
    </div>
  );
}
