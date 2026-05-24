import { API_URL } from '../constants';

class ApiService {
  private readonly baseUrl = API_URL;
  private token: string | null = null;
  private onRefresh?: () => Promise<string | null>;

  setToken(token: string): void { this.token = token; }
  clearToken(): void { this.token = null; }

  /** Inject from authStore so api can auto-refresh on 401 */
  setOnRefresh(fn: () => Promise<string | null>): void {
    this.onRefresh = fn;
  }

  private headers(): Record<string, string> {
    return {
      'Content-Type': 'application/json',
      ...(this.token ? { Authorization: `Bearer ${this.token}` } : {}),
    };
  }

  private async doFetch(path: string, options: RequestInit): Promise<Response> {
    return fetch(`${this.baseUrl}${path}`, {
      ...options,
      headers: { ...this.headers(), ...(options.headers as Record<string, string>) },
    });
  }

  private async parseError(res: Response): Promise<Error> {
    const body = await res.json().catch(() => ({})) as { message?: string };
    const err = new Error(body.message ?? `HTTP ${res.status}`);
    (err as Error & { statusCode: number }).statusCode = res.status;
    return err;
  }

  private async request<T>(path: string, options: RequestInit = {}): Promise<T> {
    let res = await this.doFetch(path, options);

    // Attempt token refresh once on 401
    if (res.status === 401 && this.onRefresh) {
      const newToken = await this.onRefresh();
      if (newToken) {
        this.setToken(newToken);
        res = await this.doFetch(path, options);
      }
    }

    if (!res.ok) throw await this.parseError(res);
    if (res.status === 204) return undefined as T;
    return res.json() as Promise<T>;
  }

  get<T>(path: string): Promise<T> {
    return this.request<T>(path, { method: 'GET' });
  }

  post<T>(path: string, body?: unknown): Promise<T> {
    return this.request<T>(path, {
      method: 'POST',
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  }

  patch<T>(path: string, body: unknown): Promise<T> {
    return this.request<T>(path, { method: 'PATCH', body: JSON.stringify(body) });
  }

  delete<T>(path: string): Promise<T> {
    return this.request<T>(path, { method: 'DELETE' });
  }
}

export const api = new ApiService();
