/**
 * Central API Client for Durable Server Persistence
 * Automatically attaches researcher session token and handles JSON responses.
 */

const SESSION_TOKEN_KEY = 'qrp_session_token';

export const apiClient = {
  getToken(): string | null {
    return localStorage.getItem(SESSION_TOKEN_KEY);
  },

  setToken(token: string): void {
    localStorage.setItem(SESSION_TOKEN_KEY, token);
  },

  clearToken(): void {
    localStorage.removeItem(SESSION_TOKEN_KEY);
  },

  async ensureSession(userId: string = 'usr_amelia_ross'): Promise<string> {
    const existingToken = this.getToken();
    if (existingToken) {
      try {
        const check = await fetch('/api/auth/me', {
          headers: { Authorization: `Bearer ${existingToken}` },
        });
        if (check.ok) {
          const res = await check.json();
          if (res.user?.id === userId) {
            return existingToken;
          }
        }
      } catch {
        // Continue to recreate session
      }
    }

    // Switch or create session on server
    try {
      const res = await fetch('/api/auth/switch-user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.token) {
          this.setToken(data.token);
          return data.token;
        }
      }
    } catch (e) {
      console.warn('Could not establish server session:', e);
    }

    return '';
  },

  async fetch<T>(url: string, options: RequestInit = {}): Promise<{ success: boolean; data?: T; error?: string; status: number }> {
    const token = this.getToken();
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(options.headers as Record<string, string> || {}),
    };

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    try {
      const response = await fetch(url, {
        ...options,
        headers,
      });

      const json = await response.json().catch(() => null);

      if (!response.ok) {
        return {
          success: false,
          error: json?.error || `HTTP ${response.status}: ${response.statusText}`,
          status: response.status,
        };
      }

      return {
        success: true,
        data: json?.data ?? json,
        status: response.status,
      };
    } catch (err: any) {
      return {
        success: false,
        error: err.message || 'Network request failed',
        status: 0,
      };
    }
  },
};
