import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import React, { useState } from "react";
import {
  Alert,
  FlatList,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useApp } from "@/context/AppContext";
import { useColors } from "@/hooks/useColors";
import type { TravelReport } from "@/context/AppContext";

function formatDate(dateStr: string) {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
}

function formatCurrency(val: number) {
  return val.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

const STATUS_CONFIG = {
  rascunho: { label: "Rascunho", color: "#6B7280", bg: "#F3F4F6", border: "#D1D5DB" },
  enviado: { label: "Em Análise", color: "#D97706", bg: "#FEF3C7", border: "#FDE68A" },
  aprovado: { label: "Aprovado", color: "#16A34A", bg: "#DCFCE7", border: "#86EFAC" },
  devolvido: { label: "Devolvido", color: "#DC2626", bg: "#FEE2E2", border: "#FCA5A5" },
};

function ReportCard({ item, onDelete, onSend, colors }: {
  item: TravelReport;
  onDelete: (id: string) => void;
  onSend: (id: string) => void;
  colors: ReturnType<typeof useColors>;
}) {
  const cfg = STATUS_CONFIG[item.status];
  return (
    <View style={[rStyles.card, { backgroundColor: colors.card, borderLeftColor: cfg.border }]}>
      <View style={rStyles.top}>
        <View>
          <Text style={[rStyles.numero, { color: colors.primary }]}>{item.numero}</Text>
          <Text style={[rStyles.rota, { color: colors.foreground }]}>{item.rota}</Text>
        </View>
        <View style={[rStyles.badge, { backgroundColor: cfg.bg }]}>
          <Text style={[rStyles.badgeText, { color: cfg.color }]}>{cfg.label}</Text>
        </View>
      </View>
      <View style={rStyles.detailRow}>
        <View style={rStyles.detail}>
          <Feather name="calendar" size={12} color={colors.mutedForeground} />
          <Text style={[rStyles.detailText, { color: colors.mutedForeground }]}>{formatDate(item.dataInicio)} – {formatDate(item.dataFim)} ({item.dias}d)</Text>
        </View>
        <View style={rStyles.detail}>
          <Feather name="credit-card" size={12} color={colors.mutedForeground} />
          <Text style={[rStyles.detailText, { color: colors.mutedForeground }]}>{item.aeronave}</Text>
        </View>
      </View>

      {item.status === "devolvido" && item.motivoDevolucao && (
        <View style={[rStyles.alertBox, { backgroundColor: "#FEE2E2" }]}>
          <Feather name="alert-circle" size={13} color="#DC2626" />
          <Text style={rStyles.alertText}>{item.motivoDevolucao}</Text>
        </View>
      )}

      <View style={[rStyles.totalsRow, { backgroundColor: colors.muted }]}>
        {item.combustivel > 0 && <View style={rStyles.totalItem}><Text style={[rStyles.totalLabel, { color: colors.mutedForeground }]}>Combustível</Text><Text style={[rStyles.totalVal, { color: colors.foreground }]}>{formatCurrency(item.combustivel)}</Text></View>}
        {item.hospedagem > 0 && <View style={rStyles.totalItem}><Text style={[rStyles.totalLabel, { color: colors.mutedForeground }]}>Hospedagem</Text><Text style={[rStyles.totalVal, { color: colors.foreground }]}>{formatCurrency(item.hospedagem)}</Text></View>}
        {item.alimentacao > 0 && <View style={rStyles.totalItem}><Text style={[rStyles.totalLabel, { color: colors.mutedForeground }]}>Alimentação</Text><Text style={[rStyles.totalVal, { color: colors.foreground }]}>{formatCurrency(item.alimentacao)}</Text></View>}
      </View>

      <View style={rStyles.footer}>
        <View>
          <Text style={[rStyles.footerLabel, { color: colors.mutedForeground }]}>Total</Text>
          <Text style={[rStyles.total, { color: colors.foreground }]}>{formatCurrency(item.total)}</Text>
        </View>
        <View style={rStyles.footerActions}>
          {item.status === "rascunho" && (
            <Pressable
              style={[rStyles.actionBtn, { backgroundColor: colors.primary }]}
              onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); onSend(item.id); }}
            >
              <Feather name="send" size={13} color="#FFFFFF" />
              <Text style={rStyles.actionBtnText}>Enviar</Text>
            </Pressable>
          )}
          {(item.status === "rascunho" || item.status === "devolvido") && (
            <Pressable
              style={[rStyles.deleteBtn, { backgroundColor: colors.muted }]}
              onPress={() => {
                Alert.alert("Excluir relatório", "Deseja excluir este relatório?", [
                  { text: "Cancelar", style: "cancel" },
                  { text: "Excluir", style: "destructive", onPress: () => onDelete(item.id) },
                ]);
              }}
            >
              <Feather name="trash-2" size={13} color={colors.destructive} />
            </Pressable>
          )}
        </View>
      </View>
    </View>
  );
}

