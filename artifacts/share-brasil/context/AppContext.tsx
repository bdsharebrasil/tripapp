import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { createContext, useCallback, useContext, useEffect, useState } from "react";

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

const STORAGE_KEYS = {
  profile: "@sharebrasil:profile",
  flights: "@sharebrasil:flights",
  flightPlans: "@sharebrasil:flightPlans",
  travelReports: "@sharebrasil:travelReports",
  maintenanceReports: "@sharebrasil:maintenance",
  vacationRequests: "@sharebrasil:vacations",
  financialEntries: "@sharebrasil:financial",
};

const DEMO_PROFILE: UserProfile = {
  id: "1",
  nome: "Carlos Eduardo Silva",
  cargo: "Comandante",
  canac: "2345678",
  cma: "2º Classe",
  cmaValidade: "2025-12-31",
  cmaClasse: "2ª Classe",
  tipoSanguineo: "O+",
  habilitacoes: ["ATPL-A", "IR-A", "PH", "BI"],
  email: "carlos.silva@sharebrasil.com.br",
  telefone: "(11) 99876-5432",
  horasAcumuladas: 4850,
  feriasDisponivel: 28,
};

const genId = () => Date.now().toString() + Math.random().toString(36).substr(2, 9);

const DEMO_FLIGHTS: FlightEntry[] = [
  {
    id: "f1",
    data: "2026-06-01",
    aeronave: "Citation CJ3+",
    matricula: "PS-SBR",
    partida: "SBGR",
    chegada: "SBBR",
    trecho: "GRU-BSB",
    horaDecolagem: "08:15",
    horaPouso: "10:05",
    tempoVoo: 1.83,
    horasDiurnas: 1.83,
    horasNoturnas: 0,
    pousos: 1,
    naturezaVoo: "EX - Executivo",
    picCanac: "2345678",
    sicCanac: "3456789",
    cliente: "Grupo Alpha S.A.",
    observacoes: "",
    confirmado: true,
    assinado: true,
    combustivelInicio: 2400,
    combustivelFim: 1850,
  },
  {
    id: "f2",
    data: "2026-05-28",
    aeronave: "Citation CJ3+",
    matricula: "PS-SBR",
    partida: "SBBR",
    chegada: "SBCF",
    trecho: "BSB-CNF",
    horaDecolagem: "14:30",
    horaPouso: "16:10",
    tempoVoo: 1.67,
    horasDiurnas: 1.67,
    horasNoturnas: 0,
    pousos: 1,
    naturezaVoo: "EX - Executivo",
    picCanac: "2345678",
    sicCanac: "",
    cliente: "Beta Participações",
    observacoes: "Voo sem copiloto",
    confirmado: true,
    assinado: true,
    combustivelInicio: 2200,
    combustivelFim: 1700,
  },
  {
    id: "f3",
    data: "2026-05-25",
    aeronave: "King Air B200",
    matricula: "PT-SBK",
    partida: "SBSP",
    chegada: "SBFL",
    trecho: "CGH-FLN",
    horaDecolagem: "09:00",
    horaPouso: "11:30",
    tempoVoo: 2.5,
    horasDiurnas: 2.5,
    horasNoturnas: 0,
    pousos: 1,
    naturezaVoo: "EX - Executivo",
    picCanac: "2345678",
    sicCanac: "4567890",
    cliente: "Gamma Investimentos",
    observacoes: "",
    confirmado: true,
    assinado: false,
    combustivelInicio: 3200,
    combustivelFim: 2100,
  },
];

