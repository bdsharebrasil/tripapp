import { useQuery } from "@tanstack/react-query";
import {
  API_DIARIO,
  horasDecimais,
  leitura,
  naturezas,
  type AeronaveDiario,
  type DiarioMensalResposta,
} from "@/src/features/diario/modelo";
import { avisar, confirmar } from "@/src/lib/confirmar";
import {
  Botao,
  Cabecalho,
  ErroConsulta,
  Tela,
  tema,
  Icon,
  Toque,
} from "@/src/components/ui";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import React, { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Image,
  RefreshControl,
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
    fabricante?: string;
    modelo?: string;
    imagem_url?: string;
    celula_atual_ttotal?: number | null;
    celula_prox_revisao_ttotal?: number | null;
    celula_disponivel_ttotal?: number | null;
    celula_anterior_ttotal?: number | null;
    horas_ano?: number | null;
    origem?: string;
    destino?: string;
    data_agendada?: string;
  };
};
const API = "/api/colaborador/diario-bordo";
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
  const { vooId, aeronaveId, matricula } = useLocalSearchParams<{
    vooId?: string;
    aeronaveId?: string;
    matricula?: string;
  }>();
  if (aeronaveId && !vooId)
    return (
      <DiarioMensal
        key={aeronaveId}
        aeronaveId={aeronaveId}
        matricula={matricula}
      />
    );
  return <DiarioDoVoo vooId={vooId} />;
}

