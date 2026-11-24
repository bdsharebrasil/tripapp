import { CartaoVoo } from "@/src/components/CartaoVoo";
import { Feather } from "@expo/vector-icons";
import { useLocalSearchParams, useFocusEffect, useRouter } from "expo-router";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Cabecalho, Vazio, tema } from "@/src/components/ui";
import { apiFetch } from "@/src/lib/api";
import { abrirBriefingPdf } from "@/src/lib/briefing-pdf";

type Flight = {
  id: string;
  numero_voo?: string;
  origem?: string;
  destino?: string;
  data_agendada?: string;
  horario_previsto_agendamento?: string;
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
const navy = tema.fundo,
  card = tema.superficie,
  border = tema.borda,
  blue = tema.azul,
  muted = tema.suave;
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
const formatDate = (v?: string) =>
  v ? v.slice(0, 10).split("-").reverse().join("/") : "—";
const dateKey = (d: Date) =>
  [d.getFullYear(), String(d.getMonth() + 1).padStart(2, "0"), String(d.getDate()).padStart(2, "0")].join("-");
const normalizeStatus = (status?: string) =>
  String(status || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toUpperCase()
    .replace(/[\s-]+/g, "_");
const isClosedStatus = (status?: string) =>
  ["ENCERRADO", "ENCERRADA", "CONCLUIDO", "CONCLUIDA", "FINALIZADO", "FINALIZADA", "CLOSED"].includes(
    normalizeStatus(status),
  );

export default function AgendaScreen() {
  const router = useRouter(),
    insets = useSafeAreaInsets();
  const { vooId } = useLocalSearchParams<{ vooId?: string }>();
  const [day, setDay] = useState(today());
  const [filter, setFilter] = useState<"operacao" | "proximos" | "historico">("operacao");
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [monthPickerOpen, setMonthPickerOpen] = useState(false);
  const [calendarMonth, setCalendarMonth] = useState(today().slice(0, 7));
  const [flights, setFlights] = useState<Flight[]>([]);
  const [selected, setSelected] = useState<Detail | null>(null);
  const [loading, setLoading] = useState(true),
    [saving, setSaving] = useState(false);
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
    } catch (error) {
      Alert.alert(
        "Briefing indisponível",
        error instanceof Error
          ? error.message
          : "Não foi possível abrir o PDF.",
      );
    } finally {
      setOpeningBriefing(false);
    }
  };

  const action = (
    label: string,
    icon: React.ComponentProps<typeof Feather>["name"],
    onPress: () => void,
  ) => (
    <Pressable accessibilityRole="button" onPress={onPress} style={s.action}>
      <Feather name={icon} size={19} color={blue} />
      <Text style={s.actionText}>{label}</Text>
      <Feather name="chevron-right" size={16} color={muted} />
    </Pressable>
  );
  const detail = selected;
  const visible = flights
    .filter((f) => {
      const flightDate = String(f.data_agendada || "").slice(0, 10);
      if (filter === "operacao") return !isClosedStatus(f.status);
      if (filter === "proximos")
        return flightDate >= today() && (!selectedDate || flightDate === selectedDate);
      return Boolean(flightDate) && flightDate < today();
    })
    .sort((a, b) =>
      filter === "historico"
        ? String(b.data_agendada).localeCompare(String(a.data_agendada))
        : String(a.data_agendada).localeCompare(String(b.data_agendada)),
    );
  const current = visible[0];
  const dates = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(day + "T12:00:00");
    d.setDate(d.getDate() + i - 3);
    return dateKey(d);
  });
  const monthDate = new Date(`${calendarMonth}-01T12:00:00`);
  const monthDayCount = new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 0).getDate();
  const monthOffset = (monthDate.getDay() + 6) % 7;
  const monthCells: (string | null)[] = [
    ...Array.from({ length: monthOffset }, () => null),
    ...Array.from({ length: monthDayCount }, (_, i) =>
      dateKey(new Date(monthDate.getFullYear(), monthDate.getMonth(), i + 1, 12)),
    ),
  ];

  return (
    <View style={[s.root, { paddingTop: insets.top + 10 }]}>
      <Cabecalho
        titulo={detail ? "Meu voo" : "Minha agenda"}
        apoio="OPERAÇÕES DE VOO"
        voltar={detail ? () => setSelected(null) : undefined}
        acao={() =>
          detail ? void openFlight(detail.voo.id, true) : void load()
        }
      />
      {error ? (
        <Pressable onPress={() => void load()} style={s.error}>
          <Text style={{ color: "#ffb6b6" }}>
            {error} · Toque para tentar novamente
          </Text>
        </Pressable>
      ) : null}
      {loading ? (
        <ActivityIndicator style={{ marginTop: 35 }} color={blue} />
      ) : (
        <ScrollView
          contentContainerStyle={{ padding: 18, paddingBottom: 120 }}
          showsVerticalScrollIndicator={false}
        >
          {!detail ? (
            <>
              <View style={s.filters}>
                {(
                  [
                    ["operacao", "Voos em Operação"],
                    ["proximos", "Próximos voos"],
                    ["historico", "Histórico"],
                  ] as const
                ).map(([id, label]) => (
                  <Pressable
                    key={id}
                    accessibilityRole="button"
                    onPress={() => {
                      setFilter(id);
                      if (id !== "proximos") setSelectedDate(null);
                    }}
                    style={[s.filter, filter === id && s.activeFilter]}
                  >
                    <Text
                      style={{
                        color: filter === id ? blue : muted,
                        fontSize: 10,
                        fontFamily: "Inter_600SemiBold",
                        textAlign: "center",
                      }}
                    >
                      {label}
                    </Text>
                  </Pressable>
                ))}
              </View>
              {filter === "proximos" && (
                <>
                  <View style={s.between}>
                    <Pressable
                      accessibilityLabel="Semana anterior"
                      onPress={() => {
                        const d = new Date(day + "T12:00:00");
                        d.setDate(d.getDate() - 7);
                        const next = dateKey(d);
                        setDay(next);
                        if (selectedDate) setSelectedDate(next);
                      }}
                      style={s.calendarArrow}
                    >
                      <Feather name="chevron-left" color={blue} size={18} />
                    </Pressable>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel="Abrir calendário mensal"
                      onPress={() => {
                        setCalendarMonth(day.slice(0, 7));
                        setMonthPickerOpen(true);
                      }}
                      style={s.monthTitle}
                    >
                      <Text style={s.rowTitle}>
                        {new Date(day + "T12:00:00").toLocaleDateString("pt-BR", {
                          month: "long",
                          year: "numeric",
                        })}
                      </Text>
                      <Feather name="calendar" size={16} color={blue} />
                    </Pressable>
                    <Pressable
                      accessibilityLabel="Próxima semana"
                      onPress={() => {
                        const d = new Date(day + "T12:00:00");
                        d.setDate(d.getDate() + 7);
                        const next = dateKey(d);
                        setDay(next);
                        if (selectedDate) setSelectedDate(next);
                      }}
                      style={s.calendarArrow}
                    >
                      <Feather name="chevron-right" color={blue} size={18} />
                    </Pressable>
                  </View>
                  <View style={s.week}>
                    {dates.map((d) => (
                      <Pressable
                        key={d}
                        accessibilityRole="button"
                        accessibilityState={{ selected: selectedDate === d, disabled: d < today() }}
                        disabled={d < today()}
                        onPress={() => {
                          setDay(d);
                          setSelectedDate(d);
                        }}
                        style={[s.day, selectedDate === d && s.selectedDay, d < today() && s.pastDay]}
                      >
                        <Text
                          style={{
                            fontSize: 9,
                            color: selectedDate === d ? navy : muted,
                            textTransform: "uppercase",
                          }}
                        >
                          {new Date(d + "T12:00:00")
                            .toLocaleDateString("pt-BR", { weekday: "short" })
                            .replace(".", "")}
                        </Text>
                        <Text
                          style={{
                            fontSize: 18,
                            fontFamily: "Inter_700Bold",
                            color: selectedDate === d ? navy : "#fff",
                            marginTop: 7,
                          }}
                        >
                          {d.slice(-2)}
                        </Text>
                        <View
                          style={{
                            width: 4,
                            height: 4,
                            borderRadius: 2,
                            marginTop: 7,
                            backgroundColor: flights.some(
                              (f) => f.data_agendada?.slice(0, 10) === d,
                            )
                              ? selectedDate === d
                                ? navy
                                : blue
                              : "transparent",
                          }}
                        />
                      </Pressable>
                    ))}
                  </View>
                  <View style={s.between}>
                    <Text style={s.calendarHint}>
                      {selectedDate ? `Filtrado por ${formatDate(selectedDate)}` : "Selecione um dia para filtrar"}
                    </Text>
                    {selectedDate ? (
                      <Pressable accessibilityRole="button" onPress={() => setSelectedDate(null)}>
                        <Text style={s.clearDate}>Todos os próximos</Text>
                      </Pressable>
                    ) : null}
                  </View>
                </>
              )}
              <Text style={s.section}>
                {filter === "operacao"
                  ? "VOOS EM OPERAÇÃO"
                  : filter === "proximos"
                    ? selectedDate
                      ? `VOOS EM ${formatDate(selectedDate)}`
                      : "PRÓXIMOS VOOS"
                    : "HISTÓRICO DE VOOS"}
              </Text>
              {current ? (
                <CartaoVoo
                  key={current.id}
                  voo={current}
                  onPress={() => void openFlight(current.id)}
                />
              ) : (
                <Vazio
                  icone={filter === "operacao" ? "send" : "calendar"}
                  titulo={filter === "proximos" && selectedDate ? "Nenhum voo neste dia" : "Nenhum voo neste período"}
                  texto={
                    filter === "proximos" && selectedDate
                      ? "Escolha outra data no calendário ou veja todos os próximos voos."
                      : filter === "operacao"
                        ? "Não há voos em operação no momento."
                        : "Selecione outro período ou consulte seu histórico."
                  }
                />
              )}
              {visible.length > 1 && (
                <Text style={s.section}>
                  OUTROS VOOS · {visible.length - 1}
                </Text>
              )}
              {visible.slice(1).map((f) => (
                <CartaoVoo
                  key={f.id}
                  voo={f}
                  onPress={() => void openFlight(f.id)}
                />
              ))}
            </>
          ) : (
            <>
              <CartaoVoo key={detail.voo.id} voo={detail.voo} />
              {action("Acompanhar voo", "map", () =>
                router.push({
                  pathname: "/acompanhar-voo",
                  params: { vooId: detail.voo.id },
                }),
              )}
              <Text style={s.section}>PREPARAÇÃO E BRIEFING</Text>
              <View style={s.panel}>
                <Text style={s.rowTitle}>Informações do briefing</Text>
                <Text style={[s.secondary, { marginTop: 8 }]}>
                  {detail.voo.mensagem ||
                    "Nenhuma observação operacional cadastrada."}
                </Text>
                <Text style={[s.secondary, { marginTop: 8 }]}>
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
                                  ? "#79dbb5"
                                  : blue,
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
                          <Pressable
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
                          </Pressable>
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
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Fechar calendário mensal"
                onPress={() => setMonthPickerOpen(false)}
                hitSlop={10}
              >
                <Feather name="x" size={22} color="#fff" />
              </Pressable>
            </View>
            <View style={[s.between, { marginTop: 18 }]}>
              <Pressable
                accessibilityLabel="Mês anterior"
                onPress={() => {
                  const prev = new Date(monthDate.getFullYear(), monthDate.getMonth() - 1, 1, 12);
                  setCalendarMonth(dateKey(prev).slice(0, 7));
                }}
                style={s.calendarArrow}
              >
                <Feather name="chevron-left" color={blue} size={18} />
              </Pressable>
              <Text style={s.rowTitle}>
                {monthDate.toLocaleDateString("pt-BR", { month: "long", year: "numeric" })}
              </Text>
              <Pressable
                accessibilityLabel="Próximo mês"
                onPress={() => {
                  const next = new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 1, 12);
                  setCalendarMonth(dateKey(next).slice(0, 7));
                }}
                style={s.calendarArrow}
              >
                <Feather name="chevron-right" color={blue} size={18} />
              </Pressable>
            </View>
            <View style={s.monthGrid}>
              {["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"].map((weekday) => (
                <Text key={weekday} style={s.weekdayLabel}>{weekday}</Text>
              ))}
              {monthCells.map((d, index) => {
                if (!d) return <View key={`blank-${index}`} style={s.monthCell} />;
                const isPast = d < today();
                const isSelected = selectedDate === d;
                const hasFlight = flights.some((f) => f.data_agendada?.slice(0, 10) === d);
                return (
                  <Pressable
                    key={d}
                    accessibilityRole="button"
                    accessibilityLabel={new Date(d + "T12:00:00").toLocaleDateString("pt-BR", { dateStyle: "full" })}
                    accessibilityState={{ selected: isSelected, disabled: isPast }}
                    disabled={isPast}
                    onPress={() => {
                      setDay(d);
                      setSelectedDate(d);
                      setMonthPickerOpen(false);
                    }}
                    style={[s.monthCell, isSelected && s.selectedDay, isPast && s.pastDay]}
                  >
                    <Text style={[s.monthCellText, isSelected && { color: navy }]}>
                      {Number(d.slice(-2))}
                    </Text>
                    {hasFlight ? <View style={[s.monthCellDot, isSelected && { backgroundColor: navy }]} /> : null}
                  </Pressable>
                );
              })}
            </View>
            {selectedDate ? (
              <Pressable
                accessibilityRole="button"
                onPress={() => {
                  setSelectedDate(null);
                  setMonthPickerOpen(false);
                }}
                style={s.clearMonthDate}
              >
                <Text style={s.clearDate}>Remover filtro de data · ver todos os próximos</Text>
              </Pressable>
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
            <Pressable onPress={() => setEditing(null)}>
              <Feather name="x" size={23} color="#fff" />
            </Pressable>
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
                  placeholderTextColor={muted}
                  keyboardType="numbers-and-punctuation"
                  value={times[key]}
                  onChangeText={(v) => setTimes((p) => ({ ...p, [key]: v }))}
                />
              </View>
            ))}
          </View>
          <Pressable
            disabled={saving}
            onPress={() => void saveTimes()}
            style={s.primary}
          >
            <Text style={s.primaryText}>
              {saving ? "Salvando…" : "Salvar horários"}
            </Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  filters: {
    flexDirection: "row",
    padding: 5,
    borderRadius: 16,
    backgroundColor: card,
    gap: 5,
    marginBottom: 20,
  },
  filter: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: "center",
  },
  activeFilter: { backgroundColor: "#153752" },
  week: { flexDirection: "row", gap: 5, marginTop: 15 },
  monthTitle: { flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 8 },
  calendarHint: { color: muted, fontSize: 11, marginTop: 12 },
  clearDate: { color: blue, fontSize: 11, fontFamily: "Inter_600SemiBold" },
  pastDay: { opacity: 0.35 },
  day: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 13,
    borderRadius: 16,
    backgroundColor: card,
    borderWidth: 1,
    borderColor: border,
  },
  selectedDay: { backgroundColor: blue, borderColor: blue },
  calendarArrow: { padding: 10, borderRadius: 12, backgroundColor: card },
  root: { flex: 1, backgroundColor: navy },
  top: {
    paddingHorizontal: 20,
    paddingVertical: 18,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  kicker: { color: blue, fontSize: 10, letterSpacing: 2.2, fontWeight: "800" },
  heading: { color: "#fff", fontSize: 29, fontWeight: "800", marginTop: 7 },
  iconBtn: {
    width: 44,
    height: 44,
    backgroundColor: card,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  section: {
    color: muted,
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1.8,
    marginTop: 24,
    marginBottom: 12,
  },
  flightCard: {
    backgroundColor: "#112c48",
    borderRadius: 23,
    borderWidth: 1,
    borderColor: border,
    padding: 20,
  },
  between: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  flightNo: { fontSize: 20, fontWeight: "800", color: "#fff" },
  status: {
    color: "#72dfbb",
    fontSize: 11,
    fontWeight: "800",
    textTransform: "uppercase",
  },
  route: {
    fontSize: 29,
    fontWeight: "800",
    color: "#fff",
    marginTop: 20,
    marginBottom: 8,
  },
  secondary: { fontSize: 13, color: muted, lineHeight: 21 },
  link: { color: blue, fontSize: 13, fontWeight: "700", marginTop: 8 },
  listRow: {
    backgroundColor: card,
    borderRadius: 16,
    padding: 17,
    marginBottom: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  rowTitle: { color: "#fff", fontSize: 15, fontWeight: "700" },
  panel: {
    backgroundColor: card,
    borderRadius: 18,
    borderColor: border,
    borderWidth: 1,
    padding: 16,
    gap: 5,
    marginBottom: 10,
  },
  action: {
    backgroundColor: card,
    padding: 18,
    borderRadius: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  actionText: { color: "#fff", fontWeight: "700", flex: 1 },
  leg: {
    borderTopWidth: 1,
    borderTopColor: border,
    marginTop: 12,
    paddingTop: 12,
    gap: 5,
  },
  error: {
    marginHorizontal: 18,
    padding: 14,
    backgroundColor: "#4b202a",
    borderRadius: 12,
  },
  editor: {
    position: "absolute",
    left: 12,
    right: 12,
    backgroundColor: "#14263f",
    borderWidth: 1,
    borderColor: blue,
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
    backgroundColor: navy,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: border,
    padding: 12,
    color: "#fff",
    fontSize: 17,
  },
  primary: {
    backgroundColor: blue,
    borderRadius: 12,
    minHeight: 48,
    alignItems: "center",
    justifyContent: "center",
  },
  primaryText: { color: navy, fontWeight: "800" },
  modalBackdrop: {
    flex: 1,
    justifyContent: "center",
    padding: 20,
    backgroundColor: "rgba(0,0,0,0.72)",
  },
  monthSheet: {
    backgroundColor: card,
    borderColor: border,
    borderWidth: 1,
    borderRadius: 24,
    padding: 20,
  },
  monthSheetTitle: { color: "#fff", fontSize: 18, fontFamily: "Inter_700Bold" },
  monthGrid: { flexDirection: "row", flexWrap: "wrap", marginTop: 18 },
  weekdayLabel: {
    width: `${100 / 7}%`,
    color: muted,
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
  monthCellText: { color: "#fff", fontSize: 13, fontFamily: "Inter_600SemiBold" },
  monthCellDot: { width: 4, height: 4, borderRadius: 2, backgroundColor: blue, position: "absolute", bottom: 4 },
  clearMonthDate: { alignItems: "center", paddingTop: 18 },
});
