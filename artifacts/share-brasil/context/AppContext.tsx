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
  id: "c0b10d9a-03e5-4778-8c4c-a4c0499ca0f7",
  nome: "ROLFFE ERBE",
  cargo: "Comandante",
  canac: "130042",
  cma: "—",
  cmaValidade: "2025-06-30",
  cmaClasse: "1ª Classe",
  tipoSanguineo: "—",
  habilitacoes: ["LR20"],
  email: "rolffe.erbe@sharebrasil.com.br",
  telefone: "(65) 98146-7766",
  horasAcumuladas: 3240,
  feriasDisponivel: 20,
};

const genId = () => Date.now().toString() + Math.random().toString(36).substr(2, 9);

const DEMO_FLIGHTS: FlightEntry[] = [
  {
    id: "f1",
    data: "2026-04-19",
    aeronave: "PT-WSR",
    matricula: "PT-WSR",
    partida: "SBGO",
    chegada: "SWBF",
    trecho: "GYN-BOM FUTURO",
    horaDecolagem: "14:10",
    horaPouso: "16:05",
    tempoVoo: 1.92,
    horasDiurnas: 1.92,
    horasNoturnas: 0,
    pousos: 1,
    naturezaVoo: "EX - Executivo",
    picCanac: "130042",
    sicCanac: "",
    cliente: "Share Brasil",
    observacoes: "Retorno – relatório REL-GRF-008/26",
    confirmado: true,
    assinado: true,
    combustivelInicio: 1800,
    combustivelFim: 1350,
  },
  {
    id: "f2",
    data: "2026-04-17",
    aeronave: "PT-WSR",
    matricula: "PT-WSR",
    partida: "SWBF",
    chegada: "SBGO",
    trecho: "BOM FUTURO-GYN",
    horaDecolagem: "08:30",
    horaPouso: "10:25",
    tempoVoo: 1.92,
    horasDiurnas: 1.92,
    horasNoturnas: 0,
    pousos: 1,
    naturezaVoo: "EX - Executivo",
    picCanac: "130042",
    sicCanac: "",
    cliente: "Share Brasil",
    observacoes: "Pernoite em Goiânia – relatório REL-GRF-008/26",
    confirmado: true,
    assinado: true,
    combustivelInicio: 2100,
    combustivelFim: 1650,
  },
  {
    id: "f3",
    data: "2026-03-22",
    aeronave: "PT-WSR",
    matricula: "PT-WSR",
    partida: "SBCY",
    chegada: "SBBR",
    trecho: "CGB-BSB",
    horaDecolagem: "09:00",
    horaPouso: "10:40",
    tempoVoo: 1.67,
    horasDiurnas: 1.67,
    horasNoturnas: 0,
    pousos: 1,
    naturezaVoo: "EX - Executivo",
    picCanac: "130042",
    sicCanac: "",
    cliente: "Share Brasil",
    observacoes: "",
    confirmado: true,
    assinado: true,
    combustivelInicio: 2000,
    combustivelFim: 1520,
  },
  {
    id: "f4",
    data: "2026-03-20",
    aeronave: "PT-WSR",
    matricula: "PT-WSR",
    partida: "SBBR",
    chegada: "SBCY",
    trecho: "BSB-CGB",
    horaDecolagem: "16:45",
    horaPouso: "18:30",
    tempoVoo: 1.75,
    horasDiurnas: 1.0,
    horasNoturnas: 0.75,
    pousos: 1,
    naturezaVoo: "EX - Executivo",
    picCanac: "130042",
    sicCanac: "",
    cliente: "Share Brasil",
    observacoes: "Chegada após pôr do sol",
    confirmado: true,
    assinado: true,
    combustivelInicio: 2050,
    combustivelFim: 1580,
  },
  {
    id: "f5",
    data: "2026-02-14",
    aeronave: "PT-WSR",
    matricula: "PT-WSR",
    partida: "SBCY",
    chegada: "SBGO",
    trecho: "CGB-GYN",
    horaDecolagem: "07:00",
    horaPouso: "08:50",
    tempoVoo: 1.83,
    horasDiurnas: 1.83,
    horasNoturnas: 0,
    pousos: 1,
    naturezaVoo: "EX - Executivo",
    picCanac: "130042",
    sicCanac: "",
    cliente: "Share Brasil",
    observacoes: "",
    confirmado: true,
    assinado: true,
    combustivelInicio: 2200,
    combustivelFim: 1710,
  },
];

