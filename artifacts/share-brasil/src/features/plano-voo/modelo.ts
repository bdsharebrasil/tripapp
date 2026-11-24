import { useColors } from "@/hooks/useColors";
import { apiFetch } from "@/src/lib/api";

export type Cores = ReturnType<typeof useColors>;
export type StatusPlano = "rascunho" | "enviado" | "aprovado" | "cancelado";

export type NovoPlano = {
  partida: string;
  chegada: string;
  trecho: string;
  data: string;
  aeronave: string;
  matricula: string;
  horaPrevista: string;
  estimativaVoo: string;
  combustivelPrevisto: number;
  alternates: string;
  passageiros: number;
  peso: number;
  piloto: string;
  copiloto: string;
  observacoes: string;
  condicoes: string;
  status: StatusPlano;
};
export type PlanoVoo = NovoPlano & { id: string };

export type PlanoRegistro = {
  id: string;
  numero_voo: string;
  adep: string;
  ades: string;
  data_voo: string;
  eobt: string;
  created_at: string;
  payload: { form?: Partial<NovoPlano> } | null;
};

export type FormularioPlano = {
  partida: string;
  chegada: string;
  trecho: string;
  data: string;
  aeronave: string;
  matricula: string;
  horaPrevista: string;
  estimativaVoo: string;
  combustivelPrevisto: string;
  alternates: string;
  passageiros: string;
  peso: string;
  piloto: string;
  copiloto: string;
  observacoes: string;
  condicoes: string;
};

export type Clima = { metar?: string; taf?: string; error?: string };
export type Ponto = { icao: string; name: string; lat: number; lon: number };
export type PlanoRota = {
  flightplan?: {
    route?: string;
    distance_nm?: number;
    estimated_time?: string;
  };
  fuel?: { total_required?: number };
  departure?: Ponto;
  destination?: Ponto;
  alternates?: { icao: string; name: string; distance_km: number }[];
  error?: string;
};

export type VooSolicitacao = {
  solicitacao_id?: string | number;
  id?: string | number;
  numero_voo: string;
  origem?: string;
  destino?: string;
  data_agendada?: string;
  matricula?: string;
};

export const ICAO = /^[A-Z]{4}$/;
export const CONDICOES = ["VMC", "IMC", "IFR", "VFR"];
export const STATUS_CONFIG: Record<
  StatusPlano,
  { label: string; color: string }
> = {
  rascunho: { label: "Rascunho", color: "#94A3B8" },
  enviado: { label: "Enviado", color: "#F59E0B" },
  aprovado: { label: "Aprovado", color: "#22C55E" },
  cancelado: { label: "Cancelado", color: "#EF4444" },
};

export const hoje = () => new Date().toISOString().split("T")[0];
export const criarFormulario = (): FormularioPlano => ({
  partida: "",
  chegada: "",
  trecho: "",
  data: hoje(),
  aeronave: "Citation CJ3+",
  matricula: "PS-SBR",
  horaPrevista: "",
  estimativaVoo: "",
  combustivelPrevisto: "",
  alternates: "",
  passageiros: "0",
  peso: "",
  piloto: "",
  copiloto: "",
  observacoes: "",
  condicoes: "VMC",
});

export const buscarClima = (icao: string) =>
  apiFetch<Clima>(`/api/v1/weather/${encodeURIComponent(icao)}`);
export const buscarRota = (adep: string, ades: string) =>
  apiFetch<PlanoRota>(
    `/api/v1/flightplan?adep=${encodeURIComponent(adep)}&ades=${encodeURIComponent(ades)}`,
  );

export const mensagemErro = (e: unknown) =>
  e instanceof Error ? e.message : "Tente novamente.";

export function corMetar(metar?: string) {
  if (!metar) return "#6B7280";
  const u = metar.toUpperCase();
  if (u.includes("TS") || u.includes("FG") || u.includes("//"))
    return "#DC2626";
  if (u.includes("OVC") || u.includes("BKN0") || u.includes("SCT0"))
    return "#D97706";
  return "#16A34A";
}

export function formatarData(dateStr: string) {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export function paraPlano(r: PlanoRegistro): PlanoVoo {
  const f: Partial<NovoPlano> = r.payload?.form ?? {};
  return {
    id: r.id,
    partida: r.adep,
    chegada: r.ades,
    trecho: f.trecho ?? `${r.adep}-${r.ades}`,
    data: r.data_voo,
    aeronave: f.aeronave ?? "",
    matricula: f.matricula ?? r.numero_voo,
    horaPrevista: f.horaPrevista ?? r.eobt,
    estimativaVoo: f.estimativaVoo ?? "",
    combustivelPrevisto: f.combustivelPrevisto ?? 0,
    alternates: f.alternates ?? "",
    passageiros: f.passageiros ?? 0,
    peso: f.peso ?? 0,
    piloto: f.piloto ?? "",
    copiloto: f.copiloto ?? "",
    observacoes: f.observacoes ?? "",
    condicoes: f.condicoes ?? "VMC",
    status: f.status ?? "rascunho",
  };
}

export function paraRegistro(p: NovoPlano) {
  return {
    numero_voo: p.matricula || p.trecho,
    adep: p.partida,
    ades: p.chegada,
    data_voo: p.data,
    eobt: p.horaPrevista,
    form: p,
    contexto: null,
    rota: null,
    segmentos: [],
    distancia_total_nm: null,
    salvo_em: new Date().toISOString(),
  };
}
