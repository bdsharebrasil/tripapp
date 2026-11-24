import { avisar, confirmar } from "@/src/lib/confirmar";
import { Cabecalho, tema, Icon, Toque } from "@/src/components/ui";
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
type AircraftSummary = {
  id: string;
  registration?: string;
  matricula?: string;
  matricula_registro?: string;
  model?: string;
  modelo?: string;
  fabricante?: string;
  image_url?: string | null;
  imagem_url?: string | null;
  celula_atual_ttotal?: number | null;
  celula_prox_revisao_ttotal?: number | null;
  celula_disponivel_ttotal?: number | null;
  celula_anterior_ttotal?: number | null;
  horas_ano?: number | null;
  voo_id?: string;
};
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
const horasDecimais = (valor?: number | null | string) => {
  if (valor === null || valor === undefined || valor === "" || Number.isNaN(Number(valor))) return "—";
  const total = Math.round(Math.abs(Number(valor)) * 60);
  return `${Math.floor(total / 60)}h ${String(total % 60).padStart(2, "0")}m`;
};

export default function DiarioBordoMobile() {
  const { vooId, aeronaveId, matricula, imageUrl } = useLocalSearchParams<{
    vooId?: string;
    aeronaveId?: string;
    matricula?: string;
    imageUrl?: string;
  }>();
  const router = useRouter(),
    insets = useSafeAreaInsets();
  const [voos, setVoos] = useState<AircraftSummary[]>([]);
  const agora = new Date();
  const [anoDiario, setAnoDiario] = useState(agora.getFullYear());
  const [mesDiario, setMesDiario] = useState(agora.getMonth() + 1);
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
        if (!vooId && !aeronaveId) {
          const aeronavesResult = await apiFetch<{ aeronaves: Record<string, any>[] }>(
            "/api/sharebrasil/aeronaves",
          ).catch(() => ({ aeronaves: [] as Record<string, any>[] }));
          let aeronaves = aeronavesResult.aeronaves || [];

          if (!aeronaves.length) {
            const manutencao = await apiFetch<{
              aeronaves: Array<{
                id: string;
                registration?: string;
                model?: string;
                image_url?: string | null;
              }>;
            }>("/api/ctm/relatorios-manutencao").catch(() => ({ aeronaves: [] }));
            aeronaves = manutencao.aeronaves.map((item) => ({
              id: item.id,
              registration: item.registration,
              matricula_registro: item.registration,
              model: item.model,
              modelo: item.model,
              image_url: item.image_url,
            }));
          }

          let manutencaoCompleta: Array<Record<string, any>> = [];
          if (aeronaves.length) {
            const manutencao = await apiFetch<{
              aeronaves: Array<Record<string, any>>;
            }>("/api/ctm/relatorios-manutencao").catch(() => ({ aeronaves: [] }));
            manutencaoCompleta = manutencao.aeronaves || [];
          }

          const voosResult = await apiFetch<{ voos: Array<Record<string, any>> }>(
            "/api/colaborador/meus-voos",
          ).catch(() => ({ voos: [] as Array<Record<string, any>> }));

          const lista = aeronaves.map((row) => {
            const matricula = String(
              row.matricula_registro || row.registration || row.matricula || "",
            ).trim();
            const manutencaoCorrespondente = manutencaoCompleta.find((item) => {
              if (row.id && item.id === row.id) return true;
              return Boolean(matricula) &&
                String(item.registration || item.matricula || item.matricula_registro || "") === matricula;
            });
            const vooCorrespondente = voosResult.voos.find((voo) => {
              if (row.id && voo.aeronave_id === row.id) return true;
              return Boolean(matricula) && String(voo.matricula_registro || "") === matricula;
            });
            return {
              ...row,
              id: row.id,
              registration: matricula,
              matricula_registro: matricula,
              model: row.modelo || row.model || "",
              modelo: row.modelo || row.model || "",
              fabricante: row.fabricante || row.manufacturer || "",
              image_url:
                row.image_url ||
                row.imagem_url ||
                row.foto_url ||
                manutencaoCorrespondente?.image_url ||
                null,
              celula_atual_ttotal:
                row.celula_atual_ttotal ??
                row.celula_atual ??
                row.celula_total_atual ??
                row.ttotal_atual,
              celula_prox_revisao_ttotal:
                row.celula_prox_revisao_ttotal ??
                row.celula_proxima_revisao_ttotal ??
                row.proxima_revisao_ttotal ??
                row.revisao_ttotal,
              celula_disponivel_ttotal:
                row.celula_disponivel_ttotal ??
                row.celula_disponivel ??
                row.disponivel_ttotal,
              celula_anterior_ttotal:
                row.celula_anterior_ttotal ?? row.celula_anterior,
              horas_ano: row.horas_ano ?? row.horas_voadas_ano,
              voo_id: vooCorrespondente?.id,
            } as AircraftSummary;
          });

          setVoos(
            lista.sort((a, b) =>
              String(a.registration || a.matricula_registro || "").localeCompare(
                String(b.registration || b.matricula_registro || ""),
              ),
            ),
          );
          return;
        }

        if (aeronaveId && !vooId) {
          const paths = [
            `/api/colaborador/diario-bordo/aeronaves/${encodeURIComponent(aeronaveId)}?ano=${anoDiario}&mes=${mesDiario}`,
            `/api/colaborador/diario-bordo/aeronaves/${encodeURIComponent(aeronaveId)}/detalhes?ano=${anoDiario}&mes=${mesDiario}`,
          ];
          let data: any = null;
          for (const path of paths) {
            try {
              data = await apiFetch<any>(path);
              break;
            } catch {
              // Tenta o formato alternativo publicado pelo Worker.
            }
          }
          if (data) {
            setResponse({
              pode_assinar: Boolean(data.pode_assinar),
              lancamentos: Array.isArray(data.lancamentos)
                ? data.lancamentos
                : Array.isArray(data.entries)
                  ? data.entries
                  : [],
            });
            const diario = data.diario_mes || data.diario || {};
            const aeronaveDetalhe = data.aeronave || {};
            setDetail({
              voo: {
                id: aeronaveId,
                matricula_registro:
                  matricula || aeronaveDetalhe.matricula_registro || aeronaveDetalhe.registration,
                modelo: aeronaveDetalhe.modelo || aeronaveDetalhe.model,
                fabricante: aeronaveDetalhe.fabricante || aeronaveDetalhe.manufacturer,
                imagem_url:
                  imageUrl || aeronaveDetalhe.image_url || aeronaveDetalhe.imagem_url,
                cliente_razao_social: diario.aerodromo_base,
                celula_atual_ttotal:
                  diario.celula_atual_ttotal ??
                  diario.celula_atual ??
                  aeronaveDetalhe.celula_atual_ttotal,
                celula_prox_revisao_ttotal:
                  diario.celula_prox_revisao_ttotal ??
                  diario.celula_proxima_revisao_ttotal ??
                  aeronaveDetalhe.celula_prox_revisao_ttotal,
                celula_disponivel_ttotal:
                  diario.celula_disponivel_ttotal ??
                  diario.celula_disponivel ??
                  aeronaveDetalhe.celula_disponivel_ttotal,
                celula_anterior_ttotal:
                  diario.celula_anterior_ttotal ??
                  diario.celula_anterior,
              },
            });
            return;
          }
        }

        if (!vooId) {
          setError("Nenhum voo foi informado para abrir o Diário.");
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
    [vooId, aeronaveId, matricula, imageUrl, anoDiario, mesDiario],
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
      {vooId || aeronaveId ? (
        <Cabecalho
          titulo={active ? "Complementar lançamento" : aeronaveId ? "Histórico da aeronave" : "Diário do voo"}
          apoio="Diário de bordo"
          voltar={() => {
            if (active) {
              close();
              return;
            }
            if (aeronaveId) {
              router.replace("/diario-bordo");
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
          {!vooId && !aeronaveId ? (
            <>
              <View style={s.fleetHeader}>
                <Text style={s.kicker}>OPERAÇÃO · {new Date().getFullYear()}</Text>
                <Text style={s.title}>Escolha uma aeronave</Text>
                <Text style={s.fleetCount}>
                  {voos.length} {voos.length === 1 ? "aeronave ativa" : "aeronaves ativas"}
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
                  [
                    v.registration,
                    v.matricula,
                    v.matricula_registro,
                    v.fabricante,
                    v.model,
                    v.modelo,
                  ]
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
                    accessibilityLabel={`Abrir diário da aeronave ${v.registration || v.matricula_registro || v.matricula || v.id}`}
                    onPress={() => {
                      router.push({
                        pathname: "/diario-bordo",
                        params: {
                          aeronaveId: v.id,
                          matricula:
                            v.registration ||
                            v.matricula_registro ||
                            v.matricula ||
                            "",
                          imageUrl: v.image_url || v.imagem_url || "",
                        },
                      });
                    }}
                  >
                    <Image
                      source={
                        v.image_url || v.imagem_url
                          ? { uri: String(v.image_url || v.imagem_url) }
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
                            {v.registration || v.matricula_registro || v.matricula || "Aeronave"}
                          </Text>
                          <Text style={s.aircraftModel} numberOfLines={1}>
                            {[v.fabricante, v.model || v.modelo].filter(Boolean).join(" ") ||
                              "Aeronave"}
                          </Text>
                        </View>
                        {v.celula_disponivel_ttotal !== undefined &&
                          v.celula_disponivel_ttotal !== null && (
                            <View
                              style={[
                                s.aircraftStatus,
                                Number(v.celula_disponivel_ttotal) < 0
                                  ? s.aircraftStatusWarning
                                  : s.aircraftStatusActive,
                              ]}
                            >
                              <Icon
                                name={
                                  Number(v.celula_disponivel_ttotal) < 0
                                    ? "tool"
                                    : "check-circle"
                                }
                                size={13}
                                color={
                                  Number(v.celula_disponivel_ttotal) < 0
                                    ? "#F0C583"
                                    : tema.verde
                                }
                              />
                              <Text
                                style={[
                                  s.aircraftStatusText,
                                  {
                                    color:
                                      Number(v.celula_disponivel_ttotal) < 0
                                        ? "#F0C583"
                                        : tema.verde,
                                  },
                                ]}
                              >
                                {Number(v.celula_disponivel_ttotal) < 0
                                  ? "Revisão vencida"
                                  : "Ativa"}
                              </Text>
                            </View>
                          )}
                      </View>
                      <View style={s.aircraftMetrics}>
                        <View style={s.aircraftMetric}>
                          <Text style={s.aircraftMetricLabel}>CÉLULA ATUAL</Text>
                          <Text style={s.aircraftMetricValue}>
                            {horasDecimais(v.celula_atual_ttotal)}
                          </Text>
                        </View>
                        <View style={s.aircraftMetric}>
                          <Text style={s.aircraftMetricLabel}>PRÓXIMA REVISÃO</Text>
                          <Text style={s.aircraftMetricValue}>
                            {horasDecimais(v.celula_prox_revisao_ttotal)}
                          </Text>
                        </View>
                      </View>
                    </View>
                  </Toque>
                ))}
              </View>
              {!voos.length && !error && (
                <Text style={s.note}>Nenhum voo disponível no seu diário.</Text>
              )}
            </>
          ) : (
            <>
              {aeronaveId && (
                <View style={s.periodoRow}>
                  <Toque
                    accessibilityRole="button"
                    accessibilityLabel="Mês anterior"
                    onPress={() => {
                      const anterior = new Date(anoDiario, mesDiario - 2, 1);
                      setAnoDiario(anterior.getFullYear());
                      setMesDiario(anterior.getMonth() + 1);
                    }}
                    style={s.periodoBotao}
                  >
                    <Icon name="chevron-left" size={20} color={tema.texto} />
                  </Toque>
                  <Text style={s.periodoTexto}>
                    {new Intl.DateTimeFormat("pt-BR", {
                      month: "long",
                      year: "numeric",
                    }).format(new Date(anoDiario, mesDiario - 1, 1))}
                  </Text>
                  <Toque
                    accessibilityRole="button"
                    accessibilityLabel="Próximo mês"
                    onPress={() => {
                      const proximo = new Date(anoDiario, mesDiario, 1);
                      if (
                        proximo.getFullYear() > new Date().getFullYear() ||
                        (proximo.getFullYear() === new Date().getFullYear() &&
                          proximo.getMonth() > new Date().getMonth())
                      ) return;
                      setAnoDiario(proximo.getFullYear());
                      setMesDiario(proximo.getMonth() + 1);
                    }}
                    style={s.periodoBotao}
                  >
                    <Icon name="chevron-right" size={20} color={tema.texto} />
                  </Toque>
                </View>
              )}
              {aeronaveId && (
                <View style={s.historyMetrics}>
                  <View style={s.historyMetric}>
                    <Text style={s.historyMetricLabel}>CÉLULA ANTERIOR</Text>
                    <Text style={s.historyMetricValue}>
                      {horasDecimais(detail?.voo.celula_anterior_ttotal)}
                    </Text>
                  </View>
                  <View style={s.historyMetric}>
                    <Text style={s.historyMetricLabel}>CÉLULA ATUAL</Text>
                    <Text style={s.historyMetricValue}>
                      {horasDecimais(detail?.voo.celula_atual_ttotal)}
                    </Text>
                  </View>
                  <View style={s.historyMetric}>
                    <Text style={s.historyMetricLabel}>PRÓXIMA REVISÃO</Text>
                    <Text style={s.historyMetricValue}>
                      {horasDecimais(detail?.voo.celula_prox_revisao_ttotal)}
                    </Text>
                  </View>
                  <View style={s.historyMetric}>
                    <Text style={s.historyMetricLabel}>DISPONÍVEL</Text>
                    <Text style={s.historyMetricValue}>
                      {horasDecimais(detail?.voo.celula_disponivel_ttotal)}
                    </Text>
                  </View>
                </View>
              )}
              <View style={s.summary}>
                {aeronaveId && imageUrl ? (
                  <Image
                    source={{ uri: String(imageUrl) }}
                    style={s.detailImage}
                    resizeMode="cover"
                  />
                ) : null}
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
  detailImage: {
    width: "100%",
    height: 120,
    borderRadius: 14,
    marginBottom: 12,
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