const rStyles = StyleSheet.create({
  card: {
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    borderLeftWidth: 4,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  top: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 },
  numero: { fontSize: 12, fontFamily: "Inter_500Medium", marginBottom: 2 },
  rota: { fontSize: 16, fontFamily: "Inter_700Bold" },
  badge: { borderRadius: 100, paddingHorizontal: 10, paddingVertical: 5 },
  badgeText: { fontSize: 11, fontFamily: "Inter_500Medium" },
  detailRow: { flexDirection: "row", gap: 14, marginBottom: 10 },
  detail: { flexDirection: "row", alignItems: "center", gap: 4 },
  detailText: { fontSize: 12, fontFamily: "Inter_400Regular" },
  alertBox: { flexDirection: "row", alignItems: "flex-start", gap: 8, borderRadius: 8, padding: 10, marginBottom: 10 },
  alertText: { flex: 1, fontSize: 12, fontFamily: "Inter_400Regular", color: "#991B1B" },
  totalsRow: { flexDirection: "row", gap: 0, borderRadius: 10, overflow: "hidden", marginBottom: 10 },
  totalItem: { flex: 1, padding: 8, alignItems: "center" },
  totalLabel: { fontSize: 10, fontFamily: "Inter_400Regular" },
  totalVal: { fontSize: 12, fontFamily: "Inter_600SemiBold" },
  footer: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  footerLabel: { fontSize: 11, fontFamily: "Inter_400Regular" },
  total: { fontSize: 18, fontFamily: "Inter_700Bold" },
  footerActions: { flexDirection: "row", gap: 8 },
  actionBtn: { flexDirection: "row", alignItems: "center", gap: 6, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8 },
  actionBtnText: { fontSize: 13, color: "#FFFFFF", fontFamily: "Inter_500Medium" },
  deleteBtn: { borderRadius: 8, padding: 8 },
});

