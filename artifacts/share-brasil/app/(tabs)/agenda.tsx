import { useLocalSearchParams, useFocusEffect, useRouter } from "expo-router";
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";
import {
  Cabecalho,
  Vazio,
  tema,
  Icon,
  Toque,
  type Icone,
} from "@/src/components/ui";
import { FotoAeronave } from "@/src/components/FotoAeronave";
import { apiFetch } from "@/src/lib/api";
import { obterImagemAeronave } from "@/src/lib/aeronave-imagem";
import { abrirBriefingPdf } from "@/src/lib/briefing-pdf";
import { useAeronave } from "@/hooks/useAeronave";

type Flight = {
  id: string;
  numero_voo?: string;
  origem?: string;
  destino?: string;
  origem_cidade?: string;
  destino_cidade?: string;
  data_agendada?: string;
  horario_previsto_agendamento?: string;
  duracao?: string | number;
  duracao_minutos?: number | string;
  tempo_voo?: string | number;
  matricula_registro?: string;
  modelo?: string;
  status?: string;
  solicitacao_id?: string;
  numero_passageiros?: number | null;
  aeronave_id?: string | null;
  cliente_id?: string;
  socio_id?: string;
  url_imagem?: string | null;
  aeronave_url_imagem?: string | null;
  foto_aeronave?: string | null;
  aeronave_foto_url?: string | null;
  imagem_aeronave?: string | null;
  aeronave?: {
    url_imagem?: string | null;
    image_url?: string | null;
    foto_url?: string | null;
    imagem_url?: string | null;
  } | null;
};

type Leg = {
  id: string;
  numero: number;
  origem: string;
  destino: string;
  horario_ac?: string | null;
  horario_dep?: string | null;
  horario_pouso?: string | null;
  horario_corte?: string | null;
  lancamento_diario_id?: string | null;
  diario_confirmado?: number;
  diario_assinado_pic?: string | null;
  diario_fechado?: number;
};

type Journey = {
  id: string;
  status: string;
  pernas: Leg[];
  funcao_tripulante?: string;
};

type Detail = {
  voo: Flight & {
    mensagem?: string | null;
    cliente_razao_social?: string | null;
    piloto_nome?: string | null;
    copiloto_nome?: string | null;
  };
  jornadas: Journey[];
  hospedagens: Record<string, unknown>[];
};

const CORES = {
  fundo: "#0B0F22",
  card: "#141A32",
  cardBorda: "#222A46",
  pillBg: "#161D36",
  amarelo: "#F5CE3E",
  amareloTexto: "#10152B",
  amareloSuave: "rgba(245, 206, 62, 0.14)",
  amareloBorda: "rgba(245, 206, 62, 0.42)",
  verde: "#34D399",
  verdeSuave: "rgba(52, 211, 153, 0.14)",
  azul: tema.azul,
  muted: "#8E96B0",
  textoSecundario: "#B6BED4",
};

const MESES_CURTOS = [
  "Jan",
  "Fev",
  "Mar",
  "Abr",
  "Mai",
  "Jun",
  "Jul",
  "Ago",
  "Set",
  "Out",
  "Nov",
  "Dez",
];

const hhmm = (v?: string | null) =>
  v ? String(v).match(/(\d{2}:\d{2})/)?.[1] || "" : "";

const today = () => {
  const d = new Date();
  return [
    d.getFullYear(),
    String(d.getMonth() + 1).padStart(2, "0"),
    String(d.getDate()).padStart(2, "0"),
  ].join("-");
};

const formatDateFull = (v?: string) =>
  v ? v.slice(0, 10).split("-").reverse().join("/") : "—";

const formatDateEmphasis = (v?: string) => {
  const [year, month, day] = String(v || "").slice(0, 10).split("-");
  const monthLabel = MESES_CURTOS[Number(month) - 1];
  return year && day && monthLabel
    ? `${day} ${monthLabel.toUpperCase()} ${year}`
    : "A definir";
};

const aircraftImageOf = (voo: Flight) => obterImagemAeronave(voo);

const timeUntilFlight = (voo: Flight) => {
  const hora = hhmm(voo.horario_previsto_agendamento);
  const data = String(voo.data_agendada || "").slice(0, 10);
  if (!hora || !data) return null;

  const remainingMinutes = Math.round(
    (new Date(`${data}T${hora}:00`).getTime() - Date.now()) / 60_000,
  );
  if (!Number.isFinite(remainingMinutes) || remainingMinutes <= 0) return null;
  if (remainingMinutes < 60) return `${remainingMinutes}MIN`;
  return `${Math.floor(remainingMinutes / 60)}H${String(
    remainingMinutes % 60,
  ).padStart(2, "0")}MIN`;
};

const dateKey = (d: Date) =>
  [
    d.getFullYear(),
    String(d.getMonth() + 1).padStart(2, "0"),
    String(d.getDate()).padStart(2, "0"),
  ].join("-");

const flightDurationMinutes = (voo: Flight) => {
  const minutes = Number(voo.duracao_minutos);
  if (Number.isFinite(minutes) && minutes > 0) return Math.round(minutes);

  const raw = voo.tempo_voo ?? voo.duracao;
  if (typeof raw === "number") {
    return Number.isFinite(raw) && raw > 0 ? Math.round(raw * 60) : 0;
  }
  if (typeof raw !== "string") return 0;

  const value = raw.trim().toLowerCase().replace(",", ".");
  const clock = value.match(/^(\d+):([0-5]\d)(?::[0-5]\d)?$/);
  if (clock) return Number(clock[1]) * 60 + Number(clock[2]);

  const hoursAndMinutes = value.match(
    /^(\d+(?:\.\d+)?)\s*h(?:oras?)?\s*(\d+)?\s*m?(?:in(?:utos?)?)?$/,
  );
  if (hoursAndMinutes) {
    return (
      Math.round(Number(hoursAndMinutes[1]) * 60) +
      Number(hoursAndMinutes[2] || 0)
    );
  }

  const decimalHours = value.match(/^(\d+(?:\.\d+)?)\s*(?:h|horas?)?$/);
  return decimalHours ? Math.round(Number(decimalHours[1]) * 60) : 0;
};

const formatDuration = (voo: Flight) => {
  const minutes = flightDurationMinutes(voo);
  if (minutes > 0) {
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return `${h}h ${String(m).padStart(2, "0")}m`;
  }
  return voo.duracao || voo.tempo_voo || "—";
};

