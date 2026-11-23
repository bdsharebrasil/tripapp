import { valorDespesa, payloadDespesas } from "@/src/lib/despesas";
import { Feather } from "@expo/vector-icons";
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
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ApiError, apiFetch } from "@/src/lib/api";
import { Cabecalho, ErroConsulta, Vazio, tema } from "@/src/components/ui";
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
const BG = tema.fundo,
  CARD = tema.superficie,
  EDGE = tema.borda,
  BLUE = tema.azul,
  MUTED = tema.suave;
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
  const [items, setItems] = useState<Expense[]>([]);
  const [dirty, setDirty] = useState(false);
  const [expandedItem, setExpandedItem] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");

  const selected = reports.find((r) => reportId(r) === selectedId);
  const editable = isEditable(selected);
  const total = useMemo(
    () => items.reduce((v, x) => v + Number(x.valor || 0), 0),
    [items],
  );
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
    setExpandedItem(id);
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
    <Pressable
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
    </Pressable>
  );

  return (
    <View style={[styles.root, { paddingTop: insets.top + 10 }]}>
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
          <ActivityIndicator color={BLUE} />
          <Text style={styles.muted}>Carregando suas despesas…</Text>
        </View>
      ) : (
        <ScrollView
          ref={scrollRef}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => void load(true)}
              tintColor={BLUE}
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
              <View style={styles.overview}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.muted}>Relatórios vinculados a você</Text>
                  <Text style={styles.overviewTitle}>
                    Cada viagem, organizada.
                  </Text>
                  <Text style={styles.secondary}>
                    Crie despesas, adicione comprovantes e acompanhe os
                    reembolsos.
                  </Text>
                </View>
                <View style={styles.overviewIcon}>
                  <Feather name="file-text" size={30} color={BLUE} />
                </View>
              </View>
              <View style={styles.tabs}>
                {(["lancamentos", "historico"] as const).map((t) => (
                  <Pressable
                    key={t}
                    onPress={() => setSection(t)}
                    style={[styles.tab, section === t && styles.tabActive]}
                  >
                    <Text
                      style={[styles.tabText, section === t && { color: BG }]}
                    >
                      {t === "lancamentos"
                        ? "Lançar despesas"
                        : "Meus relatórios"}
                    </Text>
                  </Pressable>
                ))}
              </View>
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
                      <Pressable
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
                            <ActivityIndicator color={BLUE} />
                          ) : (
                            <>
                              <Text style={styles.link}>
                                {existing
                                  ? isEditable(existing)
                                    ? "Continuar"
                                    : "Ver relatório"
                                  : "Iniciar"}
                              </Text>
                              <Feather
                                name="arrow-up-right"
                                size={17}
                                color={BLUE}
                              />
                            </>
                          )}
                        </View>
                      </Pressable>
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
                  {reports.map(showReport)}
                  {!reports.length && (
                    <Text style={styles.muted}>
                      Não há relatórios registrados.
                    </Text>
                  )}
                </>
              )}
            </>
          ) : (
            <>
              <View style={styles.steps}>
                {["Voo vinculado", "Despesas", "Finalização"].map(
                  (step, index) => (
                    <View key={step} style={styles.step}>
                      <View
                        style={[
                          styles.stepNumber,
                          (index === 0 ||
                            (index === 1 && editable) ||
                            (index === 2 && !editable)) &&
                            styles.stepCurrent,
                        ]}
                      >
                        <Text
                          style={{
                            fontSize: 10,
                            fontWeight: "800",
                            color:
                              index === 0 ||
                              (index === 1 && editable) ||
                              (index === 2 && !editable)
                                ? BG
                                : MUTED,
                          }}
                        >
                          {index + 1}
                        </Text>
                      </View>
                      <Text style={styles.stepLabel}>{step}</Text>
                    </View>
                  ),
                )}
              </View>
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
                  <Pressable
                    accessibilityRole="button"
                    onPress={() => void viewReportPdf()}
                    style={styles.outlinedButton}
                  >
                    <Feather name="file-text" size={17} color={BLUE} />
                    <Text style={styles.link}>Abrir PDF do relatório</Text>
                  </Pressable>
                )}
              </View>
              <View style={styles.between}>
                <Text style={styles.sectionTitle}>
                  DESPESAS LANÇADAS · {items.length}
                </Text>
              </View>
              {editable && (
                <Pressable
                  accessibilityRole="button"
                  onPress={add}
                  disabled={!!busy}
                  style={styles.primary}
                >
                  <Feather name="plus-circle" size={21} color={BG} />
                  <Text style={styles.primaryText}>Criar nova despesa</Text>
                </Pressable>
              )}
              {!items.length && (
                <View style={styles.empty}>
                  <Feather name="file-text" size={28} color={BLUE} />
                  <Text style={styles.secondary}>
                    Nenhuma despesa registrada neste voo.
                  </Text>
                </View>
              )}
              {items.map((item, i) => (
                <View key={item.id} style={styles.itemCard}>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`Despesa ${i + 1}: ${item.categoria}`}
                    accessibilityState={{ expanded: expandedItem === item.id }}
                    onPress={() =>
                      setExpandedItem((v) => (v === item.id ? null : item.id))
                    }
                    style={styles.expenseSummary}
                  >
                    <View style={styles.expenseIcon}>
                      <Feather
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
                        color={BLUE}
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
                      <Feather
                        name={
                          expandedItem === item.id
                            ? "chevron-up"
                            : "chevron-down"
                        }
                        size={18}
                        color={BLUE}
                      />
                    </View>
                  </Pressable>
                  {expandedItem === item.id && (
                    <>
                      <View style={[styles.between, { marginTop: 14 }]}>
                        <Text style={styles.eyebrow}>DESPESA {i + 1}</Text>
                        {editable && (
                          <Pressable
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
                            <Feather
                              name="trash-2"
                              size={18}
                              color={tema.perigo}
                            />
                          </Pressable>
                        )}
                      </View>
                      {label("Categoria")}
                      <ScrollView
                        horizontal
                        showsHorizontalScrollIndicator={false}
                        contentContainerStyle={styles.chips}
                      >
                        {CATEGORIES.map((cat) => (
                          <Pressable
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
                                color: item.categoria === cat ? BG : MUTED,
                                fontWeight: "700",
                              }}
                            >
                              {cat}
                            </Text>
                          </Pressable>
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
                            placeholderTextColor={MUTED}
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
                          <Pressable
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
                                color: item.pago_por === id ? BG : MUTED,
                                fontWeight: "700",
                              }}
                            >
                              {name}
                            </Text>
                          </Pressable>
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
                        placeholderTextColor={MUTED}
                      />
                      <Text style={styles.sectionTitle}>
                        COMPROVANTES · {item.anexos.length}
                      </Text>
                      {item.anexos.map((a) => (
                        <View key={a.id} style={styles.proofRow}>
                          <Feather name="paperclip" size={17} color={BLUE} />
                          <Pressable
                            accessibilityRole="button"
                            style={{ flex: 1 }}
                            disabled={!!busy}
                            onPress={() => void viewProof(a)}
                          >
                            <Text style={styles.link} numberOfLines={2}>
                              {a.nome_arquivo || "Abrir comprovante"}
                            </Text>
                          </Pressable>
                          {editable && (
                            <Pressable onPress={() => removeProof(a)}>
                              <Feather
                                name="x-circle"
                                size={19}
                                color="#fb8d8d"
                              />
                            </Pressable>
                          )}
                        </View>
                      ))}
                      {editable && (
                        <>
                          <Text style={styles.muted}>
                            Salve a despesa antes de anexar comprovantes.
                          </Text>
                          <View style={styles.attachActions}>
                            <Pressable
                              disabled={!!busy}
                              onPress={() => void upload(i, "camera")}
                              style={styles.attach}
                            >
                              <Feather name="camera" size={17} color={BLUE} />
                              <Text style={styles.link}>Câmera</Text>
                            </Pressable>
                            <Pressable
                              disabled={!!busy}
                              onPress={() => void upload(i, "foto")}
                              style={styles.attach}
                            >
                              <Feather name="image" size={17} color={BLUE} />
                              <Text style={styles.link}>Fotos</Text>
                            </Pressable>
                            <Pressable
                              disabled={!!busy}
                              onPress={() => void upload(i, "arquivo")}
                              style={styles.attach}
                            >
                              <Feather name="file" size={17} color={BLUE} />
                              <Text style={styles.link}>Arquivo</Text>
                            </Pressable>
                          </View>
                        </>
                      )}
                    </>
                  )}
                </View>
              ))}
              {editable && (
                <>
                  <Pressable
                    disabled={!!busy}
                    accessibilityRole="button"
                    onPress={finalize}
                    style={styles.outlinedButton}
                  >
                    <Feather name="check-circle" size={19} color="#69d9a3" />
                    <Text style={[styles.link, { color: "#69d9a3" }]}>
                      Finalizar relatório
                    </Text>
                  </Pressable>
                </>
              )}
              <Text style={styles.sectionTitle}>HISTÓRICO E APROVAÇÃO</Text>
              <View style={styles.itemCard}>
                <Text style={styles.secondary}>
                  Status: {statusText(reportStatus(selected))}
                </Text>
                {arr(selected.historico_ajustes).map((h, i) => (
                  <View key={String(h.id || i)} style={styles.historyRow}>
                    <Feather name="clock" size={15} color={BLUE} />
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
          <Pressable
            accessibilityRole="button"
            disabled={!dirty || !!busy}
            onPress={() => void save()}
            style={[styles.saveAction, (!dirty || !!busy) && { opacity: 0.4 }]}
          >
            <Feather name="save" size={17} color={BG} />
            <Text style={styles.primaryText}>
              {busy === "save" ? "Salvando…" : "Salvar despesas"}
            </Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  saveBar: {
    position: "absolute",
    left: 16,
    right: 16,
    padding: 13,
    borderRadius: 20,
    backgroundColor: "#17334d",
    borderWidth: 1,
    borderColor: "#356184",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  saveAction: {
    minHeight: 48,
    paddingHorizontal: 16,
    backgroundColor: BLUE,
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
    backgroundColor: CARD,
    alignItems: "center",
    justifyContent: "center",
  },
  stepCurrent: { backgroundColor: BLUE },
  stepLabel: { fontSize: 10, color: MUTED },
  expenseSummary: { flexDirection: "row", alignItems: "center", gap: 12 },
  expenseIcon: {
    width: 42,
    height: 46,
    borderRadius: 14,
    backgroundColor: "#17354f",
    alignItems: "center",
    justifyContent: "center",
  },
  overview: {
    flexDirection: "row",
    gap: 16,
    padding: 20,
    borderRadius: 24,
    backgroundColor: "#102a46",
    borderWidth: 1,
    borderColor: EDGE,
    marginBottom: 18,
  },
  overviewTitle: {
    color: "#fff",
    fontSize: 23,
    fontFamily: "Inter_700Bold",
    letterSpacing: -0.7,
    marginVertical: 8,
  },
  overviewIcon: {
    width: 54,
    height: 54,
    borderRadius: 18,
    backgroundColor: "#183c59",
    alignItems: "center",
    justifyContent: "center",
  },
  startAction: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    padding: 9,
  },
  root: { flex: 1, backgroundColor: BG },
  header: {
    paddingHorizontal: 19,
    paddingVertical: 17,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  eyebrow: { fontSize: 10, letterSpacing: 1.9, fontWeight: "800", color: BLUE },
  title: { fontSize: 25, color: "#fff", fontWeight: "800", marginTop: 5 },
  iconButton: {
    width: 45,
    height: 45,
    backgroundColor: CARD,
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
    backgroundColor: CARD,
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
  tabActive: { backgroundColor: BLUE },
  tabText: { color: MUTED, fontSize: 14, fontWeight: "800" },
  sectionTitle: {
    color: "#91a9bd",
    fontSize: 11,
    letterSpacing: 1.35,
    fontWeight: "800",
    marginTop: 21,
    marginBottom: 11,
  },
  reportCard: {
    backgroundColor: CARD,
    borderRadius: 19,
    padding: 17,
    borderWidth: 1,
    borderColor: EDGE,
    marginBottom: 10,
  },
  flightCard: {
    padding: 17,
    borderWidth: 1,
    borderColor: EDGE,
    borderRadius: 15,
    backgroundColor: CARD,
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
  muted: { color: MUTED, fontSize: 12, lineHeight: 19, marginTop: 4 },
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12 },
  warning: {
    backgroundColor: "#4a2530",
    padding: 13,
    marginHorizontal: 18,
    borderRadius: 11,
  },
  warningText: { color: "#ffb5bb", fontSize: 13 },
  summaryCard: {
    backgroundColor: "#153354",
    padding: 20,
    borderRadius: 20,
    marginBottom: 9,
    borderWidth: 1,
    borderColor: "#2a6085",
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
    backgroundColor: BLUE,
    marginBottom: 12,
  },
  primaryText: { color: BG, fontSize: 15, fontWeight: "800" },
  outlinedButton: {
    borderWidth: 1,
    borderColor: EDGE,
    borderRadius: 13,
    minHeight: 50,
    padding: 12,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 9,
    marginTop: 12,
  },
  link: { color: BLUE, fontWeight: "700", fontSize: 12 },
  itemCard: {
    backgroundColor: CARD,
    borderColor: EDGE,
    borderWidth: 1,
    borderRadius: 17,
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
    borderColor: EDGE,
  },
  chipActive: { backgroundColor: BLUE, borderColor: BLUE },
  input: {
    borderWidth: 1,
    borderColor: EDGE,
    borderRadius: 10,
    padding: 11,
    color: "#fff",
    minHeight: 46,
    backgroundColor: BG,
    fontSize: 15,
  },
  two: { flexDirection: "row", gap: 11 },
  proofRow: {
    flexDirection: "row",
    gap: 10,
    paddingVertical: 9,
    alignItems: "center",
    borderTopWidth: 1,
    borderTopColor: EDGE,
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
    borderTopColor: EDGE,
  },
  rowTitle: { fontSize: 13, color: "#fff", marginTop: 5 },
  empty: {
    padding: 32,
    gap: 10,
    alignItems: "center",
    backgroundColor: CARD,
    borderRadius: 16,
    marginBottom: 14,
  },
});
