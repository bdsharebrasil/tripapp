export type Perfil = {
  id: string;
  nome_completo?: string;
  nome_exibicao?: string;
  email?: string;
  email_envio?: string;
  foto_url?: string | null;
  telefone?: string;
  canac?: string;
  tipo_user?: string;
  departamento?: string;
  data_admissao?: string;
  data_nascimento?: string;
  cidade?: string;
  uf?: string;
};
export type Credencial = {
  id: string;
  tipo_habilitacao: string;
  data_validade: string | null;
};
export type PerfilCompleto = {
  perfil: Perfil;
  metricas: {
    horas_totais?: number;
    voos_escalados?: number;
    ctm_abertos?: number;
  };
  tripulante?: { tipo_licenca?: string; canac?: string };
  habilitacoes?: Credencial[];
  cma?: { id: string; classe: string | null; validade: string | null } | null;
  resumo_ferias?: {
    dias_direito: number;
    dias_utilizados: number;
    dias_disponiveis: number;
  };
  ferias?: {
    id: string;
    data_inicio: string;
    data_fim: string;
    status: string;
  }[];
};
export const dataBr = (valor?: string | null) =>
  valor ? valor.slice(0, 10).split("-").reverse().join("/") : "—";
export const hoje = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
export const moeda = (valor: number) =>
  valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
export function situacaoValidade(data?: string | null) {
  if (!data) return "Sem validade informada";
  return data.slice(0, 10) < hoje() ? "Vencido" : "Válido";
}
