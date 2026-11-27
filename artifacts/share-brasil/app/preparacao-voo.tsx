import { Cabecalho, tema, Icon, Toque } from "@/src/components/ui";
import { avisar, confirmar } from "@/src/lib/confirmar";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  ActivityIndicator,
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
import { abrirBriefingPdf } from "@/src/lib/briefing-pdf";
import {
  checklistItemResolvido,
  checklistItemsForAircraft,
  FLIGHT_CHECKLIST_SECTIONS,
  proximaSecaoPendente,
  type ChecklistItem,
} from "@/src/features/checklist/checklist";

type Estado =
  | "PENDENTE"
  | "EM_ANDAMENTO"
  | "CONCLUIDO"
  | "NAO_REALIZADO"
  | "NAO_APLICAVEL";
type Resposta = {
  estado: Estado;
  observacao: string;
  responsavel?: string;
  atualizado_em?: string;
};
type Servico = Resposta & {
  id: string;
  tipo: string;
  dados: Record<string, string>;
};
type Escala = { id: string; icao: string; cidade: string; servicos: Servico[] };
type Preparacao = {
  modelo: 1;
  itens: Record<string, Resposta>;
  nivel_oleo: string;
  observacoes: string;
  trechos: unknown[];
  escalas: Escala[];
};
type Secao = {
  id: string;
  titulo: string;
  subtitulo?: string;
  segmento: string;
  itens: ChecklistItem[];
};
type Snapshot = {
  versao: number;
  somente_leitura: boolean;
  finalizado_em?: string | null;
  dados: Preparacao;
  secoes: Secao[];
  tipos_servico: { id: string; nome: string }[];
  resumo: { total: number; resolvidos: number; pendencias: number };
  voo?: {
    numero_voo?: string;
    matricula_registro?: string;
    modelo?: string;
  };
};
const bg = tema.fundo,
  panel = tema.superficie,
  line = tema.borda,
  muted = tema.suave,
  accent = tema.azul;
const states: { id: Estado; label: string }[] = [
  { id: "PENDENTE", label: "Pendente" },
  { id: "EM_ANDAMENTO", label: "Em andamento" },
  { id: "CONCLUIDO", label: "Concluído" },
  { id: "NAO_REALIZADO", label: "Não realizado" },
  { id: "NAO_APLICAVEL", label: "Não se aplica" },
];

