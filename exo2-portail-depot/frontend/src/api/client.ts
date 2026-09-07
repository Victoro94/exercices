const BASE = (import.meta.env.VITE_API_URL as string | undefined) ?? '/api';

export function getLawyerToken(): string | null {
  return localStorage.getItem('div_token');
}
export function setLawyerToken(t: string) {
  localStorage.setItem('div_token', t);
}
export function clearLawyerToken() {
  localStorage.removeItem('div_token');
}

async function req<T>(path: string, init: RequestInit = {}, auth?: 'lawyer' | 'public', publicToken?: string): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(init.headers as Record<string, string> | undefined),
  };
  if (auth === 'lawyer') {
    const t = getLawyerToken();
    if (t) headers['Authorization'] = `Bearer ${t}`;
  }
  if (auth === 'public' && publicToken) {
    const s = sessionStorage.getItem(`div_public_${publicToken}`);
    if (s) headers['Authorization'] = `Bearer ${s}`;
  }
  const res = await fetch(`${BASE}${path}`, { ...init, headers });
  if (!res.ok) {
    let msg = `HTTP ${res.status}`;
    try {
      const j = (await res.json()) as { message?: string | string[] };
      const m = j.message;
      msg = Array.isArray(m) ? m.join(', ') : (m ?? msg);
    } catch {
      /* ignore */
    }
    throw new Error(msg);
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

export interface DepositRequest {
  id: string;
  title: string;
  token: string;
  expectedDocs: number;
  readyCount: number;
  status: 'PENDING' | 'COMPLETE' | 'EXPIRED';
  expiresAt: string;
  createdAt: string;
  publicUrlPath: string;
}

export interface PublicMeta {
  title: string;
  expectedDocs: number;
  readyCount: number;
  status: 'PENDING' | 'COMPLETE' | 'EXPIRED';
  expiresAt: string;
}

export const api = {
  login: (email: string, password: string) =>
    req<{ access_token: string; user: { id: string; email: string } }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    }),
  listRequests: () => req<DepositRequest[]>('/requests', {}, 'lawyer'),
  createRequest: (dto: { title: string; pin: string; expectedDocs?: number; expiresInDays?: number }) =>
    req<DepositRequest>('/requests', { method: 'POST', body: JSON.stringify(dto) }, 'lawyer'),
  deleteRequest: (id: string) => req<{ deleted: boolean }>(`/requests/${id}`, { method: 'DELETE' }, 'lawyer'),
  publicMeta: (token: string) => req<PublicMeta>(`/public/${token}`),
  unlock: (token: string, pin: string) =>
    req<PublicMeta & { session: string }>(`/public/${token}/unlock`, {
      method: 'POST',
      body: JSON.stringify({ pin }),
    }),
  presign: (token: string, dto: { filename: string; mime: string; size: number }) =>
    req<{ documentId: string; s3Key: string; uploadUrl: string; expiresIn: number }>(
      `/public/${token}/files/presign`,
      { method: 'POST', body: JSON.stringify(dto) },
      'public',
      token,
    ),
  complete: (token: string, documentId: string) =>
    req<{ readyCount: number; expectedDocs: number; status: string }>(
      `/public/${token}/files/${documentId}/complete`,
      { method: 'POST', body: JSON.stringify({}) },
      'public',
      token,
    ),
};

export function putWithProgress(url: string, file: File, onProgress: (pct: number) => void): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('PUT', url);
    xhr.setRequestHeader('Content-Type', file.type);
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100));
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) resolve();
      else reject(new Error(`Upload échoué (${xhr.status})`));
    };
    xhr.onerror = () => reject(new Error('Upload interrompu (réseau/CORS)'));
    xhr.send(file);
  });
}