const DEMO_TRAVEL_REPORTS: TravelReport[] = [
  {
    id: "tr1",
    numero: "R-2026-042",
    data: "2026-06-01",
    rota: "GRU-BSB-GRU",
    aeronave: "PS-SBR",
    dataInicio: "2026-06-01",
    dataFim: "2026-06-02",
    dias: 2,
    combustivel: 850.0,
    hospedagem: 380.0,
    alimentacao: 120.0,
    transporte: 75.0,
    outros: 45.0,
    total: 1470.0,
    status: "enviado",
    observacoes: "Pernoite em Brasília",
  },
  {
    id: "tr2",
    numero: "R-2026-038",
    data: "2026-05-25",
    rota: "CGH-FLN-CGH",
    aeronave: "PT-SBK",
    dataInicio: "2026-05-25",
    dataFim: "2026-05-26",
    dias: 2,
    combustivel: 1200.0,
    hospedagem: 450.0,
    alimentacao: 180.0,
    transporte: 60.0,
    outros: 0,
    total: 1890.0,
    status: "aprovado",
    observacoes: "",
  },
  {
    id: "tr3",
    numero: "R-2026-031",
    data: "2026-05-15",
    rota: "GRU-REC-GRU",
    aeronave: "PS-SBR",
    dataInicio: "2026-05-15",
    dataFim: "2026-05-16",
    dias: 2,
    combustivel: 1600.0,
    hospedagem: 520.0,
    alimentacao: 210.0,
    transporte: 90.0,
    outros: 30.0,
    total: 2450.0,
    status: "devolvido",
    observacoes: "",
    motivoDevolucao: "Comprovante de hospedagem ilegível. Favor substituir.",
  },
];

const DEMO_MAINTENANCE: MaintenanceReport[] = [
  {
    id: "m1",
    data: "2026-05-30",
    aeronave: "Citation CJ3+",
    matricula: "PS-SBR",
    tipo: "Avaria",
    descricao: "Luz indicadora do painel esquerdo piscando intermitentemente após o voo GRU-BSB.",
    local: "SBGR",
    prioridade: "media",
    status: "em_andamento",
    criadoEm: "2026-05-30T18:30:00",
  },
  {
    id: "m2",
    data: "2026-05-20",
    aeronave: "King Air B200",
    matricula: "PT-SBK",
    tipo: "Manutenção Preventiva",
    descricao: "Revisão dos freios traseiros. Pastilhas desgastadas além do limite.",
    local: "SBSP",
    prioridade: "alta",
    status: "resolvido",
    resolucao: "Pastilhas substituídas pela oficina credenciada em 23/05.",
    criadoEm: "2026-05-20T09:00:00",
  },
];

const DEMO_VACATIONS: VacationRequest[] = [
  {
    id: "v1",
    dataInicio: "2026-07-14",
    dataFim: "2026-07-28",
    dias: 15,
    tipo: "Férias Programadas",
    motivo: "Período aprovado em planejamento anual",
    status: "aprovada",
    criadoEm: "2026-04-10T10:00:00",
    solicitadoEm: "2026-04-10T10:00:00",
    observacoesGestor: "Aprovado. Boas férias!",
  },
  {
    id: "v2",
    dataInicio: "2026-09-01",
    dataFim: "2026-09-05",
    dias: 5,
    tipo: "Folga Compensatória",
    motivo: "Compensação de horas extras do mês de agosto",
    status: "solicitada",
    criadoEm: "2026-06-01T08:00:00",
    solicitadoEm: "2026-06-01T08:00:00",
  },
];

const DEMO_FINANCIAL: FinancialEntry[] = [
  {
    id: "fin1",
    data: "2026-06-05",
    tipo: "salario",
    descricao: "Salário Junho/2026",
    valor: 18500.0,
    status: "pendente",
    periodo: "Junho/2026",
  },
  {
    id: "fin2",
    data: "2026-05-05",
    tipo: "salario",
    descricao: "Salário Maio/2026",
    valor: 18500.0,
    status: "pago",
    periodo: "Maio/2026",
  },
  {
    id: "fin3",
    data: "2026-05-20",
    tipo: "ressarcimento",
    descricao: "Ressarcimento R-2026-038 (FLN)",
    valor: 1890.0,
    status: "pago",
    referencia: "R-2026-038",
  },
  {
    id: "fin4",
    data: "2026-04-05",
    tipo: "salario",
    descricao: "Salário Abril/2026",
    valor: 18500.0,
    status: "pago",
    periodo: "Abril/2026",
  },
  {
    id: "fin5",
    data: "2026-04-10",
    tipo: "diaria",
    descricao: "Diárias – Viagem REC",
    valor: 420.0,
    status: "pago",
    referencia: "R-2026-031",
  },
  {
    id: "fin6",
    data: "2026-05-25",
    tipo: "ressarcimento",
    descricao: "Ressarcimento R-2026-042 (BSB) – Pendente",
    valor: 1470.0,
    status: "pendente",
    referencia: "R-2026-042",
  },
];