export default function PreparacaoVoo() {
  const { id } = useLocalSearchParams<{ id: string }>(),
    router = useRouter(),
    insets = useSafeAreaInsets();
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null),
    [draft, setDraft] = useState<Preparacao | null>(null);
  const [busy, setBusy] = useState(false),
    [loading, setLoading] = useState(true),
    [error, setError] = useState("");
  const [tab, setTab] = useState<"aeronave" | "tripulacao">("aeronave");
  const [openSection, setOpenSection] = useState("");
  const scrollRef = useRef<React.ComponentRef<typeof ScrollView>>(null);
  const stageOffsets = useRef<Record<string, number>>({});
  const [dirty, setDirty] = useState(false);
  const [openingPdf, setOpeningPdf] = useState(false);
  const base = `/api/interno/agendamento/${encodeURIComponent(id || "")}/preparacao`;
  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError("");
    try {
      const data = await apiFetch<Snapshot>(base);
      setSnapshot(data);
      setDraft(JSON.parse(JSON.stringify(data.dados)));
      setDirty(false);
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "Não foi possível consultar o checklist.",
      );
    } finally {
      setLoading(false);
    }
  }, [base, id]);
  useEffect(() => {
    void load();
  }, [load]);

  const update = (fn: (d: Preparacao) => Preparacao) => {
    setDraft((prev) => (prev ? fn(JSON.parse(JSON.stringify(prev))) : prev));
    setDirty(true);
  };
  const setItem = (key: string, patch: Partial<Resposta>) =>
    update((d) => {
      d.itens[key] = { ...d.itens[key], ...patch };
      return d;
    });
  const setService = (
    escalaId: string,
    tipo: string,
    patch: Partial<Servico>,
  ) =>
    update((d) => {
      const serv = d.escalas
        .find((e) => e.id === escalaId)
        ?.servicos.find((s) => s.tipo === tipo);
      if (serv) Object.assign(serv, patch);
      return d;
    });
  const save = async (finish = false) => {
    if (!snapshot || !draft || busy || snapshot.somente_leitura) return;
    const run = async () => {
      setBusy(true);
      try {
        await apiFetch<Snapshot>(base + (finish ? "/concluir" : ""), {
          method: "POST",
          body: JSON.stringify({ versao: snapshot.versao, dados: draft }),
        });
        // Recarrega as seções e a versão do servidor para evitar sobrescrever mudanças de outro colaborador.
        const fresh = await apiFetch<Snapshot>(base);
        setSnapshot(fresh);
        setDraft(JSON.parse(JSON.stringify(fresh.dados)));
        setDirty(false);
        avisar(
          finish ? "Preparação concluída" : "Rascunho salvo",
          finish
            ? `Checklist atualizado. ${fresh.resumo.pendencias} pendência(s) permanecem no briefing.`
            : "As alterações foram salvas.",
        );
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Não foi possível salvar.";
        if (/versao_desatualizada|409/.test(msg))
          confirmar(
            "Alteração simultânea",
            "Outra pessoa atualizou este voo. Recarregar os dados e descartar suas alterações locais?",
            () => void load(),
          );
        else avisar("Falha ao salvar", msg);
      } finally {
        setBusy(false);
      }
    };
    if (finish)
      confirmar(
        "Concluir preparação?",
        "A conclusão registra o checklist, mas pode manter pendências no briefing. Não certifica a aeronave.",
        () => void run(),
      );
    else await run();
  };
  const openPdf = async () => {
    if (!snapshot || !id || openingPdf || busy) return;
    if (dirty) {
      avisar(
        "Alterações não salvas",
        "Salve o checklist para gerar um briefing com os dados mais recentes.",
      );
      return;
    }
    setOpeningPdf(true);
    try {
      await abrirBriefingPdf(
        id,
        snapshot.versao,
        snapshot.voo?.numero_voo || "",
      );
    } catch (e) {
      avisar(
        "Briefing indisponível",
        e instanceof Error ? e.message : "Não foi possível abrir o PDF.",
      );
    } finally {
      setOpeningPdf(false);
    }
  };
  const readonly = Boolean(snapshot?.somente_leitura);
  const sections = useMemo(() => {
    if (tab === "aeronave") {
      const allowedItems = new Set(
        checklistItemsForAircraft(
          snapshot?.voo?.matricula_registro,
          snapshot?.voo?.modelo,
        ).map((item) => item.id),
      );
      return FLIGHT_CHECKLIST_SECTIONS.map((section) => ({
        ...section,
        segmento: "aeronave",
        itens: section.itens.filter((item) => allowedItems.has(item.id)),
      }));
    }
    return (snapshot?.secoes || []).filter((s) => s.segmento === tab);
  }, [
    snapshot?.secoes,
    snapshot?.voo?.matricula_registro,
    snapshot?.voo?.modelo,
    tab,
  ]);
  useEffect(() => {
    if (!sections.length) {
      setOpenSection("");
      return;
    }
    if (!sections.some((section) => section.id === openSection)) {
      const estados = Object.fromEntries(
        Object.entries(draft?.itens ?? {}).map(([key, resposta]) => [
          key,
          resposta.estado,
        ]),
      );
      setOpenSection(
        sections.find((section) =>
          section.itens.some(
            (item) => !checklistItemResolvido(estados[item.id]),
          ),
        )?.id ?? "",
      );
    }
  }, [sections, openSection, draft]);

  const atualizarItemChecklist = (key: string, patch: Partial<Resposta>) => {
    const secao = sections.find((section) =>
      section.itens.some((item) => item.id === key),
    );
    if (!secao || !patch.estado || !draft) {
      setItem(key, patch);
      return;
    }
    const estados = Object.fromEntries(
      Object.entries(draft.itens).map(([itemId, resposta]) => [
        itemId,
        resposta.estado,
      ]),
    );
    const antesConcluida = secao.itens.every((item) =>
      checklistItemResolvido(estados[item.id]),
    );
    estados[key] = patch.estado;
    const depoisConcluida = secao.itens.every((item) =>
      checklistItemResolvido(estados[item.id]),
    );
    setItem(key, patch);
    if (!antesConcluida && depoisConcluida) {
      const proxima = proximaSecaoPendente(sections, estados, secao.id);
      setOpenSection(proxima);
      if (proxima) {
        requestAnimationFrame(() =>
          requestAnimationFrame(() => {
            const y = stageOffsets.current[proxima];
            if (y != null) scrollRef.current?.scrollTo({ y, animated: true });
          }),
        );
      }
    }
  };
  const statePicker = (value: Estado, change: (v: Estado) => void) => (
    <View style={styles.states}>
      {states
        .filter((s) => s.id !== "PENDENTE")
        .map((s) => (
          <Toque
            key={s.id}
            accessibilityRole="button"
            accessibilityState={{
              selected: value === s.id,
              disabled: readonly,
            }}
            disabled={readonly}
            onPress={() => change(s.id)}
            style={[styles.state, value === s.id && styles.stateActive]}
          >
            <Text
              style={[
                styles.stateText,
                value === s.id && styles.stateTextActive,
              ]}
            >
              {s.label}
            </Text>
          </Toque>
        ))}
    </View>
  );

  return (
    <SafeAreaView edges={["top"]} style={[styles.root, { paddingTop: 8 }]}>
      <Cabecalho
        titulo="Preparação do voo"
        apoio="CHECKLIST E BRIEFING"
        voltar={() =>
          dirty
            ? confirmar(
                "Alterações não salvas",
                "Deseja sair sem salvar?",
                () => router.back(),
                true,
              )
            : router.back()
        }
      />

      {loading ? (
        <ActivityIndicator color={accent} style={{ marginTop: 35 }} />
      ) : error ? (
        <View style={styles.card}>
          <Text style={styles.description}>{error}</Text>
          <Toque onPress={() => void load()} style={styles.button}>
            <Text style={styles.buttonText}>Tentar novamente</Text>
          </Toque>
        </View>
      ) : snapshot && draft ? (
        <>
          <ScrollView
            ref={scrollRef}
            contentContainerStyle={{
              paddingHorizontal: 18,
              paddingBottom: 180,
            }}
            keyboardShouldPersistTaps="handled"
          >
            <View style={styles.card}>
              <Text style={styles.flight}>
                {snapshot.voo?.numero_voo || "Voo"} ·{" "}
                {snapshot.voo?.matricula_registro || "Aeronave"}
              </Text>
              <Text style={styles.description}>
                Versão {snapshot.versao} · {snapshot.resumo.resolvidos}/
                {snapshot.resumo.total} resolvidos
              </Text>
              <Text style={styles.pending}>
                {snapshot.resumo.pendencias} pendência(s) no último salvamento
              </Text>
              {tab === "aeronave" ? (
                <Text style={styles.checklistVersion}>
                  CHECKLIST OPERACIONAL · 4 ETAPAS
                </Text>
              ) : null}
              {readonly ? (
                <Text style={styles.pending}>
                  Voo encerrado: somente leitura
                </Text>
              ) : null}
              <Toque
                accessibilityRole="button"
                disabled={openingPdf || busy}
                onPress={() => void openPdf()}
                style={styles.pdfButton}
              >
                <Icon name="file-text" size={18} color={accent} />
                <Text style={styles.pdfText}>
                  {openingPdf ? "Abrindo briefing…" : "Abrir briefing em PDF"}
                </Text>
                <Icon name="external-link" size={16} color={accent} />
              </Toque>
            </View>
            <View style={styles.tabs}>
              {(["aeronave", "tripulacao"] as const).map((t) => (
                <Toque
                  key={t}
                  accessibilityRole="tab"
                  accessibilityState={{ selected: tab === t }}
                  onPress={() => {
                    setTab(t);
                    setOpenSection("");
                  }}
                  style={[styles.tab, tab === t && styles.tabActive]}
                >
                  <Icon
                    name={t === "aeronave" ? "send" : "users"}
                    color={tab === t ? bg : muted}
                    size={17}
                  />
                  <Text style={[styles.tabText, tab === t && { color: bg }]}>
                    {t === "aeronave" ? "Aeronave" : "Tripulação"}
                  </Text>
                </Toque>
              ))}
            </View>
            {sections.map((sec) => {
              const respostas = sec.itens.map(
                (item) => draft.itens[item.id]?.estado || "PENDENTE",
              );
              const concluidos = respostas.filter(
                checklistItemResolvido,
              ).length;
              const secaoConcluida =
                sec.itens.length > 0 && concluidos === sec.itens.length;
              const isOpen = openSection === sec.id;
              return (
                <View
                  key={sec.id}
                  style={styles.stage}
                  onLayout={(event) => {
                    stageOffsets.current[sec.id] = event.nativeEvent.layout.y;
                  }}
                >
                  <Toque
                    accessibilityRole="button"
                    accessibilityLabel={`${sec.titulo}. ${secaoConcluida ? "Etapa concluída" : `${sec.itens.length - concluidos} pendências`}. ${isOpen ? "Recolher etapa" : "Abrir etapa"}`}
                    accessibilityState={{ expanded: isOpen }}
                    onPress={() => setOpenSection(isOpen ? "" : sec.id)}
                    style={styles.stageHeader}
                  >
                    <View
                      style={[
                        styles.stageProgress,
                        secaoConcluida && styles.stageProgressComplete,
                      ]}
                    >
                      {secaoConcluida ? (
                        <Icon name="check" size={18} color="#fff" />
                      ) : (
                        <Text style={styles.stageCount}>
                          {concluidos}/{sec.itens.length}
                        </Text>
                      )}
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.stageTitle}>{sec.titulo}</Text>
                      {sec.subtitulo ? (
                        <Text style={styles.stageDescription}>
                          {sec.subtitulo}
                        </Text>
                      ) : null}
                      <Text
                        style={[
                          styles.stageSubtitle,
                          secaoConcluida && styles.stageSubtitleComplete,
                        ]}
                      >
                        {secaoConcluida
                          ? isOpen
                            ? "Etapa concluída · toque para recolher"
                            : "Etapa concluída · toque para revisar"
                          : `${sec.itens.length - concluidos} pendências nesta etapa`}
                      </Text>
                    </View>
                    <Icon
                      name={isOpen ? "chevron-up" : "chevron-down"}
                      size={19}
                      color={secaoConcluida ? "#55c99b" : muted}
                    />
                  </Toque>
                  {isOpen
                    ? sec.itens.map((item) => {
                        const estado =
                          draft.itens[item.id]?.estado || "PENDENTE";
                        const concluido =
                          estado === "CONCLUIDO" || estado === "NAO_APLICAVEL";
                        return (
                          <View key={item.id} style={styles.checkItem}>
                            <Toque
                              accessibilityRole="checkbox"
                              accessibilityState={{
                                checked: concluido,
                                disabled: readonly,
                              }}
                              disabled={readonly}
                              onPress={() =>
                                atualizarItemChecklist(item.id, {
                                  estado: concluido ? "PENDENTE" : "CONCLUIDO",
                                })
                              }
                              style={styles.checkRow}
                            >
                              <View
                                style={[
                                  styles.nativeCheck,
                                  concluido && styles.nativeCheckActive,
                                ]}
                              >
                                {concluido ? (
                                  <Icon name="check" size={16} color="#fff" />
                                ) : null}
                              </View>
                              <View style={{ flex: 1 }}>
                                <Text
                                  style={[
                                    styles.itemTitle,
                                    concluido && styles.itemTitleDone,
                                  ]}
                                >
                                  {item.label}
                                </Text>
                                <Text style={styles.itemStatus}>
                                  {states.find((s) => s.id === estado)?.label}
                                </Text>
                              </View>
                            </Toque>
                            {statePicker(estado, (v) =>
                              atualizarItemChecklist(item.id, { estado: v }),
                            )}
                            <TextInput
                              editable={!readonly}
                              placeholder="Observação (opcional)"
                              placeholderTextColor={muted}
                              multiline
                              value={draft.itens[item.id]?.observacao || ""}
                              onChangeText={(v) =>
                                setItem(item.id, { observacao: v })
                              }
                              style={styles.input}
                            />
                            {item.tipo === "oleo" ? (
                              <View style={styles.oilLevel}>
                                <Text style={styles.itemStatus}>
                                  Nível de óleo LH / RH
                                </Text>
                                <TextInput
                                  editable={!readonly}
                                  placeholder="Informe os níveis"
                                  placeholderTextColor={muted}
                                  value={draft.nivel_oleo}
                                  onChangeText={(v) =>
                                    update((d) => {
                                      d.nivel_oleo = v;
                                      return d;
                                    })
                                  }
                                  style={styles.input}
                                />
                              </View>
                            ) : null}
                          </View>
                        );
                      })
                    : null}
                </View>
              );
            })}
            {tab === "tripulacao"
              ? draft.escalas.map((escala) => (
                  <View key={escala.id}>
                    <Text style={styles.section}>
                      SERVIÇOS · {escala.icao || "ESCALA"}
                    </Text>
                    {escala.servicos.map((serv) => (
                      <View key={serv.id} style={styles.card}>
                        <Text style={styles.itemTitle}>
                          {snapshot.tipos_servico.find(
                            (t) => t.id === serv.tipo,
                          )?.nome || serv.tipo}
                        </Text>
                        {statePicker(serv.estado, (v) =>
                          setService(escala.id, serv.tipo, { estado: v }),
                        )}
                        <TextInput
                          editable={!readonly}
                          placeholder="Observação do serviço"
                          placeholderTextColor={muted}
                          multiline
                          value={serv.observacao}
                          onChangeText={(v) =>
                            setService(escala.id, serv.tipo, { observacao: v })
                          }
                          style={styles.input}
                        />
                        {Object.entries(serv.dados || {})
                          .filter(([, v]) => v)
                          .map(([key, val]) => (
                            <Text key={key} style={styles.description}>
                              {key.replace(/_/g, " ")}: {val}
                            </Text>
                          ))}
                      </View>
                    ))}
                  </View>
                ))
              : null}
            <Text style={styles.section}>OBSERVAÇÕES GERAIS</Text>
            <TextInput
              editable={!readonly}
              placeholder="Observações da preparação"
              placeholderTextColor={muted}
              multiline
              value={draft.observacoes}
              onChangeText={(v) =>
                update((d) => {
                  d.observacoes = v;
                  return d;
                })
              }
              style={[
                styles.input,
                { minHeight: 85, textAlignVertical: "top" },
              ]}
            />
            <Text style={styles.description}>
              Acompanhe os serviços do roteiro e registre as observações da
              preparação.
            </Text>
          </ScrollView>
          {!readonly && (
            <View
              style={[
                styles.footer,
                { paddingBottom: Math.max(insets.bottom, 12) },
              ]}
            >
              <Toque
                disabled={busy || !dirty}
                onPress={() => void save(false)}
                style={[
                  styles.button,
                  styles.outline,
                  (!dirty || busy) && { opacity: 0.5 },
                ]}
              >
                <Text style={styles.buttonText}>Salvar</Text>
              </Toque>
              <Toque
                disabled={busy}
                onPress={() => void save(true)}
                style={[
                  styles.button,
                  { backgroundColor: "#248b70" },
                  busy && { opacity: 0.5 },
                ]}
              >
                <Text style={styles.buttonText}>
                  {busy ? "Salvando…" : "Concluir"}
                </Text>
              </Toque>
            </View>
          )}
        </>
      ) : null}
    </SafeAreaView>
  );
}
const styles = StyleSheet.create({
  pdfButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 13,
    marginTop: 14,
    borderWidth: 1,
    borderColor: "#316083",
    backgroundColor: "#142b42",
    borderRadius: 12,
  },
  pdfText: { flex: 1, fontSize: 13, fontWeight: "800", color: "#fff" },
  root: { flex: 1, backgroundColor: bg },
  header: { flexDirection: "row", alignItems: "center", padding: 18, gap: 12 },
  back: {
    width: 42,
    height: 42,
    borderRadius: 13,
    backgroundColor: panel,
    alignItems: "center",
    justifyContent: "center",
  },
  eyebrow: { color: accent, fontSize: 10, fontWeight: "800", letterSpacing: 2 },
  heading: { color: "#fff", fontSize: 23, fontWeight: "800", marginTop: 4 },
  card: {
    backgroundColor: panel,
    borderRadius: 18,
    padding: 15,
    marginBottom: 11,
    marginHorizontal: 0,
  },
  flight: { color: "#fff", fontSize: 19, fontWeight: "800" },
  description: { color: muted, fontSize: 12, lineHeight: 19, marginTop: 6 },
  pending: { color: "#f0c47d", fontSize: 12, marginTop: 8 },
  checklistVersion: {
    color: accent,
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 1.2,
    marginTop: 8,
  },
  tabs: {
    flexDirection: "row",
    backgroundColor: panel,
    padding: 5,
    borderRadius: 16,
    marginVertical: 15,
  },
  tab: {
    flex: 1,
    minHeight: 50,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 14,
    gap: 8,
    borderRadius: 12,
  },
  tabActive: { backgroundColor: accent },
  tabText: { color: muted, fontSize: 13, fontWeight: "800" },
  section: {
    color: accent,
    fontSize: 11,
    letterSpacing: 1.6,
    fontWeight: "800",
    marginTop: 20,
    marginBottom: 12,
  },
  stage: {
    backgroundColor: panel,
    borderRadius: 16,
    marginTop: 12,
    overflow: "hidden",
  },
  stageHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 14,
    minHeight: 76,
  },
  stageProgress: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 2,
    borderColor: accent,
    alignItems: "center",
    justifyContent: "center",
  },
  stageProgressComplete: { borderColor: "#35a879", backgroundColor: "#1b503b" },
  stageCount: { color: "#fff", fontSize: 12, fontWeight: "900" },
  stageTitle: { color: "#fff", fontSize: 15, fontWeight: "800" },
  stageSubtitle: { color: muted, fontSize: 11, marginTop: 4 },
  stageSubtitleComplete: { color: "#55c99b", fontWeight: "700" },
  stageDescription: {
    color: muted,
    fontSize: 11,
    lineHeight: 16,
    marginTop: 4,
  },
  checkItem: {
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 14,
    borderTopWidth: 1,
    borderTopColor: line,
  },
  checkRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 11,
    minHeight: 48,
  },
  nativeCheck: {
    width: 26,
    height: 26,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: line,
    alignItems: "center",
    justifyContent: "center",
  },
  nativeCheckActive: { backgroundColor: "#248b70", borderColor: "#248b70" },
  itemTitleDone: { color: muted },
  itemStatus: { color: accent, fontSize: 11, marginTop: 3 },
  oilLevel: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: line,
    marginTop: 12,
    paddingTop: 10,
  },
  itemTitle: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "700",
    marginBottom: 12,
  },
  states: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  state: {
    minHeight: 40,
    justifyContent: "center",
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 9,
    borderWidth: 1,
    borderColor: line,
  },
  stateActive: { borderColor: accent, backgroundColor: "#15415c" },
  stateText: { color: muted, fontSize: 11, fontWeight: "600" },
  stateTextActive: { color: "#fff" },
  input: {
    backgroundColor: bg,
    borderWidth: 1,
    borderColor: line,
    color: "#fff",
    padding: 12,
    borderRadius: 10,
    marginTop: 12,
    minHeight: 43,
  },
  footer: {
    flexDirection: "row",
    paddingHorizontal: 18,
    paddingTop: 12,
    gap: 10,
    borderTopWidth: 1,
    borderColor: line,
    backgroundColor: bg,
  },
  button: {
    flex: 1,
    backgroundColor: accent,
    borderRadius: 13,
    minHeight: 51,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 12,
  },
  outline: { backgroundColor: panel, borderWidth: 1, borderColor: line },
  buttonText: { color: "#fff", fontWeight: "800", fontSize: 14 },
});