const normalizeStatus = (status?: string) =>
  String(status || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toUpperCase()
    .replace(/[\s-]+/g, "_");

const isClosedStatus = (status?: string) =>
  [
    "ENCERRADO",
    "ENCERRADA",
    "CONCLUIDO",
    "CONCLUIDA",
    "FINALIZADO",
    "FINALIZADA",
    "CLOSED",
  ].includes(normalizeStatus(status));

const STATUS_APROVAR = new Set([
  "PENDENTE",
  "A_APROVAR",
  "AGUARDANDO_APROVACAO",
]);

const STATUS_APROVADOS = new Set([
  "APROVADA",
  "APROVADO",
  "CONFIRMADA",
  "CONFIRMADO",
]);

function getStatusBadge(status?: string) {
  const norm = normalizeStatus(status);
  if (isClosedStatus(status)) {
    return {
      label: "Concluído",
      bg: "rgba(142, 150, 176, 0.16)",
      color: CORES.textoSecundario,
    };
  }
  if (["EM_ROTA", "EM_VOO", "DECOLADO"].includes(norm)) {
    return {
      label: "Em voo",
      bg: CORES.verdeSuave,
      color: CORES.verde,
    };
  }
  if (["EM_SOLO", "ACIONADO", "POUSADO"].includes(norm)) {
    return {
      label: norm === "ACIONADO" ? "Acionado" : "Em solo",
      bg: CORES.verdeSuave,
      color: CORES.verde,
    };
  }
  if (STATUS_APROVAR.has(norm)) {
    return {
      label: "A aprovar",
      bg: CORES.amareloSuave,
      color: CORES.amarelo,
    };
  }
  if (STATUS_APROVADOS.has(norm)) {
    return {
      label: "Confirmado",
      bg: CORES.verdeSuave,
      color: CORES.verde,
    };
  }
  return {
    label: status || "Agendado",
    bg: "rgba(142, 150, 176, 0.16)",
    color: CORES.textoSecundario,
  };
}

function CardVooItem({
  voo,
  onPress,
  isNextFlight = false,
  imagemAeronave,
}: {
  voo: Flight;
  onPress?: () => void;
  isNextFlight?: boolean;
  imagemAeronave?: string | null;
}) {
  const badge = getStatusBadge(voo.status);
  const horaZ = hhmm(voo.horario_previsto_agendamento);
  const status = normalizeStatus(voo.status);
  const isActive = [
    "EM_SOLO",
    "EM_ROTA",
    "EM_VOO",
    "ACIONADO",
    "DECOLADO",
    "POUSADO",
  ].includes(status);
  const countdown = timeUntilFlight(voo);
  const aeronave = [voo.matricula_registro, voo.modelo]
    .filter(Boolean)
    .join(" · ");
  const imagem = imagemAeronave?.trim() || obterImagemAeronave(voo);

  const content = (
    <View style={s.flightCard}>
      <View style={s.flightCardCover}>
        <FotoAeronave
          uri={imagem}
          style={s.flightCardCoverImage}
          accessibilityLabel={`Foto da aeronave ${voo.matricula_registro || ""}`}
        />
        <View style={s.flightCardCoverShade}>
          <Text numberOfLines={1} style={s.flightCardCoverTitle}>
            {voo.numero_voo || "Voo programado"}
          </Text>
          <Text numberOfLines={1} style={s.flightCardCoverRegistration}>
            {voo.matricula_registro || voo.modelo || "Aeronave"}
          </Text>
        </View>
      </View>
      <View style={s.flightCardContent}>
      <View style={s.cardTopRow}>
        <View style={{ flex: 1 }}>
          {(isNextFlight || isActive) && (
            <Text style={s.kicker}>
              {isActive
                ? "EM OPERAÇÃO"
                : countdown
                  ? `PRÓXIMO VOO · EM ${countdown}`
                  : "PRÓXIMO VOO"}
            </Text>
          )}
          <Text style={s.dateLabel}>DATA DO VOO</Text>
          <Text style={s.dateValue}>
            {formatDateEmphasis(voo.data_agendada)}
          </Text>
        </View>
        <View style={[s.statusBadge, { backgroundColor: badge.bg }]}>
          <Text style={[s.statusBadgeText, { color: badge.color }]}>
            {badge.label}
          </Text>
        </View>
      </View>

      <Text numberOfLines={1} style={s.aircraftText}>
        {aeronave || voo.numero_voo || "Aeronave não informada"}
      </Text>

      <View style={s.routeRow}>
        <View style={s.airportCol}>
          <Text style={s.icaoCode}>{voo.origem || "----"}</Text>
          <Text numberOfLines={1} style={s.cityText}>
            {voo.origem_cidade || "Origem"}
          </Text>
          <Text style={s.airportTime}>{horaZ ? `${horaZ} LT` : "—"}</Text>
        </View>

        <View style={s.routeCenter}>
          <View style={s.routeLineWrap}>
            <View style={s.routeDot} />
            <View style={s.dashedLine} />
            <Icon name="airplane" size={18} color={CORES.azul} />
            <View style={s.dashedLine} />
            <View style={s.routeDot} />
          </View>
          <Text style={s.routeMeta}>{formatDuration(voo)}</Text>
        </View>

        <View style={[s.airportCol, { alignItems: "flex-end" }]}>
          <Text style={s.icaoCode}>{voo.destino || "----"}</Text>
          <Text numberOfLines={1} style={s.cityText}>
            {voo.destino_cidade || "Destino"}
          </Text>
        </View>
      </View>

      <View style={s.flightMetaRow}>
        <View style={s.flightMetaCard}>
          <Text style={s.footerLabel}>SOLICITAÇÃO</Text>
          <Text numberOfLines={1} style={s.footerValue}>
            {voo.solicitacao_id || "—"}
          </Text>
        </View>
        <View style={s.flightMetaCard}>
          <Text style={s.footerLabel}>PAX</Text>
          <Text style={s.footerValue}>
            {voo.numero_passageiros ?? "—"}
          </Text>
        </View>
      </View>
      </View>
    </View>
  );

  if (!onPress) return content;
  return (
    <Toque
      accessibilityRole="button"
      accessibilityLabel={`Detalhes do voo ${voo.numero_voo || voo.origem || ""}`}
      onPress={onPress}
      style={{ marginBottom: 14 }}
    >
      {content}
    </Toque>
  );
}

function CardVooDetalhe({
  voo,
  imagemAeronave,
}: {
  voo: Flight;
  imagemAeronave?: string | null;
}) {
  const badge = getStatusBadge(voo.status);
  const hora = hhmm(voo.horario_previsto_agendamento);
  const coverContent = (
    <View style={s.detailCoverShade}>
      <View style={s.detailCoverTop}>
        <Text numberOfLines={1} style={s.detailCoverFlight}>
          Voo {voo.numero_voo || "—"}
        </Text>
        <Text numberOfLines={1} style={s.detailCoverRegistration}>
          {voo.matricula_registro || "—"}
        </Text>
      </View>
      <View style={[s.statusBadge, { backgroundColor: badge.bg }]}>
        <Text style={[s.statusBadgeText, { color: badge.color }]}>
          {badge.label}
        </Text>
      </View>
    </View>
  );
  const photo = imagemAeronave?.trim() || obterImagemAeronave(voo);

  return (
    <View style={s.detailFlightCard}>
      <View style={s.detailCover}>
        <FotoAeronave
          uri={photo}
          style={s.detailCoverImage}
          accessibilityLabel={`Foto da aeronave ${voo.matricula_registro || ""}`}
        />
        {coverContent}
      </View>

      <View style={s.detailRouteRow}>
        <View style={s.detailAirport}>
          <Text style={s.detailAirportCode}>{voo.origem || "—"}</Text>
          <Text numberOfLines={1} style={s.detailAirportCity}>
            {voo.origem_cidade || "Origem"}
          </Text>
        </View>
        <View style={s.detailRouteCenter}>
          <View style={s.detailPlane}>
            <Icon name="airplane" size={17} color={CORES.azul} />
          </View>
        </View>
        <View style={[s.detailAirport, { alignItems: "flex-end" }]}>
          <Text style={s.detailAirportCode}>{voo.destino || "—"}</Text>
          <Text numberOfLines={1} style={s.detailAirportCity}>
            {voo.destino_cidade || "Destino"}
          </Text>
        </View>
      </View>

      <View style={s.detailFlightMeta}>
        <Text style={s.detailFlightTime}>
          {hora ? `${hora} UTC` : "Horário não informado"}
        </Text>
        <Text style={s.detailFlightDate}>
          {formatDateEmphasis(voo.data_agendada)}
        </Text>
      </View>
    </View>
  );
}

export default function AgendaScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { vooId } = useLocalSearchParams<{ vooId?: string }>();
  const [day, setDay] = useState(today());
  const [filter, setFilter] = useState<
    "todos" | "aprovar" | "aprovados" | "historico"
  >("todos");
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchText, setSearchText] = useState("");
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [monthPickerOpen, setMonthPickerOpen] = useState(false);
  const [calendarMonth, setCalendarMonth] = useState(today().slice(0, 7));
  const [flights, setFlights] = useState<Flight[]>([]);
  const [horasMesPerfil, setHorasMesPerfil] = useState<number | null>(null);
  const [selected, setSelected] = useState<Detail | null>(null);
  const listedSelectedFlight = selected
    ? flights.find((flight) => flight.id === selected.voo.id)
    : undefined;
  const { imagem: imagemAeronave, todasAeronaves } = useAeronave({
    id: selected?.voo.aeronave_id || listedSelectedFlight?.aeronave_id,
    matricula:
      selected?.voo.matricula_registro ||
      listedSelectedFlight?.matricula_registro,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [openingBriefing, setOpeningBriefing] = useState(false);
  const [error, setError] = useState("");
  const [editing, setEditing] = useState<{
    journeyId: string;
    leg: Leg;
  } | null>(null);
  const [times, setTimes] = useState({
    horario_ac: "",
    horario_dep: "",
    horario_pouso: "",
    horario_corte: "",
  });

  const loaded = useRef(false);
  const load = useCallback(async () => {
    if (!loaded.current) setLoading(true);
    setError("");
    try {
      const [result, perfil] = await Promise.all([
        apiFetch<{ voos: Flight[] }>("/api/colaborador/meus-voos"),
        apiFetch<{
          horas_voo_minutos?: { mes?: number | null } | null;
        }>("/api/colaborador/perfil").catch(() => null),
      ]);
      setFlights(result.voos || []);
      const minutosMes = perfil?.horas_voo_minutos?.mes;
      setHorasMesPerfil(
        typeof minutosMes === "number" && Number.isFinite(minutosMes)
          ? Math.max(0, Math.round(minutosMes))
          : null,
      );
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "Não foi possível consultar sua agenda.",
      );
    } finally {
      loaded.current = true;
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const openFlight = async (id: string, refresh = false) => {
    if (!refresh) setLoading(true);
    setError("");
    try {
      setSelected(
        await apiFetch<Detail>(
          `/api/colaborador/meus-voos/${encodeURIComponent(id)}`,
        ),
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Falha ao consultar voo.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (vooId) void openFlight(vooId);
  }, [vooId]);

  useEffect(() => {
    if (!selected) return;
    const currentImage = aircraftImageOf(selected.voo);
    if (currentImage) return;

    const listedFlight = flights.find((flight) => flight.id === selected.voo.id);
    const listedImage = listedFlight && aircraftImageOf(listedFlight);
    if (!listedImage) return;

    setSelected((current) => {
      if (!current || current.voo.id !== selected.voo.id) return current;
      if (aircraftImageOf(current.voo)) return current;
      return {
        ...current,
        voo: { ...current.voo, url_imagem: listedImage },
      };
    });
  }, [flights, selected]);

  const saveTimes = async () => {
    if (!editing || saving) return;
    const fields = Object.entries(times).filter(([, v]) => v.trim());
    if (!fields.length || fields.some(([, v]) => !/^\d{2}:\d{2}$/.test(v)))
      return Alert.alert("Horários", "Informe horários UTC no formato HH:MM.");
    setSaving(true);
    try {
      const resultado = await apiFetch<{
        diario_bordo?: {
          status: string;
          detalhe?: string;
          lancamento_id?: string;
        };
      }>(
        `/api/interno/jornadas/${encodeURIComponent(editing.journeyId)}/pernas/${encodeURIComponent(editing.leg.id)}`,
        {
          method: "PATCH",
          body: JSON.stringify(Object.fromEntries(fields)),
        },
      );
      const id = selected?.voo.id;
      if (id)
        setSelected(
          await apiFetch<Detail>(
            `/api/colaborador/meus-voos/${encodeURIComponent(id)}`,
          ),
        );
      setEditing(null);
      const diario = resultado.diario_bordo;
      const sincronizado =
        diario?.status === "rascunho" || diario?.status === "assinado";
      Alert.alert(
        sincronizado ? "Horários e Diário atualizados" : "Horários salvos",
        sincronizado
          ? "Os horários foram gravados no Worker e vinculados ao Diário de Bordo da aeronave. O lançamento permanece em rascunho até a assinatura do CMTE."
          : `Horários gravados. ${diario?.detalhe || "O Diário será criado após registrar o AC."}`,
        sincronizado && id
          ? [
              { text: "Continuar na Agenda" },
              {
                text: "Abrir Diário",
                onPress: () =>
                  router.push({
                    pathname: "/diario-bordo",
                    params: { vooId: id },
                  }),
              },
            ]
          : [{ text: "OK" }],
      );
    } catch (e) {
      Alert.alert(
        "Não foi possível salvar",
        e instanceof Error ? e.message : "Verifique sua conexão e permissões.",
      );
    } finally {
      setSaving(false);
    }
  };

  const openBriefing = async (voo: Flight) => {
    if (openingBriefing) return;
    setOpeningBriefing(true);
    try {
      const snapshot = await apiFetch<{ versao: number }>(
        `/api/interno/agendamento/${encodeURIComponent(voo.id)}/preparacao`,
      );
      await abrirBriefingPdf(voo.id, snapshot.versao, voo.numero_voo || "");
    } catch (err) {
      Alert.alert(
        "Briefing indisponível",
        err instanceof Error ? err.message : "Não foi possível abrir o PDF.",
      );
    } finally {
      setOpeningBriefing(false);
    }
  };

  const action = (label: string, icon: Icone, onPress: () => void) => (
    <Toque accessibilityRole="button" onPress={onPress} style={s.action}>
      <Icon name={icon} size={19} color={CORES.amarelo} />
      <Text style={s.actionText}>{label}</Text>
      <Icon name="chevron-right" size={16} color={CORES.muted} />
    </Toque>
  );

  const horasMesFormatada = useMemo(() => {
    if (horasMesPerfil != null) {
      const h = Math.floor(horasMesPerfil / 60);
      const m = horasMesPerfil % 60;
      return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
    }

    const mesAtual = today().slice(0, 7);
    const totalMin = flights.reduce((acc, f) => {
      if (!String(f.data_agendada || "").startsWith(mesAtual)) return acc;
      return acc + flightDurationMinutes(f);
    }, 0);
    const h = Math.floor(totalMin / 60);
    const m = totalMin % 60;
    return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
  }, [flights, horasMesPerfil]);

  const pendentesCount = useMemo(
    () =>
      flights.filter((f) => STATUS_APROVAR.has(normalizeStatus(f.status)))
        .length,
    [flights],
  );

  const detail = selected;

  const visible = flights
    .filter((f) => {
      const flightDate = String(f.data_agendada || "").slice(0, 10);
      const status = normalizeStatus(f.status);
      if (selectedDate && flightDate !== selectedDate) return false;
      if (filter === "aprovar") return STATUS_APROVAR.has(status);
      if (filter === "aprovados") return STATUS_APROVADOS.has(status);
      if (filter === "historico")
        return Boolean(flightDate) && flightDate < today();
      return !isClosedStatus(f.status);
    })
    .filter((f) => {
      if (!searchText.trim()) return true;
      const query = searchText.trim().toLowerCase();
      return [
        f.numero_voo,
        f.origem,
        f.destino,
        f.origem_cidade,
        f.destino_cidade,
        f.matricula_registro,
        f.modelo,
      ]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(query));
    })
    .sort((a, b) =>
      filter === "historico"
        ? String(b.data_agendada).localeCompare(String(a.data_agendada))
        : String(a.data_agendada).localeCompare(String(b.data_agendada)),
    );
  const nextFlightId =
    filter === "historico"
      ? null
      : visible.find(
          (flight) =>
            String(flight.data_agendada || "").slice(0, 10) >= today() &&
            !isClosedStatus(flight.status),
        )?.id;

  const monthDate = new Date(`${calendarMonth}-01T12:00:00`);
  const monthDayCount = new Date(
    monthDate.getFullYear(),
    monthDate.getMonth() + 1,
    0,
  ).getDate();
  const monthOffset = (monthDate.getDay() + 6) % 7;
  const monthCells: (string | null)[] = [
    ...Array.from({ length: monthOffset }, () => null),
    ...Array.from({ length: monthDayCount }, (_, i) =>
      dateKey(
        new Date(monthDate.getFullYear(), monthDate.getMonth(), i + 1, 12),
      ),
    ),
  ];

  return (
    <SafeAreaView edges={["top"]} style={s.root}>
      {detail ? (
        <Cabecalho
          titulo="Detalhes do voo"
          apoio="MEUS VOOS"
          voltar={() => setSelected(null)}
          acao={() => void openFlight(detail.voo.id, true)}
        />
      ) : (
        <View style={s.header}>
          <View>
            <Text style={s.headerTitle}>Meus Voos</Text>
          </View>
          <View style={s.headerActions}>
            <Toque
              accessibilityRole="button"
              accessibilityLabel="Filtrar por data"
              onPress={() => {
                setCalendarMonth(day.slice(0, 7));
                setMonthPickerOpen(true);
              }}
              style={[
                s.circleBtn,
                selectedDate && { borderColor: CORES.amarelo },
              ]}
            >
              <Icon
                name="calendar"
                size={19}
                color={selectedDate ? CORES.amarelo : "#FFFFFF"}
              />
            </Toque>
            <Toque
              accessibilityRole="button"
              accessibilityLabel="Buscar voos"
              onPress={() => setSearchOpen((open) => !open)}
              style={[
                s.circleBtn,
                searchOpen && { borderColor: CORES.amarelo },
              ]}
            >
              <Icon
                name="search"
                size={20}
                color={searchOpen ? CORES.amarelo : "#FFFFFF"}
              />
            </Toque>
          </View>
        </View>
      )}

      {error ? (
        <Toque onPress={() => void load()} style={s.error}>
          <Text style={{ color: "#ffb6b6", fontSize: 13 }}>
            {error} · Toque para tentar novamente
          </Text>
        </Toque>
      ) : null}

      {loading ? (
        <ActivityIndicator style={{ marginTop: 40 }} color={CORES.amarelo} />
      ) : (
        <ScrollView
          contentContainerStyle={{
            paddingHorizontal: 18,
            paddingTop: 6,
            paddingBottom: 165,
          }}
          showsVerticalScrollIndicator={false}
        >
          {!detail ? (
            <>
              {searchOpen && (
                <TextInput
                  value={searchText}
                  onChangeText={setSearchText}
                  placeholder="Buscar voo, aeroporto ou aeronave"
                  placeholderTextColor={CORES.muted}
                  style={s.search}
                  autoFocus
                />
              )}

              <View style={s.metrics}>
                <View style={s.metricCard}>
                  <Text style={s.metricValue}>{horasMesFormatada}</Text>
                  <Text style={s.metricLabel}>Horas no mês</Text>
                </View>

                <View style={s.metricCard}>
                  <Text style={s.metricValue}>{flights.length}</Text>
                  <Text style={s.metricLabel}>Voos</Text>
                </View>

                <View style={[s.metricCard, s.metricCardPending]}>
                  <Text style={[s.metricValue, { color: CORES.amarelo }]}>
                    {pendentesCount}
                  </Text>
                  <Text style={s.metricLabel}>Pendentes</Text>
                </View>
              </View>

              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={s.filterScroll}
              >
                {(
                  [
                    ["todos", "Todos"],
                    ["aprovar", "A aprovar"],
                    ["aprovados", "Aprovados"],
                    ["historico", "Histórico"],
                  ] as const
                ).map(([id, label]) => {
                  const active = filter === id;
                  return (
                    <Toque
                      key={id}
                      accessibilityRole="button"
                      onPress={() => {
                        setFilter(id);
                        setSelectedDate(null);
                      }}
                      style={[s.filterPill, active && s.filterPillActive]}
                    >
                      <Text
                        style={[
                          s.filterPillText,
                          active && s.filterPillTextActive,
                        ]}
                      >
                        {label}
                      </Text>
                    </Toque>
                  );
                })}
              </ScrollView>

              {selectedDate ? (
                <View style={s.activeDateBanner}>
                  <Text style={s.activeDateText}>
                    Data selecionada: {formatDateFull(selectedDate)}
                  </Text>
                  <Toque
                    accessibilityRole="button"
                    onPress={() => setSelectedDate(null)}
                  >
                    <Text style={s.clearDateText}>Limpar</Text>
                  </Toque>
                </View>
              ) : null}

              {visible.length ? (
                visible.map((f) => (
                  <CardVooItem
                    key={f.id}
                    voo={f}
                    onPress={() => void openFlight(f.id)}
                    isNextFlight={f.id === nextFlightId}
                    imagemAeronave={
                      todasAeronaves.find(
                        (aeronave) =>
                          aeronave.id === f.aeronave_id ||
                          (!!f.matricula_registro &&
                            aeronave.matricula_registro.trim().toUpperCase() ===
                              f.matricula_registro.trim().toUpperCase()),
                      )?.url_imagem
                    }
                  />
                ))
              ) : (
                <Vazio
                  icone="calendar"
                  titulo="Nenhum voo neste filtro"
                  texto="Altere o filtro ou use a busca para localizar outro voo."
                />
              )}
            </>
          ) : (
            <>
              <View style={{ marginBottom: 14 }}>
                <CardVooDetalhe
                  voo={detail.voo}
                  imagemAeronave={imagemAeronave}
                />
              </View>

              {action("Acompanhar voo", "map", () =>
                router.push({
                  pathname: "/acompanhar-voo",
                  params: { vooId: detail.voo.id },
                }),
              )}

              <Text style={s.section}>PREPARAÇÃO E BRIEFING</Text>
              <View style={s.panel}>
                <Text style={s.rowTitle}>Informações do briefing</Text>
                <Text style={[s.secondary, { marginTop: 6 }]}>
                  {detail.voo.mensagem ||
                    "Nenhuma observação operacional cadastrada."}
                </Text>
                <Text style={[s.secondary, { marginTop: 6 }]}>
                  Piloto: {detail.voo.piloto_nome || "—"} · Copiloto:{" "}
                  {detail.voo.copiloto_nome || "—"}
                </Text>
              </View>

              {action("Checklist pré-voo", "check-square", () =>
                router.push({
                  pathname: "/preparacao-voo",
                  params: { id: detail.voo.id },
                }),
              )}
              <View style={{ height: 10 }} />
              {action(
                openingBriefing
                  ? "Abrindo briefing PDF…"
                  : "Abrir briefing em PDF",
                "file-text",
                () => void openBriefing(detail.voo),
              )}
              <View style={{ height: 10 }} />
              {action(
                "Diário de Bordo · completar e assinar",
                "book-open",
                () =>
                  router.push({
                    pathname: "/diario-bordo",
                    params: { vooId: detail.voo.id },
                  }),
              )}

              <Text style={s.section}>HOSPEDAGEM DA TRIPULAÇÃO</Text>
              {detail.hospedagens.length ? (
                detail.hospedagens.map((h, i) => (
                  <View key={i} style={s.panel}>
                    {Object.entries(h)
                      .filter(([, v]) => v != null && typeof v !== "object")
                      .map(([k, v]) => (
                        <Text key={k} style={s.secondary}>
                          {k.replace(/_/g, " ")}: {String(v)}
                        </Text>
                      ))}
                  </View>
                ))
              ) : (
                <View style={s.panel}>
                  <Text style={s.secondary}>
                    Nenhuma hospedagem vinculada a este voo.
                  </Text>
                </View>
              )}

              <View style={{ height: 10 }} />
              <Toque
                accessibilityRole="button"
                accessibilityLabel="Criar nova perna nesta solicitação"
                onPress={() => {
                  const jornada = detail.jornadas[0];
                  const ultimaPerna = jornada?.pernas?.[jornada.pernas.length - 1];
                  router.push({
                    pathname: "/criar-agendamento",
                    params: {
                      vooId: detail.voo.id,
                      solicitacaoId: detail.voo.solicitacao_id || detail.voo.id,
                      jornadaId: jornada?.id || "",
                      aeronaveId: detail.voo.aeronave_id || "",
                      clienteId: detail.voo.cliente_id || "",
                      socioId: detail.voo.socio_id || "",
                      origem: ultimaPerna?.destino || detail.voo.destino || "",
                      destino: "",
                      data: detail.voo.data_agendada?.slice(0, 10) || today(),
                    },
                  });
                }}
                style={[s.action, { backgroundColor: CORES.azul, borderColor: CORES.azul, marginBottom: 14 }]}
              >
                <Icon name="plus-circle" size={18} color="#fff" />
                <Text style={[s.actionText, { color: "#FFFFFF" }]}>Nova perna nesta solicitação</Text>
              </Toque>

              <Text style={s.section}>HORÁRIOS · UTC</Text>
              {detail.jornadas.length ? (
                detail.jornadas.map((j) => (
                  <View key={j.id} style={s.panel}>
                    <Text style={s.rowTitle}>Jornada · {j.status}</Text>
                    {(j.pernas || []).map((leg) => (
                      <View key={leg.id} style={s.leg}>
                        <Text style={s.rowTitle}>
                          Perna {leg.numero} · {leg.origem} → {leg.destino}
                        </Text>
                        <Text style={s.secondary}>
                          AC {hhmm(leg.horario_ac) || "—"} · DEP{" "}
                          {hhmm(leg.horario_dep) || "—"} · POU{" "}
                          {hhmm(leg.horario_pouso) || "—"} · COR{" "}
                          {hhmm(leg.horario_corte) || "—"}
                        </Text>
                        <Text
                          style={[
                            s.secondary,
                            {
                              color:
                                leg.diario_confirmado || leg.diario_assinado_pic
                                  ? CORES.verde
                                  : CORES.amarelo,
                            },
                          ]}
                        >
                          {leg.diario_confirmado || leg.diario_assinado_pic
                            ? "DIÁRIO ASSINADO"
                            : leg.lancamento_diario_id
                              ? "DIÁRIO EM RASCUNHO"
                              : "DIÁRIO AGUARDANDO SINCRONIZAÇÃO"}
                        </Text>
                        {!leg.diario_confirmado &&
                        !leg.diario_assinado_pic &&
                        !leg.diario_fechado ? (
                          <Toque
                            onPress={() => {
                              setEditing({ journeyId: j.id, leg });
                              setTimes({
                                horario_ac: hhmm(leg.horario_ac),
                                horario_dep: hhmm(leg.horario_dep),
                                horario_pouso: hhmm(leg.horario_pouso),
                                horario_corte: hhmm(leg.horario_corte),
                              });
                            }}
                          >
                            <Text style={s.link}>
                              Registrar / corrigir horários
                            </Text>
                          </Toque>
                        ) : null}
                      </View>
                    ))}
                  </View>
                ))
              ) : (
                <View style={s.panel}>
                  <Text style={s.secondary}>
                    Nenhuma jornada registrada para este voo.
                  </Text>
                </View>
              )}
            </>
          )}
        </ScrollView>
      )}

      <Modal
        transparent
        animationType="fade"
        visible={monthPickerOpen}
        onRequestClose={() => setMonthPickerOpen(false)}
      >
        <View style={s.modalBackdrop}>
          <View style={s.monthSheet}>
            <View style={s.between}>
              <Text style={s.monthSheetTitle}>Escolher data</Text>
              <Toque
                accessibilityRole="button"
                accessibilityLabel="Fechar calendário mensal"
                onPress={() => setMonthPickerOpen(false)}
                hitSlop={10}
              >
                <Icon name="x" size={22} color="#fff" />
              </Toque>
            </View>
            <View style={[s.between, { marginTop: 18 }]}>
              <Toque
                accessibilityLabel="Mês anterior"
                onPress={() => {
                  const prev = new Date(
                    monthDate.getFullYear(),
                    monthDate.getMonth() - 1,
                    1,
                    12,
                  );
                  setCalendarMonth(dateKey(prev).slice(0, 7));
                }}
                style={s.calendarArrow}
              >
                <Icon name="chevron-left" color={CORES.amarelo} size={18} />
              </Toque>
              <Text style={s.rowTitle}>
                {monthDate.toLocaleDateString("pt-BR", {
                  month: "long",
                  year: "numeric",
                })}
              </Text>
              <Toque
                accessibilityLabel="Próximo mês"
                onPress={() => {
                  const next = new Date(
                    monthDate.getFullYear(),
                    monthDate.getMonth() + 1,
                    1,
                    12,
                  );
                  setCalendarMonth(dateKey(next).slice(0, 7));
                }}
                style={s.calendarArrow}
              >
                <Icon name="chevron-right" color={CORES.amarelo} size={18} />
              </Toque>
            </View>
            <View style={s.monthGrid}>
              {["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"].map(
                (weekday) => (
                  <Text key={weekday} style={s.weekdayLabel}>
                    {weekday}
                  </Text>
                ),
              )}
              {monthCells.map((d, index) => {
                if (!d)
                  return <View key={`blank-${index}`} style={s.monthCell} />;
                const isSelected = selectedDate === d;
                const hasFlight = flights.some(
                  (f) => f.data_agendada?.slice(0, 10) === d,
                );
                return (
                  <Toque
                    key={d}
                    accessibilityRole="button"
                    accessibilityLabel={new Date(
                      d + "T12:00:00",
                    ).toLocaleDateString("pt-BR", { dateStyle: "full" })}
                    accessibilityState={{ selected: isSelected }}
                    onPress={() => {
                      setDay(d);
                      setSelectedDate(d);
                      setMonthPickerOpen(false);
                    }}
                    style={[s.monthCell, isSelected && s.selectedDay]}
                  >
                    <Text
                      style={[
                        s.monthCellText,
                        isSelected && { color: CORES.amareloTexto },
                      ]}
                    >
                      {Number(d.slice(-2))}
                    </Text>
                    {hasFlight ? (
                      <View
                        style={[
                          s.monthCellDot,
                          isSelected && { backgroundColor: CORES.amareloTexto },
                        ]}
                      />
                    ) : null}
                  </Toque>
                );
              })}
            </View>
            {selectedDate ? (
              <Toque
                accessibilityRole="button"
                onPress={() => {
                  setSelectedDate(null);
                  setMonthPickerOpen(false);
                }}
                style={s.clearMonthDate}
              >
                <Text style={s.clearDateText}>
                  Remover filtro de data · ver todos os voos
                </Text>
              </Toque>
            ) : null}
          </View>
        </View>
      </Modal>

      {editing && (
        <View style={[s.editor, { bottom: insets.bottom + 12 }]}>
          <View style={s.between}>
            <Text style={s.rowTitle}>
              Horários da perna {editing.leg.numero} · UTC
            </Text>
            <Toque onPress={() => setEditing(null)}>
              <Icon name="x" size={23} color="#fff" />
            </Toque>
          </View>
          <View style={s.timeGrid}>
            {(
              [
                "horario_ac",
                "horario_dep",
                "horario_pouso",
                "horario_corte",
              ] as const
            ).map((key, i) => (
              <View key={key} style={{ width: "47%" }}>
                <Text style={s.secondary}>
                  {["AC", "DEP", "POU", "COR"][i]}
                </Text>
                <TextInput
                  style={s.input}
                  placeholder="HH:MM"
                  placeholderTextColor={CORES.muted}
                  keyboardType="numbers-and-punctuation"
                  value={times[key]}
                  onChangeText={(v) => setTimes((p) => ({ ...p, [key]: v }))}
                />
              </View>
            ))}
          </View>
          <Toque
            disabled={saving}
            onPress={() => void saveTimes()}
            style={s.primary}
          >
            <Text style={s.primaryText}>
              {saving ? "Salvando…" : "Salvar horários"}
            </Text>
          </Toque>
        </View>
      )}
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: CORES.fundo,
  },
  header: {
    paddingHorizontal: 18,
    paddingTop: 10,
    paddingBottom: 14,
    marginTop: 9,
    marginBottom: 9,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  headerTitle: {
    color: "#FFFFFF",
    fontSize: 28,
    fontFamily: "Inter_700Bold",
    marginTop: 2,
  },
  headerActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  circleBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: CORES.card,
    borderWidth: 1,
    borderColor: CORES.cardBorda,
    alignItems: "center",
    justifyContent: "center",
  },
  search: {
    height: 48,
    borderRadius: 16,
    backgroundColor: CORES.card,
    borderWidth: 1,
    borderColor: CORES.cardBorda,
    color: "#FFFFFF",
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  metrics: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 18,
  },
  metricCard: {
    flex: 1,
    minHeight: 84,
    borderRadius: 18,
    backgroundColor: CORES.card,
    borderWidth: 1,
    borderColor: CORES.cardBorda,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
    paddingHorizontal: 6,
  },
  metricCardPending: {
    backgroundColor: "#1B1E2E",
    borderColor: CORES.amareloBorda,
  },
  metricValue: {
    color: "#FFFFFF",
    fontFamily: "Inter_700Bold",
    fontSize: 22,
  },
  metricLabel: {
    color: CORES.muted,
    fontFamily: "Inter_500Medium",
    fontSize: 11,
    marginTop: 4,
  },
  filterScroll: {
    gap: 10,
    paddingBottom: 18,
  },
  filterPill: {
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: CORES.pillBg,
    borderWidth: 1,
    borderColor: CORES.cardBorda,
    alignItems: "center",
    justifyContent: "center",
  },
  filterPillActive: {
    backgroundColor: CORES.amarelo,
    borderColor: CORES.amarelo,
  },
  filterPillText: {
    color: CORES.textoSecundario,
    fontFamily: "Inter_600SemiBold",
    fontSize: 13,
  },
  filterPillTextActive: {
    color: CORES.amareloTexto,
    fontFamily: "Inter_700Bold",
  },
  activeDateBanner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: CORES.card,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginBottom: 14,
  },
  activeDateText: {
    color: CORES.textoSecundario,
    fontSize: 12,
    fontFamily: "Inter_500Medium",
  },
  clearDateText: {
    color: CORES.amarelo,
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
  },
  flightCard: {
    backgroundColor: CORES.card,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: CORES.cardBorda,
    overflow: "hidden",
  },
  flightCardCover: {
    height: 106,
    backgroundColor: "#10243A",
    overflow: "hidden",
  },
  flightCardCoverImage: {
    position: "absolute",
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    width: "100%",
    height: "100%",
  },
  flightCardCoverShade: {
    flex: 1,
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12,
    paddingHorizontal: 18,
    paddingVertical: 14,
    backgroundColor: "rgba(4,11,22,0.42)",
  },
  flightCardCoverTitle: {
    flex: 1,
    color: "#FFFFFF",
    fontSize: 12,
    fontFamily: "Inter_700Bold",
  },
  flightCardCoverRegistration: {
    maxWidth: "45%",
    color: "rgba(255,255,255,0.82)",
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
    textAlign: "right",
  },
  flightCardContent: {
    padding: 18,
  },
  cardTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  kicker: {
    color: CORES.azul,
    fontSize: 9,
    fontFamily: "Inter_700Bold",
    letterSpacing: 1,
    marginBottom: 6,
  },
  dateLabel: {
    color: CORES.muted,
    fontSize: 9,
    fontFamily: "Inter_600SemiBold",
    letterSpacing: 1,
  },
  dateValue: {
    color: CORES.azul,
    fontSize: 18,
    fontFamily: "Inter_700Bold",
    marginTop: 3,
  },
  aircraftText: {
    flex: 1,
    color: "#F2F3F6",
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
    marginTop: 12,
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 999,
  },
  statusBadgeText: {
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
  },
  routeRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 16,
    marginBottom: 18,
    gap: 10,
  },
  routeCenter: {
    flex: 1,
    minWidth: 72,
  },
  airportCol: {
    minWidth: 68,
  },
  icaoCode: {
    color: "#F2F3F6",
    fontSize: 22,
    fontFamily: "Inter_700Bold",
    letterSpacing: 0.5,
  },
  cityText: {
    color: CORES.muted,
    fontSize: 10,
    fontFamily: "Inter_500Medium",
    marginTop: 2,
  },
  airportTime: {
    color: CORES.textoSecundario,
    fontSize: 10,
    fontFamily: "Inter_600SemiBold",
    marginTop: 5,
  },
  routeMeta: {
    color: CORES.muted,
    fontSize: 9,
    fontFamily: "Inter_500Medium",
    textAlign: "center",
    marginTop: 6,
  },
  flightMetaRow: {
    flexDirection: "row",
    gap: 8,
  },
  flightMetaCard: {
    flex: 1,
    backgroundColor: "rgba(255,255,255,0.04)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  routeLineWrap: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  routeDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: CORES.azul,
  },
  dashedLine: {
    flex: 1,
    height: 1,
    borderBottomWidth: 1,
    borderStyle: "dashed",
    borderColor: "rgba(142,150,176,0.65)",
  },
  footerLabel: {
    color: CORES.muted,
    fontSize: 10,
    fontFamily: "Inter_500Medium",
  },
  footerValue: {
    color: "#FFFFFF",
    fontSize: 14,
    fontFamily: "Inter_700Bold",
    marginTop: 4,
  },
  detailFlightCard: {
    backgroundColor: CORES.card,
    borderColor: CORES.cardBorda,
    borderWidth: 1,
    borderRadius: 22,
    overflow: "hidden",
  },
  detailCover: {
    height: 112,
    overflow: "hidden",
    backgroundColor: "#10243A",
  },
  detailCoverImage: {
    position: "absolute",
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    width: "100%",
    height: "100%",
    borderTopLeftRadius: 21,
    borderTopRightRadius: 21,
  },
  detailCoverShade: {
    flex: 1,
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: "rgba(4,11,22,0.42)",
    alignItems: "flex-end",
    justifyContent: "space-between",
  },
  detailCoverTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    width: "100%",
  },
  detailCoverFlight: {
    color: "#FFFFFF",
    fontSize: 12,
    fontFamily: "Inter_700Bold",
  },
  detailCoverRegistration: {
    color: "rgba(255,255,255,0.78)",
    fontSize: 10,
    fontFamily: "Inter_500Medium",
  },
  detailRouteRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 18,
    paddingTop: 16,
  },
  detailAirport: {
    flex: 1,
    minWidth: 0,
  },
  detailAirportCode: {
    color: "#FFFFFF",
    fontSize: 27,
    fontFamily: "Inter_700Bold",
    letterSpacing: -0.5,
  },
  detailAirportCity: {
    color: CORES.muted,
    fontSize: 10,
    marginTop: 2,
  },
  detailRouteCenter: {
    flex: 0.55,
    alignItems: "center",
    justifyContent: "center",
  },
  detailPlane: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: "rgba(255,255,255,0.3)",
    alignItems: "center",
    justifyContent: "center",
  },
  detailFlightMeta: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
    marginTop: 14,
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "rgba(255,255,255,0.08)",
  },
  detailFlightTime: {
    color: "#CBD7E7",
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
  },
  detailFlightDate: {
    color: CORES.textoSecundario,
    fontSize: 10,
    fontFamily: "Inter_600SemiBold",
  },
  fab: {
    position: "absolute",
    right: 18,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: CORES.amarelo,
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderRadius: 999,
    shadowColor: "#000000",
    shadowOpacity: 0.3,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 12,
  },
  fabPlus: {
    color: CORES.amareloTexto,
    fontSize: 20,
    fontFamily: "Inter_700Bold",
    lineHeight: 22,
  },
  fabText: {
    color: CORES.amareloTexto,
    fontSize: 15,
    fontFamily: "Inter_700Bold",
  },
  between: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  section: {
    color: CORES.muted,
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1.8,
    marginTop: 22,
    marginBottom: 12,
  },
  secondary: {
    fontSize: 13,
    color: CORES.muted,
    lineHeight: 21,
  },
  link: {
    color: CORES.amarelo,
    fontSize: 13,
    fontWeight: "700",
    marginTop: 8,
  },
  rowTitle: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "700",
  },
  panel: {
    backgroundColor: CORES.card,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: CORES.cardBorda,
    padding: 16,
    gap: 5,
    marginBottom: 10,
  },
  action: {
    backgroundColor: CORES.card,
    borderWidth: 1,
    borderColor: CORES.cardBorda,
    padding: 16,
    borderRadius: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  actionText: {
    color: "#FFFFFF",
    fontWeight: "700",
    flex: 1,
  },
  leg: {
    borderTopWidth: 1,
    borderTopColor: CORES.cardBorda,
    marginTop: 12,
    paddingTop: 12,
    gap: 5,
  },
  error: {
    marginHorizontal: 18,
    marginBottom: 10,
    padding: 14,
    backgroundColor: "#4b202a",
    borderRadius: 12,
  },
  editor: {
    position: "absolute",
    left: 12,
    right: 12,
    backgroundColor: "#141D38",
    borderWidth: 1,
    borderColor: CORES.amarelo,
    borderRadius: 22,
    padding: 18,
    elevation: 15,
  },
  timeGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    gap: 10,
    marginVertical: 14,
  },
  input: {
    backgroundColor: CORES.fundo,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: CORES.cardBorda,
    padding: 12,
    color: "#FFFFFF",
    fontSize: 17,
  },
  primary: {
    backgroundColor: CORES.amarelo,
    borderRadius: 12,
    minHeight: 48,
    alignItems: "center",
    justifyContent: "center",
  },
  primaryText: {
    color: CORES.amareloTexto,
    fontWeight: "800",
  },
  modalBackdrop: {
    flex: 1,
    justifyContent: "center",
    padding: 20,
    backgroundColor: "rgba(0,0,0,0.72)",
  },
  monthSheet: {
    backgroundColor: CORES.card,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: CORES.cardBorda,
    padding: 20,
  },
  monthSheetTitle: {
    color: "#FFFFFF",
    fontSize: 18,
    fontFamily: "Inter_700Bold",
  },
  monthGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginTop: 18,
  },
  weekdayLabel: {
    width: `${100 / 7}%`,
    color: CORES.muted,
    textAlign: "center",
    fontSize: 10,
    fontFamily: "Inter_600SemiBold",
    paddingBottom: 8,
  },
  monthCell: {
    width: `${100 / 7}%`,
    height: 42,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 12,
  },
  monthCellText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
  },
  monthCellDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: CORES.amarelo,
    position: "absolute",
    bottom: 4,
  },
  selectedDay: {
    backgroundColor: CORES.amarelo,
  },
  calendarArrow: {
    padding: 10,
    borderRadius: 12,
    backgroundColor: CORES.pillBg,
  },
  clearMonthDate: {
    alignItems: "center",
    paddingTop: 18,
  },
});
