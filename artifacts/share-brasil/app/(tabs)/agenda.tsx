import { Feather } from "@expo/vector-icons";
import { useLocalSearchParams, useFocusEffect, useRouter } from "expo-router";
import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
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

export default function AgendaScreen() {
  const router = useRouter(),
    insets = useSafeAreaInsets();
  const { vooId } = useLocalSearchParams<{ vooId?: string }>();
  const [day, setDay] = useState(today());
  const [filter, setFilter] = useState<"dia" | "proximos" | "historico">("dia");
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

  const load = useCallback(async () => {
    setLoading(true);
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
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const openFlight = async (id: string) => {
    setLoading(true);
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
    .filter((f) =>
      filter === "dia"
        ? f.data_agendada?.slice(0, 10) === day
        : filter === "proximos"
          ? String(f.data_agendada || "").slice(0, 10) >= today()
          : String(f.data_agendada || "").slice(0, 10) < today(),
    )
    .sort((a, b) =>
      filter === "historico"
        ? String(b.data_agendada).localeCompare(String(a.data_agendada))
        : String(a.data_agendada).localeCompare(String(b.data_agendada)),
    );
  const current = visible[0];
  const dates = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(day + "T12:00:00");
    d.setDate(d.getDate() + i - 3);
    return [
      d.getFullYear(),
      String(d.getMonth() + 1).padStart(2, "0"),
      String(d.getDate()).padStart(2, "0"),
    ].join("-");
  });

  return (
    <View style={[s.root, { paddingTop: insets.top + 10 }]}>
      <Cabecalho
        titulo={detail ? "Meu voo" : "Minha agenda"}
        apoio="OPERAÇÕES DE VOO"
        voltar={detail ? () => setSelected(null) : undefined}
        acao={() => (detail ? void openFlight(detail.voo.id) : void load())}
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
                    ["dia", "Por dia"],
                    ["proximos", "Próximos"],
                    ["historico", "Histórico"],
                  ] as const
                ).map(([id, label]) => (
                  <Pressable
                    key={id}
                    accessibilityRole="button"
                    onPress={() => setFilter(id)}
                    style={[s.filter, filter === id && s.activeFilter]}
                  >
                    <Text
                      style={{
                        color: filter === id ? blue : muted,
                        fontSize: 12,
                        fontFamily: "Inter_600SemiBold",
                      }}
                    >
                      {label}
                    </Text>
                  </Pressable>
                ))}
              </View>
              {filter === "dia" && (
                <>
                  <View style={s.between}>
                    <Pressable
                      accessibilityLabel="Semana anterior"
                      onPress={() => {
                        const d = new Date(day + "T12:00:00");
                        d.setDate(d.getDate() - 7);
                        setDay(
                          [
                            d.getFullYear(),
                            String(d.getMonth() + 1).padStart(2, "0"),
                            String(d.getDate()).padStart(2, "0"),
                          ].join("-"),
                        );
                      }}
                      style={s.calendarArrow}
                    >
                      <Feather name="chevron-left" color={blue} size={18} />
                    </Pressable>
                    <Text style={s.rowTitle}>
                      {new Date(day + "T12:00:00").toLocaleDateString("pt-BR", {
                        month: "long",
                        year: "numeric",
                      })}
                    </Text>
                    <Pressable
                      accessibilityLabel="Próxima semana"
                      onPress={() => {
                        const d = new Date(day + "T12:00:00");
                        d.setDate(d.getDate() + 7);
                        setDay(
                          [
                            d.getFullYear(),
                            String(d.getMonth() + 1).padStart(2, "0"),
                            String(d.getDate()).padStart(2, "0"),
                          ].join("-"),
                        );
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
                        accessibilityState={{ selected: day === d }}
                        onPress={() => setDay(d)}
                        style={[s.day, day === d && s.selectedDay]}
                      >
                        <Text
                          style={{
                            fontSize: 9,
                            color: day === d ? navy : muted,
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
                            color: day === d ? navy : "#fff",
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
                              ? day === d
                                ? navy
                                : blue
                              : "transparent",
                          }}
                        />
                      </Pressable>
                    ))}
                  </View>
                </>
              )}
              <Text style={s.section}>
                {filter === "dia"
                  ? `VOOS EM ${formatDate(day)}`
                  : filter === "proximos"
                    ? "PRÓXIMO VOO"
                    : "ÚLTIMO VOO"}
              </Text>
              {current ? (
                <Pressable
                  onPress={() => void openFlight(current.id)}
                  style={[s.flightCard, { borderColor: blue }]}
                >
                  <View style={s.between}>
                    <Text style={s.flightNo}>
                      {current.numero_voo || "Voo programado"}
                    </Text>
                    <Text style={s.status}>
                      {current.status || "PROGRAMADO"}
                    </Text>
                  </View>
                  <Text style={s.route}>
                    {current.origem || "—"}{" "}
                    <Text style={{ color: blue }}>→</Text>{" "}
                    {current.destino || "—"}
                  </Text>
                  <Text style={s.secondary}>
                    {current.matricula_registro || "Aeronave"} ·{" "}
                    {formatDate(current.data_agendada)} ·{" "}
                    {hhmm(current.horario_previsto_agendamento)} UTC
                  </Text>
                  <Text style={[s.link, { marginTop: 15 }]}>
                    Consultar voo e operação →
                  </Text>
                </Pressable>
              ) : (
                <Vazio
                  icone="calendar"
                  titulo="Nenhum voo neste período"
                  texto="Selecione outro dia ou consulte seu histórico."
                />
              )}
              {visible.length > 1 && (
                <Text style={s.section}>
                  OUTROS VOOS · {visible.length - 1}
                </Text>
              )}
              {visible.slice(1).map((f) => (
                <Pressable
                  key={f.id}
                  onPress={() => void openFlight(f.id)}
                  style={s.listRow}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={s.rowTitle}>{f.numero_voo || "Voo"}</Text>
                    <Text style={s.secondary}>
                      {f.origem} → {f.destino} · {formatDate(f.data_agendada)}
                    </Text>
                  </View>
                  <Feather name="chevron-right" color={blue} size={20} />
                </Pressable>
              ))}
            </>
          ) : (
            <>
              <View style={s.flightCard}>
                <View style={s.between}>
                  <Text style={s.flightNo}>{detail.voo.numero_voo}</Text>
                  <Text style={s.status}>{detail.voo.status}</Text>
                </View>
                <Text style={s.route}>
                  {detail.voo.origem} → {detail.voo.destino}
                </Text>
                <Text style={s.secondary}>
                  {detail.voo.matricula_registro} ·{" "}
                  {formatDate(detail.voo.data_agendada)}
                </Text>
                <Text style={[s.secondary, { marginTop: 10 }]}>
                  {detail.voo.cliente_razao_social || "Cliente não informado"}
                </Text>
              </View>
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
});
