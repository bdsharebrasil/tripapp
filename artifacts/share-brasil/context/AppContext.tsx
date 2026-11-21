import React, { createContext, useContext, useEffect, useState } from "react";
import { supabase } from "@/src/lib/supabase";

export interface UserProfile {
  id: string;
  nome: string;
  cargo: string;
  canac: string;
  cma: string;
  cmaValidade: string;
  cmaClasse: string;
  tipoSanguineo: string;
  habilitacoes: string[];
  email: string;
  telefone: string;
  horasAcumuladas: number;
  feriasDisponivel: number;
}

export interface FlightEntry {
  id: string;
  data: string;
  aeronave: string;
  matricula: string;
  partida: string;
  chegada: string;
  trecho: string;
  horaDecolagem: string;
  horaPouso: string;
  tempoVoo: number;
  horasDiurnas: number;
  horasNoturnas: number;
  pousos: number;
  naturezaVoo: string;
  picCanac: string;
  sicCanac: string;
  cliente: string;
  observacoes: string;
  confirmado: boolean;
  assinado: boolean;
  combustivelInicio: number;
  combustivelFim: number;
}

export interface FlightPlan {
  id: string;
  data: string;
  partida: string;
  chegada: string;
  trecho: string;
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
  status: "rascunho" | "enviado" | "aprovado" | "cancelado";
  criadoEm: string;
}

export interface TravelReport {
  id: string;
  numero: string;
  data: string;
  rota: string;
  aeronave: string;
  dataInicio: string;
  dataFim: string;
  dias: number;
  combustivel: number;
  hospedagem: number;
  alimentacao: number;
  transporte: number;
  outros: number;
  total: number;
  status: "rascunho" | "enviado" | "aprovado" | "devolvido";
  observacoes: string;
  motivoDevolucao?: string;
}

export interface MaintenanceReport {
  id: string;
  data: string;
  aeronave: string;
  matricula: string;
  tipo: string;
  descricao: string;
  local: string;
  prioridade: "baixa" | "media" | "alta" | "critica";
  status: "aberto" | "em_andamento" | "resolvido";
  resolucao?: string;
  criadoEm: string;
}

export interface VacationRequest {
  id: string;
  dataInicio: string;
  dataFim: string;
  dias: number;
  tipo: string;
  motivo?: string;
  status: "solicitada" | "aprovada" | "recusada" | "cancelada";
  criadoEm: string;
  solicitadoEm: string;
  observacoesGestor?: string;
}

export interface FinancialEntry {
  id: string;
  data: string;
  tipo: "salario" | "ressarcimento" | "diaria" | "bonus";
  descricao: string;
  valor: number;
  status: "pago" | "pendente";
  referencia?: string;
  periodo?: string;
}

interface AppState {
  profile: UserProfile;
  flights: FlightEntry[];
  flightPlans: FlightPlan[];
  travelReports: TravelReport[];
  maintenanceReports: MaintenanceReport[];
  vacationRequests: VacationRequest[];
  financialEntries: FinancialEntry[];
  loading: boolean;
}

interface AppContextType extends AppState {
  updateProfile: (profile: UserProfile) => Promise<void>;
  addFlight: (flight: Omit<FlightEntry, "id">) => Promise<void>;
  updateFlight: (id: string, flight: Partial<FlightEntry>) => Promise<void>;
  deleteFlight: (id: string) => Promise<void>;
  addFlightPlan: (plan: Omit<FlightPlan, "id" | "criadoEm">) => Promise<void>;
  updateFlightPlan: (id: string, plan: Partial<FlightPlan>) => Promise<void>;
  deleteFlightPlan: (id: string) => Promise<void>;
  addTravelReport: (report: Omit<TravelReport, "id">) => Promise<void>;
  updateTravelReport: (id: string, report: Partial<TravelReport>) => Promise<void>;
  deleteTravelReport: (id: string) => Promise<void>;
  addMaintenanceReport: (report: Omit<MaintenanceReport, "id" | "criadoEm">) => Promise<void>;
  updateMaintenanceReport: (id: string, report: Partial<MaintenanceReport>) => Promise<void>;
  addVacationRequest: (req: Omit<VacationRequest, "id" | "criadoEm" | "solicitadoEm">) => Promise<void>;
  updateVacationRequest: (id: string, req: Partial<VacationRequest>) => Promise<void>;
}

/** Sem dados fictícios: a identidade é obtida da sessão autenticada. */
const EMPTY_PROFILE: UserProfile = {
  id: "", nome: "", cargo: "", canac: "", cma: "", cmaValidade: "",
  cmaClasse: "", tipoSanguineo: "", habilitacoes: [], email: "",
  telefone: "", horasAcumuladas: 0, feriasDisponivel: 0,
};

const unavailable = async (): Promise<never> => {
  throw new Error("Esta operação ainda não está conectada ao Worker. Nenhum dado foi salvo.");
};

const AppContext = createContext<AppContextType | null>(null);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AppState>({
    profile: EMPTY_PROFILE, flights: [], flightPlans: [], travelReports: [],
    maintenanceReports: [], vacationRequests: [], financialEntries: [], loading: true,
  });

  useEffect(() => {
    let mounted = true;
    const refresh = async () => {
      const { data } = await supabase.auth.getUser();
      if (!mounted) return;
      const user = data.user;
      const meta = user?.user_metadata || {};
      setState(prev => ({
        ...prev,
        profile: {
          ...EMPTY_PROFILE,
          id: user?.id || "",
          email: user?.email || "",
          nome: String(meta.nome_completo || meta.nome || meta.full_name || ""),
          cargo: String(meta.cargo || ""),
          canac: String(meta.canac || ""),
        },
        loading: false,
      }));
    };
    void refresh().catch(() => { if (mounted) setState(prev => ({ ...prev, loading: false })); });
    const { data: listener } = supabase.auth.onAuthStateChange(() => { void refresh(); });
    return () => { mounted = false; listener.subscription.unsubscribe(); };
  }, []);

  return <AppContext.Provider value={{
    ...state,
    updateProfile: unavailable, addFlight: unavailable, updateFlight: unavailable,
    deleteFlight: unavailable, addFlightPlan: unavailable, updateFlightPlan: unavailable,
    deleteFlightPlan: unavailable, addTravelReport: unavailable, updateTravelReport: unavailable,
    deleteTravelReport: unavailable, addMaintenanceReport: unavailable,
    updateMaintenanceReport: unavailable, addVacationRequest: unavailable,
    updateVacationRequest: unavailable,
  }}>{children}</AppContext.Provider>;
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp must be used within AppProvider");
  return ctx;
}
