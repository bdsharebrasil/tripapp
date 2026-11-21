import { avisar, confirmar } from "@/src/lib/confirmar";
import { Cabecalho, tema } from "@/src/components/ui";
import { Feather } from "@expo/vector-icons";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import React, { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { apiFetch } from "@/src/lib/api";

type Lancamento = {
  perna_id: string;
  jornada_id: string;
  numero_perna: number;
  origem: string;
  destino: string;
  horario_ac?: string | null;
  horario_dep?: string | null;
  horario_pouso?: string | null;
  horario_corte?: string | null;
  lancamento_id?: string | null;
  numero_sequencial?: number | null;
  numero_voo?: string;
  diario_mes_id?: string | null;
  data_registro?: string;
  natureza_voo?: string | null;
  tempo_voo?: number;
  tempo_total?: number;
  tempo_ifr?: number;
  horas_diurnas?: number;
  horas_noturnas?: number;
  pousos_total?: number;
  passageiros?: number;
  distancia_nm?: number;
  litros_combustivel_inicio_voo?: number;
  litros_combustivel_abastecido?: number;
  carga_kg?: string;
  diarias?: string;
  ocorrencias?: string;
  discrepancias?: string;
  acoes_corretivas?: string;
  tipo_manutencao_ultima?: string;
  tipo_manutencao_proxima?: string;
  responsavel_aprovacao_manutencao?: string;
  detectado_por?: string;
  assinado_pic?: string | null;
  data_assinatura?: string | null;
  status_lancamento:
    | "RASCUNHO"
    | "ASSINADO"
    | "AGUARDANDO_AC"
    | "SINCRONIZACAO_PENDENTE";
  diario_fechado?: number;
};
type Response = { pode_assinar: boolean; lancamentos: Lancamento[] };
type FlightDetail = {
  voo: {
    id: string;
    numero_voo?: string;
    matricula_registro?: string;
    cliente_razao_social?: string;
    origem?: string;
    destino?: string;
    data_agendada?: string;
  };
};
const BG = tema.fundo,
  CARD = tema.superficie,
  LINE = tema.borda,
  BLUE = tema.azul,
  MUTED = "#a9b9cd",
  GREEN = "#79dbb5";
const API = "/api/colaborador/diario-bordo";
const naturezas = [
  "EX - Executivo",
  "AE - Aérea/Regular",
  "NR - Não Remunerado",
  "RE - Retorno/Reposição",
  "PV - Privado",
  "TR - Traslado",
  "SA - Serviço Aéreo",
  "TN - Táxi Aéreo",
  "VT - Voo Teste",
];
type Campo = keyof Lancamento;
const grupos: {
  titulo: string;
  campos: {
    key: Campo;
    label: string;
    keyboard?: "decimal-pad" | "numeric";
    multiline?: boolean;
  }[];
}[] = [
  {
    titulo: "OPERAÇÃO",
    campos: [
      { key: "tempo_ifr", label: "Tempo IFR (horas)", keyboard: "decimal-pad" },
      { key: "horas_diurnas", label: "Horas diurnas", keyboard: "decimal-pad" },
      {
        key: "horas_noturnas",
        label: "Horas noturnas",
        keyboard: "decimal-pad",
      },
      { key: "pousos_total", label: "Número de pousos", keyboard: "numeric" },
      { key: "passageiros", label: "Passageiros", keyboard: "numeric" },
      { key: "distancia_nm", label: "Distância (NM)", keyboard: "decimal-pad" },
    ],
  },
  {
    titulo: "COMBUSTÍVEL E CARGA",
    campos: [
      {
        key: "litros_combustivel_inicio_voo",
        label: "Combustível no início (L)",
        keyboard: "decimal-pad",
      },
      {
        key: "litros_combustivel_abastecido",
        label: "Combustível abastecido (L)",
        keyboard: "decimal-pad",
      },
      { key: "carga_kg", label: "Carga (kg)" },
      { key: "diarias", label: "Diárias" },
    ],
  },
  {
    titulo: "REGISTROS E MANUTENÇÃO",
    campos: [
      { key: "ocorrencias", label: "Ocorrências", multiline: true },
      { key: "discrepancias", label: "Discrepâncias", multiline: true },
      { key: "acoes_corretivas", label: "Ações corretivas", multiline: true },
      { key: "tipo_manutencao_ultima", label: "Última manutenção" },
      { key: "tipo_manutencao_proxima", label: "Próxima manutenção" },
      {
        key: "responsavel_aprovacao_manutencao",
        label: "Responsável pela liberação",
      },
      { key: "detectado_por", label: "Detectado por" },
    ],
  },
];
const date = (v?: string) =>
  v ? v.slice(0, 10).split("-").reverse().join("/") : "—";
const hhmm = (v?: string | null) => v?.match(/\d{2}:\d{2}/)?.[0] || "—";
const str = (v: unknown) => (v === undefined || v === null ? "" : String(v));

export default function DiarioBordoMobile() {
  const { vooId } = useLocalSearchParams<{ vooId: string }>();
  const router = useRouter(),
    insets = useSafeAreaInsets();
  const [voos, setVoos] = useState<FlightDetail["voo"][]>([]);
  const [busca, setBusca] = useState("");
  const [detail, setDetail] = useState<FlightDetail | null>(null),
    [response, setResponse] = useState<Response | null>(null);
  const [loading, setLoading] = useState(true),
    [refreshing, setRefreshing] = useState(false),
    [busy, setBusy] = useState("");
  const [error, setError] = useState(""),
    [active, setActive] = useState<string | null>(null);
  const [draft, setDraft] = useState<Record<string, string>>({}),
    [changed, setChanged] = useState<string[]>([]);
  const selected = response?.lancamentos.find((l) => l.perna_id === active);
  const readonly =
    selected?.status_lancamento === "ASSINADO" ||
    Boolean(selected?.diario_fechado);
  const fetchData = useCallback(
    async (refresh = false) => {
      if (refresh) setRefreshing(true);
      else setLoading(true);
      setError("");
      try {
        if (!vooId) {
          const result = await apiFetch<{ voos: FlightDetail["voo"][] }>(
            "/api/colaborador/meus-voos",
          );
          setVoos(
            result.voos
              .slice()
              .sort((a, b) =>
                String(b.data_agendada).localeCompare(String(a.data_agendada)),
              ),
          );
          return;
        }
        const [data, flight] = await Promise.all([
          apiFetch<Response>(`${API}/voos/${encodeURIComponent(vooId)}`),
          apiFetch<FlightDetail>(
            `/api/colaborador/meus-voos/${encodeURIComponent(vooId)}`,
          ),
        ]);
        setResponse(data);
        setDetail(flight);
      } catch (e) {
        setError(
          e instanceof Error
            ? e.message
            : "Não foi possível abrir o Diário de Bordo.",
        );
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [vooId],
  );
  useFocusEffect(
    useCallback(() => {
      void fetchData();
    }, [fetchData]),
  );
  const open = (row: Lancamento) => {
    if (!row.lancamento_id) return;
    setActive(row.perna_id);
    const values: Record<string, string> = {};
    for (const key of [
      "natureza_voo",
      ...grupos.flatMap((g) => g.campos.map((c) => c.key)),
    ]) {
      values[key] = str((row as Record<string, any>)[key]);
    }
    setDraft(values);
    setChanged([]);
  };
  const set = (key: string, val: string) => {
    setDraft((p) => ({ ...p, [key]: val }));
    setChanged((p) => (p.includes(key) ? p : [...p, key]));
  };
  const close = () => {
    if (changed.length)
      confirmar(
        "Alterações não salvas",
        "Sair sem salvar o complemento do Diário?",
        () => {
          setActive(null);
          setChanged([]);
        },
        true,
      );
    else setActive(null);
  };
  const sync = async () => {
    if (!vooId || busy) return;
    setBusy("sync");
    try {
      const result = await apiFetch<{
        resultados: { perna_id: string; status: string; detalhe?: string }[];
      }>(`${API}/voos/${encodeURIComponent(vooId)}/sincronizar`, {
        method: "POST",
      });
      await fetchData(true);
      const issues = result.resultados.filter(
        (r) => !["rascunho", "assinado", "aguardando_ac"].includes(r.status),
      );
      avisar(
        issues.length ? "Sincronização com pendências" : "Diário sincronizado",
        issues.length
          ? issues
              .map((r) => `${r.perna_id}: ${r.detalhe || r.status}`)
              .join("\n")
          : "Cada perna com AC registrado está vinculada ao rascunho do Diário de Bordo.",
      );
    } catch (e) {
      avisar(
        "Erro ao sincronizar",
        e instanceof Error ? e.message : "Tente novamente.",
      );
    } finally {
      setBusy("");
    }
  };
  const save = async () => {
    if (!selected || readonly || !changed.length || busy) return;
    setBusy("save");
    try {
      const payload: Record<string, unknown> = {};
      for (const key of changed) {
        const value = draft[key] || "";
        const numeric = grupos.some((g) =>
          g.campos.some((c) => c.key === key && Boolean(c.keyboard)),
        );
        if (
          numeric &&
          value.trim() &&
          !/^\d+(?:[.,]\d+)?$/.test(value.trim())
        ) {
          avisar(
            "Valor inválido",
            `Confira o campo ${key.replace(/_/g, " ")}. Use apenas números positivos.`,
          );
          return;
        }
        payload[key] = numeric
          ? Number((value || "0").replace(",", "."))
          : value;
      }
      await apiFetch(`${API}/pernas/${encodeURIComponent(selected.perna_id)}`, {
        method: "PATCH",
        body: JSON.stringify(payload),
      });
      setChanged([]);
      await fetchData(true);
      avisar(
        "Rascunho salvo",
        "Dados complementares registrados no Diário de Bordo da aeronave.",
      );
    } catch (e) {
      avisar(
        "Falha ao salvar",
        e instanceof Error ? e.message : "Verifique as informações.",
      );
    } finally {
      setBusy("");
    }
  };
  const sign = () => {
    if (!selected || readonly || busy) return;
    if (changed.length)
      return avisar(
        "Salve primeiro",
        "Salve os dados complementares antes da assinatura.",
      );
    if (!response?.pode_assinar)
      return avisar(
        "Permissão",
        "Apenas o piloto comandante escalado pode assinar este lançamento.",
      );
    confirmar(
      "Assinatura eletrônica do comandante",
      "Confirmo que conferi os horários e informações deste lançamento. A assinatura ficará vinculada à minha conta e à data/hora atual.",
      async () => {
        setBusy("sign");
        try {
          await apiFetch(
            `${API}/pernas/${encodeURIComponent(selected.perna_id)}/assinar`,
            {
              method: "POST",
              body: JSON.stringify({ confirmar_assinatura: true }),
            },
          );
          await fetchData(true);
          setActive(null);
          avisar(
            "Diário assinado",
            "O lançamento foi confirmado pelo comandante e está bloqueado para alterações comuns.",
          );
        } catch (e) {
          avisar(
            "Assinatura não registrada",
            e instanceof Error
              ? e.message
              : "Verifique os horários e a natureza do voo.",
          );
        } finally {
          setBusy("");
        }
      },
    );
  };
  const voo = detail?.voo;
  return (
    <View style={[s.root, { paddingTop: insets.top + 10 }]}>
      <Cabecalho
        titulo={
          !vooId
            ? "Diário de bordo"
            : active
              ? "Complementar lançamento"
              : "Diário do voo"
        }
        apoio="Diário de bordo"
        voltar={() => (active ? close() : router.back())}
      />
      {!!error && (
        <Pressable style={s.warn} onPress={() => void fetchData(true)}>
          <Text style={s.note}>{error} · Tocar para atualizar</Text>
        </Pressable>
      )}
      {loading ? (
        <ActivityIndicator color={BLUE} style={{ marginTop: 40 }} />
      ) : (
        <ScrollView
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => void fetchData(true)}
              tintColor={BLUE}
            />
          }
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{
            padding: 17,
            paddingBottom: insets.bottom + 110,
          }}
        >
          {!vooId ? (
            <>
              <Text style={s.section}>SELECIONE O VOO</Text>
              <Text style={s.note}>
                Os horários registrados em Meus voos preenchem o rascunho
                automaticamente, a partir do acionamento (AC).
              </Text>
              <TextInput
                accessibilityLabel="Buscar voo no diário"
                placeholder="Número, matrícula ou rota"
                placeholderTextColor={MUTED}
                style={[s.input, { marginVertical: 14 }]}
                value={busca}
                onChangeText={setBusca}
              />
              {voos
                .filter((v) =>
                  [v.numero_voo, v.matricula_registro, v.origem, v.destino]
                    .join(" ")
                    .toLowerCase()
                    .includes(busca.toLowerCase()),
                )
                .map((v) => (
                  <Pressable
                    key={v.id}
                    style={s.card}
                    accessibilityRole="button"
                    accessibilityLabel={`Abrir diário do voo ${v.numero_voo || v.id}`}
                    onPress={() =>
                      router.push({
                        pathname: "/diario-bordo",
                        params: { vooId: v.id },
                      })
                    }
                  >
                    <View style={s.between}>
                      <Text style={s.heading}>
                        {v.numero_voo || "Voo"} · {v.matricula_registro || "—"}
                      </Text>
                      <Feather name="chevron-right" size={20} color={MUTED} />
                    </View>
                    <Text style={s.note}>
                      {v.origem || "—"} → {v.destino || "—"} ·{" "}
                      {date(v.data_agendada)}
                    </Text>
                    <Text style={s.note}>{v.cliente_razao_social || ""}</Text>
                  </Pressable>
                ))}
              {!voos.length && !error && (
                <Text style={s.note}>Nenhum voo disponível no seu diário.</Text>
              )}
            </>
          ) : (
            <>
              <View style={s.summary}>
                <Text style={s.kicker}>{voo?.numero_voo || "VOO"}</Text>
                <Text style={s.big}>
                  {voo?.matricula_registro || "Aeronave não informada"}
                </Text>
                <Text style={s.route}>
                  {voo?.origem || "—"} → {voo?.destino || "—"}
                </Text>
                <Text style={s.note}>
                  {voo?.cliente_razao_social ||
                    "Cliente/holding do agendamento"}{" "}
                  · {date(voo?.data_agendada)}
                </Text>
              </View>
              {!active ? (
                <>
                  <Text style={s.section}>LANÇAMENTOS POR PERNA</Text>
                  {response?.lancamentos.map((r) => (
                    <View key={r.perna_id} style={s.card}>
                      <View style={s.between}>
                        <Text style={s.heading}>
                          Perna {r.numero_perna} · {r.origem} → {r.destino}
                        </Text>
                        <Text
                          style={[
                            s.badge,
                            {
                              color:
                                r.status_lancamento === "ASSINADO"
                                  ? GREEN
                                  : BLUE,
                            },
                          ]}
                        >
                          {r.status_lancamento.replace(/_/g, " ")}
                        </Text>
                      </View>
                      <Text style={s.note}>
                        {date(r.data_registro || r.horario_ac || undefined)} ·{" "}
                        {r.lancamento_id
                          ? `Lançamento nº ${r.numero_sequencial || "—"}`
                          : "Ainda sem lançamento"}
                      </Text>
                      <View style={s.hours}>
                        <Text style={s.hour}>AC {hhmm(r.horario_ac)}</Text>
                        <Text style={s.hour}>DEP {hhmm(r.horario_dep)}</Text>
                        <Text style={s.hour}>POU {hhmm(r.horario_pouso)}</Text>
                        <Text style={s.hour}>COR {hhmm(r.horario_corte)}</Text>
                      </View>
                      <View style={s.between}>
                        <Text style={s.note}>
                          Voo {Number(r.tempo_voo || 0).toFixed(2)} h · Total{" "}
                          {Number(r.tempo_total || 0).toFixed(2)} h
                        </Text>
                        {r.status_lancamento === "ASSINADO" ? (
                          <Feather
                            name="check-circle"
                            size={21}
                            color={GREEN}
                          />
                        ) : null}
                      </View>
                      {r.lancamento_id ? (
                        <Pressable
                          accessibilityRole="button"
                          accessibilityLabel={
                            r.status_lancamento === "ASSINADO"
                              ? "Visualizar assinatura"
                              : "Complementar lançamento"
                          }
                          style={s.action}
                          onPress={() => open(r)}
                        >
                          <Feather
                            name={
                              r.status_lancamento === "ASSINADO"
                                ? "eye"
                                : "edit-3"
                            }
                            size={17}
                            color={BLUE}
                          />
                          <Text style={s.link}>
                            {r.status_lancamento === "ASSINADO"
                              ? "Visualizar assinatura"
                              : "Complementar lançamento"}
                          </Text>
                          <Feather name="chevron-right" color={MUTED} />
                        </Pressable>
                      ) : (
                        <Text style={s.note}>
                          Registre AC em Minha Agenda ou sincronize os horários
                          existentes.
                        </Text>
                      )}
                    </View>
                  ))}
                  {!response?.lancamentos.length ? (
                    <View style={s.card}>
                      <Text style={s.note}>
                        Não há pernas registradas neste voo.
                      </Text>
                    </View>
                  ) : null}
                  <Pressable
                    disabled={!!busy}
                    style={s.primary}
                    onPress={() => void sync()}
                  >
                    <Feather name="refresh-cw" size={18} color={BG} />
                    <Text style={s.primaryText}>
                      {busy === "sync"
                        ? "Sincronizando…"
                        : "Sincronizar rascunhos existentes"}
                    </Text>
                  </Pressable>
                </>
              ) : selected ? (
                <>
                  <View style={s.card}>
                    <View style={s.between}>
                      <Text style={s.heading}>
                        {selected.origem} → {selected.destino}
                      </Text>
                      <Text
                        style={[s.badge, { color: readonly ? GREEN : BLUE }]}
                      >
                        {selected.status_lancamento}
                      </Text>
                    </View>
                    <Text style={s.note}>
                      Diário nº {selected.numero_sequencial || "—"} ·{" "}
                      {date(selected.data_registro)}
                    </Text>
                    <Text style={s.note}>
                      AC {hhmm(selected.horario_ac)} · DEP{" "}
                      {hhmm(selected.horario_dep)} · POU{" "}
                      {hhmm(selected.horario_pouso)} · COR{" "}
                      {hhmm(selected.horario_corte)} (UTC)
                    </Text>
                    <Text style={s.note}>
                      Tempo de voo: {Number(selected.tempo_voo || 0).toFixed(2)}{" "}
                      h · Tempo total:{" "}
                      {Number(selected.tempo_total || 0).toFixed(2)} h
                    </Text>
                    <Text style={s.note}>
                      Horários, aeronave, data e cliente vêm da jornada e não
                      podem ser alterados nesta tela.
                    </Text>
                    {selected.diario_mes_id?.startsWith("auto-") ? (
                      <Text style={[s.note, { color: "#f0c583" }]}>
                        Competência aberta automaticamente. Confirme o valor
                        inicial de célula/horímetro com a operação antes do
                        fechamento mensal.
                      </Text>
                    ) : null}
                  </View>
                  <Text style={s.section}>NATUREZA DO VOO</Text>
                  <View style={s.chips}>
                    {naturezas.map((n) => (
                      <Pressable
                        key={n}
                        disabled={readonly}
                        onPress={() => set("natureza_voo", n)}
                        style={[
                          s.chip,
                          draft.natureza_voo === n && s.chipActive,
                        ]}
                      >
                        <Text
                          style={{
                            color: draft.natureza_voo === n ? BG : MUTED,
                            fontSize: 11,
                            fontWeight: "700",
                          }}
                        >
                          {n}
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                  {grupos.map((g) => (
                    <View key={g.titulo}>
                      <Text style={s.section}>{g.titulo}</Text>
                      <View style={s.card}>
                        {g.campos.map((c) => (
                          <View key={c.key} style={{ marginBottom: 12 }}>
                            <Text style={s.fieldLabel}>{c.label}</Text>
                            <TextInput
                              style={[
                                s.input,
                                c.multiline && {
                                  minHeight: 85,
                                  textAlignVertical: "top",
                                },
                              ]}
                              value={draft[c.key] ?? ""}
                              editable={!readonly}
                              onChangeText={(v) => set(c.key, v)}
                              keyboardType={c.keyboard || "default"}
                              placeholder={
                                c.keyboard ? "0,00" : "Informe quando aplicável"
                              }
                              placeholderTextColor={MUTED}
                              multiline={c.multiline}
                            />
                          </View>
                        ))}
                      </View>
                    </View>
                  ))}
                  {selected.status_lancamento === "ASSINADO" ? (
                    <View style={s.signed}>
                      <Feather name="check-circle" size={23} color={GREEN} />
                      <View style={{ flex: 1 }}>
                        <Text style={s.heading}>Assinado pelo comandante</Text>
                        <Text style={s.note}>
                          {selected.assinado_pic || "Piloto comandante"} ·{" "}
                          {selected.data_assinatura || "Data registrada no D1"}
                        </Text>
                      </View>
                    </View>
                  ) : (
                    <>
                      <Pressable
                        disabled={!!busy || readonly || !changed.length}
                        onPress={() => void save()}
                        style={[
                          s.primary,
                          (!changed.length || readonly) && { opacity: 0.48 },
                        ]}
                      >
                        <Feather name="save" size={18} color={BG} />
                        <Text style={s.primaryText}>
                          {busy === "save"
                            ? "Salvando…"
                            : "Salvar complementos"}
                        </Text>
                      </Pressable>
                      {response?.pode_assinar ? (
                        <Pressable
                          disabled={!!busy || readonly}
                          onPress={sign}
                          style={s.sign}
                        >
                          <Feather
                            name="check-circle"
                            size={19}
                            color={GREEN}
                          />
                          <Text style={s.signText}>
                            {busy === "sign"
                              ? "Assinando…"
                              : "Conferir e assinar como CMTE"}
                          </Text>
                        </Pressable>
                      ) : (
                        <Text style={s.note}>
                          A assinatura eletrônica fica disponível somente para o
                          comandante (PIC) escalado.
                        </Text>
                      )}
                    </>
                  )}
                </>
              ) : null}
            </>
          )}
        </ScrollView>
      )}
    </View>
  );
}
const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: BG },
  header: {
    paddingHorizontal: 17,
    paddingVertical: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  icon: {
    backgroundColor: CARD,
    width: 43,
    height: 43,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
  },
  kicker: { color: BLUE, fontSize: 10, fontWeight: "800", letterSpacing: 1.6 },
  title: { color: "#fff", fontSize: 24, fontWeight: "800", marginTop: 5 },
  summary: {
    backgroundColor: "#143553",
    borderWidth: 1,
    borderColor: "#326181",
    padding: 18,
    borderRadius: 18,
    marginBottom: 15,
  },
  big: { fontSize: 22, color: "#fff", fontWeight: "800", marginTop: 8 },
  route: { fontSize: 19, color: "#fff", fontWeight: "700", marginTop: 7 },
  note: { fontSize: 12, color: MUTED, lineHeight: 19, marginTop: 7 },
  section: {
    fontSize: 11,
    color: MUTED,
    fontWeight: "800",
    letterSpacing: 1.4,
    marginTop: 19,
    marginBottom: 11,
  },
  card: {
    padding: 16,
    borderRadius: 16,
    backgroundColor: CARD,
    borderWidth: 1,
    borderColor: LINE,
    marginBottom: 12,
  },
  between: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  heading: { color: "#fff", fontSize: 15, fontWeight: "800", flexShrink: 1 },
  badge: { fontSize: 10, fontWeight: "800", textTransform: "uppercase" },
  hours: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginVertical: 12 },
  hour: {
    backgroundColor: "#183752",
    borderRadius: 8,
    overflow: "hidden",
    color: "#fff",
    fontSize: 12,
    fontWeight: "700",
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  action: {
    minHeight: 44,
    alignItems: "center",
    flexDirection: "row",
    gap: 9,
    borderTopWidth: 1,
    borderTopColor: LINE,
    marginTop: 12,
    paddingTop: 12,
  },
  link: { color: BLUE, fontSize: 13, fontWeight: "800", flex: 1 },
  primary: {
    minHeight: 55,
    borderRadius: 14,
    backgroundColor: BLUE,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 10,
    marginTop: 14,
    marginBottom: 12,
  },
  primaryText: { fontSize: 14, color: BG, fontWeight: "800" },
  sign: {
    minHeight: 55,
    borderColor: GREEN,
    borderWidth: 1,
    borderRadius: 14,
    backgroundColor: "#143d37",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    marginTop: 6,
  },
  signText: { color: GREEN, fontSize: 14, fontWeight: "800" },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 7 },
  chip: {
    backgroundColor: "#1d344c",
    borderColor: LINE,
    borderWidth: 1,
    borderRadius: 9,
    paddingHorizontal: 10,
    paddingVertical: 9,
  },
  chipActive: { backgroundColor: BLUE, borderColor: BLUE },
  fieldLabel: {
    color: MUTED,
    fontSize: 12,
    fontWeight: "700",
    marginBottom: 6,
  },
  input: {
    color: "#fff",
    backgroundColor: BG,
    borderColor: LINE,
    borderWidth: 1,
    borderRadius: 10,
    minHeight: 46,
    padding: 12,
    fontSize: 15,
  },
  signed: {
    borderRadius: 13,
    backgroundColor: "#173c35",
    borderWidth: 1,
    borderColor: GREEN,
    padding: 15,
    flexDirection: "row",
    alignItems: "center",
    gap: 11,
  },
  warn: {
    marginHorizontal: 17,
    backgroundColor: "#482b34",
    borderRadius: 12,
    padding: 12,
  },
});
