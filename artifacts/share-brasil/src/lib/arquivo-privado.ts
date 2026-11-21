import { File, FileMode, Paths } from "expo-file-system";
import * as Sharing from "expo-sharing";
import { Platform } from "react-native";
import { apiUrl } from "./api";
import { getToken } from "./session";

const allowed = [
  /^\/api\/financeiro\/relatorios-despesa-viagem\/[^/?]+\/anexos-tripulante\/[^/?]+\/arquivo$/,
  /^\/api\/financeiro\/relatorios-despesa-viagem\/[^/?]+\/pdf$/,
  /^\/api\/colaborador\/documentos\/[^/?]+\/arquivo$/,
  /^\/api\/colaborador\/folha-pagamento\/anexos\?key=financeiro%2Fpagamentos-folha%2F/i,
];

type TipoArquivo = "application/pdf" | "image/jpeg" | "image/png" | "image/webp";
const supported: TipoArquivo[] = ["application/pdf", "image/jpeg", "image/png", "image/webp"];

/** Recebe apenas caminhos privados já autorizados pelo Worker. Nunca usa URL pública nem token em query. */
export async function abrirArquivoPrivado(path: string, title: string, mime: string = "application/pdf"): Promise<void> {
  if (Platform.OS === "web") throw new Error("Abra o documento no aplicativo iOS/Android.");
  if (!allowed.some(pattern => pattern.test(path)) || path.includes("..") || path.includes("#")) {
    throw new Error("Caminho de documento não permitido.");
  }
  if (!supported.includes(mime as TipoArquivo)) throw new Error("Formato do documento não suportado.");
  const token = await getToken();
  if (!token) throw new Error("Sessão expirada. Entre novamente para consultar o documento.");
  if (!await Sharing.isAvailableAsync()) throw new Error("Não há aplicativo disponível para abrir documentos.");
  const extension = mime === "application/pdf" ? "pdf" : mime === "image/png" ? "png" : mime === "image/webp" ? "webp" : "jpg";
  const filename = title.replace(/[^a-zA-Z0-9._-]/g, "-").slice(0, 60) || "documento";
  const file = new File(Paths.cache, `${filename}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${extension}`);
  try {
    await File.downloadFileAsync(apiUrl(path), file, {
      headers: { Authorization: `Bearer ${token}`, Accept: mime },
    });
    if (!file.exists || (file.size ?? 0) < 8) throw new Error("Arquivo indisponível ou vazio.");
    const handle = file.open(FileMode.ReadOnly);
    try {
      const bytes = Array.from(handle.readBytesSync(12));
      const ascii = String.fromCharCode(...bytes);
      const valid = mime === "application/pdf"
        ? ascii.startsWith("%PDF-")
        : mime === "image/jpeg"
          ? bytes[0] === 0xff && bytes[1] === 0xd8
          : mime === "image/png"
            ? bytes.slice(0, 4).join(",") === "137,80,78,71"
            : ascii.startsWith("RIFF") && ascii.slice(8, 12) === "WEBP";
      if (!valid) throw new Error("Resposta inválida. Verifique sua permissão de acesso e tente novamente.");
    } finally { handle.close(); }
    await Sharing.shareAsync(file.uri, { mimeType: mime, UTI: mime === "application/pdf" ? "com.adobe.pdf" : undefined, dialogTitle: title });
  } finally {
    try { if (file.exists) file.delete(); } catch { /* cache gerenciado pelo iOS/Android */ }
  }
}
