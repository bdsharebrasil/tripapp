import { abrirArquivoPrivado } from "./arquivo-privado";
export async function abrirBriefingPdf(
  vooId: string,
  versao: number,
  numeroVoo = "",
): Promise<void> {
  if (!vooId.trim()) throw new Error("Voo não identificado.");
  if (!Number.isInteger(versao) || versao < 0)
    throw new Error("Versão de briefing inválida.");
  await abrirArquivoPrivado(
    `/api/interno/agendamento/${encodeURIComponent(vooId)}/preparacao/pdf?versao=${versao}`,
    `Briefing-${numeroVoo || vooId}`,
    "application/pdf",
  );
}
