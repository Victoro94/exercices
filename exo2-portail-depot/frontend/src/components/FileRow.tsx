import { DIV } from '../theme';

export interface FileItem {
  name: string;
  size: number;
  progress: number;
  error?: string;
  done?: boolean;
}

function fmt(bytes: number): string {
  if (bytes < 1024) return `${bytes} o`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} Ko`;
  return `${(bytes / 1024 / 1024).toFixed(1)} Mo`;
}

function ext(name: string): string {
  const p = name.split('.').pop()?.toUpperCase() ?? '?';
  return p.slice(0, 4);
}

export function FileRow({ file }: { file: FileItem }) {
  return (
    <div
      className="div-card"
      style={{ padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 12 }}
    >
      <span
        style={{
          fontSize: 11,
          fontWeight: 600,
          background: DIV.accentBg,
          color: DIV.primary,
          borderRadius: 6,
          padding: '4px 8px',
        }}
      >
        {ext(file.name)}
      </span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 14, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {file.name}
        </div>
        <div style={{ fontSize: 12, color: DIV.gray }}>
          {fmt(file.size)}
          {file.error ? (
            <span style={{ color: DIV.danger }}> — {file.error}</span>
          ) : file.done ? (
            <span style={{ color: DIV.success }}> — ✓ déposé</span>
          ) : (
            <span> — {file.progress}%</span>
          )}
        </div>
        {!file.done && !file.error && (
          <div style={{ height: 4, background: DIV.border, borderRadius: 999, marginTop: 6 }}>
            <div
              style={{
                width: `${file.progress}%`,
                height: '100%',
                background: DIV.primary,
                borderRadius: 999,
                transition: 'width .2s',
              }}
            />
          </div>
        )}
      </div>
    </div>
  );
}