function NewReportModal({ visible, onClose, onSave, colors }: {
  visible: boolean;
  onClose: () => void;
  onSave: (r: Omit<TravelReport, "id">) => void;
  colors: ReturnType<typeof useColors>;
}) {
  const today = new Date().toISOString().split("T")[0];
  const [form, setForm] = useState({
    numero: `R-${new Date().getFullYear()}-${String(Date.now()).slice(-3)}`,
    rota: "",
    aeronave: "PS-SBR",
    dataInicio: today,
    dataFim: today,
    combustivel: "",
    hospedagem: "",
    alimentacao: "",
    transporte: "",
    outros: "",
    observacoes: "",
  });

  const set = (k: string, v: string) => setForm((p) => ({ ...p, [k]: v }));

  const calcDias = () => {
    const start = new Date(form.dataInicio + "T00:00:00");
    const end = new Date(form.dataFim + "T00:00:00");
    return Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
  };

  const total = (parseFloat(form.combustivel) || 0) + (parseFloat(form.hospedagem) || 0) + (parseFloat(form.alimentacao) || 0) + (parseFloat(form.transporte) || 0) + (parseFloat(form.outros) || 0);

  const handleSave = (status: TravelReport["status"]) => {
    if (!form.rota) { Alert.alert("Campo obrigatório", "Preencha a rota."); return; }
    onSave({
      numero: form.numero,
      data: today,
      rota: form.rota,
      aeronave: form.aeronave,
      dataInicio: form.dataInicio,
      dataFim: form.dataFim,
      dias: calcDias(),
      combustivel: parseFloat(form.combustivel) || 0,
      hospedagem: parseFloat(form.hospedagem) || 0,
      alimentacao: parseFloat(form.alimentacao) || 0,
      transporte: parseFloat(form.transporte) || 0,
      outros: parseFloat(form.outros) || 0,
      total,
      status,
      observacoes: form.observacoes,
    });
    onClose();
  };

  const inputStyle = [mStyles.input, { backgroundColor: colors.background, color: colors.foreground, borderColor: colors.border }];
  const labelStyle = [mStyles.label, { color: colors.foreground }];

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <View style={[mStyles.container, { backgroundColor: colors.card }]}>
        <View style={[mStyles.header, { borderBottomColor: colors.border }]}>
          <Pressable onPress={onClose}><Feather name="x" size={22} color={colors.foreground} /></Pressable>
          <Text style={[mStyles.title, { color: colors.foreground }]}>Novo Relatório</Text>
          <Pressable onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); handleSave("enviado"); }}>
            <Text style={[mStyles.saveText, { color: colors.primary }]}>Enviar</Text>
          </Pressable>
        </View>
        <ScrollView contentContainerStyle={mStyles.form} showsVerticalScrollIndicator={false}>
          <View style={styles.row}>
            <View style={{ flex: 1 }}>
              <Text style={labelStyle}>Nº Relatório</Text>
              <TextInput style={inputStyle} value={form.numero} onChangeText={(v) => set("numero", v)} placeholderTextColor={colors.mutedForeground} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={labelStyle}>Matrícula</Text>
              <TextInput style={inputStyle} value={form.aeronave} onChangeText={(v) => set("aeronave", v)} placeholderTextColor={colors.mutedForeground} autoCapitalize="characters" />
            </View>
          </View>
          <Text style={labelStyle}>Rota *</Text>
          <TextInput style={inputStyle} value={form.rota} onChangeText={(v) => set("rota", v)} placeholder="GRU-BSB-GRU" placeholderTextColor={colors.mutedForeground} autoCapitalize="characters" />
          <View style={styles.row}>
            <View style={{ flex: 1 }}>
              <Text style={labelStyle}>Data Início</Text>
              <TextInput style={inputStyle} value={form.dataInicio} onChangeText={(v) => set("dataInicio", v)} placeholder="AAAA-MM-DD" placeholderTextColor={colors.mutedForeground} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={labelStyle}>Data Fim</Text>
              <TextInput style={inputStyle} value={form.dataFim} onChangeText={(v) => set("dataFim", v)} placeholder="AAAA-MM-DD" placeholderTextColor={colors.mutedForeground} />
            </View>
          </View>
          <Text style={[mStyles.sectionLabel, { color: colors.mutedForeground }]}>DESPESAS (R$)</Text>
          {([
            ["Combustível", "combustivel"],
            ["Hospedagem", "hospedagem"],
            ["Alimentação", "alimentacao"],
            ["Transporte", "transporte"],
            ["Outros", "outros"],
          ] as [string, string][]).map(([lbl, key]) => (
            <View key={key}>
              <Text style={labelStyle}>{lbl}</Text>
              <TextInput style={inputStyle} value={(form as any)[key]} onChangeText={(v) => set(key, v)} keyboardType="decimal-pad" placeholder="0,00" placeholderTextColor={colors.mutedForeground} />
            </View>
          ))}
          <View style={[mStyles.totalBox, { backgroundColor: colors.primary }]}>
            <Text style={mStyles.totalLabel}>Total do Relatório</Text>
            <Text style={mStyles.totalVal}>{total.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</Text>
          </View>
          <Text style={labelStyle}>Observações</Text>
          <TextInput style={[inputStyle, mStyles.textarea]} value={form.observacoes} onChangeText={(v) => set("observacoes", v)} multiline numberOfLines={3} placeholder="Detalhes adicionais..." placeholderTextColor={colors.mutedForeground} textAlignVertical="top" />
          <Pressable style={[mStyles.draftBtn, { backgroundColor: colors.muted }]} onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); handleSave("rascunho"); }}>
            <Text style={[mStyles.draftText, { color: colors.foreground }]}>Salvar como Rascunho</Text>
          </Pressable>
        </ScrollView>
      </View>
    </Modal>
  );
}

