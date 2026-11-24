export type Severity = "low" | "medium" | "high" | "critical";
export type ReportStatus =
  | "open"
  | "in_analysis"
  | "in_maintenance"
  | "resolved";
export type Aircraft = {
  id: string;
  registration: string;
  model: string;
  image_url?: string | null;
  in_maintenance: boolean;
};
export type MaintenanceReport = {
  id: string;
  aircraft_id: string;
  report_date: string;
  description: string;
  severity: Severity;
  status: ReportStatus;
  aircraft: Aircraft;
  reporter?: { full_name: string } | null;
};
export type ReportsResponse = {
  data: MaintenanceReport[];
  aeronaves: Aircraft[];
};
export type StatusFilter = "all" | ReportStatus;

export const API_PATH = "/api/ctm/relatorios-manutencao";
export const SEVERITIES: Severity[] = ["low", "medium", "high", "critical"];
export const STATUSES: StatusFilter[] = [
  "all",
  "open",
  "in_analysis",
  "in_maintenance",
  "resolved",
];
export const severityInfo: Record<
  Severity,
  { label: string; color: string; bg: string }
> = {
  low: { label: "Baixa", color: "#15803D", bg: "#DCFCE7" },
  medium: { label: "Média", color: "#B45309", bg: "#FEF3C7" },
  high: { label: "Alta", color: "#C2410C", bg: "#FFEDD5" },
  critical: { label: "Crítica", color: "#B91C1C", bg: "#FEE2E2" },
};
export const statusInfo: Record<
  ReportStatus,
  { label: string; color: string; bg: string }
> = {
  open: { label: "Aberto", color: "#B91C1C", bg: "#FEE2E2" },
  in_analysis: { label: "Em análise", color: "#1D4ED8", bg: "#DBEAFE" },
  in_maintenance: { label: "Em manutenção", color: "#B45309", bg: "#FEF3C7" },
  resolved: { label: "Resolvido", color: "#15803D", bg: "#DCFCE7" },
};
export const filterLabels: Record<StatusFilter, string> = {
  all: "Todos",
  open: "Abertos",
  in_analysis: "Em análise",
  in_maintenance: "Em manutenção",
  resolved: "Resolvidos",
};

export function formatDate(value: string) {
  const date = new Date(`${value.slice(0, 10)}T00:00:00`);
  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleDateString("pt-BR", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      });
}
export function todayISO() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}
export function validISODate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00`);
  return (
    !Number.isNaN(parsed.getTime()) &&
    parsed.toISOString().slice(0, 10) === value
  );
}
