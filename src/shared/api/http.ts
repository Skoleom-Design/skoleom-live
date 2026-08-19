const TOKEN_KEY = 'skoleom:token';
const USER_KEY = 'skoleom:user';

export interface SessionUser {
  id: string;
  email: string;
  username: string;
  displayName?: string;
  avatarUrl?: string;
  role: string;
  plan?: 'free' | 'premium' | 'ultra';
}

export function getToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(TOKEN_KEY);
}

export function getStoredUser(): SessionUser | null {
  if (typeof window === 'undefined') return null;
  const raw = localStorage.getItem(USER_KEY);
  return raw ? JSON.parse(raw) : null;
}

export function setSession(token: string, user: SessionUser): void {
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(USER_KEY, JSON.stringify(user));
}

export function clearSession(): void {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

async function request<T = any>(path: string, options: RequestInit & { body?: any } = {}): Promise<T> {
  const token = getToken();
  const { body, headers, ...rest } = options;

  const res = await fetch(`/api${path}`, {
    ...rest,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...headers,
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  if (!res.ok) {
    const payload = await res.json().catch(() => ({}));
    const message = Array.isArray(payload.message) ? payload.message.join(', ') : payload.message;
    if (res.status === 401 && token) {
      // Le token était valide côté client mais rejeté par le serveur — soit un autre appareil
      // vient de se connecter sur ce compte (un seul appareil actif à la fois), soit le compte
      // a été suspendu/supprimé par un admin. On force la sortie immédiatement, sur n'importe
      // quelle page.
      const reason = message === 'SESSION_SUPERSEDED' ? 'sessionExpired' : 'suspended';
      clearSession();
      if (typeof window !== 'undefined' && !window.location.pathname.startsWith('/auth/login')) {
        window.location.href = `/auth/login?${reason}=1`;
      }
    }
    throw new ApiError(message || `Request failed (${res.status})`, res.status);
  }

  if (res.status === 204) return null as T;
  const text = await res.text();
  return text ? JSON.parse(text) : (null as T);
}

export const api = {
  get: <T = any>(path: string) => request<T>(path),
  post: <T = any>(path: string, body?: any) => request<T>(path, { method: 'POST', body }),
  patch: <T = any>(path: string, body?: any) => request<T>(path, { method: 'PATCH', body }),
  delete: <T = any>(path: string) => request<T>(path, { method: 'DELETE' }),
};

export async function uploadFile(file: File, folder: 'posts' | 'capsules' | 'avatars'): Promise<string> {
  const extension = file.name.split('.').pop() || 'bin';
  const { uploadUrl, fileUrl } = await api.post<{ uploadUrl: string; fileUrl: string }>('/files/upload-url', {
    folder,
    mimeType: file.type,
    extension,
  });
  const putRes = await fetch(uploadUrl, {
    method: 'PUT',
    headers: { 'Content-Type': file.type },
    body: file,
  });
  if (!putRes.ok) throw new Error('Upload failed');
  return fileUrl;
}
