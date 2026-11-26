import { valorDespesa, payloadDespesas } from "@/src/lib/despesas";
import { randomUUID } from "expo-crypto";
import { useLocalSearchParams, useFocusEffect } from "expo-router";
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
  ActivityIndicator,
  Modal,
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
import { ApiError, apiFetch } from "@/src/lib/api";
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

type Obj = Record<string, any>;
type Attachment = {
  id: string;
  indice_despesa?: number;
  nome_arquivo?: string;
  tipo_arquivo?: string;
  url_arquivo?: string;
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
const money = (v: unknown) =>
  Number(v || 0).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
const date = (value?: string) =>
  value ? value.slice(0, 10).split("-").reverse().join("/") : "—";
const localISO = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
const arr = (x: unknown): Obj[] => (Array.isArray(x) ? x : []);
const reportId = (r: Obj) => String(r.id || r.relatorio_id || "");
const flightNo = (r: Obj) =>
  String(r.numero_voo || r.voo?.numero_voo || r.voo_numero || "");
const reportStatus = (r: Obj) =>
  String(r.status || "indisponível").toLowerCase();
const statusText = (s: string) =>
  ({
    rascunho: "Rascunho",
    finalizado: "Finalizado",
    aguardando_aprovacao: "Em aprovação",
    aprovado: "Aprovado",
    ajuste_necessario: "Ajustes necessários",
    ajuste_concluido: "Ajustes enviados",
    cancelado: "Cancelado",
  })[s] || s.replace(/_/g, " ");
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
const label = (s: string) => <Text style={styles.label}>{s}</Text>;

export default function RelatorioViagemScreen() {
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ relatorioId?: string }>();
  const dirtyRef = useRef(false);
  const scrollRef = useRef<React.ComponentRef<typeof ScrollView>>(null);
  const [flights, setFlights] = useState<Obj[]>([]);
  const [reports, setReports] = useState<Obj[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(
    params.relatorioId || null,
  );
  const [section, setSection] = useState<"lancamentos" | "historico">(
    "lancamentos",
  );
  const [reportFilter, setReportFilter] = useState<"todos" | "rascunho" | "aprovacao" | "aprovado">("todos");
  const [items, setItems] = useState<Expense[]>([]);
  const [dirty, setDirty] = useState(false);
  const [expandedItem, setExpandedItem] = useState<string | null>(null);
  const [expenseSheetId, setExpenseSheetId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");

  const selected = reports.find((r) => reportId(r) === selectedId);
  const sheetItem = items.find((item) => item.id === expenseSheetId);
  const sheetIndex = items.findIndex((item) => item.id === expenseSheetId);
  const editable = isEditable(selected);
  const total = useMemo(
    () => items.reduce((v, x) => v + Number(x.valor || 0), 0),
    [items],
  );
  const reportStats = useMemo(() => {
    const rascunhos = reports.filter(isEditable).length;
    const aprovacao = reports.filter((r) => ["aguardando_aprovacao", "ajuste_concluido"].includes(reportStatus(r))).length;
    const aprovados = reports.filter((r) => reportStatus(r) === "aprovado").length;
    const totalGeral = reports.reduce((sum, r) => sum + Number(r.total_valor ?? arr(r.despesas).reduce((v, x) => v + Number(x.valor || 0), 0)), 0);
    return { rascunhos, aprovacao, aprovados, totalGeral };
  }, [reports]);
  const filteredReports = useMemo(() => {
    if (reportFilter === "rascunho") return reports.filter(isEditable);
    if (reportFilter === "aprovacao") return reports.filter((r) => ["aguardando_aprovacao", "ajuste_concluido"].includes(reportStatus(r)));
    if (reportFilter === "aprovado") return reports.filter((r) => reportStatus(r) === "aprovado");
    return reports;
  }, [reports, reportFilter]);
  const ownPayer =
    Number(selected?.tripulante_pos) === 2 ? "tripulante_2" : "tripulante_1";
  const hasSecondCrew = Boolean(selected?.tripulante_id_2);

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
      const [f, r] = await Promise.all([
        apiFetch<{ voos: Obj[] }>(`${BASE}/meus-voos`),
        apiFetch<{ relatorios: Obj[] }>(`${BASE}/minhas`),
      ]);
      setFlights(arr(f.voos));
      setReports(arr(r.relatorios));
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
    setDirty(false);
    dirtyRef.current = false;
    scrollRef.current?.scrollTo({ y: 0, animated: false });
  }, [selectedId, reports]);
  useEffect(() => {
    dirtyRef.current = dirty;
  }, [dirty]);

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
      // A resposta de criação já é o registro real; abrir independe de uma segunda consulta.
      setReports((prev) => [
        ...prev.filter((r) => reportId(r) !== String(result.relatorio!.id)),
        result.relatorio!,
      ]);
      setSelectedId(String(result.relatorio.id));
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
    setDirty(true);
  };
  const add = () => {
    if (!selected || !editable) return;
    const id = randomUUID();
    setExpandedItem(null);
    setExpenseSheetId(id);
    setItems((prev) => [
      ...prev,
      {
        id,
        categoria: "Alimentação",
        data: localISO(),
        valor: 0,
        pago_por: ownPayer,
        descricao: "",
        anexos: [],
      },
    ]);
    setDirty(true);
  };
  const save = async () => {
    if (!selected || !editable || busy) return;
    for (const [index, item] of items.entries()) {
      if (
        !CATEGORIES.includes(item.categoria) ||
        !/^\d{4}-\d{2}-\d{2}$/.test(item.data) ||
        !Number.isFinite(item.valor) ||
        item.valor <= 0 ||
        !item.descricao.trim() ||
        item.descricao.length > 500 ||
        !PAYERS.some(([id]) => id === item.pago_por) ||
        (item.pago_por === "tripulante_2" && !hasSecondCrew)
      ) {
        return avisar(
          "Verifique a despesa",
          `Confira a despesa ${index + 1}: categoria, data, valor positivo, pagador e descrição (até 500 caracteres).`,
        );
      }
    }
    setBusy("save");
    try {
      await apiFetch(
        `${BASE}/${encodeURIComponent(reportId(selected))}/despesas-tripulante`,
        {
          method: "PUT",
          body: JSON.stringify(payloadDespesas(items)),
        },
      );
      dirtyRef.current = false;
      setDirty(false);
      await load(true);
      avisar("Despesas salvas", "Seus lançamentos foram registrados.");
    } catch (e) {
      avisar(
        "Erro ao salvar",
        e instanceof Error
          ? e.message
          : "Não foi possível registrar as despesas.",
      );
    } finally {
      setBusy("");
    }
  };
  const upload = async (
    index: number,
    source: "camera" | "foto" | "arquivo",
  ) => {
    if (!selected || !editable || busy) return;
    if (dirty)
      return avisar(
        "Salve antes",
        "Salve as despesas primeiro para vincular o comprovante ao lançamento correto.",
      );
    let asset: {
      uri: string;
      name: string;
      mime: string;
      size?: number;
    } | null = null;
    try {
      if (source === "arquivo") {
        const result = await DocumentPicker.getDocumentAsync({
          type: ["application/pdf", "image/*"],
          copyToCacheDirectory: true,
        });
        if (result.canceled || !result.assets?.[0]) return;
        const a = result.assets[0];
        asset = {
          uri: a.uri,
          name: a.name || `comprovante-${Date.now()}.pdf`,
          mime: a.mimeType || "application/pdf",
          size: a.size,
        };
      } else {
        const perm =
          source === "camera"
            ? await ImagePicker.requestCameraPermissionsAsync()
            : await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (!perm.granted)
          return avisar(
            "Permissão necessária",
            "Autorize o acesso à câmera ou às fotos.",
          );
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
        const a = result.assets[0];
        asset = {
          uri: a.uri,
          name: a.fileName || `comprovante-${Date.now()}.jpg`,
          mime: a.mimeType || "image/jpeg",
          size: a.fileSize,
        };
      }
      if (
        !asset ||
        !["application/pdf", "image/jpeg", "image/png", "image/webp"].includes(
          asset.mime,
        )
      ) {
        return avisar("Formato inválido", "Envie um PDF, JPG, PNG ou WEBP.");
      }
      if (asset.size && asset.size > 25 * 1024 * 1024)
        return avisar("Arquivo grande", "O limite por comprovante é de 25 MB.");
      setBusy("upload");
      const form = new FormData();
      await anexarArquivo(form, "arquivo", asset.uri, asset.name, asset.mime);
      form.append("indice_despesa", String(index));
      await apiFetch(
        `${BASE}/${encodeURIComponent(reportId(selected))}/anexos-tripulante`,
        { method: "POST", body: form },
      );
      await load(true);
    } catch (e) {
      avisar(
        "Falha no comprovante",
        e instanceof Error
          ? e.message
          : "Não foi possível enviar o comprovante.",
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
      await abrirArquivoPrivado(
        path,
        attachment.nome_arquivo || "Comprovante",
        mime,
      );
    } catch (e) {
      avisar(
        "Comprovante indisponível",
        e instanceof Error ? e.message : "Não foi possível abrir.",
      );
    } finally {
      setBusy("");
    }
  };
  const finalize = () => {
    if (!selected || !editable || busy) return;
    if (dirty)
      return avisar(
        "Salve as despesas",
        "Salve seus lançamentos antes de finalizar.",
      );
    if (!items.length)
      return avisar("Relatório vazio", "Adicione pelo menos uma despesa.");
    confirmar(
      "Finalizar relatório?",
      "Os lançamentos serão enviados para a próxima etapa e não poderão ser editados aqui.",
      async () => {
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
  const viewReportPdf = async () => {
    if (!selected || busy) return;
    setBusy("report-pdf");
    try {
      await abrirArquivoPrivado(
        `${BASE}/${encodeURIComponent(reportId(selected))}/pdf`,
        String(selected.numero_relatorio || "relatorio"),
        "application/pdf",
      );
    } catch (e) {
      avisar(
        "PDF indisponível",
        e instanceof Error ? e.message : "O PDF ainda não foi gerado.",
      );
    } finally {
      setBusy("");
    }
  };

  const showReport = (r: Obj) => (
    <Toque
      accessibilityRole="button"
      key={reportId(r)}
      onPress={() => open(reportId(r))}
      style={styles.reportCard}
    >
      <View style={styles.between}>
        <Text style={styles.flightNo}>Voo {flightNo(r)}</Text>
        <Text style={styles.tag}>{statusText(reportStatus(r))}</Text>
      </View>
      <Text style={styles.secondary}>
        {r.numero_relatorio || "Relatório de viagem"} ·{" "}
        {date(r.data_inicio || r.criado_em)}
      </Text>
      <View style={[styles.between, { marginTop: 12 }]}>
        <Text style={styles.amount}>
          {money(
            r.total_valor ??
              arr(r.despesas).reduce((sum, x) => sum + Number(x.valor || 0), 0),
          )}
        </Text>
        <Text style={styles.link}>
          {isEditable(r) ? "Continuar →" : "Ver relatório →"}
        </Text>
      </View>
      {r.pagamento_status && r.pagamento_status !== "NAO_PROGRAMADO" ? (
        <Text style={styles.muted}>
          Reembolso: {r.pagamento_status} · {money(r.pagamento_valor)}
        </Text>
      ) : null}
    </Toque>
  );

  return (
    <SafeAreaView edges={["top"]} style={[styles.root, { paddingTop: 10 }]}>
      <Cabecalho
        titulo={selected ? "Relatório por voo" : "Despesas de viagem"}
        apoio="PRESTAÇÃO DE CONTAS"
        voltar={selected ? back : undefined}
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
            padding: 17,
            paddingBottom: insets.bottom + 220,
          }}
        >
          {!selected ? (
            <>
              <View style={styles.tabs}>
                {(["lancamentos", "historico"] as const).map((t) => (
                  <Toque
                    key={t}
                    onPress={() => setSection(t)}
                    style={[styles.tab, section === t && styles.tabActive]}
                  >
                    <Text
                      style={[
                        styles.tabText,
                        section === t && { color: tema.fundo },
                      ]}
                    >
                      {t === "lancamentos"
                        ? "Lançar despesas"
                        : "Meus relatórios"}
                    </Text>
                  </Toque>
                ))}
              </View>
              <View style={styles.reportStats}>
                <View style={styles.reportStatItem}><Text style={styles.reportStatValue}>{reports.length}</Text><Text style={styles.reportStatLabel}>Relatórios</Text></View>
                <View style={styles.reportStatDivider} /><View style={styles.reportStatItem}><Text style={[styles.reportStatValue, { color: tema.destaque }]}>{reportStats.rascunhos}</Text><Text style={styles.reportStatLabel}>Rascunhos</Text></View>
                <View style={styles.reportStatDivider} /><View style={styles.reportStatItem}><Text style={[styles.reportStatValue, { color: "#7aa7ff" }]}>{reportStats.aprovacao}</Text><Text style={styles.reportStatLabel}>Em análise</Text></View>
                <View style={styles.reportStatDivider} /><View style={styles.reportStatItem}><Text style={[styles.reportStatValue, { color: tema.verde }]}>{reportStats.aprovados}</Text><Text style={styles.reportStatLabel}>Aprovados</Text></View>
              </View>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.reportFilters}>
                {([
                  ["todos", "Todos"], ["rascunho", "Rascunhos"], ["aprovacao", "Em análise"], ["aprovado", "Aprovados"],
                ] as const).map(([key, label]) => (
                  <Toque key={key} onPress={() => setReportFilter(key)} style={[styles.reportFilter, reportFilter === key && styles.reportFilterActive]}>
                    <Text style={[styles.reportFilterText, reportFilter === key && styles.reportFilterTextActive]}>{label}</Text>
                  </Toque>
                ))}
              </ScrollView>
              {section === "lancamentos" ? (
                <>
                  <Text style={styles.sectionTitle}>
                    RELATÓRIOS EM RASCUNHO
                  </Text>
                  {reports.filter(isEditable).length ? (
                    reports.filter(isEditable).map(showReport)
                  ) : (
                    <Vazio
                      icone="edit-3"
                      titulo="Nenhum rascunho aberto"
                      texto="Escolha um voo abaixo para começar."
                    />
                  )}
                  <Text style={styles.sectionTitle}>
                    CRIAR RELATÓRIO DE VIAGEM
                  </Text>
                  <Text style={[styles.muted, { marginBottom: 10 }]}>
                    Selecione o voo para iniciar os lançamentos de despesas.
                  </Text>
                  {flights.map((f) => {
                    const existing = reports.find(
                      (r) =>
                        (f.relatorio_id &&
                          reportId(r) === String(f.relatorio_id)) ||
                        (flightNo(r) === flightNo(f) &&
                          r.aeronave_id === f.aeronave_id &&
                          r.cliente_id === f.cliente_id &&
                          String(r.socio_id || "") ===
                            String(f.socio_id || "")),
                    );
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
                            · {date(f.data_agendada)}
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
                  {!flights.length && (
                    <Vazio
                      icone="send"
                      titulo="Nenhum voo disponível"
                      texto="Os voos atribuídos à sua tripulação aparecerão aqui."
                    />
                  )}
                </>
              ) : (
                <>
                  <Text style={styles.sectionTitle}>
                    MEUS RELATÓRIOS · {reports.length}
                  </Text>
                  {filteredReports.map(showReport)}
                  {!filteredReports.length && (
                    <Text style={styles.muted}>
                      Não há relatórios registrados.
                    </Text>
                  )}
                </>
              )}
            </>
          ) : (
            <>
              <View style={styles.summaryCard}>
                <Text style={styles.eyebrow}>
                  {selected.numero_relatorio || "RELATÓRIO DE VIAGEM"}
                </Text>
                <Text style={styles.bigRoute}>
                  {selected.rota || `Voo ${flightNo(selected)}`}
                </Text>
                <Text style={styles.secondary}>
                  Voo {flightNo(selected)} · {date(selected.data_inicio)} —{" "}
                  {date(selected.data_fim)}
                </Text>
                <View style={[styles.between, { marginTop: 18 }]}>
                  <Text style={styles.tag}>
                    {statusText(reportStatus(selected))}
                  </Text>
                  <Text style={styles.total}>{money(total)}</Text>
                </View>
                {selected.pagamento_status &&
                  selected.pagamento_status !== "NAO_PROGRAMADO" && (
                    <Text style={styles.secondary}>
                      Reembolso: {selected.pagamento_status} ·{" "}
                      {money(selected.pagamento_valor)} de{" "}
                      {money(selected.pagamento_total)}
                    </Text>
                  )}
                {!!(selected.pdf_path || selected.pdf_url) && (
                  <Toque
                    accessibilityRole="button"
                    onPress={() => void viewReportPdf()}
                    style={styles.outlinedButton}
                  >
                    <Icon name="file-text" size={17} color={tema.azul} />
                    <Text style={styles.link}>Abrir PDF do relatório</Text>
                  </Toque>
                )}
              </View>
              <View style={styles.between}>
                <Text style={styles.sectionTitle}>
                  DESPESAS LANÇADAS · {items.length}
                </Text>
              </View>
              {editable && (
                <Toque
                  accessibilityRole="button"
                  onPress={add}
                  disabled={!!busy}
                  style={styles.primary}
                >
                  <Icon name="plus-circle" size={21} color={tema.fundo} />
                  <Text style={styles.primaryText}>Criar nova despesa</Text>
                </Toque>
              )}
              {!items.length && (
                <View style={styles.empty}>
                  <Icon name="file-text" size={28} color={tema.azul} />
                  <Text style={styles.secondary}>
                    Nenhuma despesa registrada neste voo.
                  </Text>
                </View>
              )}
              {items.map((item, i) => (
                <View key={item.id} style={styles.itemCard}>
                  <Toque
                    accessibilityRole="button"
                    accessibilityLabel={`Despesa ${i + 1}: ${item.categoria}`}
                    accessibilityState={{ expanded: expandedItem === item.id }}
                    onPress={() => setExpenseSheetId(item.id)}
                    style={styles.expenseSummary}
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
                        size={21}
                        color={tema.azul}
                      />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.itemTitle}>{item.categoria}</Text>
                      <Text style={styles.muted} numberOfLines={1}>
                        {item.descricao || `Despesa ${i + 1} · Preencher dados`}
                      </Text>
                      <Text style={styles.muted}>
                        {date(item.data)} · {item.anexos.length} comprovante(s)
                      </Text>
                    </View>
                    <View style={{ alignItems: "flex-end", gap: 10 }}>
                      <Text style={styles.amount}>{money(item.valor)}</Text>
                      <Icon
                        name={
                          expandedItem === item.id
                            ? "chevron-up"
                            : "chevron-down"
                        }
                        size={18}
                        color={tema.azul}
                      />
                    </View>
                  </Toque>
                  {expandedItem === item.id && (
                    <>
                      <View style={[styles.between, { marginTop: 14 }]}>
                        <Text style={styles.eyebrow}>DESPESA {i + 1}</Text>
                        {editable && (
                          <Toque
                            accessibilityRole="button"
                            accessibilityLabel="Remover despesa"
                            onPress={() =>
                              confirmar(
                                "Remover despesa?",
                                "A remoção será aplicada ao salvar o relatório.",
                                () => {
                                  setItems((prev) =>
                                    prev.filter((_, idx) => idx !== i),
                                  );
                                  setDirty(true);
                                },
                                true,
                              )
                            }
                          >
                            <Icon
                              name="trash-2"
                              size={18}
                              color={tema.perigo}
                            />
                          </Toque>
                        )}
                      </View>
                      {label("Categoria")}
                      <ScrollView
                        horizontal
                        showsHorizontalScrollIndicator={false}
                        contentContainerStyle={styles.chips}
                      >
                        {CATEGORIES.map((cat) => (
                          <Toque
                            key={cat}
                            disabled={!editable}
                            onPress={() => update(i, { categoria: cat })}
                            style={[
                              styles.chip,
                              item.categoria === cat && styles.chipActive,
                            ]}
                          >
                            <Text
                              style={{
                                fontSize: 12,
                                color:
                                  item.categoria === cat
                                    ? tema.fundo
                                    : tema.suave,
                                fontWeight: "700",
                              }}
                            >
                              {cat}
                            </Text>
                          </Toque>
                        ))}
                      </ScrollView>
                      <View style={styles.two}>
                        <View style={{ flex: 1 }}>
                          {label("Data (AAAA-MM-DD)")}
                          <TextInput
                            editable={editable}
                            style={styles.input}
                            value={item.data}
                            onChangeText={(v) => update(i, { data: v })}
                          />
                        </View>
                        <View style={{ flex: 1 }}>
                          {label("Valor (R$)")}
                          <TextInput
                            editable={editable}
                            style={styles.input}
                            keyboardType="decimal-pad"
                            value={
                              item.valorTexto ??
                              (item.valor
                                ? String(item.valor).replace(".", ",")
                                : "")
                            }
                            onChangeText={(v) =>
                              update(i, {
                                valorTexto: v,
                                valor: valorDespesa(v),
                              })
                            }
                            placeholder="0,00"
                            placeholderTextColor={tema.suave}
                          />
                        </View>
                      </View>
                      {label("Pago por")}
                      <ScrollView
                        horizontal
                        showsHorizontalScrollIndicator={false}
                        contentContainerStyle={styles.chips}
                      >
                        {PAYERS.filter(
                          ([id]) => id !== "tripulante_2" || hasSecondCrew,
                        ).map(([id, name]) => (
                          <Toque
                            key={id}
                            disabled={!editable}
                            onPress={() => update(i, { pago_por: id })}
                            style={[
                              styles.chip,
                              item.pago_por === id && styles.chipActive,
                            ]}
                          >
                            <Text
                              style={{
                                fontSize: 12,
                                color:
                                  item.pago_por === id
                                    ? tema.fundo
                                    : tema.suave,
                                fontWeight: "700",
                              }}
                            >
                              {name}
                            </Text>
                          </Toque>
                        ))}
                      </ScrollView>
                      {label("Descrição")}
                      <TextInput
                        editable={editable}
                        maxLength={500}
                        multiline
                        style={[
                          styles.input,
                          { minHeight: 68, textAlignVertical: "top" },
                        ]}
                        value={item.descricao}
                        onChangeText={(v) => update(i, { descricao: v })}
                        placeholder="Descreva a despesa"
                        placeholderTextColor={tema.suave}
                      />
                      <Text style={styles.sectionTitle}>
                        COMPROVANTES · {item.anexos.length}
                      </Text>
                      {item.anexos.map((a) => (
                        <View key={a.id} style={styles.proofRow}>
                          <Icon name="paperclip" size={17} color={tema.azul} />
                          <Toque
                            accessibilityRole="button"
                            style={{ flex: 1 }}
                            disabled={!!busy}
                            onPress={() => void viewProof(a)}
                          >
                            <Text style={styles.link} numberOfLines={2}>
                              {a.nome_arquivo || "Abrir comprovante"}
                            </Text>
                          </Toque>
                          {editable && (
                            <Toque onPress={() => removeProof(a)}>
                              <Icon name="x-circle" size={19} color="#fb8d8d" />
                            </Toque>
                          )}
                        </View>
                      ))}
                      {editable && (
                        <>
                          <Text style={styles.muted}>
                            Salve a despesa antes de anexar comprovantes.
                          </Text>
                          <View style={styles.attachActions}>
                            <Toque
                              disabled={!!busy}
                              onPress={() => void upload(i, "camera")}
                              style={styles.attach}
                            >
                              <Icon name="camera" size={17} color={tema.azul} />
                              <Text style={styles.link}>Câmera</Text>
                            </Toque>
                            <Toque
                              disabled={!!busy}
                              onPress={() => void upload(i, "foto")}
                              style={styles.attach}
                            >
                              <Icon name="image" size={17} color={tema.azul} />
                              <Text style={styles.link}>Fotos</Text>
                            </Toque>
                            <Toque
                              disabled={!!busy}
                              onPress={() => void upload(i, "arquivo")}
                              style={styles.attach}
                            >
                              <Icon name="file" size={17} color={tema.azul} />
                              <Text style={styles.link}>Arquivo</Text>
                            </Toque>
                          </View>
                        </>
                      )}
                    </>
                  )}
                </View>
              ))}
              {editable && (
                <>
                  <Toque
                    disabled={!!busy}
                    accessibilityRole="button"
                    onPress={finalize}
                    style={styles.outlinedButton}
                  >
                    <Icon name="check-circle" size={19} color="#69d9a3" />
                    <Text style={[styles.link, { color: "#69d9a3" }]}>
                      Finalizar relatório
                    </Text>
                  </Toque>
                </>
              )}
              <Text style={styles.sectionTitle}>HISTÓRICO E APROVAÇÃO</Text>
              <View style={styles.itemCard}>
                <Text style={styles.secondary}>
                  Status: {statusText(reportStatus(selected))}
                </Text>
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
            </>
          )}
        </ScrollView>
      )}
      <Modal
        transparent
        animationType="slide"
        visible={Boolean(sheetItem)}
        onRequestClose={() => setExpenseSheetId(null)}
      >
        {sheetItem && sheetIndex >= 0 ? (
          <View style={styles.sheetBackdrop}>
            <View style={[styles.expenseSheet, { paddingBottom: Math.max(insets.bottom, 18) }]}>
              <View style={styles.sheetHandle} />
              <View style={styles.sheetHeader}>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={styles.sheetKicker}>DESPESA {sheetIndex + 1}</Text>
                  <Text style={styles.sheetTitle}>{sheetItem.categoria}</Text>
                </View>
                <Toque
                  accessibilityRole="button"
                  accessibilityLabel="Fechar formulário da despesa"
                  onPress={() => setExpenseSheetId(null)}
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
                <Text style={styles.sheetLabel}>Categoria</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
                  {CATEGORIES.map((cat) => (
                    <Toque
                      key={cat}
                      disabled={!editable}
                      onPress={() => update(sheetIndex, { categoria: cat })}
                      style={[styles.chip, sheetItem.categoria === cat && styles.chipActive]}
                    >
                      <Text style={{ color: sheetItem.categoria === cat ? tema.fundo : tema.suave, fontSize: 12, fontWeight: "700" }}>{cat}</Text>
                    </Toque>
                  ))}
                </ScrollView>
                <View style={styles.two}>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={styles.sheetLabel}>Data</Text>
                    <TextInput editable={editable} style={styles.input} value={sheetItem.data} onChangeText={(v) => update(sheetIndex, { data: v })} />
                  </View>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={styles.sheetLabel}>Valor (R$)</Text>
                    <TextInput
                      editable={editable}
                      style={styles.input}
                      keyboardType="decimal-pad"
                      value={sheetItem.valorTexto ?? (sheetItem.valor ? String(sheetItem.valor).replace(".", ",") : "")}
                      onChangeText={(v) => update(sheetIndex, { valorTexto: v, valor: valorDespesa(v) })}
                      placeholder="0,00"
                      placeholderTextColor={tema.suave}
                    />
                  </View>
                </View>
                <Text style={styles.sheetLabel}>Pago por</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
                  {PAYERS.filter(([id]) => id !== "tripulante_2" || hasSecondCrew).map(([id, name]) => (
                    <Toque key={id} disabled={!editable} onPress={() => update(sheetIndex, { pago_por: id })} style={[styles.chip, sheetItem.pago_por === id && styles.chipActive]}>
                      <Text style={{ color: sheetItem.pago_por === id ? tema.fundo : tema.suave, fontSize: 12, fontWeight: "700" }}>{name}</Text>
                    </Toque>
                  ))}
                </ScrollView>
                <Text style={styles.sheetLabel}>Descrição</Text>
                <TextInput
                  editable={editable}
                  maxLength={500}
                  multiline
                  style={[styles.input, { minHeight: 82, textAlignVertical: "top" }]}
                  value={sheetItem.descricao}
                  onChangeText={(v) => update(sheetIndex, { descricao: v })}
                  placeholder="Ex.: refeição da tripulação"
                  placeholderTextColor={tema.suave}
                />
                <Text style={styles.sectionTitle}>COMPROVANTES · {sheetItem.anexos.length}</Text>
                {sheetItem.anexos.map((a) => (
                  <View key={a.id} style={styles.proofRow}>
                    <Icon name="paperclip" size={17} color={tema.azul} />
                    <Toque accessibilityRole="button" style={{ flex: 1 }} disabled={!!busy} onPress={() => void viewProof(a)}>
                      <Text style={styles.link} numberOfLines={2}>{a.nome_arquivo || "Abrir comprovante"}</Text>
                    </Toque>
                    {editable && <Toque onPress={() => removeProof(a)}><Icon name="x-circle" size={19} color="#fb8d8d" /></Toque>}
                  </View>
                ))}
                {editable && (
                  <View style={styles.attachActions}>
                    <Toque disabled={!!busy} onPress={() => void upload(sheetIndex, "camera")} style={styles.attach}><Icon name="camera" size={17} color={tema.azul} /><Text style={styles.link}>Câmera</Text></Toque>
                    <Toque disabled={!!busy} onPress={() => void upload(sheetIndex, "foto")} style={styles.attach}><Icon name="image" size={17} color={tema.azul} /><Text style={styles.link}>Fotos</Text></Toque>
                    <Toque disabled={!!busy} onPress={() => void upload(sheetIndex, "arquivo")} style={styles.attach}><Icon name="file" size={17} color={tema.azul} /><Text style={styles.link}>Arquivo</Text></Toque>
                  </View>
                )}
              </ScrollView>
              <View style={styles.sheetFooter}>
                {editable && (
                  <Toque
                    accessibilityRole="button"
                    onPress={() => confirmar("Remover despesa?", "A remoção será aplicada ao salvar o relatório.", () => {
                      setItems((prev) => prev.filter((_, i) => i !== sheetIndex));
                      setDirty(true);
                      setExpenseSheetId(null);
                    }, true)}
                    style={styles.sheetDelete}
                  >
                    <Icon name="trash-2" size={18} color={tema.perigo} />
                  </Toque>
                )}
                <Toque
                  accessibilityRole="button"
                  onPress={() => setExpenseSheetId(null)}
                  style={[styles.primary, styles.sheetDone]}
                >
                  <Text style={styles.primaryText}>Concluir edição</Text>
                </Toque>
              </View>
            </View>
          </View>
        ) : null}
      </Modal>
      {selected && editable && !loading && (
        <View
          style={[styles.saveBar, { bottom: Math.max(insets.bottom, 10) + 82 }]}
        >
          <View>
            <Text style={styles.muted}>
              {dirty ? "Alterações não salvas" : "Total registrado"}
            </Text>
            <Text style={styles.amount}>{money(total)}</Text>
          </View>
          <Toque
            accessibilityRole="button"
            disabled={!dirty || !!busy}
            onPress={() => void save()}
            style={[styles.saveAction, (!dirty || !!busy) && { opacity: 0.4 }]}
          >
            <Icon name="save" size={17} color={tema.fundo} />
            <Text style={styles.primaryText}>
              {busy === "save" ? "Salvando…" : "Salvar despesas"}
            </Text>
          </Toque>
        </View>
      )}
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
  sheetLabel: { color: tema.suave, fontSize: 12, fontWeight: "700", marginTop: 12, marginBottom: 7 },
  sheetFooter: {
    flexDirection: "row",
    gap: 10,
    paddingHorizontal: 16,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: tema.borda,
  },
  sheetDelete: {
    width: 50,
    height: 50,
    borderRadius: 13,
    borderWidth: 1,
    borderColor: tema.borda,
    alignItems: "center",
    justifyContent: "center",
  },
  sheetDone: { flex: 1, minHeight: 50 },
  saveBar: {
    position: "absolute",
    left: 16,
    right: 16,
    padding: 13,
    borderRadius: 20,
    backgroundColor: tema.superficie,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  saveAction: {
    minHeight: 48,
    paddingHorizontal: 16,
    backgroundColor: tema.azul,
    borderRadius: 13,
    flexDirection: "row",
    gap: 8,
    alignItems: "center",
    justifyContent: "center",
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
  expenseSummary: { flexDirection: "row", alignItems: "center", gap: 12, minWidth: 0 },
  expenseIcon: {
    width: 42,
    height: 46,
    borderRadius: 14,
    backgroundColor: "#17354f",
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
    fontSize: 10,
    letterSpacing: 1.9,
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
  tab: {
    flex: 1,
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 11,
  },
  tabActive: { backgroundColor: tema.azul },
  tabText: { color: tema.suave, fontSize: 14, fontWeight: "800" },
  sectionTitle: {
    color: "#91a9bd",
    fontSize: 11,
    letterSpacing: 1.35,
    fontWeight: "800",
    marginTop: 21,
    marginBottom: 11,
  },
  reportStats: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: tema.superficie,
    borderRadius: 16,
    paddingVertical: 12,
    marginBottom: 10,
  },
  reportStatItem: { flex: 1, alignItems: "center" },
  reportStatValue: { color: "#fff", fontSize: 20, fontWeight: "800" },
  reportStatLabel: { color: tema.suave, fontSize: 10, marginTop: 3 },
  reportStatDivider: { width: 1, height: 34, backgroundColor: tema.borda },
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
    backgroundColor: tema.superficie,
    borderRadius: 19,
    padding: 17,
    marginBottom: 10,
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
  amount: { color: "#fff", fontWeight: "800", fontSize: 17 },
  secondary: { color: "#b1c0d1", fontSize: 13, marginTop: 5, lineHeight: 20 },
  muted: { color: tema.suave, fontSize: 12, lineHeight: 19, marginTop: 4 },
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12 },
  warning: {
    backgroundColor: "#4a2530",
    padding: 13,
    marginHorizontal: 18,
    borderRadius: 11,
  },
  warningText: { color: "#ffb5bb", fontSize: 13 },
  summaryCard: {
    backgroundColor: tema.superficie,
    padding: 20,
    borderRadius: 20,
    marginBottom: 9,
  },
  bigRoute: { fontSize: 23, fontWeight: "800", color: "#fff", marginTop: 9 },
  total: { fontWeight: "800", fontSize: 20, color: "#fff" },
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
    borderRadius: 13,
    minHeight: 50,
    padding: 12,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 9,
    marginTop: 12,
  },
  link: { color: tema.azul, fontWeight: "700", fontSize: 12 },
  itemCard: {
    backgroundColor: tema.superficie,
    borderRadius: 18,
    padding: 16,
    marginBottom: 12,
  },
  itemTitle: { fontSize: 16, fontWeight: "800", color: "#fff" },
  label: {
    color: "#aebdd0",
    fontSize: 12,
    fontWeight: "700",
    marginTop: 15,
    marginBottom: 6,
  },
  chips: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    paddingVertical: 2,
  },
  chip: {
    paddingHorizontal: 11,
    paddingVertical: 9,
    borderRadius: 10,
    backgroundColor: "#1b3550",
    borderWidth: 1,
    borderColor: tema.borda,
  },
  chipActive: { backgroundColor: tema.azul, borderColor: tema.azul },
  input: {
    borderWidth: 1,
    borderColor: tema.borda,
    borderRadius: 10,
    padding: 11,
    color: "#fff",
    minHeight: 46,
    backgroundColor: tema.fundo,
    fontSize: 15,
  },
  two: { flexDirection: "row", gap: 11 },
  proofRow: {
    flexDirection: "row",
    gap: 10,
    paddingVertical: 9,
    alignItems: "center",
    borderTopWidth: 1,
    borderTopColor: tema.borda,
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
    padding: 32,
    gap: 10,
    alignItems: "center",
    backgroundColor: tema.superficie,
    borderRadius: 16,
    marginBottom: 14,
  },
});
