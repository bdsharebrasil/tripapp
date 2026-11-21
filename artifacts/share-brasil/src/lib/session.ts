import { apiFetch } from "./api";
import { encryptedSessionStorage } from "./auth-storage";
import { SessionManager } from "./session-core";
export type { Session } from "./session-core";
const manager = new SessionManager(encryptedSessionStorage, apiFetch);
export const getSession = () => manager.getSession();
export const signIn = (usuario: string, senha: string) =>
  manager.login(usuario, senha);
export const signOut = () => manager.logout();
export const onSessionChange = (
  listener: Parameters<SessionManager["subscribe"]>[0],
) => manager.subscribe(listener);
export async function getToken() {
  return (await manager.getSession())?.access_token ?? null;
}
let aoPerderSessao: (() => void | Promise<void>) | null = null;
export function setUnauthorizedHandler(handler: typeof aoPerderSessao) {
  aoPerderSessao = handler;
}
export async function notifyUnauthorized() {
  await manager.clear();
  try {
    await aoPerderSessao?.();
  } catch {
    /* preserva o erro da requisição */
  }
}
