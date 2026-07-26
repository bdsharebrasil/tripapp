import { createContext, useContext, useEffect, useState, ReactNode } from 'react';

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
  id: string; data: string; aeronave: string; matricula: string;
  partida: string; chegada: string; trecho: string;
  horaDecolagem: string; horaPouso: string; tempoVoo: number;
  horasDiurnas: number; horasNoturnas: number; pousos: number;
  naturezaVoo: string; picCanac: string; sicCanac: string;
  cliente: string; observacoes: string;
  confirmado: boolean; assinado: boolean;
  combustivelInicio: number; combustivelFim: number;
}

export interface FlightPlan {
  id: string; data: string; partida: string; chegada: string; trecho: string;
  aeronave: string; matricula: string; horaPrevista: string; estimativaVoo: string;
  combustivelPrevisto: number; alternates: string; passageiros: number;
  peso: number; piloto: string; copiloto: string; observacoes: string;
  condicoes: "VMC" | "IMC"; status: "rascunho" | "enviado" | "aprovado" | "cancelado";
  criadoEm: string;
}

export interface TravelReport {
  id: string; numero: string; data: string; rota: string; aeronave: string;
  dataInicio: string; dataFim: string; dias: number;
  combustivel: number; hospedagem: number; alimentacao: number;
  transporte: number; outros: number; total: number;
  status: "rascunho" | "enviado" | "aprovado" | "devolvido";
  observacoes: string; motivoDevolucao?: string;
}

export interface MaintenanceReport {
  id: string; data: string; aeronave: string; matricula: string;
  tipo: string; descricao: string; local: string;
  prioridade: "baixa" | "media" | "alta" | "critica";
  status: "aberto" | "em_andamento" | "resolvido";
  resolucao?: string; criadoEm: string;
}

export interface VacationRequest {
  id: string; dataInicio: string; dataFim: string; dias: number;
  tipo: string; motivo?: string;
  status: "solicitada" | "aprovada" | "recusada" | "cancelada";
  criadoEm: string; solicitadoEm: string; observacoesGestor?: string;
}

export interface FinancialEntry {
  id: string; data: string;
  tipo: "salario" | "ressarcimento" | "diaria" | "bonus";
  descricao: string; valor: number;
  status: "pago" | "pendente"; referencia?: string; periodo?: string;
}

interface AppState {
  profile: UserProfile;
  flights: FlightEntry[];
  flightPlans: FlightPlan[];
  travelReports: TravelReport[];
  maintenance: MaintenanceReport[];
  vacations: VacationRequest[];
  financial: FinancialEntry[];
}

interface AppContextType extends AppState {
  updateProfile: (profile: UserProfile) => void;
  saveFlight: (flight: FlightEntry) => void;
  deleteFlight: (id: string) => void;
  saveFlightPlan: (plan: FlightPlan) => void;
  deleteFlightPlan: (id: string) => void;
  saveTravelReport: (report: TravelReport) => void;
  deleteTravelReport: (id: string) => void;
  saveMaintenance: (report: MaintenanceReport) => void;
  deleteMaintenance: (id: string) => void;
  saveVacation: (req: VacationRequest) => void;
  deleteVacation: (id: string) => void;
  saveFinancial: (entry: FinancialEntry) => void;
  deleteFinancial: (id: string) => void;
}

const demoProfile: UserProfile = {
  id: "c0b10d9a", nome: "ROLFFE ERBE", cargo: "Comandante", canac: "130042",
  cma: "—", cmaValidade: "2025-06-30", cmaClasse: "1ª Classe", tipoSanguineo: "—",
  habilitacoes: ["LR20"], email: "rolffe.erbe@sharebrasil.com.br",
  telefone: "(65) 98146-7766", horasAcumuladas: 3240, feriasDisponivel: 20
};

