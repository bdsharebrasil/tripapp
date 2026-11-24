import { Cabecalho, tema, Icon, Toque } from "@/src/components/ui";
import { avisar, confirmar } from "@/src/lib/confirmar";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useCallback, useEffect, useMemo, useState } from "react";
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
  segmento: string;
  itens: { id: string; label: string }[];
};
type Snapshot = {
  versao: number;
  somente_leitura: boolean;
  finalizado_em?: string | null;
  dados: Preparacao;
  secoes: Secao[];
  tipos_servico: { id: string; nome: string }[];
  resumo: { total: number; resolvidos: number; pendencias: number };
  voo?: { numero_voo?: string; matricula_registro?: string };
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
  const sections = useMemo(
    () => (snapshot?.secoes || []).filter((s) => s.segmento === tab),
    [snapshot?.secoes, tab],
  );
  const statePicker = (value: Estado, change: (v: Estado) => void) => (
    <View style={styles.states}>
      {states.map((s) => (
        <Toque
          key={s.id}
          disabled={readonly}
          onPress={() => change(s.id)}
          style={[styles.state, value === s.id && styles.stateActive]}
        >
          <Text
            style={[styles.stateText, value === s.id && styles.stateTextActive]}
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
                  onPress={() => setTab(t)}
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
            {sections.map((sec) => (
              <View key={sec.id}>
                <Text style={styles.section}>{sec.titulo}</Text>
                {sec.itens.map((item) => (
                  <View key={item.id} style={styles.card}>
                    <Text style={styles.itemTitle}>{item.label}</Text>
                    {statePicker(
                      draft.itens[item.id]?.estado || "PENDENTE",
                      (v) => setItem(item.id, { estado: v }),
                    )}
                    <TextInput
                      editable={!readonly}
                      placeholder="Observação (opcional)"
                      placeholderTextColor={muted}
                      multiline
                      value={draft.itens[item.id]?.observacao || ""}
                      onChangeText={(v) => setItem(item.id, { observacao: v })}
                      style={styles.input}
                    />
                  </View>
                ))}
              </View>
            ))}
            {tab === "aeronave" ? (
              <View style={styles.card}>
                <Text style={styles.itemTitle}>Nível de óleo</Text>
                <TextInput
                  editable={!readonly}
                  placeholder="Informe o nível de óleo"
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
            ) : (
              draft.escalas.map((escala) => (
                <View key={escala.id}>
                  <Text style={styles.section}>
                    SERVIÇOS · {escala.icao || "ESCALA"}
                  </Text>
                  {escala.servicos.map((serv) => (
                    <View key={serv.id} style={styles.card}>
                      <Text style={styles.itemTitle}>
                        {snapshot.tipos_servico.find((t) => t.id === serv.tipo)
                          ?.nome || serv.tipo}
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
            )}
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
  tabs: {
    flexDirection: "row",
    backgroundColor: panel,
    padding: 5,
    borderRadius: 16,
    marginVertical: 15,
  },
  tab: {
    flex: 1,
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
  itemTitle: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "700",
    marginBottom: 12,
  },
  states: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  state: {
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
