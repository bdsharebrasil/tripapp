import { supabase } from "./supabase";

/**
 * Compatibilidade com a camada de API; o token é sempre lido da sessão Supabase.
 */

let aoPerderSessao: (() => void | Promise<void>) | null = null;

/** Token atual da sessão, ou `null` quando não há sessão. */
export async function getToken(): Promise<string | null> {
  const { data, error } = await supabase.auth.getSession();
  if (error) return null;
  return data.session?.access_token ?? null;
}

/**
 * Registra o que fazer quando a API responde 401 (sessão expirada/revogada).
 *
 * O app ainda não tem tela de login. Quando `app/login.tsx` existir, registre
 * o redirecionamento no layout raiz:
 *
 *   setUnauthorizedHandler(async () => { await supabase.auth.signOut(); router.replace("/login"); });
 */
export function setUnauthorizedHandler(handler: (() => void | Promise<void>) | null): void {
  aoPerderSessao = handler;
}

/** Avisa a camada de navegação que a sessão caiu. */
export async function notifyUnauthorized(): Promise<void> {
  try {
    await aoPerderSessao?.();
  } catch {
    // Um handler com defeito não pode esconder o erro original da API.
  }
}
