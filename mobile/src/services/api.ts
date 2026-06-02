import { API_URL } from '../constants';

class ApiService {
  private readonly baseUrl = API_URL;
  private token: string | null = null;
  private onRefresh?: () => Promise<string | null>;
  /** In-flight refresh, shared by all concurrent 401s (single-flight) */
  private refreshPromise: Promise<string | null> | null = null;

  setToken(token: string): void { this.token = token; }
  clearToken(): void { this.token = null; }

  /** Inject from authStore so api can auto-refresh on 401 */
  setOnRefresh(fn: () => Promise<string | null>): void {
    this.onRefresh = fn;
  }

  private headers(): Record<string, string> {
    // NOTE: Content-Type is added per-request only when there's a body (see post/patch).
    // Sending "application/json" on a body-less GET/DELETE makes Fastify reject it with
    // "Body cannot be empty when content-type is set to 'application/json'".
    return {
      ...(this.token ? { Authorization: `Bearer ${this.token}` } : {}),
    };
  }

  private async doFetch(path: string, options: RequestInit): Promise<Response> {
    // Abort after 15 s — prevents infinite loading when network drops mid-request
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15_000);
    try {
      return await fetch(`${this.baseUrl}${path}`, {
        ...options,
        signal: controller.signal,
        headers: { ...this.headers(), ...(options.headers as Record<string, string>) },
      });
    } finally {
      clearTimeout(timeoutId);
    }
  }

  private async parseError(res: Response): Promise<Error> {
    const body = await res.json().catch(() => ({})) as { message?: string };
    const err = new Error(body.message ?? `HTTP ${res.status}`);
    (err as Error & { statusCode: number }).statusCode = res.status;
    return err;
  }

  /**
   * Refresh the access token, but ensure only ONE refresh runs at a time.
   * The backend rotates refresh tokens (each refresh invalidates the previous
   * one), so concurrent refreshes with the same token would trip the reuse-attack
   * guard and permanently kill the session. All concurrent 401s share this promise.
   */
  private refreshOnce(): Promise<string | null> {
    if (!this.onRefresh) return Promise.resolve(null);
    if (!this.refreshPromise) {
      this.refreshPromise = this.onRefresh().finally(() => {
        this.refreshPromise = null;
      });
    }
    return this.refreshPromise;
  }

  private async request<T>(path: string, options: RequestInit = {}): Promise<T> {
    let res = await this.doFetch(path, options);

    // Attempt token refresh once on 401 (single-flight — see refreshOnce)
    if (res.status === 401 && this.onRefresh) {
      const newToken = await this.refreshOnce();
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
    // Always send a JSON body (even if empty `{}`) so Fastify's
    // content-type parser doesn't reject "Content-Type: application/json" with no body.
    return this.request<T>(path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body ?? {}),
    });
  }

  patch<T>(path: string, body: unknown): Promise<T> {
    return this.request<T>(path, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  }

  delete<T>(path: string): Promise<T> {
    return this.request<T>(path, { method: 'DELETE' });
  }
}

export const api = new ApiService();
