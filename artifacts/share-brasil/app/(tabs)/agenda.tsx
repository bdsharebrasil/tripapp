import { useLocalSearchParams, useFocusEffect, useRouter } from "expo-router";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
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
import { apiFetch } from "@/src/lib/api";
import { abrirBriefingPdf } from "@/src/lib/briefing-pdf";

type Flight = {
  id: string;
  numero_voo?: string;
  origem?: string;
  destino?: string;
  origem_cidade?: string;
  destino_cidade?: string;
  data_agendada?: string;
  horario_previsto_agendamento?: string;
  duracao?: string;
  duracao_minutos?: number;
  tempo_voo?: string;
  matricula_registro?: string;
  modelo?: string;
  status?: string;
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

const formatDateShort = (v?: string) => {
  if (!v) return "—";
  const clean = v.slice(0, 10);
  const [, month, day] = clean.split("-");
  const monthIdx = Number(month) - 1;
  if (!day || monthIdx < 0 || monthIdx > 11) return clean;
  return `${day} ${MESES_CURTOS[monthIdx]}`;
};

const formatDateFull = (v?: string) =>
  v ? v.slice(0, 10).split("-").reverse().join("/") : "—";

const dateKey = (d: Date) =>
  [
    d.getFullYear(),
    String(d.getMonth() + 1).padStart(2, "0"),
    String(d.getDate()).padStart(2, "0"),
  ].join("-");

const formatDuration = (voo: Flight) => {
  if (voo.duracao) return voo.duracao;
  if (voo.tempo_voo) return voo.tempo_voo;
  if (typeof voo.duracao_minutos === "number" && voo.duracao_minutos > 0) {
    const h = Math.floor(voo.duracao_minutos / 60);
    const m = voo.duracao_minutos % 60;
    return `${h}h ${String(m).padStart(2, "0")}m`;
  }
  return "—";
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
  if (STATUS_APROVAR.has(norm)) {
    return {
      label: "A aprovar",
      bg: CORES.amareloSuave,
      color: CORES.amarelo,
    };
  }
  if (STATUS_APROVADOS.has(norm)) {
    return {
      label: "Aprovado",
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
}: {
  voo: Flight;
  onPress?: () => void;
}) {
  const badge = getStatusBadge(voo.status);
  const horaZ = hhmm(voo.horario_previsto_agendamento);
  const aeronave = [voo.matricula_registro, voo.modelo]
    .filter(Boolean)
    .join(" · ");

  const content = (
    <View style={s.flightCard}>
      <View style={s.cardTopRow}>
        <Text numberOfLines={1} style={s.aircraftText}>
          {aeronave || voo.numero_voo || "Aeronave não informada"}
        </Text>
        <View style={[s.statusBadge, { backgroundColor: badge.bg }]}>
          <Text style={[s.statusBadgeText, { color: badge.color }]}>
            {badge.label}
          </Text>
        </View>
      </View>

      <View style={s.routeRow}>
        <View style={s.airportCol}>
          <Text style={s.icaoCode}>{voo.origem || "----"}</Text>
          <Text numberOfLines={1} style={s.cityText}>
            {voo.origem_cidade || "Origem"}
          </Text>
        </View>

        <View style={s.routeLineWrap}>
          <View style={s.dashedLine} />
          <View style={s.planeIconWrap}>
            <Icon name="send" size={14} color={CORES.amarelo} />
          </View>
          <View style={s.dashedLine} />
        </View>

        <View style={[s.airportCol, { alignItems: "flex-end" }]}>
          <Text style={s.icaoCode}>{voo.destino || "----"}</Text>
          <Text numberOfLines={1} style={s.cityText}>
            {voo.destino_cidade || "Destino"}
          </Text>
        </View>
      </View>

      <View style={s.cardFooter}>
        <View style={s.footerCol}>
          <Text style={s.footerLabel}>Data</Text>
          <Text style={s.footerValue}>
            {formatDateShort(voo.data_agendada)}
          </Text>
        </View>

        <View style={s.footerCol}>
          <Text style={s.footerLabel}>Horário</Text>
          <Text style={s.footerValue}>{horaZ ? `${horaZ} Z` : "—"}</Text>
        </View>

        <View style={[s.footerCol, { alignItems: "flex-end" }]}>
          <Text style={s.footerLabel}>Duração</Text>
          <Text style={[s.footerValue, { color: CORES.amarelo }]}>
            {formatDuration(voo)}
          </Text>
        </View>
      </View>
    </View>
  );

  if (!onPress) return content;

  return (
    <Toque
      accessibilityRole="button"
      onPress={onPress}
      style={{ marginBottom: 14 }}
    >
      {content}
    </Toque>
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
  const [selected, setSelected] = useState<Detail | null>(null);
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
      const result = await apiFetch<{ voos: Flight[] }>(
        "/api/colaborador/meus-voos",
      );
      setFlights(result.voos || []);
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
    const mesAtual = today().slice(0, 7);
    const totalMin = flights.reduce((acc, f) => {
      if (!String(f.data_agendada || "").startsWith(mesAtual)) return acc;
      if (typeof f.duracao_minutos === "number") return acc + f.duracao_minutos;
      const match = String(f.duracao || f.tempo_voo || "").match(
        /(\d+)\s*h\s*(\d+)?/i,
      );
      if (match) {
        return acc + Number(match[1]) * 60 + Number(match[2] || 0);
      }
      return acc;
    }, 0);
    const h = Math.floor(totalMin / 60);
    const m = totalMin % 60;
    return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
  }, [flights]);

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
          titulo="Meu voo"
          apoio="DIÁRIO DE BORDO"
          voltar={() => setSelected(null)}
          acao={() => void openFlight(detail.voo.id, true)}
        />
      ) : (
        <View style={s.header}>
          <View>
            <Text style={s.headerKicker}>Diário de bordo</Text>
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
                  <Text
                    style={[s.metricValue, { color: CORES.amarelo }]}
                  >
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
                <CardVooItem voo={detail.voo} />
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

      {!detail && !editing && (
        <Toque
          accessibilityRole="button"
          accessibilityLabel="Criar agendamento"
          onPress={() => router.push("/criar-agendamento")}
          style={[s.fab, { bottom: Math.max(insets.bottom, 12) + 84 }]}
        >
          <Text style={s.fabPlus}>+</Text>
          <Text style={s.fabText}>Criar agendamento</Text>
        </Toque>
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
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  headerKicker: {
    color: CORES.muted,
    fontSize: 13,
    fontFamily: "Inter_500Medium",
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
    padding: 18,
  },
  cardTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  aircraftText: {
    flex: 1,
    color: CORES.muted,
    fontSize: 12,
    fontFamily: "Inter_500Medium",
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
  airportCol: {
    minWidth: 76,
  },
  icaoCode: {
    color: "#FFFFFF",
    fontSize: 23,
    fontFamily: "Inter_700Bold",
    letterSpacing: 0.5,
  },
  cityText: {
    color: CORES.muted,
    fontSize: 12,
    fontFamily: "Inter_500Medium",
    marginTop: 2,
  },
  routeLineWrap: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  dashedLine: {
    flex: 1,
    height: 1,
    borderBottomWidth: 1,
    borderStyle: "dashed",
    borderColor: "#333D5E",
  },
  planeIconWrap: {
    transform: [{ rotate: "45deg" }],
  },
  cardFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: CORES.cardBorda,
  },
  footerCol: {
    flex: 1,
  },
  footerLabel: {
    color: CORES.muted,
    fontSize: 11,
    fontFamily: "Inter_500Medium",
  },
  footerValue: {
    color: "#FFFFFF",
    fontSize: 14,
    fontFamily: "Inter_700Bold",
    marginTop: 3,
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