const demoFlights: FlightEntry[] = [
  { id: "f1", data: "2026-04-19", aeronave: "PT-WSR", matricula: "PT-WSR", partida: "SBGO", chegada: "SWBF", trecho: "GYN-BOM FUTURO", horaDecolagem: "14:10", horaPouso: "16:05", tempoVoo: 1.92, horasDiurnas: 1.92, horasNoturnas: 0, pousos: 1, naturezaVoo: "EX - Executivo", picCanac: "130042", sicCanac: "", cliente: "Share Brasil", observacoes: "Retorno – relatório REL-GRF-008/26", confirmado: true, assinado: true, combustivelInicio: 1800, combustivelFim: 1350 },
  { id: "f2", data: "2026-04-17", aeronave: "PT-WSR", matricula: "PT-WSR", partida: "SWBF", chegada: "SBGO", trecho: "BOM FUTURO-GYN", horaDecolagem: "08:30", horaPouso: "10:25", tempoVoo: 1.92, horasDiurnas: 1.92, horasNoturnas: 0, pousos: 1, naturezaVoo: "EX - Executivo", picCanac: "130042", sicCanac: "", cliente: "Share Brasil", observacoes: "", confirmado: true, assinado: true, combustivelInicio: 2100, combustivelFim: 1650 },
  { id: "f3", data: "2026-03-22", aeronave: "PT-WSR", matricula: "PT-WSR", partida: "SBCY", chegada: "SBBR", trecho: "CGB-BSB", horaDecolagem: "09:00", horaPouso: "10:40", tempoVoo: 1.67, horasDiurnas: 1.67, horasNoturnas: 0, pousos: 1, naturezaVoo: "EX - Executivo", picCanac: "130042", sicCanac: "", cliente: "Share Brasil", observacoes: "", confirmado: true, assinado: true, combustivelInicio: 2000, combustivelFim: 1520 },
  { id: "f4", data: "2026-03-20", aeronave: "PT-WSR", matricula: "PT-WSR", partida: "SBBR", chegada: "SBCY", trecho: "BSB-CGB", horaDecolagem: "16:45", horaPouso: "18:30", tempoVoo: 1.75, horasDiurnas: 1.0, horasNoturnas: 0.75, pousos: 1, naturezaVoo: "EX - Executivo", picCanac: "130042", sicCanac: "", cliente: "Share Brasil", observacoes: "", confirmado: true, assinado: true, combustivelInicio: 2050, combustivelFim: 1580 },
  { id: "f5", data: "2026-02-14", aeronave: "PT-WSR", matricula: "PT-WSR", partida: "SBCY", chegada: "SBGO", trecho: "CGB-GYN", horaDecolagem: "07:00", horaPouso: "08:50", tempoVoo: 1.83, horasDiurnas: 1.83, horasNoturnas: 0, pousos: 1, naturezaVoo: "EX - Executivo", picCanac: "130042", sicCanac: "", cliente: "Share Brasil", observacoes: "", confirmado: true, assinado: true, combustivelInicio: 2200, combustivelFim: 1710 }
];

const demoFlightPlans: FlightPlan[] = [
  { id: "fp1", data: "2026-06-20", partida: "SWBF", chegada: "SBGO", trecho: "BOM FUTURO-GYN", aeronave: "LR20", matricula: "PT-WSR", horaPrevista: "08:00", estimativaVoo: "02:00", combustivelPrevisto: 2500, alternates: "SBCY", passageiros: 4, peso: 15000, piloto: "ROLFFE ERBE", copiloto: "", observacoes: "", condicoes: "VMC", status: "rascunho", criadoEm: "2026-06-15T10:00:00Z" },
  { id: "fp2", data: "2026-04-17", partida: "SWBF", chegada: "SBGO", trecho: "BOM FUTURO-GYN", aeronave: "LR20", matricula: "PT-WSR", horaPrevista: "08:30", estimativaVoo: "01:55", combustivelPrevisto: 2100, alternates: "SBCY", passageiros: 2, peso: 14500, piloto: "ROLFFE ERBE", copiloto: "", observacoes: "", condicoes: "VMC", status: "aprovado", criadoEm: "2026-04-16T15:00:00Z" }
];

