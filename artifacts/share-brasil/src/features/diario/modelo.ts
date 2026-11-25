export const API_DIARIO = "/api/interno/diario-bordo";
export const naturezas = [
  "EX - Executivo",
  "AE - Aérea/Regular",
  "NR - Não Remunerado",
  "RE - Retorno/Reposição",
  "PV - Privado",
  "TR - Traslado",
  "SA - Serviço Aéreo",
  "TN - Táxi Aéreo",
  "VT - Voo Teste",
];

export type ModoCelula = "tvoo" | "tempo_total";
type Leitura = {
  modo_celula?: ModoCelula;
} & Partial<
  Record<
    `celula_${"anterior" | "atual" | "prox_revisao" | "disponivel"}_${"ttotal" | "tvoo"}`,
    number | null
  >
>;

export type AeronaveDiario = Leitura & {
  id: string;
  matricula_registro: string;
  modelo?: string;
  fabricante?: string;
  image_url?: string | null;
  mes_referencia?: number;
};
export type MesDiario = Leitura & {
  id: string;
  ano: number;
  mes: number;
  fechado: number;
};
export type DiarioMensalResposta = {
  aeronave: AeronaveDiario;
  diario_mes: MesDiario | null;
  meses_disponiveis: MesDiario[];
  lancamentos: {
    id: string;
    numero_sequencial: number;
    data_registro: string;
    aerodromo_partida_icao: string;
    aerodromo_chegada_icao: string;
    tempo_ac: string;
    tempo_dep: string;
    tempo_pou: string;
    tempo_cor: string;
    tempo_voo: number;
    tempo_total: number;
    pic_nome_exibicao?: string;
    pic_canac?: string;
    sic_nome_exibicao?: string;
    sic_canac?: string;
    numero_voo?: string;
    natureza_voo?: string;
    confirmado?: number;
    assinado_pic?: string;
  }[];
};

export function leitura(
  dados: Leitura | undefined,
  campo: "anterior" | "atual" | "prox_revisao" | "disponivel",
) {
  const sufixo = dados?.modo_celula === "tvoo" ? "tvoo" : "ttotal";
  if (
    (campo === "prox_revisao" || campo === "disponivel") &&
    !(Number(dados?.[`celula_prox_revisao_${sufixo}`]) > 0)
  )
    return null;
  return dados?.[`celula_${campo}_${sufixo}`] ?? null;
}

export function horasDecimais(valor?: number | null) {
  if (valor == null || !Number.isFinite(valor)) return "—";
  const minutos = Math.round(Math.abs(valor) * 60);
  return `${valor < 0 ? "−" : ""}${Math.floor(minutos / 60)}h ${String(minutos % 60).padStart(2, "0")}m`;
}

export function dataValida(data: string) {
  const instante = Date.parse(data);
  return (
    /^\d{4}-\d{2}-\d{2}$/.test(data) &&
    Number.isFinite(instante) &&
    new Date(instante).toISOString().slice(0, 10) === data
  );
}
export const horaValida = (hora: string) =>
  /^([01]\d|2[0-3]):[0-5]\d$/.test(hora);

// Os quatro horários são UTC e podem cruzar uma meia-noite.
export function minutosOperacao(horarios: string[]) {
  if (horarios.length !== 4 || !horarios.every(horaValida)) return null;
  const minutos = horarios.map(
    (h) => Number(h.slice(0, 2)) * 60 + Number(h.slice(3)),
  );
  const duracao = (i: number) => (minutos[i] - minutos[i - 1] + 1440) % 1440;
  const voo = duracao(2);
  const total = duracao(1) + voo + duracao(3);
  return voo > 0 && total < 1440 ? { voo, total } : null;
}