const DEMO_TRAVEL_REPORTS: TravelReport[] = [
  {
    id: "1321755d-8529-4993-856f-d57ee844a07e",
    numero: "REL-GRF-008/26 PT-WSR",
    data: "2026-04-23",
    rota: "BOM FUTURO/MT × GOIÂNIA/GO",
    aeronave: "PT-WSR",
    dataInicio: "2026-04-17",
    dataFim: "2026-04-19",
    dias: 3,
    combustivel: 0.0,
    hospedagem: 566.0,
    alimentacao: 161.97,
    transporte: 70.97,
    outros: 21.0,
    total: 819.94,
    status: "aprovado",
    observacoes: "Pernoite em Goiânia 17 a 19/04. Consumo hotel R$21. Translado hotel×aéreo R$42,97. Almoço Goiânia R$49.",
  },
  {
    id: "tr2",
    numero: "REL-GRF-005/26 PT-WSR",
    data: "2026-03-25",
    rota: "CUIABÁ/MT × BRASÍLIA/DF",
    aeronave: "PT-WSR",
    dataInicio: "2026-03-20",
    dataFim: "2026-03-22",
    dias: 3,
    combustivel: 0.0,
    hospedagem: 498.0,
    alimentacao: 143.5,
    transporte: 55.0,
    outros: 0.0,
    total: 696.5,
    status: "aprovado",
    observacoes: "Pernoite em Brasília",
  },
  {
    id: "tr3",
    numero: "REL-GRF-002/26 PT-WSR",
    data: "2026-02-18",
    rota: "CUIABÁ/MT × GOIÂNIA/GO",
    aeronave: "PT-WSR",
    dataInicio: "2026-02-14",
    dataFim: "2026-02-15",
    dias: 2,
    combustivel: 0.0,
    hospedagem: 320.0,
    alimentacao: 98.5,
    transporte: 40.0,
    outros: 0.0,
    total: 458.5,
    status: "enviado",
    observacoes: "",
  },
];

const DEMO_MAINTENANCE: MaintenanceReport[] = [
  {
    id: "m1",
    data: "2026-04-19",
    aeronave: "PT-WSR",
    matricula: "PT-WSR",
    tipo: "Avaria",
    descricao: "Indicador de pressão de óleo motor esquerdo apresentando leitura instável na fase de cruzeiro. Observado no voo SBGO-SWBF.",
    local: "SWBF",
    prioridade: "media",
    status: "em_andamento",
    criadoEm: "2026-04-19T17:00:00",
  },
  {
    id: "m2",
    data: "2026-03-18",
    aeronave: "PT-WSR",
    matricula: "PT-WSR",
    tipo: "Manutenção Preventiva",
    descricao: "Revisão de 200h. Troca de filtros de óleo, revisão de freios e inspeção geral de aviônicos.",
    local: "SBCY",
    prioridade: "baixa",
    status: "resolvido",
    resolucao: "Revisão concluída em 20/03 pela oficina autorizada em SBCY. Aeronave liberada para voo.",
    criadoEm: "2026-03-18T08:00:00",
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
    valor: 15800.0,
    status: "pendente",
    periodo: "Junho/2026",
  },
  {
    id: "fin2",
    data: "2026-05-05",
    tipo: "salario",
    descricao: "Salário Maio/2026",
    valor: 15800.0,
    status: "pago",
    periodo: "Maio/2026",
  },
  {
    id: "fin3",
    data: "2026-04-27",
    tipo: "ressarcimento",
    descricao: "Ressarcimento REL-GRF-008/26 (GYN)",
    valor: 819.94,
    status: "pago",
    referencia: "REL-GRF-008/26 PT-WSR",
  },
  {
    id: "fin4",
    data: "2026-04-05",
    tipo: "salario",
    descricao: "Salário Abril/2026",
    valor: 15800.0,
    status: "pago",
    periodo: "Abril/2026",
  },
  {
    id: "fin5",
    data: "2026-03-25",
    tipo: "ressarcimento",
    descricao: "Ressarcimento REL-GRF-005/26 (BSB)",
    valor: 696.5,
    status: "pago",
    referencia: "REL-GRF-005/26 PT-WSR",
  },
  {
    id: "fin6",
    data: "2026-03-05",
    tipo: "salario",
    descricao: "Salário Março/2026",
    valor: 15800.0,
    status: "pago",
    periodo: "Março/2026",
  },
  {
    id: "fin7",
    data: "2026-02-18",
    tipo: "ressarcimento",
    descricao: "Ressarcimento REL-GRF-002/26 (GYN) – Pendente",
    valor: 458.5,
    status: "pendente",
    referencia: "REL-GRF-002/26 PT-WSR",
  },
];

const DEMO_FLIGHT_PLANS: FlightPlan[] = [
  {
    id: "fp1",
    data: "2026-06-20",
    partida: "SWBF",
    chegada: "SBGO",
    trecho: "BOM FUTURO-GYN",
    aeronave: "PT-WSR",
    matricula: "PT-WSR",
    horaPrevista: "07:30",
    estimativaVoo: "01:55",
    combustivelPrevisto: 1900,
    alternates: "SBCY",
    passageiros: 2,
    peso: 6800,
    piloto: "ROLFFE ERBE",
    copiloto: "",
    observacoes: "Passageiros: 2 sócios. Pernoite em Goiânia previsto.",
    condicoes: "VMC",
    status: "rascunho",
    criadoEm: "2026-06-16T09:00:00",
  },
  {
    id: "fp2",
    data: "2026-04-17",
    partida: "SWBF",
    chegada: "SBGO",
    trecho: "BOM FUTURO-GYN",
    aeronave: "PT-WSR",
    matricula: "PT-WSR",
    horaPrevista: "08:30",
    estimativaVoo: "01:55",
    combustivelPrevisto: 2100,
    alternates: "SBCY",
    passageiros: 0,
    peso: 5900,
    piloto: "ROLFFE ERBE",
    copiloto: "",
    observacoes: "Viagem REL-GRF-008/26",
    condicoes: "VMC",
    status: "aprovado",
    criadoEm: "2026-04-15T10:00:00",
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