const demoTravelReports: TravelReport[] = [
  { id: "tr1", numero: "REL-GRF-008/26", data: "2026-04-20", rota: "SWBF-SBGO", aeronave: "PT-WSR", dataInicio: "2026-04-17", dataFim: "2026-04-19", dias: 3, combustivel: 0, hospedagem: 450.00, alimentacao: 250.00, transporte: 119.94, outros: 0, total: 819.94, status: "aprovado", observacoes: "" },
  { id: "tr2", numero: "REL-GRF-005/26", data: "2026-03-25", rota: "SBCY-SBBR", aeronave: "PT-WSR", dataInicio: "2026-03-20", dataFim: "2026-03-22", dias: 3, combustivel: 0, hospedagem: 380.00, alimentacao: 210.50, transporte: 106.00, outros: 0, total: 696.50, status: "aprovado", observacoes: "" },
  { id: "tr3", numero: "REL-GRF-002/26", data: "2026-02-16", rota: "SBCY-SBGO", aeronave: "PT-WSR", dataInicio: "2026-02-14", dataFim: "2026-02-15", dias: 2, combustivel: 0, hospedagem: 200.00, alimentacao: 150.00, transporte: 108.50, outros: 0, total: 458.50, status: "enviado", observacoes: "" }
];

const demoMaintenance: MaintenanceReport[] = [
  { id: "m1", data: "2026-05-10", aeronave: "LR20", matricula: "PT-WSR", tipo: "Corretiva", descricao: "Pressão de óleo instável motor #2", local: "SBGO", prioridade: "media", status: "em_andamento", criadoEm: "2026-05-10T09:00:00Z" },
  { id: "m2", data: "2026-01-15", aeronave: "LR20", matricula: "PT-WSR", tipo: "Preventiva", descricao: "Revisão de 200h", local: "SWBF", prioridade: "baixa", status: "resolvido", resolucao: "Serviço concluído pela oficina homologada", criadoEm: "2026-01-05T14:00:00Z" }
];

const demoVacations: VacationRequest[] = [
  { id: "v1", dataInicio: "2026-07-14", dataFim: "2026-07-28", dias: 15, tipo: "Regulamentar", status: "aprovada", criadoEm: "2026-05-01T10:00:00Z", solicitadoEm: "2026-05-01", observacoesGestor: "Aprovado conforme escala." },
  { id: "v2", dataInicio: "2026-09-01", dataFim: "2026-09-05", dias: 5, tipo: "Folga", status: "solicitada", criadoEm: "2026-06-15T08:30:00Z", solicitadoEm: "2026-06-15" }
];

const demoFinancial: FinancialEntry[] = [
  { id: "fin1", data: "2026-05-05", tipo: "salario", descricao: "Salário Base", valor: 15800.00, status: "pago", periodo: "04/2026" },
  { id: "fin2", data: "2026-04-25", tipo: "ressarcimento", descricao: "Reembolso REL-GRF-008/26", valor: 819.94, status: "pago", referencia: "REL-GRF-008/26" },
  { id: "fin3", data: "2026-04-05", tipo: "salario", descricao: "Salário Base", valor: 15800.00, status: "pago", periodo: "03/2026" },
  { id: "fin4", data: "2026-03-30", tipo: "ressarcimento", descricao: "Reembolso REL-GRF-005/26", valor: 696.50, status: "pago", referencia: "REL-GRF-005/26" },
  { id: "fin5", data: "2026-03-05", tipo: "salario", descricao: "Salário Base", valor: 15800.00, status: "pago", periodo: "02/2026" },
  { id: "fin6", data: "2026-02-28", tipo: "ressarcimento", descricao: "Reembolso REL-GRF-002/26", valor: 458.50, status: "pendente", referencia: "REL-GRF-002/26" },
  { id: "fin7", data: "2026-02-05", tipo: "salario", descricao: "Salário Base", valor: 15800.00, status: "pago", periodo: "01/2026" }
];

const AppContext = createContext<AppContextType | undefined>(undefined);

