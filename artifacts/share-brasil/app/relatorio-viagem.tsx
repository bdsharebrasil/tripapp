import {
  dataDespesaDeDiaMes,
  formatarDataDiaMes,
  valorDespesa,
  payloadDespesas,
} from "@/src/lib/despesas";
import { fromByteArray } from "base64-js";
import { randomUUID } from "expo-crypto";
import { useLocalSearchParams, useFocusEffect, useRouter } from "expo-router";
import * as DocumentPicker from "expo-document-picker";
import * as ImagePicker from "expo-image-picker";
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  Animated,
  ActivityIndicator,
  Image,
  Modal,
  PanResponder,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from "react-native";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";
import { ApiError, apiFetch, type ApiBinary } from "@/src/lib/api";
import {
  Cabecalho,
  ErroConsulta,
  Vazio,
  tema,
  Icon,
  Toque,
} from "@/src/components/ui";
import { avisar, confirmar } from "@/src/lib/confirmar";
import { anexarArquivo } from "@/src/lib/upload";
import { abrirArquivoPrivado } from "@/src/lib/arquivo-privado";
import RelatorioPdfViewer from "@/src/components/RelatorioPdfViewer";

type Obj = Record<string, any>;
type Attachment = {
  id: string;
  indice_despesa?: number;
  nome_arquivo?: string;
  tipo_arquivo?: string;
  url_arquivo?: string;
};
type PendingAttachment = {
  uri: string;
  name: string;
  mime: string;
  size?: number;
};
type Expense = {
  id: string;
  categoria: string;
  data: string;
  valor: number;
  pago_por: string;
  descricao: string;
  anexos: Attachment[];
  valorTexto?: string;
};
const BASE = "/api/financeiro/relatorios-despesa-viagem";
const CATEGORIES = [
  "Alimentação",
  "Hospedagem",
  "Transporte",
  "Combustível",
  "Outros",
];
const PAYERS = [
  ["tripulante_1", "Tripulante 1"],
  ["tripulante_2", "Tripulante 2"],
  ["cliente", "Cliente"],
  ["sharebrasil", "Share Brasil"],
] as const;
const PAID_STATUSES = new Set([
  "PAGO",
  "PAGA",
  "QUITADO",
  "LIQUIDADO",
  "REALIZADO",
]);
const CANCELED_PAYMENT_STATUSES = new Set([
  "CANCELADO",
  "CANCELADA",
  "ESTORNADO",
]);
const CATEGORY_COLORS: Record<string, string> = {
  Hospedagem: "#3289D8",
  Combustível: "#2EBBCB",
  Alimentação: "#FFBF26",
  Transporte: "#A17DFF",
  Outros: "#6FCF97",
};
const money = (v: unknown) =>
  Number(v || 0).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
