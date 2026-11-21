export type Session = {
  access_token: string;
  refresh_token: string;
  expires_at: number;
  user: { id: string };
};
type Storage = {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
};
type Request = <T>(
  path: string,
  init: {
    method: string;
    body?: string;
    auth: boolean;
    headers?: Record<string, string>;
  },
) => Promise<T>;
export const SESSION_STORAGE_KEY = "tripshare.auth.session.v1";
function valid(value: unknown): value is Session {
  const s = value as Session | null;
  return Boolean(
    s &&
    typeof s.access_token === "string" &&
    s.access_token &&
    typeof s.refresh_token === "string" &&
    s.refresh_token &&
    Number.isFinite(s.expires_at) &&
    typeof s.user?.id === "string" &&
    s.user.id,
  );
}
/** Coordena persistência e renovação; uma resposta antiga nunca restaura uma sessão encerrada. */
export class SessionManager {
  private current: Session | null = null;
  private ready: Promise<void> | null = null;
  private refreshing: Promise<Session | null> | null = null;
  private generation = 0;
  private writes: Promise<void> = Promise.resolve();
  private listeners = new Set<(session: Session | null) => void>();
  private storage: Storage;
  private request: Request;
  private clock: () => number;
  constructor(
    storage: Storage,
    request: Request,
    clock = () => Date.now() / 1000,
  ) {
    this.storage = storage;
    this.request = request;
    this.clock = clock;
  }
  subscribe(listener: (session: Session | null) => void) {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }
  private emit() {
    for (const listener of this.listeners) listener(this.current);
  }
  private async initialize() {
    if (!this.ready) {
      const generation = this.generation;
      this.ready = (async () => {
        const raw = await this.storage.getItem(SESSION_STORAGE_KEY);
        if (generation !== this.generation) return;
        try {
          const s = raw ? JSON.parse(raw) : null;
          this.current = valid(s) ? s : null;
        } catch {
          this.current = null;
        }
      })();
    }
    await this.ready;
  }
  private async persist(session: Session | null, generation: number) {
    this.writes = this.writes
      .catch(() => undefined)
      .then(async () => {
        if (generation !== this.generation) return;
        if (session)
          await this.storage.setItem(
            SESSION_STORAGE_KEY,
            JSON.stringify(session),
          );
        else await this.storage.removeItem(SESSION_STORAGE_KEY);
      });
    await this.writes;
    if (generation !== this.generation) return;
    this.current = session;
    this.emit();
  }
  async login(usuario: string, senha: string) {
    await this.initialize();
    const generation = ++this.generation;
    const session = await this.request<Session>("/api/trip/auth/login", {
      method: "POST",
      auth: false,
      body: JSON.stringify({ usuario, senha }),
    });
    if (!valid(session)) throw new Error("Resposta de autenticação inválida.");
    if (generation !== this.generation)
      throw new Error("O acesso foi cancelado.");
    await this.persist(session, generation);
    return session;
  }
  async getSession(): Promise<Session | null> {
    await this.initialize();
    const current = this.current;
    if (!current || current.expires_at - this.clock() > 60) return current;
    if (this.refreshing) return this.refreshing;
    const generation = this.generation;
    const renewal = (async () => {
      try {
        const next = await this.request<Session>("/api/trip/auth/refresh", {
          method: "POST",
          auth: false,
          body: JSON.stringify({ refresh_token: current.refresh_token }),
        });
        if (!valid(next)) throw new Error("Resposta de renovação inválida.");
        if (generation !== this.generation) return this.current;
        await this.persist(next, generation);
        return this.current;
      } catch (error) {
        if (generation !== this.generation) return this.current;
        const status = (error as { status?: number })?.status;
        if (status === 401 || status === 403) {
          await this.clear();
          return null;
        }
        if (current.expires_at > this.clock()) return current;
        throw error;
      }
    })();
    this.refreshing = renewal;
    try {
      return await renewal;
    } finally {
      if (this.refreshing === renewal) this.refreshing = null;
    }
  }
  async clear() {
    ++this.generation;
    this.current = null;
    this.ready = Promise.resolve();
    this.emit();
    await this.persist(null, this.generation);
  }
  async logout() {
    const token = this.current?.access_token;
    await this.clear();
    if (token)
      void this.request("/api/trip/auth/logout", {
        method: "POST",
        auth: false,
        headers: { Authorization: `Bearer ${token}` },
      }).catch(() => undefined);
  }
}