export function AppProvider({ children }: { children: ReactNode }) {
  const [profile, setProfile] = useState<UserProfile>(demoProfile);
  const [flights, setFlights] = useState<FlightEntry[]>([]);
  const [flightPlans, setFlightPlans] = useState<FlightPlan[]>([]);
  const [travelReports, setTravelReports] = useState<TravelReport[]>([]);
  const [maintenance, setMaintenance] = useState<MaintenanceReport[]>([]);
  const [vacations, setVacations] = useState<VacationRequest[]>([]);
  const [financial, setFinancial] = useState<FinancialEntry[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    const loadData = <T,>(key: string, demoData: T): T => {
      const stored = localStorage.getItem(`sb:${key}`);
      if (stored) return JSON.parse(stored);
      localStorage.setItem(`sb:${key}`, JSON.stringify(demoData));
      return demoData;
    };

    setProfile(loadData('profile', demoProfile));
    setFlights(loadData('flights', demoFlights));
    setFlightPlans(loadData('flightPlans', demoFlightPlans));
    setTravelReports(loadData('travelReports', demoTravelReports));
    setMaintenance(loadData('maintenance', demoMaintenance));
    setVacations(loadData('vacations', demoVacations));
    setFinancial(loadData('financial', demoFinancial));
    setIsLoaded(true);
  }, []);

  const saveToLocal = (key: string, data: any) => {
    localStorage.setItem(`sb:${key}`, JSON.stringify(data));
  };

  const updateProfile = (p: UserProfile) => { setProfile(p); saveToLocal('profile', p); };

  const saveFlight = (f: FlightEntry) => {
    const updated = flights.some(x => x.id === f.id) ? flights.map(x => x.id === f.id ? f : x) : [f, ...flights];
    setFlights(updated); saveToLocal('flights', updated);
  };
  const deleteFlight = (id: string) => { const updated = flights.filter(x => x.id !== id); setFlights(updated); saveToLocal('flights', updated); };

  const saveFlightPlan = (f: FlightPlan) => {
    const updated = flightPlans.some(x => x.id === f.id) ? flightPlans.map(x => x.id === f.id ? f : x) : [f, ...flightPlans];
    setFlightPlans(updated); saveToLocal('flightPlans', updated);
  };
  const deleteFlightPlan = (id: string) => { const updated = flightPlans.filter(x => x.id !== id); setFlightPlans(updated); saveToLocal('flightPlans', updated); };

  const saveTravelReport = (f: TravelReport) => {
    const updated = travelReports.some(x => x.id === f.id) ? travelReports.map(x => x.id === f.id ? f : x) : [f, ...travelReports];
    setTravelReports(updated); saveToLocal('travelReports', updated);
  };
  const deleteTravelReport = (id: string) => { const updated = travelReports.filter(x => x.id !== id); setTravelReports(updated); saveToLocal('travelReports', updated); };

  const saveMaintenance = (f: MaintenanceReport) => {
    const updated = maintenance.some(x => x.id === f.id) ? maintenance.map(x => x.id === f.id ? f : x) : [f, ...maintenance];
    setMaintenance(updated); saveToLocal('maintenance', updated);
  };
  const deleteMaintenance = (id: string) => { const updated = maintenance.filter(x => x.id !== id); setMaintenance(updated); saveToLocal('maintenance', updated); };

  const saveVacation = (f: VacationRequest) => {
    const updated = vacations.some(x => x.id === f.id) ? vacations.map(x => x.id === f.id ? f : x) : [f, ...vacations];
    setVacations(updated); saveToLocal('vacations', updated);
  };
  const deleteVacation = (id: string) => { const updated = vacations.filter(x => x.id !== id); setVacations(updated); saveToLocal('vacations', updated); };

  const saveFinancial = (f: FinancialEntry) => {
    const updated = financial.some(x => x.id === f.id) ? financial.map(x => x.id === f.id ? f : x) : [f, ...financial];
    setFinancial(updated); saveToLocal('financial', updated);
  };
  const deleteFinancial = (id: string) => { const updated = financial.filter(x => x.id !== id); setFinancial(updated); saveToLocal('financial', updated); };

  if (!isLoaded) return null;

  return (
    <AppContext.Provider value={{
      profile, flights, flightPlans, travelReports, maintenance, vacations, financial,
      updateProfile, saveFlight, deleteFlight, saveFlightPlan, deleteFlightPlan,
      saveTravelReport, deleteTravelReport, saveMaintenance, deleteMaintenance,
      saveVacation, deleteVacation, saveFinancial, deleteFinancial
    }}>
      {children}
    </AppContext.Provider>
  );
}

export function useAppContext() {
  const context = useContext(AppContext);
  if (context === undefined) throw new Error("useAppContext must be used within an AppProvider");
  return context;
}