import { Feather } from "@expo/vector-icons";
import { useFocusEffect } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import React, { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator, Alert, FlatList, Pressable, RefreshControl, ScrollView,
  StyleSheet, Text, TextInput, View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ApiError, apiFetch } from "@/src/lib/api";
import { useColors } from "@/hooks/useColors";

type Obj = Record<string, any>;
type Expense = { id: string | number; categoria: string; data: string; valor: number; pago_por: string; descricao: string; anexos?: Attachment[] };
type Attachment = { id: string | number; nome?: string; nome_arquivo?: string; arquivo_nome?: string; filename?: string; [key: string]: any };
const BASE = "/api/financeiro/relatorios-despesa-viagem";
const CATEGORIES = ["Alimentação", "Hospedagem", "Transporte", "Combustível", "Outros"];
const PAYER_OPTIONS = [["tripulante_1", "Tripulante 1"], ["tripulante_2", "Tripulante 2"], ["cliente", "Cliente"], ["sharebrasil", "Share Brasil"]] as const;
const arr = (v: any): any[] => Array.isArray(v) ? v : [];
const listFrom = (v: any, keys: string[]) => Array.isArray(v) ? v : keys.map(k => v?.[k]).find(Array.isArray) ?? [];
const str = (v: any, fallback = "—") => v == null || v === "" ? fallback : String(v);
const dateLabel = (v: any) => { if (!v) return ""; const d = new Date(String(v).slice(0, 10) + (String(v).length <= 10 ? "T00:00:00" : "")); return Number.isNaN(d.getTime()) ? String(v) : d.toLocaleDateString("pt-BR"); };
const money = (v: any) => Number(v || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const getStatus = (r: Obj) => str(r.status, "status indisponível");
const reportId = (r: Obj) => r.id ?? r.relatorio_id;
const flightNo = (f: Obj) => str(f.numero_voo ?? f.numero ?? f.voo);
const expenseArray = (r: Obj): Expense[] => listFrom(r, ["despesas", "itens", "despesas_tripulante"]).map((e: Obj, index: number) => {
  const ownCrew = Number(r.tripulante_pos) === 2 ? "tripulante_2" : "tripulante_1";
  const reportAttachments = arr(r.anexos).filter((a: Obj) => Number(a.indice_despesa) === index);
  return {
    id: e.id ?? `local-${Math.random().toString(36).slice(2)}`, categoria: str(e.categoria, "Outros"), data: str(e.data, new Date().toISOString().slice(0, 10)), valor: Number(e.valor ?? 0), pago_por: e.pago_por === "eu" || !e.pago_por ? ownCrew : String(e.pago_por), descricao: str(e.descricao, ""), anexos: [...listFrom(e, ["anexos", "attachments"]), ...reportAttachments] as Attachment[],
  };
});

export default function RelatorioViagemScreen() {
  const colors = useColors(); const insets = useSafeAreaInsets();
  const [flights, setFlights] = useState<Obj[]>([]); const [reports, setReports] = useState<Obj[]>([]);
  const [selectedId, setSelectedId] = useState<string | number | null>(null);
  const [items, setItems] = useState<Expense[]>([]); const [loading, setLoading] = useState(true); const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(""); const [busy, setBusy] = useState(""); const [dirty, setDirty] = useState(false);
  const selected = reports.find(r => String(reportId(r)) === String(selectedId));
  const editable = !!selected && String(selected.status) === "rascunho";
  const canFinalize = !!selected && String(selected.status) === "rascunho";
  const canSecondCrew = !!(selected?.tripulante_id_2 ?? selected?.tripulante_2 ?? selected?.voo?.tripulante_2 ?? selected?.voo?.tripulante2_id);
  const load = useCallback(async (refresh = false) => {
    refresh ? setRefreshing(true) : setLoading(true); setError("");
    try {
      const [f, r] = await Promise.all([
        apiFetch<any>(`${BASE}/meus-voos`), apiFetch<any>(`${BASE}/minhas`),
      ]);
      const fs = listFrom(f, ["voos", "data", "items"]); const rs = listFrom(r, ["relatorios", "data", "items"]);
      setFlights(fs); setReports(rs);
      setSelectedId(current => current != null && rs.some((x: Obj) => String(reportId(x)) === String(current)) ? current : null);
    } catch (e) { setError(e instanceof ApiError ? e.message : "Não foi possível carregar os dados."); }
    finally { setLoading(false); setRefreshing(false); }
  }, []);
  useFocusEffect(useCallback(() => { void load(); }, [load]));
  React.useEffect(() => { if (selected) { setItems(expenseArray(selected)); setDirty(false); } else { setItems([]); setDirty(false); } }, [selectedId, reports]);
  const chooseReport = (r: Obj) => {
    const nextId = reportId(r);
    if (dirty && String(nextId) !== String(selectedId)) {
      Alert.alert("Descartar alterações?", "As despesas ainda não salvas serão perdidas.", [
        { text: "Continuar editando", style: "cancel" },
        { text: "Descartar", style: "destructive", onPress: () => setSelectedId(nextId) },
      ]);
      return;
    }
    setSelectedId(nextId);
  };
  const change = (index: number, patch: Partial<Expense>) => { setItems(prev => prev.map((x, i) => i === index ? { ...x, ...patch } : x)); setDirty(true); };
  const addExpense = () => { setItems(prev => [...prev, { id: `novo-${Date.now()}`, categoria: "Alimentação", data: new Date().toISOString().slice(0, 10), valor: 0, pago_por: Number(selected?.tripulante_pos) === 2 ? "tripulante_2" : "tripulante_1", descricao: "", anexos: [] }]); setDirty(true); };
  const save = async (afterSave?: () => void) => {
    if (!selected || !editable) return;
    for (const [i, x] of items.entries()) {
      if (!CATEGORIES.includes(x.categoria) || !/^\d{4}-\d{2}-\d{2}$/.test(x.data) || !Number.isFinite(Number(x.valor)) || Number(x.valor) <= 0 || !PAYER_OPTIONS.some(([v]) => v === x.pago_por) || !x.descricao.trim() || x.descricao.length > 500 || (x.pago_por === "tripulante_2" && !canSecondCrew)) {
        Alert.alert("Revise a despesa", `Confira os campos da despesa ${i + 1}. Informe valor maior que zero e descrição obrigatória (até 500 caracteres).`); return;
      }
    }
    setBusy("save"); setError("");
    try {
      await apiFetch(`${BASE}/${encodeURIComponent(String(reportId(selected)))}/despesas-tripulante`, { method: "PUT", body: JSON.stringify({ despesas: items.map(({ id, categoria, data, valor, pago_por, descricao }) => ({ id: String(id).startsWith("novo-") || String(id).startsWith("local-") ? undefined : id, categoria, data, valor: Number(valor), pago_por, descricao: descricao.trim() })) }) });
      await load(true); setDirty(false); afterSave?.();
    } catch (e) { setError(e instanceof ApiError ? e.message : "Não foi possível salvar as despesas."); }
    finally { setBusy(""); }
  };
  const upload = async (index: number) => {
    if (!selected || !editable) return;
    if (dirty) { Alert.alert("Salve primeiro", "Salve as alterações e recarregue o relatório antes de adicionar o comprovante."); return; }
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) { Alert.alert("Permissão necessária", "Permita acesso à biblioteca para selecionar uma foto."); return; }
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], quality: 0.9 });
    if (result.canceled || !result.assets?.[0]) return;
    const asset = result.assets[0];
    if (asset.fileSize != null && asset.fileSize > 20 * 1024 * 1024) { Alert.alert("Arquivo muito grande", "O limite do comprovante é 20 MB."); return; }
    setBusy(`upload-${index}`);
    try {
      const form = new FormData(); form.append("arquivo", { uri: asset.uri, name: asset.fileName || `comprovante-${Date.now()}.jpg`, type: asset.mimeType || "image/jpeg" } as any); form.append("indice_despesa", String(index));
      await apiFetch(`${BASE}/${encodeURIComponent(String(reportId(selected)))}/anexos-tripulante`, { method: "POST", body: form }); await load(true);
    } catch (e) { setError(e instanceof ApiError ? e.message : "Não foi possível enviar o comprovante."); }
    finally { setBusy(""); }
  };
  const removeAttachment = (attachment: Attachment) => {
    if (!selected) return;
    Alert.alert("Excluir comprovante", "Deseja remover este anexo?", [{ text: "Cancelar", style: "cancel" }, { text: "Excluir", style: "destructive", onPress: async () => {
      setBusy("delete-attachment"); try { await apiFetch(`${BASE}/${encodeURIComponent(String(reportId(selected)))}/anexos-tripulante/${encodeURIComponent(String(attachment.id))}`, { method: "DELETE" }); await load(true); } catch (e) { setError(e instanceof ApiError ? e.message : "Não foi possível excluir o comprovante."); } finally { setBusy(""); }
    } }]);
  };
  const finalize = () => {
    if (!selected) return;
    if (dirty) { Alert.alert("Salve as alterações", "Salve as despesas antes de finalizar."); return; }
    if (!items.some(x => Number(x.valor) > 0)) { Alert.alert("Despesa necessária", "Adicione pelo menos um item de despesa com valor positivo."); return; }
    Alert.alert("Finalizar relatório", "Deseja finalizar este relatório de viagem?", [{ text: "Cancelar", style: "cancel" }, { text: "Finalizar", onPress: async () => {
      setBusy("finalize"); try { await apiFetch(`${BASE}/${encodeURIComponent(String(reportId(selected)))}/finalizar`, { method: "POST" }); setSelectedId(null); await load(true); } catch (e) { setError(e instanceof ApiError ? e.message : "Não foi possível finalizar o relatório."); } finally { setBusy(""); }
    } }]);
  };
  const start = async (f: Obj) => { setBusy(`start-${flightNo(f)}`); setError(""); try { await apiFetch(`${BASE}/iniciar-do-voo`, { method: "POST", body: JSON.stringify({ numero_voo: flightNo(f) }) }); await load(true); } catch (e) { setError(e instanceof ApiError ? e.message : "Não foi possível iniciar o relatório."); } finally { setBusy(""); } };
  const total = useMemo(() => items.reduce((s, x) => s + (Number(x.valor) || 0), 0), [items]);
  const text = { color: colors.foreground }; const muted = { color: colors.mutedForeground };
  const reportForFlight = (f: Obj) => reports.find(r => String(r.numero_voo ?? r.voo?.numero_voo ?? r.voo_numero) === flightNo(f));
  return <View style={[s.container, { backgroundColor: colors.background, paddingTop: insets.top + 8 }]}>
    <View style={s.header}><View style={{ flex: 1 }}><Text style={[s.eyebrow, { color: colors.primary }]}>FINANCEIRO · TRIPULAÇÃO</Text><Text style={[s.title, text]}>Relatórios de viagem</Text></View><Pressable onPress={() => void load(true)} accessibilityRole="button" accessibilityLabel="Atualizar"><Feather name="refresh-cw" size={20} color={colors.primary} /></Pressable></View>
    {!!error && <View style={[s.error, { backgroundColor: colors.destructive + "12", borderColor: colors.destructive + "40" }]}><Text style={{ color: colors.destructive, flex: 1 }}>{error}</Text><Pressable onPress={() => void load()}><Text style={{ color: colors.primary }}>Tentar novamente</Text></Pressable></View>}
    {loading ? <View style={s.center}><ActivityIndicator color={colors.primary} /><Text style={muted}>Carregando seus voos e relatórios…</Text></View> : <FlatList data={[]} renderItem={null} keyExtractor={(_, i) => String(i)} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void load(true)} tintColor={colors.primary} />} contentContainerStyle={s.content} ListHeaderComponent={<>
      <Text style={[s.section, text]}>Meus voos atribuídos</Text>
      {flights.length === 0 ? <Text style={[s.empty, muted]}>Nenhum voo atribuído disponível.</Text> : flights.map((f, i) => { const existing = reportForFlight(f); const route = f.rota ?? f.origem_destino ?? [f.origem, f.destino].filter(Boolean).join(" → "); const aircraft = f.aeronave ?? f.matricula ?? f.registro_aeronave; return <View key={String(f.id ?? flightNo(f) + i)} style={[s.card, { backgroundColor: colors.card, borderColor: colors.border }]}><View style={s.row}><View style={{ flex: 1 }}><Text style={[s.flight, text]}>Voo {flightNo(f)}</Text><Text style={muted}>{str(route)}{aircraft ? ` · ${aircraft}` : ""}</Text><Text style={muted}>{dateLabel(f.data ?? f.data_voo ?? f.data_inicio)}</Text></View>{existing ? <Pressable style={[s.secondaryBtn, { borderColor: colors.primary }]} onPress={() => chooseReport(existing)}><Text style={{ color: colors.primary }}>{String(existing.status) === "rascunho" ? "Continuar" : "Ver relatório"}</Text></Pressable> : <Pressable disabled={!!busy} style={[s.button, { backgroundColor: colors.primary }]} onPress={() => void start(f)}><Text style={s.buttonText}>{busy === `start-${flightNo(f)}` ? "Iniciando…" : "Iniciar"}</Text></Pressable>}</View></View>; })}
      <Text style={[s.section, text]}>Meus relatórios</Text>
      {reports.length === 0 ? <Text style={[s.empty, muted]}>Você ainda não tem relatórios.</Text> : reports.map((r, i) => <Pressable key={String(reportId(r) ?? i)} onPress={() => chooseReport(r)} style={[s.reportRow, { backgroundColor: String(reportId(r)) === String(selectedId) ? colors.primary + "14" : colors.card, borderColor: colors.border }]}><View style={{ flex: 1 }}><Text style={[s.flight, text]}>Voo {str(r.numero_voo ?? r.voo?.numero_voo ?? r.voo_numero)} · {money(r.total ?? r.valor_total ?? expenseArray(r).reduce((a, x) => a + x.valor, 0))}</Text><Text style={muted}>{dateLabel(r.data_criacao ?? r.criado_em ?? r.data)}{r.rota || r.voo?.rota ? ` · ${r.rota ?? r.voo?.rota}` : ""}</Text></View><View style={[s.badge, { backgroundColor: colors.muted }]}><Text style={[s.badgeText, text]}>{getStatus(r)}</Text></View></Pressable>)}
      {selected && <View style={s.editor}><View style={s.editorTitle}><View style={{ flex: 1 }}><Text style={[s.section, text]}>Despesas · voo {str(selected.numero_voo ?? selected.voo?.numero_voo ?? selected.voo_numero)}</Text><Text style={muted}>Status: {getStatus(selected)}</Text>{String(selected.status) === "ajuste_necessario" && <Text style={[muted, { marginTop: 5 }]}>O Worker não permite editar itens neste status por esta rota; consulte o fluxo de aprovação para reabertura.</Text>}</View></View>
        {items.map((item, index) => <View key={`${item.id}-${index}`} style={[s.card, { backgroundColor: colors.card, borderColor: colors.border }]}><View style={s.row}><Text style={[s.itemTitle, text]}>Despesa {index + 1}</Text>{editable && <Pressable accessibilityLabel="Excluir despesa" onPress={() => { setItems(prev => prev.filter((_, i) => i !== index)); setDirty(true); }}><Feather name="trash-2" color={colors.destructive} size={18} /></Pressable>}</View>
          <Text style={[s.label, text]}>Categoria</Text><ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.chips}>{CATEGORIES.map(c => <Pressable key={c} disabled={!editable} onPress={() => change(index, { categoria: c })} style={[s.chip, { backgroundColor: item.categoria === c ? colors.primary : colors.muted }]}><Text style={{ color: item.categoria === c ? "white" : colors.foreground }}>{c}</Text></Pressable>)}</ScrollView>
          <Text style={[s.label, text]}>Data (AAAA-MM-DD)</Text><TextInput editable={editable} value={item.data} onChangeText={v => change(index, { data: v })} style={[s.input, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.background }]} placeholder="2026-01-31" />
          <View style={s.row}><View style={{ flex: 1 }}><Text style={[s.label, text]}>Valor (R$)</Text><TextInput editable={editable} value={String(item.valor)} onChangeText={v => change(index, { valor: Number(v.replace(",", ".")) || 0 })} keyboardType="decimal-pad" style={[s.input, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.background }]} placeholder="0,00" /></View><View style={{ flex: 1 }}><Text style={[s.label, text]}>Pago por</Text><ScrollView horizontal showsHorizontalScrollIndicator={false}>{PAYER_OPTIONS.filter(([v]) => v !== "tripulante_2" || canSecondCrew).map(([v, label]) => <Pressable key={v} disabled={!editable} onPress={() => change(index, { pago_por: v })} style={[s.chip, { backgroundColor: item.pago_por === v ? colors.primary : colors.muted }]}><Text style={{ color: item.pago_por === v ? "white" : colors.foreground }}>{label}</Text></Pressable>)}</ScrollView></View></View>
          <Text style={[s.label, text]}>Descrição · obrigatória (máx. 500)</Text><TextInput editable={editable} value={item.descricao} onChangeText={v => change(index, { descricao: v.slice(0, 500) })} maxLength={500} multiline style={[s.input, s.multiline, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.background }]} placeholder="Descreva a despesa" />
          <Text style={[s.label, text]}>Comprovantes</Text>{(item.anexos ?? []).map((a, ai) => <View key={String(a.id ?? ai)} style={s.attachment}><Feather name="image" size={15} color={colors.primary} /><Text numberOfLines={1} style={[{ flex: 1 }, muted]}>{str(a.nome ?? a.nome_arquivo ?? a.arquivo_nome ?? a.filename, "Comprovante")}</Text>{editable && <Pressable onPress={() => removeAttachment(a)}><Feather name="x-circle" size={18} color={colors.destructive} /></Pressable>}</View>)}{editable && <Pressable disabled={!!busy} onPress={() => void upload(index)} style={[s.secondaryBtn, { borderColor: colors.border, alignSelf: "flex-start" }]}><Text style={{ color: colors.primary }}>{busy === `upload-${index}` ? "Enviando…" : "+ Adicionar foto (até 20 MB)"}</Text></Pressable>}
        </View>)}
        <View style={[s.total, { backgroundColor: colors.card, borderColor: colors.border }]}><Text style={[s.itemTitle, text]}>Total</Text><Text style={[s.totalValue, { color: colors.primary }]}>{money(total)}</Text></View>
        {editable && <><Pressable disabled={!!busy} onPress={addExpense} style={[s.secondaryBtn, { borderColor: colors.primary }]}><Text style={{ color: colors.primary }}>+ Adicionar despesa</Text></Pressable><Pressable disabled={!!busy || !dirty} onPress={() => void save()} style={[s.button, { backgroundColor: dirty ? colors.primary : colors.muted, marginTop: 10 }]}><Text style={s.buttonText}>{busy === "save" ? "Salvando…" : "Salvar despesas"}</Text></Pressable><Pressable disabled={!!busy} onPress={finalize} style={[s.button, { backgroundColor: colors.secondary, marginTop: 10 }]}><Text style={s.buttonText}>{busy === "finalize" ? "Finalizando…" : "Finalizar relatório"}</Text></Pressable></>}
      </View>}
    </>} />}
  </View>;
}
const s = StyleSheet.create({ container: { flex: 1 }, header: { flexDirection: "row", alignItems: "center", paddingHorizontal: 18, paddingBottom: 16, gap: 14 }, eyebrow: { fontSize: 11, fontWeight: "700", letterSpacing: 1 }, title: { fontSize: 23, fontWeight: "800", marginTop: 3 }, content: { padding: 16, paddingBottom: 50 }, center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 10 }, error: { marginHorizontal: 16, marginBottom: 8, borderWidth: 1, borderRadius: 12, padding: 12, flexDirection: "row", gap: 10, alignItems: "center" }, section: { fontSize: 18, fontWeight: "700", marginTop: 14, marginBottom: 10 }, empty: { paddingVertical: 12 }, card: { borderWidth: 1, borderRadius: 14, padding: 14, marginBottom: 10, gap: 9 }, row: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 }, flight: { fontSize: 15, fontWeight: "700", marginBottom: 3 }, button: { paddingHorizontal: 14, paddingVertical: 11, borderRadius: 10, alignItems: "center", justifyContent: "center" }, buttonText: { color: "white", fontWeight: "700" }, secondaryBtn: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 9, alignItems: "center" }, reportRow: { flexDirection: "row", alignItems: "center", gap: 8, borderWidth: 1, borderRadius: 12, padding: 12, marginBottom: 8 }, badge: { borderRadius: 20, paddingVertical: 5, paddingHorizontal: 9 }, badgeText: { fontSize: 11, fontWeight: "600" }, editor: { marginTop: 10 }, editorTitle: { flexDirection: "row", alignItems: "center" }, itemTitle: { fontSize: 15, fontWeight: "700" }, label: { fontSize: 13, fontWeight: "600", marginTop: 4 }, chips: { flexDirection: "row", gap: 6, paddingVertical: 3 }, chip: { paddingVertical: 7, paddingHorizontal: 10, borderRadius: 20 }, input: { borderWidth: 1, borderRadius: 9, padding: 10, marginTop: 5, minHeight: 42 }, multiline: { minHeight: 75, textAlignVertical: "top" }, attachment: { flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 6 }, total: { borderWidth: 1, borderRadius: 12, padding: 14, marginTop: 8, marginBottom: 10, flexDirection: "row", justifyContent: "space-between", alignItems: "center" }, totalValue: { fontSize: 19, fontWeight: "800" } });
