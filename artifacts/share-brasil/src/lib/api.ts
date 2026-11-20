import { clearSession, getToken, notifyUnauthorized } from "./session";

/**
 * Camada única de acesso à API (Cloudflare Worker, Hono + D1).
 *
 * Toda chamada HTTP do app passa por `apiFetch`. Ele cuida de:
 * - base URL via `EXPO_PUBLIC_API_URL` (nunca `VITE_*`: isso é build web do Vite);
 * - `Authorization: Bearer <token>` quando existe sessão;
 * - timeout e erro de rede com mensagem em português;
 * - 401: limpa a sessão e avisa a navegação.
 *
 * `EXPO_PUBLIC_*` vai dentro do bundle: é público por definição. Nenhum segredo
 * aqui.
 */

const TIMEOUT_PADRAO_MS = 15_000;

/** Base da API, sem barra final. */
export const API_URL = (process.env.EXPO_PUBLIC_API_URL ?? "").trim().replace(/\/+$/, "");

export type ApiErrorCode =
  | "config"
  | "timeout"
  | "network"
  | "unauthorized"
  | "http";

export class ApiError extends Error {
  readonly status: number;
  readonly code: ApiErrorCode;
  readonly body: unknown;

  constructor(mensagem: string, status: number, code: ApiErrorCode, body: unknown = null) {
    super(mensagem);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.body = body;
  }
}

export type ApiInit = Omit<RequestInit, "headers" | "signal"> & {
  headers?: Record<string, string>;
  /** Tempo máximo antes de abortar. Padrão: 15s. */
  timeoutMs?: number;
  /** Envia o Bearer token quando houver sessão. Padrão: true. */
  auth?: boolean;
};

/** Monta a URL absoluta de um caminho da API (`/api/v1/...`). */
export function apiUrl(caminho: string): string {
  if (!API_URL) {
    throw new ApiError(
      "EXPO_PUBLIC_API_URL não configurada. Defina a variável no .env e reinicie o Expo.",
      0,
      "config",
    );
  }
  return `${API_URL}${caminho.startsWith("/") ? caminho : `/${caminho}`}`;
}

async function lerCorpo(resposta: Response): Promise<unknown> {
  const texto = await resposta.text();
  if (!texto) return null;
  try {
    return JSON.parse(texto);
  } catch {
    return texto;
  }
}

function mensagemDoCorpo(corpo: unknown, status: number): string {
  if (corpo && typeof corpo === "object") {
    const registro = corpo as Record<string, unknown>;
    for (const chave of ["error", "message", "mensagem"]) {
      const valor = registro[chave];
      if (typeof valor === "string" && valor.trim()) return valor.trim();
    }
  }
  if (typeof corpo === "string" && corpo.trim()) return corpo.trim().slice(0, 200);
  return `Falha na requisição (HTTP ${status}).`;
}

/**
 * Executa uma requisição na API e devolve o JSON já tipado.
 *
 * Lança `ApiError` em timeout, erro de rede, 401 e respostas não-2xx.
 */
export async function apiFetch<T>(caminho: string, init: ApiInit = {}): Promise<T> {
  const { headers: headersInit, timeoutMs = TIMEOUT_PADRAO_MS, auth = true, ...resto } = init;
  const url = apiUrl(caminho);

  const headers: Record<string, string> = { Accept: "application/json", ...headersInit };
  const corpoEhFormData = typeof FormData !== "undefined" && resto.body instanceof FormData;
  if (typeof resto.body === "string" && !headers["Content-Type"]) {
    headers["Content-Type"] = "application/json";
  }
  if (corpoEhFormData && headers["Content-Type"]) {
    // Deixe o runtime montar o boundary do multipart.
    delete headers["Content-Type"];
  }

  if (auth) {
    const token = await getToken();
    if (token) headers.Authorization = `Bearer ${token}`;
  }

  const controller = new AbortController();
  const temporizador = setTimeout(() => controller.abort(), timeoutMs);

  let resposta: Response;
  try {
    resposta = await fetch(url, { ...resto, headers, signal: controller.signal });
  } catch (erro) {
    if (controller.signal.aborted) {
      throw new ApiError("A conexão demorou demais. Verifique sua internet e tente de novo.", 0, "timeout");
    }
    throw new ApiError("Sem conexão com a internet. Verifique sua rede e tente de novo.", 0, "network");
  } finally {
    clearTimeout(temporizador);
  }

  const corpo = await lerCorpo(resposta);

  if (resposta.status === 401) {
    await clearSession();
    notifyUnauthorized();
    throw new ApiError("Sua sessão expirou. Entre novamente.", 401, "unauthorized", corpo);
  }

  if (!resposta.ok) {
    throw new ApiError(mensagemDoCorpo(corpo, resposta.status), resposta.status, "http", corpo);
  }

  return corpo as T;
}