function DiarioDoVoo({ vooId }: { vooId?: string }) {
  const router = useRouter(),
    insets = useSafeAreaInsets();
  const [voos, setVoos] = useState<AeronaveDiario[]>([]);
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
          const dados = await apiFetch<{ aeronaves: AeronaveDiario[] }>(
            `${API_DIARIO}/resumo?referencia=atual`,
          );
          setVoos(dados.aeronaves);
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
    <SafeAreaView edges={["top"]} style={[s.root, { paddingTop: 10 }]}>
      {vooId ? (
        <Cabecalho
          titulo={active ? "Complementar lançamento" : "Diário do voo"}
          apoio="Diário de bordo"
          voltar={() => {
            if (active) {
              close();
              return;
            }
            router.back();
          }}
        />
      ) : null}
      {!!error && (
        <Toque style={s.warn} onPress={() => void fetchData(true)}>
          <Text style={s.note}>{error} · Tocar para atualizar</Text>
        </Toque>
      )}
      {loading ? (
        <ActivityIndicator color={tema.azul} style={{ marginTop: 40 }} />
      ) : (
        <ScrollView
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => void fetchData(true)}
              tintColor={tema.azul}
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
              <View style={s.fleetHeader}>
                <Text style={s.kicker}>
                  OPERAÇÃO · {new Date().getFullYear()}
                </Text>
                <Text style={s.title}>Escolha uma aeronave</Text>
                <Text style={s.fleetCount}>
                  {voos.length}{" "}
                  {voos.length === 1 ? "aeronave ativa" : "aeronaves ativas"}
                </Text>
              </View>
              <TextInput
                accessibilityLabel="Buscar aeronave, matrícula ou modelo"
                placeholder="Buscar matrícula, fabricante ou modelo"
                placeholderTextColor={tema.suave}
                style={s.searchInput}
                value={busca}
                onChangeText={setBusca}
              />
              <View style={s.aircraftGrid}>
                {voos
                  .filter((v) =>
                    [v.matricula_registro, v.fabricante, v.modelo]
                      .filter(Boolean)
                      .join(" ")
                      .toLowerCase()
                      .includes(busca.toLowerCase()),
                  )
                  .map((v) => (
                    <Toque
                      key={v.id}
                      style={s.aircraftCard}
                      accessibilityRole="button"
                      accessibilityLabel={`Abrir diário da aeronave ${v.matricula_registro || v.id}`}
                      onPress={() => {
                        router.push({
                          pathname: "/diario-bordo",
                          params: {
                            aeronaveId: v.id,
                            matricula: v.matricula_registro,
                          },
                        });
                      }}
                    >
                      <Image
                        source={
                          v.image_url
                            ? { uri: String(v.image_url) }
                            : require("../assets/images/ceu-asa.jpg")
                        }
                        style={s.aircraftImage}
                        resizeMode="cover"
                      />
                      <View style={s.aircraftShade} />
                      <View style={s.aircraftContent}>
                        <View style={s.aircraftTopRow}>
                          <View style={{ flex: 1 }}>
                            <Text style={s.aircraftRegistration}>
                              {v.matricula_registro || "Aeronave"}
                            </Text>
                            <Text style={s.aircraftModel} numberOfLines={1}>
                              {[v.fabricante, v.modelo]
                                .filter(Boolean)
                                .join(" ") || "Aeronave"}
                            </Text>
                          </View>
                          {!!v.mes_referencia &&
                            leitura(v, "disponivel") != null && (
                              <View
                                style={[
                                  s.aircraftStatus,
                                  Number(leitura(v, "disponivel")) < 0
                                    ? s.aircraftStatusWarning
                                    : s.aircraftStatusActive,
                                ]}
                              >
                                <Icon
                                  name={
                                    Number(leitura(v, "disponivel")) < 0
                                      ? "tool"
                                      : "check-circle"
                                  }
                                  size={13}
                                  color={
                                    Number(leitura(v, "disponivel")) < 0
                                      ? "#F0C583"
                                      : tema.verde
                                  }
                                />
                                <Text
                                  style={[
                                    s.aircraftStatusText,
                                    {
                                      color:
                                        Number(leitura(v, "disponivel")) < 0
                                          ? "#F0C583"
                                          : tema.verde,
                                    },
                                  ]}
                                >
                                  {Number(leitura(v, "disponivel")) < 0
                                    ? "Revisão vencida"
                                    : "Ativa"}
                                </Text>
                              </View>
                            )}
                        </View>
                        <View style={s.aircraftMetrics}>
                          <View style={s.aircraftMetric}>
                            <Text style={s.aircraftMetricLabel}>
                              CÉLULA ATUAL
                            </Text>
                            <Text style={s.aircraftMetricValue}>
                              {horasDecimais(
                                v.mes_referencia ? leitura(v, "atual") : null,
                              )}
                            </Text>
                          </View>
                          <View style={s.aircraftMetric}>
                            <Text style={s.aircraftMetricLabel}>
                              PRÓXIMA REVISÃO
                            </Text>
                            <Text style={s.aircraftMetricValue}>
                              {horasDecimais(leitura(v, "prox_revisao"))}
                            </Text>
                          </View>
                        </View>
                      </View>
                    </Toque>
                  ))}
              </View>
              {!voos.length && !error && (
                <Text style={s.note}>
                  Nenhuma aeronave disponível no diário.
                </Text>
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
                                  ? tema.verde
                                  : tema.azul,
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
                          <Icon
                            name="check-circle"
                            size={21}
                            color={tema.verde}
                          />
                        ) : null}
                      </View>
                      {r.lancamento_id ? (
                        <Toque
                          accessibilityRole="button"
                          accessibilityLabel={
                            r.status_lancamento === "ASSINADO"
                              ? "Visualizar assinatura"
                              : "Complementar lançamento"
                          }
                          style={s.action}
                          onPress={() => open(r)}
                        >
                          <Icon
                            name={
                              r.status_lancamento === "ASSINADO"
                                ? "eye"
                                : "edit-3"
                            }
                            size={17}
                            color={tema.azul}
                          />
                          <Text style={s.link}>
                            {r.status_lancamento === "ASSINADO"
                              ? "Visualizar assinatura"
                              : "Complementar lançamento"}
                          </Text>
                          <Icon name="chevron-right" color={tema.suave} />
                        </Toque>
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
                  <Toque
                    disabled={!!busy}
                    style={s.primary}
                    onPress={() => void sync()}
                  >
                    <Icon name="refresh-cw" size={18} color={tema.fundo} />
                    <Text style={s.primaryText}>
                      {busy === "sync"
                        ? "Sincronizando…"
                        : "Sincronizar rascunhos existentes"}
                    </Text>
                  </Toque>
                </>
              ) : selected ? (
                <>
                  <View style={s.card}>
                    <View style={s.between}>
                      <Text style={s.heading}>
                        {selected.origem} → {selected.destino}
                      </Text>
                      <Text
                        style={[
                          s.badge,
                          { color: readonly ? tema.verde : tema.azul },
                        ]}
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
                      <Toque
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
                            color:
                              draft.natureza_voo === n
                                ? tema.fundo
                                : tema.suave,
                            fontSize: 11,
                            fontWeight: "700",
                          }}
                        >
                          {n}
                        </Text>
                      </Toque>
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
                              placeholderTextColor={tema.suave}
                              multiline={c.multiline}
                            />
                          </View>
                        ))}
                      </View>
                    </View>
                  ))}
                  {selected.status_lancamento === "ASSINADO" ? (
                    <View style={s.signed}>
                      <Icon name="check-circle" size={23} color={tema.verde} />
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
                      <Toque
                        disabled={!!busy || readonly || !changed.length}
                        onPress={() => void save()}
                        style={[
                          s.primary,
                          (!changed.length || readonly) && { opacity: 0.48 },
                        ]}
                      >
                        <Icon name="save" size={18} color={tema.fundo} />
                        <Text style={s.primaryText}>
                          {busy === "save"
                            ? "Salvando…"
                            : "Salvar complementos"}
                        </Text>
                      </Toque>
                      {response?.pode_assinar ? (
                        <Toque
                          disabled={!!busy || readonly}
                          onPress={sign}
                          style={s.sign}
                        >
                          <Icon
                            name="check-circle"
                            size={19}
                            color={tema.verde}
                          />
                          <Text style={s.signText}>
                            {busy === "sign"
                              ? "Assinando…"
                              : "Conferir e assinar como CMTE"}
                          </Text>
                        </Toque>
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
    </SafeAreaView>
  );
}
function DiarioMensal({
  aeronaveId,
  matricula,
}: {
  aeronaveId: string;
  matricula?: string;
}) {
  const router = useRouter();
  const agora = new Date();
  const [periodo, setPeriodo] = useState(
    () => new Date(agora.getUTCFullYear(), agora.getUTCMonth(), 1),
  );
  const ano = periodo.getFullYear(),
    mes = periodo.getMonth() + 1;
  const competencia = `${ano}-${String(mes).padStart(2, "0")}`;
  const consulta = useQuery({
    queryKey: ["diario-mensal", aeronaveId, competencia],
    queryFn: ({ signal }) =>
      apiFetch<DiarioMensalResposta>(
        `${API_DIARIO}/detalhes?aeronave_id=${encodeURIComponent(aeronaveId)}&ano=${ano}&mes=${mes}`,
        { signal },
      ),
  });
  const { refetch } = consulta;
  useFocusEffect(
    useCallback(() => {
      void refetch();
    }, [refetch]),
  );
  const dados = consulta.data;
  const diario = dados?.diario_mes;
  const anterior = dados?.meses_disponiveis.find(
    (d) => d.ano < ano || (d.ano === ano && d.mes < mes),
  );
  const referencia = diario ?? anterior;
  const fechado = Boolean(Number(diario?.fechado));
  return (
    <Tela>
      <Cabecalho
        titulo={dados?.aeronave.matricula_registro || matricula || "Aeronave"}
        apoio="Diário de bordo"
        voltar={() => router.back()}
      />
      <ScrollView
        contentContainerStyle={{ padding: 17, paddingBottom: 120 }}
        refreshControl={
          <RefreshControl
            refreshing={consulta.isRefetching}
            onRefresh={() => void refetch()}
          />
        }
      >
        <View style={s.periodoRow}>
          <Toque
            style={s.periodoBotao}
            accessibilityLabel="Mês anterior"
            accessibilityRole="button"
            onPress={() => setPeriodo(new Date(ano, mes - 2, 1))}
          >
            <Icon name="chevron-left" />
          </Toque>
          <Text style={s.periodoTexto}>
            {periodo.toLocaleDateString("pt-BR", {
              month: "long",
              year: "numeric",
            })}
          </Text>
          <Toque
            style={s.periodoBotao}
            accessibilityLabel="Próximo mês"
            accessibilityRole="button"
            disabled={competencia >= agora.toISOString().slice(0, 7)}
            onPress={() => setPeriodo(new Date(ano, mes, 1))}
          >
            <Icon name="chevron-right" />
          </Toque>
        </View>
        {consulta.isError ? (
          <ErroConsulta
            mensagem={consulta.error.message}
            atualizar={() => void refetch()}
          />
        ) : !dados ? (
          <ActivityIndicator color={tema.azul} />
        ) : (
          <>
            {!diario && anterior && (
              <Text style={s.note}>
                Última leitura registrada em{" "}
                {String(anterior.mes).padStart(2, "0")}/{anterior.ano}
              </Text>
            )}
            <View style={s.historyMetrics}>
              {(
                [
                  ["atual", "CÉLULA ATUAL"],
                  ["prox_revisao", "PRÓXIMA REVISÃO"],
                  ["anterior", "CÉLULA ANTERIOR"],
                  ["disponivel", "DISPONÍVEL"],
                ] as const
              ).map(([campo, label]) => (
                <View key={campo} style={s.historyMetric}>
                  <Text style={s.historyMetricLabel}>{label}</Text>
                  <Text style={s.historyMetricValue}>
                    {horasDecimais(leitura(referencia, campo))}
                  </Text>
                </View>
              ))}
            </View>
            {fechado ? (
              <Text style={s.note}>Diário do mês fechado.</Text>
            ) : (
              <Botao
                texto="Lançar horas de voo"
                icone="plus"
                onPress={() =>
                  router.push({
                    pathname: "/novo-lancamento",
                    params: {
                      aeronaveId,
                      competencia,
                      matricula: dados.aeronave.matricula_registro,
                      diarioMesId: diario?.id || "",
                      modoAnterior: anterior
                        ? anterior.modo_celula || "tempo_total"
                        : "",
                    },
                  })
                }
              />
            )}
            <Text style={s.section}>LANÇAMENTOS DO MÊS</Text>
            {!dados.lancamentos.length && (
              <Text style={s.note}>Nenhum lançamento neste mês.</Text>
            )}
            {dados.lancamentos.map((l) => (
              <View key={l.id} style={s.card}>
                <Text style={s.kicker}>
                  {date(l.data_registro)} · Nº {l.numero_sequencial}
                </Text>
                <Text style={s.heading}>
                  {l.aerodromo_partida_icao} → {l.aerodromo_chegada_icao}
                </Text>
                <Text style={s.note}>
                  {[
                    l.numero_voo,
                    l.natureza_voo,
                    l.assinado_pic || l.confirmado ? "Assinado" : "Rascunho",
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </Text>
                <Text style={s.note}>
                  {[
                    l.pic_nome_exibicao || l.pic_canac,
                    l.sic_nome_exibicao || l.sic_canac,
                  ]
                    .filter(Boolean)
                    .join(" / ")}
                </Text>
                <Text style={s.note}>
                  AC {hhmm(l.tempo_ac)} · DEP {hhmm(l.tempo_dep)} · POU{" "}
                  {hhmm(l.tempo_pou)} · COR {hhmm(l.tempo_cor)} (UTC)
                </Text>
                <Text style={s.hour}>
                  Voo {horasDecimais(l.tempo_voo)} · Total{" "}
                  {horasDecimais(l.tempo_total)}
                </Text>
              </View>
            ))}
          </>
        )}
      </ScrollView>
    </Tela>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: tema.fundo },
  header: {
    paddingHorizontal: 17,
    paddingVertical: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  icon: {
    backgroundColor: tema.superficie,
    width: 43,
    height: 43,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
  },
  kicker: {
    color: tema.azul,
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 1.6,
  },
  title: { color: "#fff", fontSize: 24, fontWeight: "800", marginTop: 5 },
  periodoRow: {
    height: 52,
    borderRadius: 16,
    backgroundColor: tema.superficie,
    borderWidth: 1,
    borderColor: tema.borda,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
    paddingHorizontal: 8,
  },
  periodoBotao: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  periodoTexto: {
    color: tema.texto,
    fontFamily: "Inter_700Bold",
    fontSize: 14,
    textTransform: "capitalize",
  },
  historyMetrics: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 12,
  },
  historyMetric: {
    flexBasis: "48%",
    flexGrow: 1,
    borderRadius: 12,
    backgroundColor: tema.superficie,
    borderWidth: 1,
    borderColor: tema.borda,
    paddingHorizontal: 10,
    paddingVertical: 9,
  },
  historyMetricLabel: {
    color: tema.suave,
    fontSize: 8,
    fontFamily: "Inter_600SemiBold",
  },
  historyMetricValue: {
    color: tema.texto,
    fontSize: 13,
    fontFamily: "Inter_700Bold",
    marginTop: 4,
  },
  summary: {
    backgroundColor: tema.superficie,
    padding: 18,
    borderRadius: 20,
    marginBottom: 15,
  },
  big: { fontSize: 22, color: "#fff", fontWeight: "800", marginTop: 8 },
  route: { fontSize: 19, color: "#fff", fontWeight: "700", marginTop: 7 },
  note: { fontSize: 12, color: tema.suave, lineHeight: 19, marginTop: 7 },
  section: {
    fontSize: 11,
    color: tema.suave,
    fontWeight: "800",
    letterSpacing: 1.4,
    marginTop: 19,
    marginBottom: 11,
  },
  searchInput: {
    height: 50,
    borderRadius: 14,
    backgroundColor: "#111D35",
    borderWidth: 1,
    borderColor: tema.borda,
    color: "#fff",
    paddingHorizontal: 16,
    marginTop: 14,
    marginBottom: 12,
  },
  fleetHeader: {
    borderRadius: 22,
    backgroundColor: "#122744",
    borderWidth: 1,
    borderColor: tema.borda,
    padding: 18,
    marginBottom: 14,
  },
  fleetCount: {
    color: "#C8D3E5",
    fontSize: 12,
    marginTop: 8,
  },
  aircraftGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  aircraftCard: {
    flexBasis: "48%",
    flexGrow: 1,
    maxWidth: "48.5%",
    height: 158,
    borderRadius: 16,
    overflow: "hidden",
    backgroundColor: tema.superficie,
    marginBottom: 14,
  },
  aircraftImage: {
    position: "absolute",
    width: "100%",
    height: "100%",
  },
  aircraftShade: {
    position: "absolute",
    width: "100%",
    height: "100%",
    backgroundColor: "rgba(5, 12, 24, 0.42)",
  },
  aircraftContent: {
    flex: 1,
    justifyContent: "space-between",
    padding: 11,
  },
  aircraftTopRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
  },
  aircraftStatus: {
    minHeight: 24,
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 9,
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  aircraftStatusActive: {
    backgroundColor: "rgba(111,207,151,0.12)",
    borderColor: "rgba(111,207,151,0.35)",
  },
  aircraftStatusWarning: {
    backgroundColor: "rgba(240,197,131,0.12)",
    borderColor: "rgba(240,197,131,0.35)",
  },
  aircraftStatusText: {
    fontSize: 8,
    fontFamily: "Inter_600SemiBold",
  },
  aircraftRegistration: {
    color: "#fff",
    fontSize: 15,
    fontFamily: "Inter_700Bold",
  },
  aircraftModel: {
    color: "#dfe5f2",
    fontSize: 9,
    fontFamily: "Inter_500Medium",
    marginTop: 3,
  },
  aircraftMetrics: {
    flexDirection: "row",
    gap: 6,
  },
  aircraftMetric: {
    flex: 1,
    borderRadius: 8,
    backgroundColor: "rgba(8,23,43,0.82)",
    paddingHorizontal: 6,
    paddingVertical: 7,
  },
  aircraftMetricLabel: {
    color: "#b8c2d8",
    fontSize: 7,
    fontFamily: "Inter_600SemiBold",
  },
  aircraftMetricValue: {
    color: "#fff",
    fontSize: 10,
    fontFamily: "Inter_700Bold",
    marginTop: 4,
  },
  card: {
    padding: 16,
    borderRadius: 18,
    backgroundColor: tema.superficie,
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
    borderTopColor: tema.borda,
    marginTop: 12,
    paddingTop: 12,
  },
  link: { color: tema.azul, fontSize: 13, fontWeight: "800", flex: 1 },
  primary: {
    minHeight: 55,
    borderRadius: 14,
    backgroundColor: tema.azul,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 10,
    marginTop: 14,
    marginBottom: 12,
  },
  primaryText: { fontSize: 14, color: tema.fundo, fontWeight: "800" },
  sign: {
    minHeight: 55,
    borderColor: tema.verde,
    borderWidth: 1,
    borderRadius: 14,
    backgroundColor: "#143d37",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    marginTop: 6,
  },
  signText: { color: tema.verde, fontSize: 14, fontWeight: "800" },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 7 },
  chip: {
    backgroundColor: "#1d344c",
    borderColor: tema.borda,
    borderWidth: 1,
    borderRadius: 9,
    paddingHorizontal: 10,
    paddingVertical: 9,
  },
  chipActive: { backgroundColor: tema.azul, borderColor: tema.azul },
  fieldLabel: {
    color: tema.suave,
    fontSize: 12,
    fontWeight: "700",
    marginBottom: 6,
  },
  input: {
    color: "#fff",
    backgroundColor: tema.fundo,
    borderColor: tema.borda,
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
    borderColor: tema.verde,
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