const parseDateParts = (value?: unknown): [number, number, number] | null => {
  const raw = String(value || "").trim();
  if (!raw) return null;
  const isoMatch = /^(\d{4})-(\d{2})-(\d{2})/.exec(raw);
  if (isoMatch) {
    const year = Number(isoMatch[1]);
    const month = Number(isoMatch[2]);
    const day = Number(isoMatch[3]);
    if (year && month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      return [year, month, day];
    }
  }
  const brMatch = /^(\d{2})\/(\d{2})\/(\d{4})/.exec(raw);
  if (brMatch) {
    const day = Number(brMatch[1]);
    const month = Number(brMatch[2]);
    const year = Number(brMatch[3]);
    if (year && month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      return [year, month, day];
    }
  }
  return null;
};
const date = (value?: string) => {
  const parts = parseDateParts(value);
  if (!parts) return "—";
  const [year, month, day] = parts;
  return `${String(day).padStart(2, "0")}/${String(month).padStart(2, "0")}/${year}`;
};
const shortDate = (value?: string) => {
  const parsed = parseDateParts(value);
  if (!parsed) return "—";
  const [year, month, day] = parsed;
  const parts = new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "short",
    timeZone: "UTC",
  }).formatToParts(new Date(Date.UTC(year, month - 1, day)));
  const dayPart = parts.find((part) => part.type === "day")?.value;
  const monthPart = parts
    .find((part) => part.type === "month")
    ?.value.replace(".", "");
  return dayPart && monthPart ? `${dayPart} ${monthPart}` : "—";
};
const calcPeriodDays = (
  startParts: [number, number, number],
  endParts: [number, number, number],
) => {
  const [startYear, startMonth, startDay] = startParts;
  const [endYear, endMonth, endDay] = endParts;
  return Math.max(
    1,
    Math.round(
      (Date.UTC(endYear, endMonth - 1, endDay) -
        Date.UTC(startYear, startMonth - 1, startDay)) /
        86400000,
    ) + 1,
  );
};
const toIsoFromParts = ([year, month, day]: [number, number, number]) =>
  `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
const period = (start?: string, end?: string) => {
  const startParts = parseDateParts(start);
  const endParts = parseDateParts(end) || startParts;
  if (!startParts || !endParts) return "—";
  const days = calcPeriodDays(startParts, endParts);
  return `${shortDate(toIsoFromParts(startParts))} – ${shortDate(toIsoFromParts(endParts))} (${days}d)`;
};
const reportPeriod = (start?: string, end?: string) => {
  const startParts = parseDateParts(start);
  const endParts = parseDateParts(end) || startParts;
  if (!startParts || !endParts) return "—";
  return `${date(toIsoFromParts(startParts))} – ${date(toIsoFromParts(endParts))}`;
};
const localISO = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
const arr = (x: unknown): Obj[] => (Array.isArray(x) ? x : []);
const reportId = (r: Obj) => String(r.id || r.relatorio_id || "");
const flightNo = (r: Obj) =>
  String(r.numero_voo || r.voo?.numero_voo || r.voo_numero || "").trim();
const normalizeFlightKey = (value: unknown) =>
  String(value || "")
    .trim()
    .toUpperCase()
    .replace(/^VOO\s*#?\s*/i, "");
const normalizeSearchText = (value: unknown) =>
  String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("pt-BR")
    .trim();
const isCompletedFlight = (flight: Obj) => {
  const status = normalizeSearchText(
    flight.status_voo ||
      flight.situacao_voo ||
      flight.situacao ||
      flight.status,
  )
    .toUpperCase()
    .replace(/[\s-]+/g, "_");
  return (
    flight.concluido === true ||
    flight.finalizado === true ||
    Boolean(flight.concluido_em || flight.finalizado_em || flight.encerrado_em) ||
    /(^|_)(CONCLUID[OA]|FINALIZAD[OA]|ENCERRAD[OA]|REALIZAD[OA]|COMPLETED|DONE)(_|$)/.test(
      status,
    ) ||
    [
      "CONCLUIDO",
      "CONCLUIDA",
      "FINALIZADO",
      "FINALIZADA",
      "ENCERRADO",
      "ENCERRADA",
      "COMPLETED",
      "DONE",
      "REALIZADO",
      "REALIZADA",
      "CANCELADO",
      "CANCELADA",
      "CANCELED",
      "CANCELLED",
    ].includes(status)
  );
};
const findFlightForReport = (report: Obj, flights: Obj[]) => {
  const repId = reportId(report);
  const repFlightKey = normalizeFlightKey(flightNo(report));
  return flights.find((flight) => {
    if (repId && String(flight.relatorio_id || "") === repId) return true;
    if (
      report.voo_id &&
      [flight.id, flight.solicitacao_id].some(
        (id) => String(id || "") === String(report.voo_id),
      )
    ) {
      return true;
    }
    if (
      report.solicitacao_id &&
      [flight.solicitacao_id, flight.id].some(
        (id) => String(id || "") === String(report.solicitacao_id),
      )
    ) {
      return true;
    }
    return (
      Boolean(repFlightKey) &&
      normalizeFlightKey(flightNo(flight)) === repFlightKey &&
      (!report.aeronave_id ||
        !flight.aeronave_id ||
        String(report.aeronave_id) === String(flight.aeronave_id))
    );
  });
};
const getReportMeta = (report: Obj, flights: Obj[]) => {
  const flight = findFlightForReport(report, flights);
  const expenses = arr(report.despesas);
  const expenseDates = expenses
    .map((item) => String(item.data || "").slice(0, 10))
    .filter((d) => Boolean(parseDateParts(d)))
    .sort();
  const start =
    [
      report.data_inicio,
      report.data_voo,
      report.data_agendada,
      report.data_ida,
      report.data_saida,
      report.data_partida,
      report.periodo_inicio,
      report.voo?.data_inicio,
      report.voo?.data_agendada,
      report.voo?.data_voo,
      report.voo?.data_ida,
      report.voo?.data_saida,
      flight?.data_inicio,
      flight?.data_agendada,
      flight?.data_voo,
      flight?.data_ida,
      flight?.data_saida,
      flight?.data_partida,
      expenseDates[0],
      report.criado_em,
    ].find((candidate) => Boolean(parseDateParts(candidate))) || undefined;
  const end =
    [
      report.data_fim,
      report.data_volta,
      report.data_retorno,
      report.data_chegada,
      report.periodo_fim,
      report.voo?.data_fim,
      report.voo?.data_volta,
      report.voo?.data_retorno,
      report.voo?.data_chegada,
      flight?.data_fim,
      flight?.data_volta,
      flight?.data_retorno,
      flight?.data_chegada,
      flight?.data_agendada,
      flight?.data_voo,
      expenseDates[expenseDates.length - 1],
      start,
    ].find((candidate) => Boolean(parseDateParts(candidate))) || undefined;
  const aircraft = String(
    report.matricula_registro ||
      report.matricula ||
      report.aeronave?.matricula_registro ||
      report.aeronave?.matricula ||
      report.voo?.matricula_registro ||
      report.voo?.matricula ||
      flight?.aeronave?.matricula_registro ||
      flight?.aeronave?.matricula ||
      flight?.matricula_registro ||
      flight?.matricula ||
      "",
  ).trim();
  const route = String(
    report.rota ||
      report.voo?.rota_nome ||
      report.voo?.rota ||
      flight?.rota_nome ||
      flight?.rota ||
      [
        report.origem || report.voo?.origem || flight?.origem,
        report.destino || report.voo?.destino || flight?.destino,
      ]
        .filter(Boolean)
        .join(" × ") ||
      (flightNo(report) ? `Voo ${flightNo(report)}` : "Relatório de viagem"),
  ).trim();
  return { flight, start, end, aircraft, route };
};
const reportForFlight = (flight: Obj, reports: Obj[]) =>
  reports.find(
    (report) =>
      (flight.relatorio_id &&
        reportId(report) === String(flight.relatorio_id)) ||
      (flightNo(report) &&
        normalizeFlightKey(flightNo(report)) ===
          normalizeFlightKey(flightNo(flight)) &&
        (!flight.aeronave_id ||
          !report.aeronave_id ||
          String(report.aeronave_id) === String(flight.aeronave_id)) &&
        (!flight.cliente_id ||
          !report.cliente_id ||
          String(report.cliente_id) === String(flight.cliente_id)) &&
        (!flight.socio_id ||
          !report.socio_id ||
          String(report.socio_id) === String(flight.socio_id))),
  );
const reportSearchValues = (report: Obj, flights: Obj[]) => {
  const flight = findFlightForReport(report, flights);
  const client =
    typeof report.cliente === "string"
      ? report.cliente
      : report.cliente?.razao_social ||
        report.cliente?.nome_fantasia ||
        report.cliente?.nome ||
        "";
  return normalizeSearchText(
    [
      report.numero_relatorio,
      report.relatorio_numero,
      flightNo(report),
      report.cliente_nome,
      report.nome_cliente,
      report.cliente_razao_social,
      report.razao_social_cliente,
      report.cliente_id,
      client,
      report.matricula,
      report.matricula_registro,
      report.aeronave_matricula,
      report.aeronave?.matricula,
      report.aeronave?.matricula_registro,
      report.aeronave?.nome,
      typeof report.aeronave === "string" ? report.aeronave : "",
      flight?.matricula,
      flight?.matricula_registro,
      flight?.aeronave?.matricula,
      flight?.aeronave?.matricula_registro,
      typeof flight?.aeronave === "string" ? flight.aeronave : "",
      flight?.cliente_nome,
      flight?.nome_cliente,
      flight?.cliente_razao_social,
      flight?.cliente?.razao_social,
      flight?.cliente?.nome_fantasia,
      flight?.cliente?.nome,
      flight?.cliente_id,
    ]
      .filter(Boolean)
      .join(" "),
  );
};
const reportStatus = (r: Obj) =>
  String(r.status || "indisponível").toLowerCase();
const statusText = (s: string) =>
  ({
    rascunho: "Rascunho",
    finalizado: "Finalizado",
    aguardando_aprovacao: "Aguardando aprovação",
    aprovado: "Aprovado",
    ajuste_necessario: "Ajustes necessários",
    ajuste_concluido: "Ajustes enviados",
    cancelado: "Cancelado",
  })[s] || s.replace(/_/g, " ");
const reportStatusTheme = (s: string) => {
  if (s === "aprovado" || s === "finalizado") {
    return {
      accent: "#6FE3B0",
      badgeBg: "#D9FBE8",
      badgeText: "#156E42",
    };
  }
  if (s === "aguardando_aprovacao" || s === "ajuste_concluido") {
    return {
      accent: "#F8D16C",
      badgeBg: "#FEF3C7",
      badgeText: "#92580C",
    };
  }
  if (s === "ajuste_necessario" || s === "cancelado") {
    return {
      accent: "#FF7B93",
      badgeBg: "#FFE4E6",
      badgeText: "#9F1239",
    };
  }
  return {
    accent: "#55AEFF",
    badgeBg: "#DBEAFE",
    badgeText: "#1E40AF",
  };
};
const isEditable = (r?: Obj) => Boolean(r && reportStatus(r) === "rascunho");

function normalizeExpenses(report: Obj): Expense[] {
  const raw = arr(report.despesas);
  const annexes = arr(report.anexos);
  return raw.map((x, idx) => ({
    id: String(x.id || randomUUID()),
    categoria: String(x.categoria || "Outros"),
    data: String(x.data || localISO()).slice(0, 10),
    valor: Number(x.valor ?? 0),
    pago_por: String(
      x.pago_por === "eu" || !x.pago_por
        ? Number(report.tripulante_pos) === 2
          ? "tripulante_2"
          : "tripulante_1"
        : x.pago_por,
    ),
    descricao: String(x.descricao || ""),
    anexos: [
      ...arr(x.anexos),
      ...annexes.filter((a) => Number(a.indice_despesa) === idx),
    ] as Attachment[],
  }));
}
function ExpenseSwipeRow({
  children,
  disabled,
  onDelete,
}: {
  children: React.ReactNode;
  disabled: boolean;
  onDelete: () => void;
}) {
  const offset = useRef(new Animated.Value(0)).current;
  const startOffset = useRef(0);
  const revealed = useRef(false);
  const [isRevealed, setIsRevealed] = useState(false);
  const disabledRef = useRef(disabled);
  const onDeleteRef = useRef(onDelete);
  disabledRef.current = disabled;
  onDeleteRef.current = onDelete;

  const reveal = (value: boolean) => {
    revealed.current = value;
    setIsRevealed(value);
    Animated.spring(offset, {
      toValue: value ? -84 : 0,
      useNativeDriver: true,
      bounciness: 0,
    }).start();
  };
  const responder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, gesture) =>
        !disabledRef.current &&
        Math.abs(gesture.dx) > 12 &&
        Math.abs(gesture.dx) > Math.abs(gesture.dy) * 1.2,
      onPanResponderGrant: () => {
        startOffset.current = revealed.current ? -84 : 0;
      },
      onPanResponderMove: (_, gesture) => {
        offset.setValue(Math.max(-84, Math.min(0, startOffset.current + gesture.dx)));
      },
      onPanResponderRelease: (_, gesture) => {
        const next =
          gesture.dx < -40 ||
          (revealed.current && gesture.dx <= 40);
        reveal(next);
      },
      onPanResponderTerminate: () => reveal(revealed.current),
    }),
  ).current;

  return (
    <View style={styles.swipeContainer}>
      {isRevealed && !disabled && (
        <Toque
          accessibilityRole="button"
          accessibilityLabel="Excluir despesa"
          onPress={() => {
            reveal(false);
            onDeleteRef.current();
          }}
          style={styles.swipeDelete}
        >
          <Icon name="trash-2" size={19} color="#fff" />
          <Text style={styles.swipeDeleteText}>Excluir</Text>
        </Toque>
      )}
      <Animated.View
        {...responder.panHandlers}
        style={[
          styles.swipeContent,
          { transform: [{ translateX: offset }] },
        ]}
      >
        {children}
      </Animated.View>
    </View>
  );
}

export default function RelatorioViagemScreen() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ relatorioId?: string }>();
  const dirtyRef = useRef(false);
  const savingRef = useRef(false);
  const scrollRef = useRef<React.ComponentRef<typeof ScrollView>>(null);
  const [flights, setFlights] = useState<Obj[]>([]);
  const [reports, setReports] = useState<Obj[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(
    params.relatorioId || null,
  );
  const [paymentMonthSummary, setPaymentMonthSummary] = useState<{
    mes: string;
    valor: number;
  } | null>(null);
  const [section, setSection] = useState<"lancamentos" | "historico">(
    "lancamentos",
  );
  const [reportFilter, setReportFilter] = useState<"todos" | "rascunho" | "aprovacao" | "aprovado">("todos");
  const [historySearch, setHistorySearch] = useState("");
  const [items, setItems] = useState<Expense[]>([]);
  const [observations, setObservations] = useState("");
  const [dirty, setDirty] = useState(false);
  const [expenseSheetId, setExpenseSheetId] = useState<string | null>(null);
  const [payerFilter, setPayerFilter] = useState<string | null>(null);
  const [payerPickerOpen, setPayerPickerOpen] = useState(false);
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [calendarMonth, setCalendarMonth] = useState(() => {
    const now = new Date();
    return { year: now.getFullYear(), month: now.getMonth() + 1 };
  });
  const [expenseDateText, setExpenseDateText] = useState("");
  const [expenseDateError, setExpenseDateError] = useState("");
  const [expenseDescriptionError, setExpenseDescriptionError] = useState("");
  const [pendingAttachment, setPendingAttachment] =
    useState<PendingAttachment | null>(null);
  const [proofPreview, setProofPreview] = useState<{
    uri: string;
    title: string;
    path: string;
    mime: string;
  } | null>(null);
  const [proofPdfPreview, setProofPdfPreview] = useState<{
    path: string;
    title: string;
    mime: string;
  } | null>(null);
  const [privateDownloadBusy, setPrivateDownloadBusy] = useState(false);
  const [approvalAction, setApprovalAction] = useState<"approve" | "reject" | null>(null);
  const [approvalReason, setApprovalReason] = useState("");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [busy, setBusy] = useState("");
  const [pdfPreviewOpen, setPdfPreviewOpen] = useState(false);
  const [error, setError] = useState("");

  const selected = reports.find((r) => reportId(r) === selectedId);
  const selectedMeta = useMemo(
    () => (selected ? getReportMeta(selected, flights) : undefined),
    [selected, flights],
  );
  const sheetItem = items.find((item) => item.id === expenseSheetId);
  const sheetIndex = items.findIndex((item) => item.id === expenseSheetId);
  const sheetIsNew = Boolean(
    sheetItem &&
      !arr(selected?.despesas).some(
        (item) => String(item.id || "") === sheetItem.id,
      ),
  );
  const editable = isEditable(selected);
  const ownApprovalStatus = String(
    Number(selected?.tripulante_pos) === 2
      ? selected?.status_aprovacao_tripulante_2
      : selected?.status_aprovacao_tripulante,
  ).toLowerCase();
  const approvalPending = Boolean(
    selected &&
      ["aguardando_aprovacao", "ajuste_concluido"].includes(reportStatus(selected)) &&
      !["aprovado", "reprovado", "rejeitado"].includes(ownApprovalStatus),
  );
  const total = useMemo(
    () => items.reduce((v, x) => v + Number(x.valor || 0), 0),
    [items],
  );
  const paymentStats = useMemo(() => {
    const currentMonth = localISO().slice(0, 7);
    const calculated = reports.reduce<{
      receber: number;
      pago: number;
      devolvidos: number;
    }>(
      (stats, report) => {
        const status = String(report.pagamento_status || "")
          .trim()
          .toUpperCase();
        const rawAmount = Number(
          report.pagamento_total ??
            report.total_valor ??
            arr(report.despesas).reduce(
              (sum, expense) => sum + Number(expense.valor || 0),
              0,
            ),
        );
        const amount = Number.isFinite(rawAmount) ? rawAmount : 0;
        const rawPaid = Number(
          report.pagamento_valor ??
            (PAID_STATUSES.has(status) ? amount : 0),
        );
        const paid = Number.isFinite(rawPaid) ? rawPaid : 0;
        if (
          status &&
          status !== "NAO_PROGRAMADO" &&
          !PAID_STATUSES.has(status) &&
          !CANCELED_PAYMENT_STATUSES.has(status)
        ) {
          stats.receber += Math.max(0, amount - paid);
        }
        const paymentDate = String(
          report.pagamento_data || report.data_pagamento || "",
        ).slice(0, 7);
        if (PAID_STATUSES.has(status) && paymentDate === currentMonth) {
          stats.pago += paid;
        }
        if (reportStatus(report) === "ajuste_necessario") {
          stats.devolvidos += 1;
        }
        return stats;
      },
      { receber: 0, pago: 0, devolvidos: 0 },
    );
    const paidThisMonth = paymentMonthSummary?.mes === currentMonth
      ? paymentMonthSummary.valor
      : calculated.pago;
    return { ...calculated, pago: paidThisMonth };
  }, [reports, paymentMonthSummary]);
  const categoryTotals = useMemo(
    () =>
      CATEGORIES.map((category) => ({
        category,
        amount: items
          .filter((item) => item.categoria === category)
          .reduce((sum, item) => sum + Number(item.valor || 0), 0),
      })).filter((category) => category.amount > 0),
    [items],
  );
  const filteredReports = useMemo(() => {
    const statusFiltered =
      reportFilter === "rascunho"
        ? reports.filter(isEditable)
        : reportFilter === "aprovacao"
          ? reports.filter((report) =>
              ["aguardando_aprovacao", "ajuste_concluido"].includes(
                reportStatus(report),
              ),
            )
          : reportFilter === "aprovado"
            ? reports.filter(
                (report) => reportStatus(report) === "aprovado",
              )
            : reports;
    const query = normalizeSearchText(historySearch);
    if (!query) return statusFiltered;
    return statusFiltered.filter((report) =>
      reportSearchValues(report, flights).includes(query),
    );
  }, [reports, reportFilter, historySearch, flights]);
  const currentFlights = useMemo(() => {
    const seen = new Set<string>();
    return flights.filter((flight) => {
      if (isCompletedFlight(flight)) return false;
      const report = reportForFlight(flight, reports);
      if (report && !isEditable(report)) return false;
      const key = [
        flightNo(flight) || flight.id || flight.solicitacao_id,
        flight.aeronave_id || flight.matricula_registro || flight.matricula,
        String(flight.data_agendada || "").slice(0, 10),
        flight.cliente_id,
        flight.socio_id,
      ]
        .map((part) => String(part || "").trim().toLowerCase())
        .join("|");
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, [flights, reports]);
  const ownPayer =
    Number(selected?.tripulante_pos) === 2 ? "tripulante_2" : "tripulante_1";
  const hasSecondCrew = Boolean(selected?.tripulante_id_2);
  const otherPayer =
    ownPayer === "tripulante_1" ? "tripulante_2" : "tripulante_1";
  const otherCrewName =
    otherPayer === "tripulante_1"
      ? selected?.nome_tripulante
      : selected?.nome_tripulante_2;
  const payerOptions = [
    { id: ownPayer, label: "Eu", color: "#4B9DFF" },
    ...((hasSecondCrew || otherCrewName)
      ? [
          {
            id: otherPayer,
            label:
              otherCrewName || `Tripulante ${otherPayer.slice(-1)}`,
            color: "#B185FF",
          },
        ]
      : []),
    { id: "cliente", label: "Cliente", color: "#FFC02E" },
    { id: "sharebrasil", label: "Share Brasil", color: "#35D6A0" },
  ];
  const activePayers = useMemo(
    () =>
      payerOptions
        .map((payer) => ({
          ...payer,
          amount: items
            .filter((item) => item.pago_por === payer.id)
            .reduce((sum, item) => sum + Number(item.valor || 0), 0),
        }))
        .filter((payer) => payer.amount > 0),
    [items, ownPayer, hasSecondCrew, otherCrewName],
  );
  const visibleItems = items.filter(
    (item) => !payerFilter || item.pago_por === payerFilter,
  );
  const selectedRoute = selectedMeta?.route || "";
  const expenseDates = useMemo(
    () =>
      items
        .map((item) => item.data)
        .filter((d) => Boolean(parseDateParts(d)))
        .sort(),
    [items],
  );
  const flightStart = selectedMeta?.start || expenseDates[0];
  const flightEnd =
    selectedMeta?.end || expenseDates[expenseDates.length - 1] || flightStart;
  const flightYear =
    parseDateParts(flightStart)?.[0] ||
    Number(localISO().slice(0, 4)) ||
    new Date().getFullYear();
  const calendarCells = useMemo(() => {
    const firstWeekday = new Date(
      Date.UTC(calendarMonth.year, calendarMonth.month - 1, 1),
    ).getUTCDay();
    const daysInMonth = new Date(
      Date.UTC(calendarMonth.year, calendarMonth.month, 0),
    ).getUTCDate();
    return [
      ...Array<number | null>(firstWeekday).fill(null),
      ...Array.from({ length: daysInMonth }, (_, index) => index + 1),
    ];
  }, [calendarMonth]);
  const calendarMonthName = new Intl.DateTimeFormat("pt-BR", {
    month: "long",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(calendarMonth.year, calendarMonth.month - 1, 1)));
  const aircraftRegistration =
    selectedMeta?.aircraft || "Aeronave não informada";
  const missingProofs = items.filter((item) => !item.anexos.length).length;

  const load = useCallback(async (refresh = false) => {
    if (dirtyRef.current)
      return avisar(
        "Despesas não salvas",
        "Salve seus lançamentos antes de atualizar.",
      );
    if (refresh) setRefreshing(true);
    else setLoading(true);
    setError("");
    try {
      const currentMonth = localISO().slice(0, 7);
      const [f, r] = await Promise.all([
        apiFetch<{ voos: Obj[] }>(`${BASE}/meus-voos`),
        apiFetch<{
          relatorios: Obj[];
          resumo_pagamentos?: { mes?: string; pago_mes_centavos?: number };
        }>(`${BASE}/minhas?mes=${encodeURIComponent(currentMonth)}`),
      ]);
      setFlights(arr(f.voos));
      setReports(arr(r.relatorios));
      const paidMonthCents = Number(r.resumo_pagamentos?.pago_mes_centavos);
      setPaymentMonthSummary(
        r.resumo_pagamentos && Number.isFinite(paidMonthCents)
          ? {
              mes: String(r.resumo_pagamentos.mes || currentMonth),
              valor: paidMonthCents / 100,
            }
          : null,
      );
      setSelectedId((current) =>
        current && !arr(r.relatorios).some((x) => reportId(x) === current)
          ? null
          : current,
      );
    } catch (e) {
      setError(
        e instanceof ApiError
          ? e.message
          : "Não foi possível consultar despesas.",
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);
  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );
  useEffect(() => {
    setItems(selected ? normalizeExpenses(selected) : []);
    setObservations(String(selected?.observacoes || ""));
    setDirty(false);
    dirtyRef.current = false;
    scrollRef.current?.scrollTo({ y: 0, animated: false });
  }, [selectedId, reports]);
  useEffect(() => {
    dirtyRef.current = dirty;
  }, [dirty]);
  useEffect(() => {
    setPayerFilter(null);
    setExpenseDescriptionError("");
    setExpenseDateError("");
  }, [selectedId]);
  useEffect(() => {
    if (
      payerFilter &&
      !activePayers.some((payer) => payer.id === payerFilter)
    ) {
      setPayerFilter(null);
    }
  }, [activePayers, payerFilter]);
  useEffect(() => {
    if (sheetItem) setExpenseDateText(formatarDataDiaMes(sheetItem.data));
  }, [expenseSheetId]);

  const open = (id: string) => {
    if (!dirty) {
      setSelectedId(id);
      return;
    }
    confirmar(
      "Alterações não salvas",
      "Descartar as alterações e mudar de relatório?",
      () => {
        dirtyRef.current = false;
        setSelectedId(id);
      },
      true,
    );
  };
  const back = () => open("");
  const startReport = async (flight: Obj) => {
    if (busy) return;
    const voo = flightNo(flight);
    if (!voo)
      return avisar(
        "Voo sem número",
        "Não é possível criar um relatório sem número de voo.",
      );
    setBusy(`start-${voo}`);
    try {
      const result = await apiFetch<{ relatorio?: Obj }>(
        `${BASE}/iniciar-do-voo`,
        {
          method: "POST",
          body: JSON.stringify({
            numero_voo: voo,
            solicitacao_id: flight.solicitacao_id || flight.id,
          }),
        },
      );
      if (!result.relatorio?.id)
        throw new Error("Servidor não retornou o relatório criado.");
      const mergedReport: Obj = {
        ...result.relatorio,
        data_inicio:
          result.relatorio.data_inicio ||
          flight.data_inicio ||
          flight.data_agendada,
        data_fim:
          result.relatorio.data_fim ||
          flight.data_fim ||
          flight.data_agendada ||
          flight.data_inicio,
        rota:
          result.relatorio.rota ||
          flight.rota_nome ||
          flight.rota ||
          [flight.origem, flight.destino].filter(Boolean).join(" × "),
        matricula:
          result.relatorio.matricula ||
          flight.matricula_registro ||
          flight.matricula,
      };
      setReports((prev) => [
        ...prev.filter((r) => reportId(r) !== String(mergedReport.id)),
        mergedReport,
      ]);
      setSelectedId(String(mergedReport.id));
      setSection("lancamentos");
    } catch (e) {
      avisar(
        "Não foi possível iniciar",
        e instanceof Error ? e.message : "Verifique os dados do voo.",
      );
    } finally {
      setBusy("");
    }
  };

  const update = (index: number, patch: Partial<Expense>) => {
    setItems((prev) =>
      prev.map((x, i) => (i === index ? { ...x, ...patch } : x)),
    );
    if ("descricao" in patch && patch.descricao?.trim()) {
      setExpenseDescriptionError("");
    }
    setDirty(true);
  };
  const add = () => {
    if (!selected || !editable) return;
    const id = randomUUID();
    setExpenseSheetId(id);
    setExpenseDescriptionError("");
    setExpenseDateError("");
    setPendingAttachment(null);
    const startParts = parseDateParts(flightStart);
    const reportDate = startParts ? toIsoFromParts(startParts) : localISO();
    setItems((prev) => [
      ...prev,
      {
        id,
        categoria: "",
        data: reportDate,
        valor: 0,
        pago_por: ownPayer,
        descricao: "",
        anexos: [],
      },
    ]);
    setDirty(true);
  };
  const changeExpenseDate = (value: string) => {
    const digits = value.replace(/\D/g, "").slice(0, 4);
    const formatted =
      digits.length > 2
        ? `${digits.slice(0, 2)}/${digits.slice(2)}`
        : digits;
    setExpenseDateText(formatted);
    const dateISO =
      digits.length === 4 ? dataDespesaDeDiaMes(formatted, flightYear) : null;
    if (dateISO) {
      update(sheetIndex, { data: dateISO });
      setExpenseDateError("");
      return;
    }
    update(sheetIndex, { data: "" });
    setExpenseDateError(
      digits.length === 4 ? "Informe um dia e mês válidos." : "",
    );
  };
  const openExpenseCalendar = () => {
    const baseDate = sheetItem?.data || flightStart || localISO();
    const parsed = parseDateParts(baseDate);
    const year = parsed?.[0] || flightYear;
    const month = parsed?.[1] || 1;
    setCalendarMonth({ year, month });
    setPayerPickerOpen(false);
    setCalendarOpen(true);
  };
  const shiftCalendarMonth = (amount: number) => {
    setCalendarMonth((current) => {
      const next = new Date(
        Date.UTC(current.year, current.month - 1 + amount, 1),
      );
      return {
        year: next.getUTCFullYear(),
        month: next.getUTCMonth() + 1,
      };
    });
  };
  const selectCalendarDay = (day: number) => {
    const dateISO = dataDespesaDeDiaMes(
      `${String(day).padStart(2, "0")}/${String(calendarMonth.month).padStart(2, "0")}`,
      calendarMonth.year,
    );
    if (!dateISO) return;
    update(sheetIndex, { data: dateISO });
    setExpenseDateText(formatarDataDiaMes(dateISO));
    setExpenseDateError("");
    setCalendarOpen(false);
  };
  const deleteExpense = (index: number) => {
    if (!editable || index < 0 || index >= items.length) return;
    const expense = items[index];
    confirmar(
      "Excluir despesa?",
      "A remoção será aplicada ao salvar o relatório.",
      () => {
        setItems((previous) => previous.filter((item) => item.id !== expense.id));
        setDirty(true);
        if (expenseSheetId === expense.id) {
          setExpenseSheetId(null);
          setPendingAttachment(null);
          setExpenseDateError("");
        }
      },
      true,
    );
  };
  const save = async (silent = false): Promise<boolean> => {
    if (!selected || !editable || busy || savingRef.current) return false;
    const invalidIndex = items.findIndex((item) =>
      !CATEGORIES.includes(item.categoria) ||
      !/^\d{4}-\d{2}-\d{2}$/.test(item.data) ||
      !Number.isFinite(item.valor) ||
      item.valor <= 0 ||
      !item.descricao.trim() ||
      item.descricao.length > 500 ||
      !PAYERS.some(([id]) => id === item.pago_por) ||
      (item.pago_por === "tripulante_2" && !hasSecondCrew),
    );
    if (invalidIndex >= 0) {
      const item = items[invalidIndex];
      setExpenseDescriptionError(
        item.id === expenseSheetId && !item.descricao.trim()
          ? "A descrição da despesa é obrigatória."
          : "",
      );
      setExpenseDateError(
        item.id === expenseSheetId && !/^\d{4}-\d{2}-\d{2}$/.test(item.data)
          ? "Escolha uma data válida no formato DD/MM."
          : "",
      );
      avisar(
        "Verifique a despesa",
        `Confira a despesa ${invalidIndex + 1}: categoria, data, valor positivo, pagador e descrição (até 500 caracteres).`,
      );
      return false;
    }
    savingRef.current = true;
    setPayerFilter(null);
    setBusy("save");
    try {
      await apiFetch(
        `${BASE}/${encodeURIComponent(reportId(selected))}/despesas-tripulante`,
        {
          method: "PUT",
          body: JSON.stringify({
            ...payloadDespesas(items),
            observacoes: observations.trim(),
          }),
        },
      );
      if (pendingAttachment && sheetIndex >= 0) {
        const form = new FormData();
        await anexarArquivo(
          form,
          "arquivo",
          pendingAttachment.uri,
          pendingAttachment.name,
          pendingAttachment.mime,
        );
        form.append("indice_despesa", String(sheetIndex));
        await apiFetch(
          `${BASE}/${encodeURIComponent(reportId(selected))}/anexos-tripulante`,
          { method: "POST", body: form },
        );
        setPendingAttachment(null);
      }
      dirtyRef.current = false;
      setDirty(false);
      await load(true);
      if (!silent) {
        avisar("Rascunho salvo", "Suas despesas e observações foram registradas.");
      }
      return true;
    } catch (e) {
      avisar(
        "Erro ao salvar",
        e instanceof Error
          ? e.message
          : "Não foi possível registrar as despesas.",
      );
      return false;
    } finally {
      savingRef.current = false;
      setBusy("");
    }
  };
  const saveAndClose = async () => {
    if (await save()) setExpenseSheetId(null);
  };
  const saveAndAddAnother = async () => {
    if (await save()) {
      setExpenseSheetId(null);
      add();
    }
  };
  const closeExpenseForm = () => {
    if (payerPickerOpen || calendarOpen) {
      setPayerPickerOpen(false);
      setCalendarOpen(false);
      return;
    }
    if (pendingAttachment) {
      confirmar(
        "Descartar comprovante?",
        "O comprovante selecionado ainda não foi salvo.",
        () => {
          setPendingAttachment(null);
          setExpenseSheetId(null);
        },
        true,
      );
      return;
    }
    setExpenseSheetId(null);
  };
  const selectAttachment = async (
    source: "camera" | "foto" | "arquivo",
  ) => {
    if (!editable || busy) return;
    setBusy("select-proof");
    try {
      let asset: PendingAttachment | null = null;
      if (source === "arquivo") {
        const result = await DocumentPicker.getDocumentAsync({
          type: ["application/pdf", "image/*"],
          copyToCacheDirectory: true,
        });
        if (result.canceled || !result.assets?.[0]) return;
        const file = result.assets[0];
        asset = {
          uri: file.uri,
          name: file.name || `comprovante-${Date.now()}.pdf`,
          mime: file.mimeType || "application/pdf",
          size: file.size,
        };
      } else {
        const permission =
          source === "camera"
            ? await ImagePicker.requestCameraPermissionsAsync()
            : await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (!permission.granted) {
          avisar(
            "Permissão necessária",
            "Autorize o acesso à câmera ou às fotos.",
          );
          return;
        }
        const result =
          source === "camera"
            ? await ImagePicker.launchCameraAsync({
                mediaTypes: ["images"],
                quality: 0.9,
              })
            : await ImagePicker.launchImageLibraryAsync({
                mediaTypes: ["images"],
                quality: 0.9,
              });
        if (result.canceled || !result.assets?.[0]) return;
        const file = result.assets[0];
        asset = {
          uri: file.uri,
          name: file.fileName || `comprovante-${Date.now()}.jpg`,
          mime: file.mimeType || "image/jpeg",
          size: file.fileSize,
        };
      }
      if (
        !asset ||
        ![
          "application/pdf",
          "image/jpeg",
          "image/png",
          "image/webp",
        ].includes(asset.mime)
      ) {
        avisar("Formato inválido", "Envie um PDF, JPG, PNG ou WEBP.");
        return;
      }
      if (asset.size && asset.size > 20 * 1024 * 1024) {
        avisar("Arquivo grande", "Escolha um comprovante de até 20 MB.");
        return;
      }
      setPendingAttachment(asset);
      setDirty(true);
    } catch (e) {
      avisar(
        "Falha no comprovante",
        e instanceof Error
          ? e.message
          : "Não foi possível preparar o comprovante.",
      );
    } finally {
      setBusy("");
    }
  };
  const removeProof = (attachment: Attachment) => {
    if (!selected || !editable || busy) return;
    confirmar(
      "Excluir comprovante?",
      "Este arquivo será removido do relatório.",
      async () => {
        setBusy("delete");
        try {
          await apiFetch(
            `${BASE}/${encodeURIComponent(reportId(selected))}/anexos-tripulante/${encodeURIComponent(attachment.id)}`,
            { method: "DELETE" },
          );
          await load(true);
        } catch (e) {
          avisar(
            "Erro",
            e instanceof Error ? e.message : "Não foi possível excluir.",
          );
        } finally {
          setBusy("");
        }
      },
      true,
    );
  };
  const viewProof = async (attachment: Attachment) => {
    if (!selected || busy) return;
    const path = `${BASE}/${encodeURIComponent(reportId(selected))}/anexos-tripulante/${encodeURIComponent(attachment.id)}/arquivo`;
    setBusy("open-proof");
    try {
      const mime =
        attachment.tipo_arquivo ||
        (/\.pdf$/i.test(attachment.nome_arquivo || "")
          ? "application/pdf"
          : "image/jpeg");
      const title = attachment.nome_arquivo || "Comprovante";
      if (mime.startsWith("image/")) {
        const { bytes, mime: receivedMime } = await apiFetch<ApiBinary>(path, {
          responseType: "binary",
          headers: { Accept: mime },
          maxBytes: 25 * 1024 * 1024,
        });
        if (
          !["image/jpeg", "image/png", "image/webp"].includes(receivedMime)
        ) {
          throw new Error("O servidor não retornou uma imagem compatível.");
        }
        setProofPreview({
          uri: `data:${receivedMime};base64,${fromByteArray(bytes)}`,
          title,
          path,
          mime: receivedMime,
        });
      } else if (mime === "application/pdf") {
        setProofPdfPreview({ path, title, mime });
      } else {
        throw new Error("O formato deste comprovante não é compatível.");
      }
    } catch (e) {
      avisar(
        "Comprovante indisponível",
        e instanceof Error ? e.message : "Não foi possível abrir.",
      );
    } finally {
      setBusy("");
    }
  };
  const downloadPrivateFile = async (path: string, title: string, mime: string) => {
    if (privateDownloadBusy) return;
    setPrivateDownloadBusy(true);
    try {
      await abrirArquivoPrivado(path, title, mime);
    } catch (e) {
      avisar(
        "Não foi possível baixar o arquivo",
        e instanceof Error ? e.message : "Tente novamente.",
      );
    } finally {
      setPrivateDownloadBusy(false);
    }
  };

  const finalize = () => {
    if (!selected || !editable || busy) return;
    if (!items.length)
      return avisar("Relatório vazio", "Adicione pelo menos uma despesa.");
    confirmar(
      "Finalizar relatório?",
      "Os lançamentos serão enviados para a próxima etapa e não poderão ser editados aqui.",
      async () => {
        if (dirty && !(await save(true))) return;
        setBusy("finalize");
        try {
          await apiFetch(
            `${BASE}/${encodeURIComponent(reportId(selected))}/finalizar`,
            { method: "POST" },
          );
          await load(true);
          avisar("Relatório finalizado", "O status foi atualizado.");
        } catch (e) {
          avisar(
            "Não foi possível finalizar",
            e instanceof Error ? e.message : "Tente novamente.",
          );
        } finally {
          setBusy("");
        }
      },
    );
  };
  const viewReportPdf = () => {
    if (selected) setPdfPreviewOpen(true);
  };
  const decideApproval = async () => {
    if (!selected || !approvalAction || busy) return;
    if (approvalAction === "reject" && !approvalReason.trim()) {
      return avisar("Motivo obrigatório", "Informe o que precisa ser corrigido no relatório.");
    }
    setBusy("approval");
    try {
      const form = new FormData();
      form.append("tripulante_pos", String(selected.tripulante_pos === 2 ? 2 : 1));
      form.append("aprovado", String(approvalAction === "approve"));
      form.append("observacoes", approvalReason.trim());
      const result = await apiFetch<{ relatorio?: Obj }>(
        `${BASE}/${encodeURIComponent(reportId(selected))}/aprovacao`,
        { method: "POST", body: form },
      );
      if (!result.relatorio?.id) throw new Error("Servidor não retornou o relatório atualizado.");
      setReports((previous) =>
        previous.map((report) =>
          reportId(report) === reportId(selected) ? result.relatorio as Obj : report,
        ),
      );
      setApprovalAction(null);
      setApprovalReason("");
      avisar(
        approvalAction === "approve" ? "Relatório aprovado" : "Relatório devolvido",
        approvalAction === "approve"
          ? "Sua aprovação foi registrada com sucesso."
          : "O relatório foi devolvido para ajuste.",
      );
    } catch (e) {
      avisar(
        "Não foi possível registrar a decisão",
        e instanceof Error ? e.message : "Tente novamente.",
      );
    } finally {
      setBusy("");
    }
  };

  const showReport = (r: Obj) => {
    const status = reportStatus(r);
    const theme = reportStatusTheme(status);
    const meta = getReportMeta(r, flights);
    const expenses = arr(r.despesas);
    const reportCategories = CATEGORIES.map((category) => ({
      category,
      amount: expenses
        .filter((item) => String(item.categoria || "") === category)
        .reduce((sum, item) => sum + Number(item.valor || 0), 0),
    })).filter((entry) => entry.amount > 0);
    const totalAmount = Number(
      r.total_valor ??
        expenses.reduce((sum, x) => sum + Number(x.valor || 0), 0),
    );
    const paymentStatus = String(r.pagamento_status || "")
      .trim()
      .toUpperCase();
    const hasPayment =
      Boolean(paymentStatus) && paymentStatus !== "NAO_PROGRAMADO";
    const paymentLabel = PAID_STATUSES.has(paymentStatus)
      ? "Pago"
      : CANCELED_PAYMENT_STATUSES.has(paymentStatus)
        ? "Cancelado"
        : "Em aberto";
    const rawReimbursementAmount = Number(
      PAID_STATUSES.has(paymentStatus)
        ? (r.pagamento_valor ?? r.pagamento_total ?? totalAmount)
        : (r.pagamento_total ?? r.pagamento_valor ?? totalAmount),
    );
    const reimbursementAmount = Number.isFinite(rawReimbursementAmount)
      ? rawReimbursementAmount
      : 0;
    const reportReference =
      r.numero_relatorio || (flightNo(r) ? `Voo ${flightNo(r)}` : "Relatório");

    return (
      <View
        key={reportId(r)}
        style={[styles.reportCard, { borderLeftColor: theme.accent }]}
      >
        <Toque
          accessibilityRole="button"
          onPress={() => open(reportId(r))}
        >
          <View style={styles.reportCardTop}>
            <Text style={styles.reportCardRef} numberOfLines={1}>
              {reportReference}
            </Text>
            <View
              style={[
                styles.reportCardBadge,
                { backgroundColor: theme.badgeBg },
              ]}
            >
              <Text
                style={[
                  styles.reportCardBadgeText,
                  { color: theme.badgeText },
                ]}
              >
                {statusText(status)}
              </Text>
            </View>
          </View>

          <Text style={styles.reportCardRoute} numberOfLines={2}>
            {meta.route}
          </Text>

          <View style={styles.reportCardMetaRow}>
            <View style={styles.reportCardMetaItem}>
              <Icon name="calendar" size={13} color="#8E9FB4" />
              <Text style={styles.reportCardMetaText}>
                {reportPeriod(meta.start, meta.end)}
              </Text>
            </View>
            {hasPayment && (
              <View style={styles.reportCardMetaItem}>
                <Icon name="wallet" size={13} color="#8E9FB4" />
                <Text style={styles.reportCardMetaText}>
                  {paymentLabel}: {money(reimbursementAmount)}
                </Text>
              </View>
            )}
          </View>
        </Toque>

        <View style={styles.reportCardFinancials}>
          <ScrollView
            horizontal
            nestedScrollEnabled
            directionalLockEnabled
            showsHorizontalScrollIndicator={false}
            style={styles.reportCardFinancialScroll}
            contentContainerStyle={styles.reportCardFinancialRow}
          >
            {reportCategories.map(({ category, amount }) => (
              <View key={category} style={styles.reportCardCategoryCol}>
                <Text style={styles.reportCardCategoryLabel} numberOfLines={1}>
                  {category}
                </Text>
                <Text
                  style={styles.reportCardCategoryValue}
                  numberOfLines={1}
                >
                  {money(amount)}
                </Text>
              </View>
            ))}
            <View
              style={[
                styles.reportCardCategoryCol,
                styles.reportCardTotalCol,
              ]}
            >
              <Text style={styles.reportCardCategoryLabel}>Total</Text>
              <Text style={styles.reportCardTotalValue}>
                {money(totalAmount)}
              </Text>
            </View>
          </ScrollView>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView edges={["top"]} style={[styles.root, { paddingTop: 10 }]}>
      <Cabecalho
        titulo={selected ? "Relatório por voo" : "Relatórios de Viagem"}
        apoio="FINANCEIRO"
        voltar={selected ? back : () => router.replace("/(tabs)")}
        acao={() => void load(true)}
      />
      {!!error && (
        <ErroConsulta mensagem={error} atualizar={() => void load(true)} />
      )}
      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={tema.azul} />
          <Text style={styles.muted}>Carregando suas despesas…</Text>
        </View>
      ) : (
        <ScrollView
          ref={scrollRef}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => void load(true)}
              tintColor={tema.azul}
            />
          }
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{
            padding: 16,
            paddingBottom: insets.bottom + 32,
          }}
        >
          {!selected ? (
            <>
              <View style={styles.paymentStats}>
                <View style={styles.paymentStat}>
                  <Text style={styles.paymentStatLabel}>A RECEBER</Text>
                  <Text style={styles.paymentStatValue}>{money(paymentStats.receber)}</Text>
                </View>
                <View style={styles.paymentStat}>
                  <Text style={styles.paymentStatLabel}>PAGO/MÊS</Text>
                  <Text style={[styles.paymentStatValue, { color: "#35D6A0" }]}>
                    {money(paymentStats.pago)}
                  </Text>
                </View>
                <View style={styles.paymentStat}>
                  <Text style={styles.paymentStatLabel}>DEVOLVIDOS</Text>
                  <Text style={[styles.paymentStatValue, { color: "#FF7190" }]}>
                    {paymentStats.devolvidos}
                  </Text>
                </View>
              </View>
              <View style={styles.tabs}>
                {(["lancamentos", "historico"] as const).map((t) => (
                  <Toque
                    key={t}
                    onPress={() => setSection(t)}
                    style={[styles.tab, section === t && styles.tabActive]}
                  >
                    <View style={styles.tabContent}>
                      <Icon
                        name={t === "lancamentos" ? "send" : "clock"}
                        size={16}
                        color={section === t ? tema.fundo : tema.suave}
                      />
                      <Text
                        style={[
                          styles.tabText,
                          section === t && { color: tema.fundo },
                        ]}
                      >
                        {t === "lancamentos" ? "Voo atual" : "Histórico"}
                      </Text>
                    </View>
                  </Toque>
                ))}
              </View>
              {section === "lancamentos" ? (
                <>
                  <Text style={styles.sectionTitle}>
                    VOOS DA ESCALA
                  </Text>
                  <Text style={[styles.muted, { marginBottom: 10 }]}>
                    Voos ainda não concluídos aparecem aqui. Relatórios em andamento continuam pelo voo correspondente.
                  </Text>
                  {currentFlights.map((f) => {
                    const existing = reportForFlight(f, reports);
                    return (
                      <Toque
                        accessibilityRole="button"
                        key={String(f.solicitacao_id || f.id || flightNo(f))}
                        onPress={() =>
                          existing
                            ? open(reportId(existing))
                            : void startReport(f)
                        }
                        disabled={!!busy}
                        style={styles.flightCard}
                      >
                        <View style={{ flex: 1 }}>
                          <Text style={styles.flightNo}>{flightNo(f)}</Text>
                          <Text style={styles.secondary}>
                            {f.rota_nome ||
                              [f.origem, f.destino]
                                .filter(Boolean)
                                .join(" → ")}{" "}
                            · {date(f.data_agendada || f.data_inicio)}
                          </Text>
                          <Text style={styles.muted}>{f.matricula || ""}</Text>
                        </View>
                        <View style={styles.startAction}>
                          {busy === `start-${flightNo(f)}` ? (
                            <ActivityIndicator color={tema.azul} />
                          ) : (
                            <>
                              <Text style={styles.link}>
                                {existing
                                  ? isEditable(existing)
                                    ? "Continuar"
                                    : "Ver relatório"
                                  : "Iniciar"}
                              </Text>
                              <Icon
                                name="arrow-up-right"
                                size={17}
                                color={tema.azul}
                              />
                            </>
                          )}
                        </View>
                      </Toque>
                    );
                  })}
                  {!currentFlights.length && (
                    <Vazio
                      icone="send"
                      titulo="Nenhum voo atual"
                      texto="Voos concluídos e relatórios anteriores ficam no histórico."
                    />
                  )}
                </>
              ) : (
                <>
                  <View style={styles.reportSearch}>
                    <Icon name="search" size={19} color={tema.suave} />
                    <TextInput
                      accessibilityLabel="Buscar relatório por número, cliente ou aeronave"
                      value={historySearch}
                      onChangeText={setHistorySearch}
                      placeholder="Número, cliente ou aeronave"
                      placeholderTextColor={tema.suave}
                      autoCapitalize="none"
                      autoCorrect={false}
                      style={styles.reportSearchInput}
                    />
                    {!!historySearch && (
                      <Toque
                        accessibilityRole="button"
                        accessibilityLabel="Limpar busca"
                        onPress={() => setHistorySearch("")}
                        style={styles.searchClear}
                      >
                        <Icon name="x" size={17} color={tema.suave} />
                      </Toque>
                    )}
                  </View>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.reportFilters}>
                    {([
                      ["todos", "Todos"], ["rascunho", "Rascunhos"], ["aprovacao", "Aguardando aprovação"], ["aprovado", "Aprovados"],
                    ] as const).map(([key, label]) => (
                      <Toque key={key} onPress={() => setReportFilter(key)} style={[styles.reportFilter, reportFilter === key && styles.reportFilterActive]}>
                        <Text style={[styles.reportFilterText, reportFilter === key && styles.reportFilterTextActive]}>{label}</Text>
                      </Toque>
                    ))}
                  </ScrollView>
                  <Text style={styles.sectionTitle}>
                    MEUS RELATÓRIOS · {filteredReports.length}
                  </Text>
                  {filteredReports.map(showReport)}
                  {!filteredReports.length && (
                    <Text style={styles.muted}>
                      {historySearch
                        ? "Nenhum relatório encontrado para essa busca."
                        : "Não há relatórios registrados."}
                    </Text>
                  )}
                </>
              )}
            </>
          ) : (
            <>
              <View style={styles.summaryCard}>
                <View style={styles.reportTopRow}>
                  <Text
                    style={[styles.eyebrow, styles.reportReference]}
                    numberOfLines={1}
                  >
                    {[selected.numero_relatorio, flightNo(selected)]
                      .filter(Boolean)
                      .join(" · ") || "RELATÓRIO DE VIAGEM"}
                  </Text>
                  <View style={styles.reportStatusBadge}>
                    <Icon
                      name={editable ? "edit-3" : "check-circle"}
                      size={11}
                      color="#C4CFDD"
                    />
                    <Text style={styles.reportStatusText}>
                      {statusText(reportStatus(selected)).toUpperCase()}
                    </Text>
                  </View>
                </View>

                <Text style={styles.bigRoute} numberOfLines={2}>
                  {selectedRoute}
                </Text>

                <View style={styles.flightMetaRow}>
                  <View style={styles.flightMetaItem}>
                    <Icon name="calendar" size={13} color="#8E9FB4" />
                    <Text style={styles.flightMetaText}>
                      {period(flightStart, flightEnd)}
                    </Text>
                  </View>
                  <View style={styles.flightMetaItem}>
                    <Icon name="airplane" size={14} color="#8E9FB4" />
                    <Text style={styles.flightMetaText}>
                      {aircraftRegistration}
                    </Text>
                  </View>
                </View>

                <View style={styles.summaryDivider} />

                <View style={styles.expenseBreakdown}>
                  <Text style={styles.breakdownLabel}>Total acumulado</Text>
                  <View style={styles.breakdownTotalRow}>
                    <Text
                      style={[
                        styles.breakdownTotal,
                        width < 360 && styles.breakdownTotalCompact,
                      ]}
                    >
                      {money(total)}
                    </Text>
                    <View style={styles.breakdownNote}>
                      <Text style={styles.breakdownNoteText}>
                        {items.length}{" "}
                        {items.length === 1 ? "despesa" : "despesas"}
                      </Text>
                      <Text
                        style={[
                          styles.missingProofText,
                          missingProofs === 0 && styles.proofsCompleteText,
                        ]}
                      >
                        {missingProofs
                          ? `${missingProofs} sem comprovante`
                          : items.length
                            ? "comprovantes em dia"
                            : "nenhum lançamento"}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.categoryBar}>
                    {categoryTotals.map(({ category, amount }) => (
                      <View
                        key={category}
                        style={{
                          width: `${(amount / (total || 1)) * 100}%`,
                          backgroundColor: CATEGORY_COLORS[category],
                        }}
                      />
                    ))}
                  </View>

                  <View style={styles.categoryLegend}>
                    {categoryTotals.map(({ category, amount }) => (
                      <View key={category} style={styles.categoryLegendItem}>
                        <View
                          style={[
                            styles.categoryDot,
                            { backgroundColor: CATEGORY_COLORS[category] },
                          ]}
                        />
                        <Text style={styles.categoryName} numberOfLines={1}>
                          {category}
                        </Text>
                        <Text style={styles.categoryAmount}>{money(amount)}</Text>
                      </View>
                    ))}
                    {!categoryTotals.length && (
                      <Text style={styles.muted}>
                        Adicione despesas para ver o resumo por categoria.
                      </Text>
                    )}
                  </View>
                </View>

                {selected.pagamento_status &&
                  selected.pagamento_status !== "NAO_PROGRAMADO" && (
                    <Text style={[styles.secondary, { marginTop: 10 }]}>
                      Reembolso: {selected.pagamento_status} ·{" "}
                      {money(selected.pagamento_valor)} de{" "}
                      {money(selected.pagamento_total)}
                    </Text>
                  )}

                {!!(selected.pdf_path || selected.pdf_url) && (
                  <Toque
                    accessibilityRole="button"
                    onPress={viewReportPdf}
                    style={styles.outlinedButton}
                  >
                    <Icon name="file-text" size={16} color={tema.azul} />
                    <Text style={styles.link}>Ver PDF do relatório</Text>
                  </Toque>
                )}
              </View>

              {activePayers.length > 0 && (
                <View style={styles.payerSummary}>
                  <View style={styles.payerHeader}>
                    <Text style={styles.payerTitle}>Quem pagou</Text>
                    {payerFilter !== null && (
                      <Toque
                        accessibilityRole="button"
                        onPress={() => setPayerFilter(null)}
                        style={styles.payerClear}
                      >
                        <Text style={styles.payerClearText}>Limpar filtro</Text>
                      </Toque>
                    )}
                  </View>
                  <View style={styles.payerChipsRow}>
                    {activePayers.map((payer) => {
                      const active = payerFilter === payer.id;
                      return (
                        <Toque
                          key={payer.id}
                          accessibilityRole="button"
                          accessibilityState={{ selected: active }}
                          onPress={() =>
                            setPayerFilter(active ? null : payer.id)
                          }
                          style={[
                            styles.payerChip,
                            active && styles.payerChipActive,
                          ]}
                        >
                          <View
                            style={[
                              styles.payerDot,
                              { backgroundColor: payer.color },
                            ]}
                          />
                          <Text style={styles.payerName}>{payer.label}</Text>
                          <Text style={styles.payerAmount}>
                            {money(payer.amount)}
                          </Text>
                        </Toque>
                      );
                    })}
                  </View>
                </View>
              )}

              <View style={styles.expenseHeading}>
                <Text style={styles.expenseHeadingTitle}>
                  Despesas lançadas · {visibleItems.length}
                </Text>
                {editable && (
                  <Toque
                    accessibilityRole="button"
                    accessibilityLabel="Criar nova despesa"
                    onPress={add}
                    disabled={!!busy}
                    style={styles.addExpense}
                  >
                    <Icon name="plus" size={15} color="#55AEFF" />
                    <Text style={styles.addExpenseText}>Adicionar</Text>
                  </Toque>
                )}
              </View>

              {!visibleItems.length && (
                <View style={styles.empty}>
                  <Icon name="file-text" size={26} color={tema.azul} />
                  <Text style={styles.secondary}>
                    {payerFilter
                      ? "Nenhuma despesa lançada por este pagador."
                      : "Nenhuma despesa registrada neste voo."}
                  </Text>
                </View>
              )}

              {visibleItems.map((item) => {
                const i = items.indexOf(item);
                return (
                  <ExpenseSwipeRow
                    key={item.id}
                    disabled={!editable}
                    onDelete={() => deleteExpense(i)}
                  >
                    <View style={[styles.itemCard, styles.swipeCard]}>
                      <View style={styles.expenseSummary}>
                        <Toque
                          accessibilityRole="button"
                          accessibilityLabel={`Editar despesa ${item.categoria || i + 1}`}
                          onPress={() => setExpenseSheetId(item.id)}
                          style={styles.expenseMain}
                        >
                          <View style={styles.expenseIcon}>
                            <Icon
                              name={
                                item.categoria === "Combustível"
                                  ? "droplet"
                                  : item.categoria === "Hospedagem"
                                    ? "home"
                                    : item.categoria === "Transporte"
                                      ? "truck"
                                      : item.categoria === "Alimentação"
                                        ? "coffee"
                                        : "file-text"
                              }
                              size={18}
                              color={
                                CATEGORY_COLORS[item.categoria] || tema.azul
                              }
                            />
                          </View>
                          <View style={{ flex: 1, minWidth: 0 }}>
                            <Text style={styles.itemTitle} numberOfLines={1}>
                              {item.descricao || item.categoria || "Nova despesa"}
                            </Text>
                            <Text style={styles.itemSubtitle} numberOfLines={1}>
                              {item.categoria || `Despesa ${i + 1}`} ·{" "}
                              {shortDate(item.data)} ·{" "}
                              {payerOptions.find(
                                (payer) => payer.id === item.pago_por,
                              )?.label || item.pago_por}
                            </Text>
                          </View>
                        </Toque>
                        <View style={styles.expenseTrailing}>
                          <Text style={styles.amount}>{money(item.valor)}</Text>
                          <Toque
                            accessibilityRole="button"
                            accessibilityLabel="Editar despesa"
                            onPress={() => setExpenseSheetId(item.id)}
                            style={styles.editChevronButton}
                          >
                            <Icon
                              name="chevron-right"
                              size={15}
                              color={tema.suave}
                            />
                          </Toque>
                        </View>
                      </View>
                      {item.anexos.map((attachment, attachmentIndex) => (
                        <Toque
                          key={attachment.id}
                          accessibilityRole="button"
                          accessibilityLabel={`Ver comprovante ${attachmentIndex + 1} de ${item.descricao || item.categoria}`}
                          disabled={busy === "open-proof"}
                          onPress={() => void viewProof(attachment)}
                          style={styles.expenseAttachmentButton}
                        >
                          <View style={styles.expenseAttachmentIcon}>
                            <Icon
                              name={attachment.tipo_arquivo?.startsWith("image/") ? "image" : "file-text"}
                              size={18}
                              color="#35D6A0"
                            />
                          </View>
                          <View style={styles.expenseAttachmentInfo}>
                            <Text style={styles.expenseAttachmentTitle} numberOfLines={1}>
                              {item.anexos.length > 1
                                ? `Ver comprovante ${attachmentIndex + 1}`
                                : "Ver comprovante"}
                            </Text>
                            <Text style={styles.expenseAttachmentName} numberOfLines={1}>
                              {attachment.nome_arquivo || "Imagem ou PDF"}
                            </Text>
                          </View>
                          {busy === "open-proof" ? (
                            <ActivityIndicator size="small" color="#35D6A0" />
                          ) : (
                            <Icon name="eye" size={18} color="#35D6A0" />
                          )}
                        </Toque>
                      ))}
                    </View>
                  </ExpenseSwipeRow>
                );
              })}

              <Text style={styles.sectionTitle}>HISTÓRICO E APROVAÇÃO</Text>
              <View style={styles.itemCard}>
                <Text style={styles.secondary}>
                  Status: {statusText(reportStatus(selected))}
                </Text>
                {approvalPending && (
                  <View style={styles.approvalActions}>
                    <Text style={styles.approvalHint}>
                      Este relatório aguarda sua aprovação.
                    </Text>
                    <View style={styles.approvalButtons}>
                      <Toque
                        accessibilityRole="button"
                        accessibilityLabel="Rejeitar relatório"
                        disabled={!!busy}
                        onPress={() => {
                          setApprovalReason("");
                          setApprovalAction("reject");
                        }}
                        style={styles.rejectApprovalButton}
                      >
                        <Icon name="x" size={16} color="#FF7190" />
                        <Text style={styles.rejectApprovalText}>Rejeitar</Text>
                      </Toque>
                      <Toque
                        accessibilityRole="button"
                        accessibilityLabel="Aprovar relatório"
                        disabled={!!busy}
                        onPress={() => {
                          setApprovalReason("");
                          setApprovalAction("approve");
                        }}
                        style={styles.approveApprovalButton}
                      >
                        <Icon name="check" size={16} color="#061A12" />
                        <Text style={styles.approveApprovalText}>Aprovar relatório</Text>
                      </Toque>
                    </View>
                  </View>
                )}
                {arr(selected.historico_ajustes).map((h, i) => (
                  <View key={String(h.id || i)} style={styles.historyRow}>
                    <Icon name="clock" size={15} color={tema.azul} />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.secondary}>
                        {date(h.criado_em)} · Ajuste solicitado
                      </Text>
                      <Text style={styles.rowTitle}>
                        {h.motivo || "Motivo não informado"}
                      </Text>
                    </View>
                  </View>
                ))}
                {!arr(selected.historico_ajustes).length && (
                  <Text style={styles.muted}>
                    Nenhuma solicitação de ajuste registrada.
                  </Text>
                )}
              </View>

              <View style={styles.reportFooter}>
                <View style={styles.observationsCard}>
                  <Text style={styles.observationsLabel}>OBSERVAÇÕES</Text>
                  <TextInput
                    accessibilityLabel="Observações do relatório"
                    editable={editable}
                    value={observations}
                    onChangeText={(value) => {
                      setObservations(value);
                      dirtyRef.current = true;
                      setDirty(true);
                    }}
                    placeholder="Inclua observações para o financeiro"
                    placeholderTextColor="#8E9FB4"
                    multiline
                    maxLength={2000}
                    textAlignVertical="top"
                    style={styles.observationsInput}
                  />
                </View>
                {editable && (
                  <View style={styles.reportFooterActions}>
                    <Toque
                      accessibilityRole="button"
                      accessibilityLabel="Salvar em rascunho"
                      disabled={!dirty || !!busy}
                      onPress={() => void save()}
                      style={[
                        styles.saveDraftButton,
                        (!dirty || !!busy) && { opacity: 0.45 },
                      ]}
                    >
                      {busy === "save" ? (
                        <ActivityIndicator color={tema.texto} />
                      ) : (
                        <Icon name="save" size={18} color={tema.texto} />
                      )}
                    </Toque>
                    <Toque
                      accessibilityRole="button"
                      disabled={!!busy}
                      onPress={finalize}
                      style={[
                        styles.sendFinanceButton,
                        !!busy && { opacity: 0.6 },
                      ]}
                    >
                      {busy === "finalize" || busy === "save" ? (
                        <ActivityIndicator color="#FFFFFF" />
                      ) : (
                        <Icon name="send" size={16} color="#FFFFFF" />
                      )}
                      <Text style={styles.sendFinanceText}>
                        {busy === "finalize" || busy === "save"
                          ? busy === "save"
                            ? "Salvando…"
                            : "Enviando…"
                          : "Enviar ao financeiro"}
                      </Text>
                    </Toque>
                  </View>
                )}
              </View>
            </>
          )}
        </ScrollView>
      )}
      <RelatorioPdfViewer
        visible={pdfPreviewOpen}
        path={selected ? `${BASE}/${encodeURIComponent(reportId(selected))}/pdf` : null}
        title={String(selected?.numero_relatorio || "Relatório de viagem")}
        onClose={() => setPdfPreviewOpen(false)}
        onDownload={() => {
          if (!selected) return;
          void downloadPrivateFile(
            `${BASE}/${encodeURIComponent(reportId(selected))}/pdf`,
            String(selected.numero_relatorio || "relatorio"),
            "application/pdf",
          );
        }}
        downloadBusy={privateDownloadBusy}
      />
      <RelatorioPdfViewer
        visible={Boolean(proofPdfPreview)}
        path={proofPdfPreview?.path || null}
        title={proofPdfPreview?.title || "Comprovante"}
        onClose={() => setProofPdfPreview(null)}
        onDownload={() => {
          if (!proofPdfPreview) return;
          void downloadPrivateFile(
            proofPdfPreview.path,
            proofPdfPreview.title,
            proofPdfPreview.mime,
          );
        }}
        downloadBusy={privateDownloadBusy}
      />
      <Modal
        transparent
        animationType="slide"
        visible={Boolean(sheetItem)}
        onRequestClose={closeExpenseForm}
      >
        {sheetItem && sheetIndex >= 0 ? (
          <View style={styles.sheetBackdrop}>
            <View style={[styles.expenseSheet, { paddingBottom: Math.max(insets.bottom, 18) }]}>
              <View style={styles.sheetHandle} />
              <View style={styles.sheetHeader}>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={styles.sheetKicker}>DESPESA {sheetIndex + 1}</Text>
                  <Text style={styles.sheetTitle}>
                    {sheetItem.categoria || "Nova despesa"}
                  </Text>
                </View>
                <Toque
                  accessibilityRole="button"
                  accessibilityLabel="Fechar formulário da despesa"
                  onPress={closeExpenseForm}
                  style={styles.sheetClose}
                >
                  <Icon name="x" size={20} color={tema.texto} />
                </Toque>
              </View>
              <ScrollView
                keyboardShouldPersistTaps="handled"
                contentContainerStyle={styles.sheetContent}
                showsVerticalScrollIndicator={false}
              >
                <View style={styles.expenseValue}>
                  <Text style={styles.expenseValueLabel}>Valor da despesa</Text>
                  <View style={styles.expenseValueRow}>
                    <Text style={styles.expenseCurrency}>R$</Text>
                    <TextInput
                      accessibilityLabel="Valor da despesa em reais"
                      editable={editable}
                      style={[
                        styles.expenseValueInput,
                        width < 360 && styles.expenseValueInputCompact,
                      ]}
                      keyboardType="decimal-pad"
                      value={
                        sheetItem.valorTexto ??
                        (sheetItem.valor
                          ? String(sheetItem.valor).replace(".", ",")
                          : "")
                      }
                      onChangeText={(value) =>
                        update(sheetIndex, {
                          valorTexto: value,
                          valor: valorDespesa(value),
                        })
                      }
                      placeholder="0,00"
                      placeholderTextColor={tema.suave}
                    />
                  </View>
                </View>

                <Text style={styles.formSectionTitle}>Categoria</Text>
                <View style={styles.categoryGrid}>
                  {CATEGORIES.map((cat) => (
                    <Toque
                      key={cat}
                      disabled={!editable}
                      onPress={() => update(sheetIndex, { categoria: cat })}
                      style={[
                        styles.categoryOption,
                        sheetItem.categoria === cat && {
                          borderColor: CATEGORY_COLORS[cat],
                          backgroundColor: `${CATEGORY_COLORS[cat]}22`,
                        },
                      ]}
                    >
                      <Icon
                        name={
                          cat === "Alimentação"
                            ? "coffee"
                            : cat === "Hospedagem"
                              ? "home"
                              : cat === "Transporte"
                                ? "truck"
                                : cat === "Combustível"
                                  ? "droplet"
                                  : "file-text"
                        }
                        size={25}
                        color={CATEGORY_COLORS[cat]}
                      />
                      <Text
                        style={[
                          styles.categoryOptionText,
                          sheetItem.categoria === cat &&
                            styles.categoryOptionTextActive,
                        ]}
                      >
                        {cat}
                      </Text>
                    </Toque>
                  ))}
                </View>

                <Text style={styles.formSectionTitle}>Detalhes</Text>
                <View style={styles.formDetails}>
                  <View style={styles.formDetailRow}>
                    <Icon name="calendar" size={23} color="#FF6B64" />
                    <Text style={styles.formDetailLabel}>Data</Text>
                    <TextInput
                      accessibilityLabel="Data da despesa, dia e mês"
                      editable={editable}
                      style={styles.formDetailInput}
                      keyboardType="numeric"
                      maxLength={5}
                      value={expenseDateText}
                      onChangeText={changeExpenseDate}
                      placeholder="DD/MM"
                      placeholderTextColor={tema.suave}
                    />
                    <Toque
                      accessibilityRole="button"
                      accessibilityLabel="Abrir calendário"
                      disabled={!editable}
                      onPress={openExpenseCalendar}
                      style={styles.calendarButton}
                    >
                      <Icon name="calendar" size={20} color={tema.azul} />
                    </Toque>
                  </View>
                  {!!expenseDateError && (
                    <Text style={styles.formError}>{expenseDateError}</Text>
                  )}
                  <View style={styles.formDivider} />
                  <View style={styles.formPayerRow}>
                    <View style={[styles.formDetailRow, styles.payerLabelRow]}>
                      <Icon name="user" size={23} color="#35D6A0" />
                      <Text style={styles.formDetailLabel}>Pago por</Text>
                    </View>
                    <Toque
                      accessibilityRole="button"
                      accessibilityLabel="Selecionar quem pagou"
                      disabled={!editable}
                      onPress={() => setPayerPickerOpen(true)}
                      style={styles.payerSelect}
                    >
                      <Text style={styles.payerSelectText}>
                        {payerOptions.find(
                          (payer) => payer.id === sheetItem.pago_por,
                        )?.label || "Selecionar"}
                      </Text>
                      <Icon
                        name="chevron-right"
                        size={17}
                        color={tema.suave}
                      />
                    </Toque>
                  </View>
                </View>

                <View style={styles.descriptionHeading}>
                  <Text style={styles.formSectionTitle}>Descrição</Text>
                  <Text style={styles.descriptionCount}>
                    {sheetItem.descricao.length}/500
                  </Text>
                </View>
                <TextInput
                  accessibilityLabel="Descrição da despesa"
                  editable={editable}
                  maxLength={500}
                  multiline
                  style={[
                    styles.descriptionInput,
                    expenseDescriptionError && styles.descriptionInputError,
                  ]}
                  value={sheetItem.descricao}
                  onChangeText={(value) =>
                    update(sheetIndex, { descricao: value })
                  }
                  placeholder="Ex.: refeição da tripulação"
                  placeholderTextColor={tema.suave}
                />
                {!!expenseDescriptionError && (
                  <Text style={styles.formError}>{expenseDescriptionError}</Text>
                )}

                <Text style={styles.formSectionTitle}>
                  Comprovantes · {sheetItem.anexos.length + (pendingAttachment ? 1 : 0)}
                </Text>
                {pendingAttachment && (
                  <View style={styles.pendingProof}>
                    {pendingAttachment.mime.startsWith("image/") ? (
                      <Image
                        source={{ uri: pendingAttachment.uri }}
                        resizeMode="cover"
                        style={styles.pendingProofImage}
                      />
                    ) : (
                      <View style={styles.pendingProofFile}>
                        <Icon name="file-text" size={26} color={tema.azul} />
                      </View>
                    )}
                    <View style={styles.pendingProofInfo}>
                      <Text style={styles.proofFileName} numberOfLines={1}>
                        {pendingAttachment.name}
                      </Text>
                      <Text style={styles.muted}>Pronto para salvar</Text>
                    </View>
                    <Toque
                      accessibilityRole="button"
                      accessibilityLabel="Remover comprovante selecionado"
                      onPress={() => setPendingAttachment(null)}
                      style={styles.proofIconButton}
                    >
                      <Icon name="x-circle" size={19} color={tema.perigo} />
                    </Toque>
                  </View>
                )}
                {sheetItem.anexos.map((attachment) => (
                  <View key={attachment.id} style={styles.proofRow}>
                    <Icon
                      name={
                        attachment.tipo_arquivo?.startsWith("image/")
                          ? "image"
                          : "file-text"
                      }
                      size={18}
                      color="#35D6A0"
                    />
                    <Toque
                      accessibilityRole="button"
                      accessibilityLabel={`Visualizar comprovante ${attachment.nome_arquivo || "anexado"}`}
                      style={styles.proofRowOpenButton}
                      disabled={!!busy}
                      onPress={() => void viewProof(attachment)}
                    >
                      <Text style={styles.link} numberOfLines={1}>
                        {attachment.nome_arquivo || "Abrir comprovante"}
                      </Text>
                      <Text style={styles.muted}>Toque para visualizar</Text>
                    </Toque>
                    {editable && (
                      <Toque
                        accessibilityRole="button"
                        accessibilityLabel="Excluir comprovante"
                        onPress={() => removeProof(attachment)}
                        style={styles.proofIconButton}
                      >
                        <Icon name="x-circle" size={19} color={tema.perigo} />
                      </Toque>
                    )}
                  </View>
                ))}
                {editable && (
                  <View style={styles.attachActions}>
                    <Toque
                      disabled={!!busy}
                      onPress={() => void selectAttachment("camera")}
                      style={styles.attach}
                    >
                      <Icon name="camera" size={19} color={tema.azul} />
                      <Text style={styles.attachText}>Tirar foto</Text>
                    </Toque>
                    <Toque
                      disabled={!!busy}
                      onPress={() => void selectAttachment("foto")}
                      style={styles.attach}
                    >
                      <Icon name="image" size={19} color="#5E5CE6" />
                      <Text style={styles.attachText}>Galeria</Text>
                    </Toque>
                    <Toque
                      disabled={!!busy}
                      onPress={() => void selectAttachment("arquivo")}
                      style={styles.attach}
                    >
                      <Icon name="upload" size={19} color="#5E5CE6" />
                      <Text style={styles.attachText}>Arquivo</Text>
                    </Toque>
                  </View>
                )}
              </ScrollView>
              <View style={styles.sheetFooter}>
                {editable && (
                  <Toque
                    accessibilityRole="button"
                    accessibilityLabel="Excluir despesa"
                    onPress={() => deleteExpense(sheetIndex)}
                    style={styles.sheetDelete}
                  >
                    <Icon name="trash-2" size={18} color={tema.perigo} />
                    <Text style={styles.sheetDeleteText}>Excluir</Text>
                  </Toque>
                )}
                {editable && sheetIsNew && (
                  <Toque
                    accessibilityRole="button"
                    disabled={!!busy}
                    onPress={() => void saveAndAddAnother()}
                    style={[styles.sheetAddAnother, !!busy && { opacity: 0.5 }]}
                  >
                    <Text style={styles.sheetAddAnotherText}>
                      Salvar e adicionar outra
                    </Text>
                  </Toque>
                )}
                <Toque
                  accessibilityRole="button"
                  disabled={!!busy}
                  onPress={() =>
                    editable ? void saveAndClose() : setExpenseSheetId(null)
                  }
                  style={[
                    styles.primary,
                    styles.sheetDone,
                    !!busy && { opacity: 0.5 },
                  ]}
                >
                  <Text style={styles.primaryText}>
                    {editable
                      ? busy === "save"
                        ? "Salvando…"
                        : "Salvar"
                      : "Fechar"}
                  </Text>
                </Toque>
              </View>
            </View>
            {(payerPickerOpen || calendarOpen) && (
              <View style={styles.pickerOverlay}>
                <Toque
                  accessibilityRole="button"
                  accessibilityLabel="Fechar seletor"
                  onPress={() => {
                    setPayerPickerOpen(false);
                    setCalendarOpen(false);
                  }}
                  style={styles.pickerDismiss}
                />
                <View style={styles.pickerSheet}>
                  <View style={styles.pickerHeader}>
                    <Text style={styles.pickerTitle}>
                      {payerPickerOpen ? "Pago por" : "Data da despesa"}
                    </Text>
                    <Toque
                      accessibilityRole="button"
                      accessibilityLabel="Fechar seletor"
                      onPress={() => {
                        setPayerPickerOpen(false);
                        setCalendarOpen(false);
                      }}
                      style={styles.sheetClose}
                    >
                      <Icon name="x" size={19} color={tema.texto} />
                    </Toque>
                  </View>
                  {payerPickerOpen ? (
                    <View style={styles.payerOptionList}>
                      {payerOptions.map((payer) => {
                        const active = sheetItem.pago_por === payer.id;
                        return (
                          <Toque
                            key={payer.id}
                            accessibilityRole="button"
                            accessibilityState={{ selected: active }}
                            onPress={() => {
                              update(sheetIndex, { pago_por: payer.id });
                              setPayerPickerOpen(false);
                            }}
                            style={styles.payerOptionRow}
                          >
                            <View
                              style={[
                                styles.payerDot,
                                { backgroundColor: payer.color },
                              ]}
                            />
                            <Text style={styles.payerOptionLabel}>
                              {payer.label}
                            </Text>
                            {active && (
                              <Icon
                                name="check"
                                size={19}
                                color={tema.azul}
                              />
                            )}
                          </Toque>
                        );
                      })}
                    </View>
                  ) : (
                    <>
                      <View style={styles.calendarMonthHeader}>
                        <Toque
                          accessibilityRole="button"
                          accessibilityLabel="Mês anterior"
                          onPress={() => shiftCalendarMonth(-1)}
                          style={styles.calendarNavButton}
                        >
                          <Icon
                            name="chevron-left"
                            size={19}
                            color={tema.texto}
                          />
                        </Toque>
                        <Text style={styles.calendarMonthName}>
                          {calendarMonthName}
                        </Text>
                        <Toque
                          accessibilityRole="button"
                          accessibilityLabel="Próximo mês"
                          onPress={() => shiftCalendarMonth(1)}
                          style={styles.calendarNavButton}
                        >
                          <Icon
                            name="chevron-right"
                            size={19}
                            color={tema.texto}
                          />
                        </Toque>
                      </View>
                      <View style={styles.calendarGrid}>
                        {["D", "S", "T", "Q", "Q", "S", "S"].map(
                          (weekday, index) => (
                            <Text
                              key={`${weekday}-${index}`}
                              style={styles.calendarWeekday}
                            >
                              {weekday}
                            </Text>
                          ),
                        )}
                        {calendarCells.map((day, index) => {
                          const dayDate =
                            day === null
                              ? null
                              : dataDespesaDeDiaMes(
                                  `${String(day).padStart(2, "0")}/${String(calendarMonth.month).padStart(2, "0")}`,
                                  calendarMonth.year,
                                );
                          const active =
                            dayDate !== null &&
                            dayDate === sheetItem.data;
                          return day === null ? (
                            <View
                              key={`empty-${index}`}
                              style={styles.calendarDay}
                            />
                          ) : (
                            <Toque
                              key={`day-${day}`}
                              accessibilityRole="button"
                              accessibilityLabel={`Selecionar dia ${day}`}
                              accessibilityState={{ selected: active }}
                              onPress={() => selectCalendarDay(day)}
                              style={[
                                styles.calendarDay,
                                active && styles.calendarDayActive,
                              ]}
                            >
                              <Text
                                style={[
                                  styles.calendarDayText,
                                  active && styles.calendarDayTextActive,
                                ]}
                              >
                                {day}
                              </Text>
                            </Toque>
                          );
                        })}
                      </View>
                    </>
                  )}
                </View>
              </View>
            )}
          </View>
        ) : null}
      </Modal>
      <Modal
        transparent
        animationType="fade"
        visible={Boolean(approvalAction)}
        onRequestClose={() => setApprovalAction(null)}
      >
        <View style={styles.proofPreviewBackdrop}>
          <View style={styles.approvalModal}>
            <Text style={styles.approvalModalTitle}>
              {approvalAction === "approve" ? "Aprovar este relatório?" : "Rejeitar este relatório?"}
            </Text>
            {approvalAction === "approve" ? (
              <Text style={styles.approvalModalText}>
                Você está confirmando a aprovação das despesas deste relatório.
              </Text>
            ) : (
              <TextInput
                accessibilityLabel="Motivo da rejeição"
                value={approvalReason}
                onChangeText={setApprovalReason}
                placeholder="Informe o que precisa ser corrigido"
                placeholderTextColor="#8E9FB4"
                multiline
                maxLength={2000}
                textAlignVertical="top"
                style={styles.approvalReasonInput}
              />
            )}
            <View style={styles.approvalModalButtons}>
              <Toque
                accessibilityRole="button"
                onPress={() => setApprovalAction(null)}
                disabled={busy === "approval"}
                style={styles.approvalCancelButton}
              >
                <Text style={styles.approvalCancelText}>Cancelar</Text>
              </Toque>
              <Toque
                accessibilityRole="button"
                onPress={() => void decideApproval()}
                disabled={busy === "approval"}
                style={approvalAction === "approve" ? styles.approveApprovalButton : styles.rejectApprovalButton}
              >
                {busy === "approval" ? (
                  <ActivityIndicator color={approvalAction === "approve" ? "#061A12" : "#FF7190"} />
                ) : (
                  <Text style={approvalAction === "approve" ? styles.approveApprovalText : styles.rejectApprovalText}>
                    {approvalAction === "approve" ? "Confirmar aprovação" : "Confirmar rejeição"}
                  </Text>
                )}
              </Toque>
            </View>
          </View>
        </View>
      </Modal>
      <Modal
        transparent
        animationType="fade"
        visible={Boolean(proofPreview)}
        onRequestClose={() => setProofPreview(null)}
      >
        <View style={styles.proofPreviewBackdrop}>
          <View style={styles.proofPreviewSheet}>
            <View style={styles.proofPreviewHeader}>
              <Text style={styles.proofPreviewTitle} numberOfLines={1}>
                {proofPreview?.title || "Comprovante"}
              </Text>
              <Toque
                accessibilityRole="button"
                accessibilityLabel="Baixar comprovante"
                disabled={!proofPreview || privateDownloadBusy}
                onPress={() => {
                  if (!proofPreview) return;
                  void downloadPrivateFile(
                    proofPreview.path,
                    proofPreview.title,
                    proofPreview.mime,
                  );
                }}
                style={styles.proofDownloadButton}
              >
                {privateDownloadBusy ? (
                  <ActivityIndicator size="small" color={tema.azul} />
                ) : (
                  <>
                    <Icon name="download" size={16} color={tema.azul} />
                    <Text style={styles.proofDownloadText}>Baixar</Text>
                  </>
                )}
              </Toque>
              <Toque
                accessibilityRole="button"
                accessibilityLabel="Fechar comprovante"
                onPress={() => setProofPreview(null)}
                style={styles.sheetClose}
              >
                <Icon name="x" size={20} color={tema.texto} />
              </Toque>
            </View>
            {proofPreview && (
              <Image
                source={{ uri: proofPreview.uri }}
                resizeMode="contain"
                style={styles.proofPreviewImage}
                accessibilityLabel="Imagem do comprovante"
              />
            )}
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  sheetBackdrop: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(3, 7, 18, 0.72)",
  },
  expenseSheet: {
    maxHeight: "92%",
    backgroundColor: tema.superficie,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: 1,
    borderColor: tema.borda,
    overflow: "hidden",
  },
  sheetHandle: {
    alignSelf: "center",
    width: 42,
    height: 5,
    borderRadius: 3,
    backgroundColor: tema.borda,
    marginTop: 8,
  },
  sheetHeader: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 10,
  },
  sheetKicker: { color: tema.azul, fontSize: 10, fontWeight: "800", letterSpacing: 1.2 },
  sheetTitle: { color: tema.texto, fontSize: 20, fontWeight: "800", marginTop: 3 },
  sheetClose: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: tema.fundo,
    alignItems: "center",
    justifyContent: "center",
  },
  sheetContent: { paddingHorizontal: 16, paddingBottom: 12 },
  expenseValue: { alignItems: "center", paddingVertical: 17 },
  expenseValueLabel: { color: tema.suave, fontSize: 13 },
  expenseValueRow: {
    flexDirection: "row",
    alignItems: "baseline",
    justifyContent: "center",
    gap: 7,
    marginTop: 4,
  },
  expenseCurrency: { color: tema.suave, fontSize: 24, fontWeight: "500" },
  expenseValueInput: {
    color: tema.texto,
    fontSize: 46,
    fontWeight: "800",
    minWidth: 130,
    padding: 0,
    textAlign: "center",
  },
  expenseValueInputCompact: { fontSize: 36, minWidth: 110 },
  formSectionTitle: {
    color: tema.texto,
    fontSize: 16,
    fontWeight: "700",
    marginTop: 13,
    marginBottom: 9,
  },
  categoryGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  categoryOption: {
    width: "31.5%",
    minHeight: 82,
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
    paddingHorizontal: 4,
    paddingVertical: 9,
    borderRadius: 12,
    backgroundColor: "rgba(255,255,255,0.04)",
    borderWidth: 1.5,
    borderColor: "transparent",
  },
  categoryOptionText: {
    color: tema.suave,
    fontSize: 12,
    textAlign: "center",
  },
  categoryOptionTextActive: { color: tema.texto, fontWeight: "700" },
  formDetails: {
    overflow: "hidden",
    borderRadius: 13,
    backgroundColor: tema.fundo,
    paddingHorizontal: 14,
  },
  formDetailRow: {
    minHeight: 52,
    flexDirection: "row",
    alignItems: "center",
    gap: 11,
  },
  calendarButton: {
    width: 38,
    height: 38,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 10,
    backgroundColor: tema.superficie,
  },
  formDetailLabel: { color: tema.texto, fontSize: 15 },
  formDetailInput: {
    flex: 1,
    minWidth: 0,
    color: tema.azul,
    fontSize: 15,
    textAlign: "right",
  },
  formDivider: { height: 1, backgroundColor: tema.borda },
  formPayerRow: { paddingVertical: 9 },
  payerLabelRow: { minHeight: 38 },
  payerSelect: {
    minHeight: 46,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
    paddingHorizontal: 12,
    borderRadius: 11,
    backgroundColor: tema.superficie,
    borderWidth: 1,
    borderColor: tema.borda,
  },
  payerSelectText: { color: tema.texto, fontSize: 14, fontWeight: "600" },
  pickerOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: "flex-end",
    backgroundColor: "rgba(3, 7, 18, 0.62)",
  },
  pickerDismiss: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  pickerSheet: {
    paddingHorizontal: 18,
    paddingTop: 12,
    paddingBottom: 22,
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    borderWidth: 1,
    borderColor: tema.borda,
    backgroundColor: tema.superficie,
  },
  pickerHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  pickerTitle: { color: tema.texto, fontSize: 18, fontWeight: "800" },
  payerOptionList: { gap: 5 },
  payerOptionRow: {
    minHeight: 50,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 10,
    borderRadius: 11,
    backgroundColor: tema.fundo,
  },
  payerOptionLabel: {
    flex: 1,
    color: tema.texto,
    fontSize: 15,
    fontWeight: "600",
  },
  calendarMonthHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 10,
  },
  calendarNavButton: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 11,
    backgroundColor: tema.fundo,
  },
  calendarMonthName: {
    color: tema.texto,
    fontSize: 16,
    fontWeight: "700",
    textTransform: "capitalize",
  },
  calendarGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
  },
  calendarWeekday: {
    width: "14.2857%",
    height: 32,
    color: tema.suave,
    fontSize: 12,
    fontWeight: "700",
    textAlign: "center",
    textAlignVertical: "center",
  },
  calendarDay: {
    width: "14.2857%",
    minHeight: 42,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 11,
  },
  calendarDayActive: { backgroundColor: tema.azul },
  calendarDayText: { color: tema.texto, fontSize: 14 },
  calendarDayTextActive: { color: tema.fundo, fontWeight: "800" },
  descriptionHeading: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 5,
  },
  descriptionCount: { color: tema.suave, fontSize: 12 },
  descriptionInput: {
    minHeight: 88,
    padding: 13,
    borderWidth: 1,
    borderColor: tema.borda,
    borderRadius: 12,
    backgroundColor: tema.fundo,
    color: tema.texto,
    textAlignVertical: "top",
    fontSize: 15,
  },
  descriptionInputError: { borderColor: tema.perigo },
  formError: { color: tema.perigo, fontSize: 12, marginTop: 6 },
  pendingProof: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 9,
    borderRadius: 12,
    backgroundColor: tema.fundo,
    marginBottom: 7,
  },
  pendingProofImage: { width: 54, height: 54, borderRadius: 8 },
  pendingProofFile: {
    width: 54,
    height: 54,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 8,
    backgroundColor: "#173451",
  },
  pendingProofInfo: { flex: 1, minWidth: 0 },
  proofFileName: { color: tema.texto, fontSize: 13, fontWeight: "600" },
  proofIconButton: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 10,
  },
  attachText: { color: tema.texto, fontSize: 12, fontWeight: "600" },
  sheetAddAnother: {
    flex: 1,
    minHeight: 50,
    paddingHorizontal: 8,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 13,
    borderWidth: 1,
    borderColor: tema.azul,
  },
  sheetAddAnotherText: {
    color: tema.azul,
    fontSize: 12,
    fontWeight: "700",
    textAlign: "center",
  },
  proofPreviewBackdrop: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 18,
    backgroundColor: "rgba(3, 7, 18, 0.92)",
  },
  proofPreviewSheet: {
    width: "100%",
    maxWidth: 760,
    height: "82%",
    overflow: "hidden",
    borderRadius: 18,
    backgroundColor: tema.superficie,
    borderWidth: 1,
    borderColor: tema.borda,
  },
  proofPreviewHeader: {
    minHeight: 56,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
    paddingHorizontal: 14,
    borderBottomWidth: 1,
    borderBottomColor: tema.borda,
  },
  proofPreviewTitle: {
    flex: 1,
    color: tema.texto,
    fontSize: 15,
    fontWeight: "700",
  },
  proofPreviewImage: { flex: 1, width: "100%" },
  proofDownloadButton: {
    minHeight: 38,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
    paddingHorizontal: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: tema.borda,
    backgroundColor: "#14243A",
  },
  proofDownloadText: { color: tema.azul, fontSize: 12, fontWeight: "700" },
  approvalActions: {
    marginTop: 14,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: tema.borda,
    gap: 10,
  },
  approvalHint: { color: "#F8D16C", fontSize: 12, fontWeight: "700" },
  approvalButtons: { flexDirection: "row", gap: 10 },
  approveApprovalButton: {
    flex: 1,
    minHeight: 46,
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
    borderRadius: 12,
    backgroundColor: "#35D6A0",
  },
  approveApprovalText: { color: "#061A12", fontSize: 12, fontWeight: "800" },
  rejectApprovalButton: {
    flex: 1,
    minHeight: 46,
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#71363D",
    backgroundColor: "#1C1723",
  },
  rejectApprovalText: { color: "#FF7190", fontSize: 12, fontWeight: "800" },
  approvalModal: {
    width: "100%",
    maxWidth: 520,
    padding: 18,
    borderRadius: 18,
    backgroundColor: tema.superficie,
    borderWidth: 1,
    borderColor: tema.borda,
  },
  approvalModalTitle: { color: tema.texto, fontSize: 18, fontWeight: "800" },
  approvalModalText: { marginTop: 12, color: tema.suave, fontSize: 13, lineHeight: 20 },
  approvalReasonInput: {
    minHeight: 110,
    marginTop: 14,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: tema.borda,
    color: tema.texto,
    fontSize: 13,
    lineHeight: 19,
  },
  approvalModalButtons: { flexDirection: "row", gap: 10, marginTop: 16 },
  approvalCancelButton: {
    flex: 1,
    minHeight: 46,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: tema.borda,
  },
  approvalCancelText: { color: tema.suave, fontSize: 12, fontWeight: "800" },
  sheetFooter: {
    flexDirection: "row",
    gap: 10,
    paddingHorizontal: 16,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: tema.borda,
  },
  sheetDelete: {
    minWidth: 88,
    height: 50,
    flexDirection: "row",
    gap: 7,
    borderRadius: 13,
    borderWidth: 1,
    borderColor: "#71363D",
    alignItems: "center",
    justifyContent: "center",
  },
  sheetDeleteText: { color: tema.perigo, fontSize: 13, fontWeight: "700" },
  sheetDone: { flex: 1, minHeight: 50 },
  reportFooter: {
    marginTop: 16,
    gap: 12,
  },
  observationsCard: {
    minHeight: 82,
    padding: 14,
    borderRadius: 13,
    backgroundColor: "#111C2E",
    borderWidth: 1,
    borderColor: "#1E2D44",
  },
  observationsLabel: {
    color: "#6EAFFF",
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 0.6,
  },
  observationsInput: {
    minHeight: 34,
    padding: 0,
    paddingTop: 7,
    color: tema.texto,
    fontSize: 13,
    lineHeight: 19,
  },
  reportFooterActions: {
    flexDirection: "row",
    alignItems: "stretch",
    gap: 10,
  },
  saveDraftButton: {
    width: 50,
    minHeight: 50,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 14,
    backgroundColor: tema.superficie,
    borderWidth: 1,
    borderColor: tema.borda,
  },
  sendFinanceButton: {
    flex: 1,
    minHeight: 50,
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 9,
    borderRadius: 14,
    backgroundColor: "#2E86D4",
  },
  sendFinanceText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "800",
  },
  steps: { flexDirection: "row", gap: 8, marginBottom: 16 },
  step: { flex: 1, flexDirection: "row", alignItems: "center", gap: 6 },
  stepNumber: {
    height: 23,
    width: 23,
    borderRadius: 9,
    backgroundColor: tema.superficie,
    alignItems: "center",
    justifyContent: "center",
  },
  stepCurrent: { backgroundColor: tema.azul },
  stepLabel: { fontSize: 10, color: tema.suave },
  expenseSummary: { flexDirection: "row", alignItems: "center", gap: 11, minWidth: 0 },
  expenseIcon: {
    width: 38,
    height: 38,
    borderRadius: 11,
    backgroundColor: "#172D46",
    alignItems: "center",
    justifyContent: "center",
  },
  startAction: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    padding: 9,
  },
  root: { flex: 1, backgroundColor: tema.fundo },
  header: {
    paddingHorizontal: 19,
    paddingVertical: 17,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  eyebrow: {
    fontSize: 11,
    letterSpacing: 1.3,
    fontWeight: "800",
    color: tema.azul,
  },
  title: { fontSize: 25, color: "#fff", fontWeight: "800", marginTop: 5 },
  iconButton: {
    width: 45,
    height: 45,
    backgroundColor: tema.superficie,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 14,
  },
  between: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  tabs: {
    flexDirection: "row",
    backgroundColor: tema.superficie,
    borderRadius: 15,
    padding: 5,
    marginBottom: 18,
  },
  tabContent: { flexDirection: "row", alignItems: "center", gap: 8 },
  tab: {
    flex: 1,
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 11,
  },
  tabActive: { backgroundColor: "#FFFFFF" },
  tabText: { color: tema.suave, fontSize: 14, fontWeight: "800" },
  sectionTitle: {
    color: "#91a9bd",
    fontSize: 11,
    letterSpacing: 1.35,
    fontWeight: "800",
    marginTop: 18,
    marginBottom: 10,
  },
  paymentStats: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 18,
  },
  paymentStat: {
    flex: 1,
    minWidth: 0,
    minHeight: 88,
    justifyContent: "center",
    padding: 12,
    borderRadius: 17,
    borderWidth: 1,
    borderColor: tema.borda,
    backgroundColor: "#111C2E",
  },
  paymentStatLabel: { color: "#7185A0", fontSize: 10, fontWeight: "700" },
  paymentStatValue: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "800",
    marginTop: 7,
  },
  reportSearch: {
    minHeight: 48,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingLeft: 13,
    paddingRight: 6,
    borderRadius: 13,
    borderWidth: 1,
    borderColor: tema.borda,
    backgroundColor: tema.superficie,
    marginBottom: 10,
  },
  reportSearchInput: {
    flex: 1,
    minWidth: 0,
    minHeight: 46,
    color: tema.texto,
    fontSize: 14,
  },
  searchClear: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 10,
  },
  reportFilters: { gap: 8, paddingVertical: 4, marginBottom: 4 },
  reportFilter: {
    minHeight: 34,
    paddingHorizontal: 13,
    borderRadius: 17,
    backgroundColor: tema.superficie,
    borderWidth: 1,
    borderColor: tema.borda,
    alignItems: "center",
    justifyContent: "center",
  },
  reportFilterActive: { backgroundColor: tema.azul, borderColor: tema.azul },
  reportFilterText: { color: tema.suave, fontSize: 12, fontWeight: "700" },
  reportFilterTextActive: { color: "#fff" },
  reportCard: {
    backgroundColor: "#192338",
    borderRadius: 16,
    borderLeftWidth: 4,
    borderLeftColor: "#6FE3B0",
    paddingVertical: 14,
    paddingHorizontal: 15,
    marginBottom: 12,
  },
  reportCardTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  reportCardRef: {
    flex: 1,
    minWidth: 0,
    color: "#4B9DFF",
    fontSize: 11.5,
    fontWeight: "700",
    letterSpacing: 0.4,
    textTransform: "uppercase",
  },
  reportCardBadge: {
    paddingHorizontal: 11,
    paddingVertical: 4,
    borderRadius: 999,
  },
  reportCardBadgeText: {
    fontSize: 11,
    fontWeight: "700",
  },
  reportCardRoute: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "800",
    textTransform: "uppercase",
    marginTop: 4,
    letterSpacing: 0.2,
  },
  reportCardMetaRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    gap: 14,
    marginTop: 8,
  },
  reportCardMetaItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  reportCardMetaText: {
    color: "#9AAAC0",
    fontSize: 12,
    fontWeight: "500",
  },
  reportCardFinancials: {
    marginTop: 12,
    overflow: "hidden",
    borderRadius: 11,
    backgroundColor: "rgba(11, 17, 30, 0.48)",
  },
  reportCardFinancialScroll: {
    width: "100%",
  },
  reportCardFinancialRow: {
    flexDirection: "row",
    alignItems: "stretch",
    paddingVertical: 9,
    paddingHorizontal: 4,
  },
  reportCardCategoryCol: {
    width: 112,
    flexShrink: 0,
    alignItems: "flex-start",
    justifyContent: "center",
    paddingHorizontal: 10,
    borderRightWidth: 1,
    borderRightColor: "rgba(255,255,255,0.07)",
  },
  reportCardTotalCol: {
    width: 124,
    borderRightWidth: 0,
  },
  reportCardCategoryLabel: {
    color: "#8E9FB4",
    fontSize: 10,
    fontWeight: "600",
  },
  reportCardCategoryValue: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "800",
    marginTop: 3,
  },
  reportCardTotalValue: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "800",
    marginTop: 3,
    letterSpacing: -0.2,
  },
  flightCard: {
    padding: 17,
    borderRadius: 18,
    backgroundColor: tema.superficie,
    marginBottom: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  flightNo: { color: "#fff", fontWeight: "800", fontSize: 17 },
  tag: {
    backgroundColor: "#23425c",
    color: "#92e2ca",
    borderRadius: 8,
    overflow: "hidden",
    paddingHorizontal: 9,
    paddingVertical: 6,
    fontSize: 11,
    fontWeight: "700",
  },
  actionIcon: {
    width: 42,
    height: 42,
    borderRadius: 13,
    backgroundColor: "#1e3851",
    alignItems: "center",
    justifyContent: "center",
  },
  amount: { color: "#fff", fontWeight: "800", fontSize: 14 },
  secondary: { color: "#b1c0d1", fontSize: 13, marginTop: 4, lineHeight: 19 },
  muted: { color: tema.suave, fontSize: 12, lineHeight: 18, marginTop: 3 },
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12 },
  warning: {
    backgroundColor: "#4a2530",
    padding: 13,
    marginHorizontal: 18,
    borderRadius: 11,
  },
  warningText: { color: "#ffb5bb", fontSize: 13 },
  summaryCard: {
    backgroundColor: "#111C2E",
    padding: 15,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#223147",
    marginBottom: 10,
  },
  reportTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  reportReference: { flex: 1, minWidth: 0 },
  reportStatusBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 12,
    backgroundColor: "#273346",
  },
  reportStatusText: {
    color: "#C4CFDD",
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 0.4,
  },
  bigRoute: {
    fontSize: 21,
    fontWeight: "800",
    color: "#fff",
    marginTop: 4,
    letterSpacing: 0.3,
  },
  flightMetaRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    gap: 14,
    marginTop: 6,
  },
  flightMetaItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    minWidth: 0,
  },
  flightMetaText: { color: "#9AAAC0", fontSize: 12, fontWeight: "500" },
  summaryDivider: {
    height: 1,
    backgroundColor: "rgba(255,255,255,0.06)",
    marginTop: 12,
    marginBottom: 11,
  },
  expenseBreakdown: {
    padding: 0,
  },
  breakdownLabel: { color: "#7E91A8", fontSize: 11.5 },
  breakdownTotalRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    gap: 10,
    marginTop: 2,
  },
  breakdownTotal: {
    color: "#FFFFFF",
    fontSize: 28,
    fontWeight: "800",
    letterSpacing: -0.6,
  },
  breakdownTotalCompact: { fontSize: 24 },
  breakdownNote: { alignItems: "flex-end", marginBottom: 3 },
  breakdownNoteText: { color: "#7E91A8", fontSize: 11 },
  missingProofText: {
    color: "#FFBF26",
    fontSize: 11,
    fontWeight: "600",
    marginTop: 1,
  },
  proofsCompleteText: { color: "#35D6A0" },
  payerSummary: {
    paddingVertical: 9,
    paddingHorizontal: 11,
    marginBottom: 12,
    borderRadius: 13,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.06)",
    backgroundColor: "rgba(17, 28, 46, 0.72)",
  },
  payerHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 6,
  },
  payerTitle: {
    color: "#7E91A8",
    fontSize: 10.5,
    fontWeight: "800",
    letterSpacing: 0.7,
    textTransform: "uppercase",
  },
  payerClear: { paddingHorizontal: 6, paddingVertical: 2 },
  payerClearText: { color: tema.azul, fontSize: 11, fontWeight: "700" },
  payerChipsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
  payerChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 9,
    backgroundColor: "rgba(255, 255, 255, 0.035)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.06)",
  },
  payerChipActive: {
    backgroundColor: "rgba(85, 174, 255, 0.14)",
    borderColor: "rgba(85, 174, 255, 0.42)",
  },
  payerDot: { width: 7, height: 7, borderRadius: 4 },
  payerName: { color: "#A4B5C8", fontSize: 11.5, fontWeight: "600" },
  payerAmount: { color: "#FFFFFF", fontSize: 11.5, fontWeight: "700" },
  categoryBar: {
    height: 7,
    borderRadius: 4,
    overflow: "hidden",
    flexDirection: "row",
    backgroundColor: tema.borda,
    marginTop: 10,
  },
  categoryLegend: {
    flexDirection: "row",
    flexWrap: "wrap",
    columnGap: 14,
    rowGap: 7,
    marginTop: 11,
  },
  categoryLegendItem: {
    width: "47%",
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  categoryDot: { width: 7, height: 7, borderRadius: 4 },
  categoryName: { flex: 1, color: "#9AAAC0", fontSize: 11.5 },
  categoryAmount: { color: "#FFFFFF", fontSize: 11.5, fontWeight: "700" },
  expenseHeading: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 4,
    marginBottom: 10,
  },
  expenseHeadingTitle: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "800",
  },
  addExpense: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 10,
    backgroundColor: "rgba(85, 174, 255, 0.14)",
    borderWidth: 1,
    borderColor: "rgba(85, 174, 255, 0.4)",
  },
  addExpenseText: { color: "#55AEFF", fontSize: 13, fontWeight: "700" },
  primary: {
    minHeight: 56,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    borderRadius: 15,
    backgroundColor: tema.azul,
    marginBottom: 12,
  },
  primaryText: { color: tema.fundo, fontSize: 15, fontWeight: "800" },
  outlinedButton: {
    borderWidth: 1,
    borderColor: tema.borda,
    borderRadius: 12,
    minHeight: 46,
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 8,
    marginTop: 10,
  },
  link: { color: tema.azul, fontWeight: "700", fontSize: 12 },
  itemCard: {
    backgroundColor: "#111C2E",
    borderRadius: 14,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: "#1E2D44",
  },
  swipeContainer: {
    position: "relative",
    overflow: "hidden",
    borderRadius: 14,
    marginBottom: 8,
  },
  swipeContent: { zIndex: 1 },
  swipeCard: { marginBottom: 0 },
  swipeDelete: {
    position: "absolute",
    top: 0,
    right: 0,
    bottom: 0,
    width: 84,
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
    backgroundColor: "#D93B45",
  },
  swipeDeleteText: { color: "#fff", fontSize: 11, fontWeight: "700" },
  expenseMain: {
    flex: 1,
    minWidth: 0,
    flexDirection: "row",
    alignItems: "center",
    gap: 11,
  },
  expenseTrailing: { alignItems: "flex-end", gap: 3 },
  expenseAttachmentButton: {
    minHeight: 56,
    flexDirection: "row",
    alignItems: "center",
    gap: 11,
    marginTop: 10,
    paddingTop: 9,
    borderTopWidth: 1,
    borderTopColor: tema.borda,
  },
  expenseAttachmentIcon: {
    width: 38,
    height: 38,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 11,
    backgroundColor: "rgba(53, 214, 160, 0.12)",
  },
  expenseAttachmentInfo: { flex: 1, minWidth: 0, gap: 3 },
  expenseAttachmentTitle: {
    color: "#35D6A0",
    fontSize: 13,
    fontWeight: "700",
  },
  expenseAttachmentName: { color: tema.suave, fontSize: 11 },
  editChevronButton: {
    paddingVertical: 2,
    paddingLeft: 6,
  },
  itemTitle: { fontSize: 14, fontWeight: "700", color: "#fff" },
  itemSubtitle: { color: tema.suave, fontSize: 11.5, marginTop: 2 },
  proofRow: {
    flexDirection: "row",
    gap: 10,
    paddingVertical: 9,
    alignItems: "center",
    borderTopWidth: 1,
    borderTopColor: tema.borda,
  },
  proofRowOpenButton: {
    flex: 1,
    minWidth: 0,
    minHeight: 46,
    justifyContent: "center",
    gap: 3,
  },
  attachActions: { flexDirection: "row", gap: 8, marginTop: 11 },
  attach: {
    flex: 1,
    flexDirection: "row",
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    backgroundColor: "#173451",
    borderRadius: 11,
  },
  historyRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    paddingVertical: 9,
    borderTopWidth: 1,
    borderTopColor: tema.borda,
  },
  rowTitle: { fontSize: 13, color: "#fff", marginTop: 5 },
  empty: {
    padding: 28,
    gap: 8,
    alignItems: "center",
    backgroundColor: "#111C2E",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#1E2D44",
    marginBottom: 12,
  },
});
