import { Platform } from "react-native";
import * as SecureStore from "expo-secure-store";

/**
 * Sessão do app.
 *
 * O token fica no `expo-secure-store` (Keychain no iOS, Keystore no Android).
 * Nunca use AsyncStorage para token: ele é texto puro no disco.
 *
 * Na web (`expo export --platform web`) o SecureStore não existe. Nesse caso o
 * token fica apenas em memória — o build web é usado para demonstração e não
 * deve guardar sessão entre recarregamentos.
 */

const CHAVE_TOKEN = "sharebrasil.session.token";

const secureStoreDisponivel = Platform.OS !== "web";

let tokenEmMemoria: string | null = null;
let aoPerderSessao: (() => void) | null = null;

/** Token atual da sessão, ou `null` quando não há sessão. */
export async function getToken(): Promise<string | null> {
  if (!secureStoreDisponivel) return tokenEmMemoria;
  try {
    return await SecureStore.getItemAsync(CHAVE_TOKEN);
  } catch {
    // Keychain/Keystore indisponível (ex.: dispositivo sem biometria configurada
    // e item corrompido): trata como "sem sessão" em vez de derrubar o app.
    return null;
  }
}

/** Grava o token da sessão. */
export async function setToken(token: string): Promise<void> {
  const valor = token.trim();
  if (!valor) {
    await clearSession();
    return;
  }
  tokenEmMemoria = valor;
  if (!secureStoreDisponivel) return;
  await SecureStore.setItemAsync(CHAVE_TOKEN, valor);
}

/** Apaga a sessão (token). Usado no logout e quando a API responde 401. */
export async function clearSession(): Promise<void> {
  tokenEmMemoria = null;
  if (!secureStoreDisponivel) return;
  try {
    await SecureStore.deleteItemAsync(CHAVE_TOKEN);
  } catch {
    // Nada a fazer: a sessão já está limpa em memória.
  }
}

/**
 * Registra o que fazer quando a API responde 401 (sessão expirada/revogada).
 *
 * O app ainda não tem tela de login. Quando `app/login.tsx` existir, registre
 * o redirecionamento no layout raiz:
 *
 *   setUnauthorizedHandler(() => router.replace("/login"));
 */
export function setUnauthorizedHandler(handler: (() => void) | null): void {
  aoPerderSessao = handler;
}

/** Avisa a camada de navegação que a sessão caiu. */
export function notifyUnauthorized(): void {
  try {
    aoPerderSessao?.();
  } catch {
    // Um handler com defeito não pode esconder o erro original da API.
  }
}