const mStyles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: 16, borderBottomWidth: 1, paddingTop: Platform.OS === "ios" ? 60 : 16 },
  title: { fontSize: 17, fontFamily: "Inter_700Bold" },
  saveText: { fontSize: 16, fontFamily: "Inter_600SemiBold" },
  form: { padding: 16, gap: 4, paddingBottom: 40 },
  sectionLabel: { fontSize: 11, fontFamily: "Inter_600SemiBold", letterSpacing: 1, marginTop: 16, marginBottom: 4 },
  label: { fontSize: 13, fontFamily: "Inter_500Medium", marginBottom: 4 },
  input: { borderRadius: 10, borderWidth: 1, padding: 10, fontSize: 14, fontFamily: "Inter_400Regular", marginBottom: 10 },
  textarea: { minHeight: 70 },
  totalBox: { borderRadius: 12, padding: 14, flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 14 },
  totalLabel: { fontSize: 13, color: "rgba(255,255,255,0.8)", fontFamily: "Inter_400Regular" },
  totalVal: { fontSize: 20, color: "#FFFFFF", fontFamily: "Inter_700Bold" },
  draftBtn: { borderRadius: 12, padding: 14, alignItems: "center" },
  draftText: { fontSize: 15, fontFamily: "Inter_600SemiBold" },
});

export default function RelatorioViagemScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { travelReports, addTravelReport, deleteTravelReport, updateTravelReport } = useApp();
  const [showModal, setShowModal] = useState(false);
  const topPadding = Platform.OS === "web" ? 67 : insets.top;
  const sorted = [...travelReports].sort((a, b) => b.data.localeCompare(a.data));

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: topPadding + 16, backgroundColor: colors.card, borderBottomColor: colors.border }]}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Feather name="x" size={22} color={colors.foreground} />
        </Pressable>
        <Text style={[styles.title, { color: colors.foreground }]}>Relatórios de Viagem</Text>
        <Pressable style={[styles.addBtn, { backgroundColor: colors.primary }]} onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setShowModal(true); }}>
          <Feather name="plus" size={20} color="#FFFFFF" />
        </Pressable>
      </View>
      <FlatList
        data={sorted}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <ReportCard
            item={item}
            onDelete={deleteTravelReport}
            onSend={(id) => updateTravelReport(id, { status: "enviado" })}
            colors={colors}
          />
        )}
        contentContainerStyle={[styles.list, { paddingBottom: Platform.OS === "web" ? 84 + 34 : 40 }]}
        scrollEnabled={!!sorted.length}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Feather name="file-text" size={40} color={colors.mutedForeground} />
            <Text style={[styles.emptyTitle, { color: colors.foreground }]}>Nenhum relatório</Text>
            <Text style={[styles.emptySub, { color: colors.mutedForeground }]}>Toque em + para criar o primeiro relatório de viagem</Text>
          </View>
        }
      />
      <NewReportModal visible={showModal} onClose={() => setShowModal(false)} onSave={addTravelReport} colors={colors} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 16, paddingBottom: 16, borderBottomWidth: 1 },
  backBtn: { padding: 4 },
  title: { fontSize: 18, fontFamily: "Inter_700Bold" },
  addBtn: { width: 38, height: 38, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  list: { padding: 16 },
  row: { flexDirection: "row", gap: 10 },
  empty: { alignItems: "center", paddingTop: 60, gap: 8 },
  emptyTitle: { fontSize: 16, fontFamily: "Inter_600SemiBold", marginTop: 8 },
  emptySub: { fontSize: 13, fontFamily: "Inter_400Regular", textAlign: "center" },
});
