import { File, FileMode, Paths } from "expo-file-system";
import * as Sharing from "expo-sharing";
import { Platform } from "react-native";
import { apiUrl } from "./api";
import { getToken } from "./session";

/**
 * Baixa o briefing privado com o Bearer da sessão atual e o entrega ao
 * visualizador/compartilhamento nativo do sistema.
 *
 * Não coloca token em URL, não usa link público nem persiste o PDF em
 * AsyncStorage/Documentos. A cópia temporária é excluída após a interação.
 */
export async function abrirBriefingPdf(vooId: string, versao: number, numeroVoo = ""): Promise<void> {
  if (!vooId.trim()) throw new Error("Voo não identificado.");
  if (!Number.isInteger(versao) || versao < 0) throw new Error("Versão de briefing inválida.");
  if (Platform.OS === "web") throw new Error("Abra o briefing pelo aplicativo no iPhone ou Android.");

  const token = await getToken();
  if (!token) throw new Error("Sua sessão expirou. Entre novamente para consultar o briefing.");
  if (!(await Sharing.isAvailableAsync())) {
    throw new Error("Nenhum visualizador de documentos está disponível neste dispositivo.");
  }

  const nome = numeroVoo.replace(/[^a-zA-Z0-9_-]/g, "-").slice(0, 50) || "voo";
  const caminho = `/api/interno/agendamento/${encodeURIComponent(vooId)}/preparacao/pdf?versao=${versao}`;
  const arquivo = new File(Paths.cache, `briefing-${nome}-v${versao}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.pdf`);

  try {
    await File.downloadFileAsync(apiUrl(caminho), arquivo, {
      headers: { Authorization: `Bearer ${token}`, Accept: "application/pdf" },
    });
    if (!arquivo.exists || (arquivo.size ?? 0) < 10) {
      throw new Error("O servidor não retornou um arquivo PDF válido.");
    }

    // Uma resposta JSON/HTML (por exemplo 401 ou 503) nunca deve ser
    // aberta como PDF mesmo se um cliente de download a salvar no cache.
    const leitor = arquivo.open(FileMode.ReadOnly);
    try {
      const assinatura = leitor.readBytesSync(5);
      if (assinatura.length !== 5 || String.fromCharCode(...assinatura) !== "%PDF-") {
        throw new Error("Não foi possível obter o PDF. Confirme seu acesso ao voo e tente novamente.");
      }
    } finally {
      leitor.close();
    }

    await Sharing.shareAsync(arquivo.uri, {
      mimeType: "application/pdf",
      UTI: "com.adobe.pdf",
      dialogTitle: `Briefing do voo ${numeroVoo || "selecionado"}`,
    });
  } finally {
    try { if (arquivo.exists) arquivo.delete(); } catch {
      // O sistema pode manter o arquivo aberto durante a entrega a outro app.
      // O diretório de cache é administrado pelo sistema operacional.
    }
  }
}
