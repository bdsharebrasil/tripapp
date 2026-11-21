import { getToken, notifyUnauthorized } from "./session";
export const API_URL = (
  process.env.EXPO_PUBLIC_API_URL || "https://api.share-brasil.com"
)
  .trim()
  .replace(/\/+$/, "");
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
  constructor(
    message: string,
    status: number,
    code: ApiErrorCode,
    body: unknown = null,
  ) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.body = body;
  }
}
export type ApiBinary = { bytes: Uint8Array; mime: string };
export type ApiInit = Omit<RequestInit, "headers" | "signal"> & {
  headers?: Record<string, string>;
  timeoutMs?: number;
  auth?: boolean;
  signal?: AbortSignal;
  responseType?: "json" | "binary";
  maxBytes?: number;
};
/** Todos os serviços e arquivos remotos passam pelo domínio do Worker. */
export function apiUrl(path: string) {
  if (!/^\/api\//.test(path) || path.includes("..") || /[\\#]/.test(path))
    throw new ApiError("Caminho de API inválido.", 0, "config");
  const base = new URL(API_URL);
  if (
    !["https:", "http:"].includes(base.protocol) ||
    base.username ||
    base.password ||
    base.pathname !== "/" ||
    base.search ||
    base.hash
  )
    throw new ApiError("Endereço da API inválido.", 0, "config");
  return `${API_URL}${path}`;
}
function message(body: unknown, status: number) {
  if (body && typeof body === "object")
    for (const key of ["error", "message", "mensagem"]) {
      const value = (body as Record<string, unknown>)[key];
      if (typeof value === "string" && value.trim()) return value;
    }
  return `Falha na requisição (HTTP ${status}).`;
}
export async function apiFetch<T>(
  path: string,
  init: ApiInit = {},
): Promise<T> {
  const {
    headers: custom,
    timeoutMs = 15000,
    auth = true,
    signal,
    responseType = "json",
    maxBytes = 25 * 1024 * 1024,
    ...rest
  } = init;
  const url = apiUrl(path);
  const headers: Record<string, string> = {
    Accept: responseType === "binary" ? "*/*" : "application/json",
    ...custom,
  };
  if (typeof rest.body === "string" && !headers["Content-Type"])
    headers["Content-Type"] = "application/json";
  if (typeof FormData !== "undefined" && rest.body instanceof FormData)
    delete headers["Content-Type"];
  if (auth) {
    const token = await getToken();
    if (!token)
      throw new ApiError(
        "Entre novamente para continuar.",
        401,
        "unauthorized",
      );
    headers.Authorization = `Bearer ${token}`;
  }
  const controller = new AbortController();
  const abort = () => controller.abort();
  signal?.addEventListener("abort", abort, { once: true });
  if (signal?.aborted) abort();
  const timer = setTimeout(abort, timeoutMs);
  try {
    const res = await fetch(url, {
      ...rest,
      headers,
      signal: controller.signal,
      redirect: "error",
    });
    if (res.status === 401 && auth) {
      await notifyUnauthorized();
      throw new ApiError(
        "Sua sessão expirou. Entre novamente.",
        401,
        "unauthorized",
      );
    }
    if (responseType === "binary" && res.ok) {
      if (Number(res.headers.get("content-length")) > maxBytes)
        throw new ApiError("Arquivo acima do limite permitido.", 413, "http");
      const bytes = new Uint8Array(await res.arrayBuffer());
      if (bytes.length > maxBytes)
        throw new ApiError("Arquivo acima do limite permitido.", 413, "http");
      return {
        bytes,
        mime:
          res.headers.get("content-type")?.split(";")[0] ||
          "application/octet-stream",
      } as T;
    }
    const raw = await res.text();
    let body: unknown = null;
    try {
      body = raw ? JSON.parse(raw) : null;
    } catch {
      body = raw;
    }
    if (!res.ok)
      throw new ApiError(message(body, res.status), res.status, "http", body);
    return body as T;
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw new ApiError(
      controller.signal.aborted
        ? "A conexão demorou demais ou foi cancelada."
        : "Sem conexão. Verifique sua rede e tente novamente.",
      0,
      controller.signal.aborted ? "timeout" : "network",
    );
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener("abort", abort);
  }
}