const DEMO_FLIGHT_PLANS: FlightPlan[] = [
  {
    id: "fp1",
    data: "2026-06-05",
    partida: "SBGR",
    chegada: "SBCT",
    trecho: "GRU-CWB",
    aeronave: "Citation CJ3+",
    matricula: "PS-SBR",
    horaPrevista: "10:00",
    estimativaVoo: "01:20",
    combustivelPrevisto: 1800,
    alternates: "SBBI",
    passageiros: 4,
    peso: 8500,
    piloto: "Carlos Eduardo Silva",
    copiloto: "Marcos Ferreira",
    observacoes: "Check-in passageiros 09:30",
    condicoes: "VMC",
    status: "aprovado",
    criadoEm: "2026-06-03T14:00:00",
  },
];

const AppContext = createContext<AppContextType | null>(null);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AppState>({
    profile: DEMO_PROFILE,
    flights: DEMO_FLIGHTS,
    flightPlans: DEMO_FLIGHT_PLANS,
    travelReports: DEMO_TRAVEL_REPORTS,
    maintenanceReports: DEMO_MAINTENANCE,
    vacationRequests: DEMO_VACATIONS,
    financialEntries: DEMO_FINANCIAL,
    loading: true,
  });

  useEffect(() => {
    const load = async () => {
      try {
        const [profile, flights, plans, reports, maint, vacs, fin] = await Promise.all([
          AsyncStorage.getItem(STORAGE_KEYS.profile),
          AsyncStorage.getItem(STORAGE_KEYS.flights),
          AsyncStorage.getItem(STORAGE_KEYS.flightPlans),
          AsyncStorage.getItem(STORAGE_KEYS.travelReports),
          AsyncStorage.getItem(STORAGE_KEYS.maintenanceReports),
          AsyncStorage.getItem(STORAGE_KEYS.vacationRequests),
          AsyncStorage.getItem(STORAGE_KEYS.financialEntries),
        ]);
        setState((prev) => ({
          ...prev,
          profile: profile ? JSON.parse(profile) : DEMO_PROFILE,
          flights: flights ? JSON.parse(flights) : DEMO_FLIGHTS,
          flightPlans: plans ? JSON.parse(plans) : DEMO_FLIGHT_PLANS,
          travelReports: reports ? JSON.parse(reports) : DEMO_TRAVEL_REPORTS,
          maintenanceReports: maint ? JSON.parse(maint) : DEMO_MAINTENANCE,
          vacationRequests: vacs ? JSON.parse(vacs) : DEMO_VACATIONS,
          financialEntries: fin ? JSON.parse(fin) : DEMO_FINANCIAL,
          loading: false,
        }));
      } catch {
        setState((prev) => ({ ...prev, loading: false }));
      }
    };
    load();
  }, []);

  const save = useCallback(async (key: string, data: unknown) => {
    await AsyncStorage.setItem(key, JSON.stringify(data));
  }, []);

  const updateProfile = useCallback(async (profile: UserProfile) => {
    setState((prev) => ({ ...prev, profile }));
    await save(STORAGE_KEYS.profile, profile);
  }, [save]);

  const addFlight = useCallback(async (flight: Omit<FlightEntry, "id">) => {
    const newFlight = { ...flight, id: genId() };
    setState((prev) => {
      const updated = [newFlight, ...prev.flights];
      save(STORAGE_KEYS.flights, updated);
      return { ...prev, flights: updated };
    });
  }, [save]);

  const updateFlight = useCallback(async (id: string, data: Partial<FlightEntry>) => {
    setState((prev) => {
      const updated = prev.flights.map((f) => (f.id === id ? { ...f, ...data } : f));
      save(STORAGE_KEYS.flights, updated);
      return { ...prev, flights: updated };
    });
  }, [save]);

  const deleteFlight = useCallback(async (id: string) => {
    setState((prev) => {
      const updated = prev.flights.filter((f) => f.id !== id);
      save(STORAGE_KEYS.flights, updated);
      return { ...prev, flights: updated };
    });
  }, [save]);

  const addFlightPlan = useCallback(async (plan: Omit<FlightPlan, "id" | "criadoEm">) => {
    const newPlan = { ...plan, id: genId(), criadoEm: new Date().toISOString() };
    setState((prev) => {
      const updated = [newPlan, ...prev.flightPlans];
      save(STORAGE_KEYS.flightPlans, updated);
      return { ...prev, flightPlans: updated };
    });
  }, [save]);

  const updateFlightPlan = useCallback(async (id: string, data: Partial<FlightPlan>) => {
    setState((prev) => {
      const updated = prev.flightPlans.map((p) => (p.id === id ? { ...p, ...data } : p));
      save(STORAGE_KEYS.flightPlans, updated);
      return { ...prev, flightPlans: updated };
    });
  }, [save]);

  const deleteFlightPlan = useCallback(async (id: string) => {
    setState((prev) => {
      const updated = prev.flightPlans.filter((p) => p.id !== id);
      save(STORAGE_KEYS.flightPlans, updated);
      return { ...prev, flightPlans: updated };
    });
  }, [save]);

  const addTravelReport = useCallback(async (report: Omit<TravelReport, "id">) => {
    const newReport = { ...report, id: genId() };
    setState((prev) => {
      const updated = [newReport, ...prev.travelReports];
      save(STORAGE_KEYS.travelReports, updated);
      return { ...prev, travelReports: updated };
    });
  }, [save]);

  const updateTravelReport = useCallback(async (id: string, data: Partial<TravelReport>) => {
    setState((prev) => {
      const updated = prev.travelReports.map((r) => (r.id === id ? { ...r, ...data } : r));
      save(STORAGE_KEYS.travelReports, updated);
      return { ...prev, travelReports: updated };
    });
  }, [save]);

  const deleteTravelReport = useCallback(async (id: string) => {
    setState((prev) => {
      const updated = prev.travelReports.filter((r) => r.id !== id);
      save(STORAGE_KEYS.travelReports, updated);
      return { ...prev, travelReports: updated };
    });
  }, [save]);

  const addMaintenanceReport = useCallback(async (report: Omit<MaintenanceReport, "id" | "criadoEm">) => {
    const newReport = { ...report, id: genId(), criadoEm: new Date().toISOString() };
    setState((prev) => {
      const updated = [newReport, ...prev.maintenanceReports];
      save(STORAGE_KEYS.maintenanceReports, updated);
      return { ...prev, maintenanceReports: updated };
    });
  }, [save]);

  const updateMaintenanceReport = useCallback(async (id: string, data: Partial<MaintenanceReport>) => {
    setState((prev) => {
      const updated = prev.maintenanceReports.map((m) => (m.id === id ? { ...m, ...data } : m));
      save(STORAGE_KEYS.maintenanceReports, updated);
      return { ...prev, maintenanceReports: updated };
    });
  }, [save]);

  const addVacationRequest = useCallback(async (req: Omit<VacationRequest, "id" | "criadoEm" | "solicitadoEm">) => {
    const now = new Date().toISOString();
    const newReq = { ...req, id: genId(), criadoEm: now, solicitadoEm: now };
    setState((prev) => {
      const updated = [newReq, ...prev.vacationRequests];
      save(STORAGE_KEYS.vacationRequests, updated);
      return { ...prev, vacationRequests: updated };
    });
  }, [save]);

  const updateVacationRequest = useCallback(async (id: string, data: Partial<VacationRequest>) => {
    setState((prev) => {
      const updated = prev.vacationRequests.map((v) => (v.id === id ? { ...v, ...data } : v));
      save(STORAGE_KEYS.vacationRequests, updated);
      return { ...prev, vacationRequests: updated };
    });
  }, [save]);

  return (
    <AppContext.Provider
      value={{
        ...state,
        updateProfile,
        addFlight,
        updateFlight,
        deleteFlight,
        addFlightPlan,
        updateFlightPlan,
        deleteFlightPlan,
        addTravelReport,
        updateTravelReport,
        deleteTravelReport,
        addMaintenanceReport,
        updateMaintenanceReport,
        addVacationRequest,
        updateVacationRequest,
      }}
    >
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp must be used within AppProvider");
  return ctx;
}
