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
import type { VacationRequest } from "@/context/AppContext";

function formatDate(dateStr: string) {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" });
}

const STATUS_CONFIG = {
  solicitada: { label: "Solicitada", color: "#D97706", bg: "#FEF3C7" },
  aprovada: { label: "Aprovada", color: "#16A34A", bg: "#DCFCE7" },
  recusada: { label: "Recusada", color: "#DC2626", bg: "#FEE2E2" },
  cancelada: { label: "Cancelada", color: "#6B7280", bg: "#F3F4F6" },
};

const TIPOS = [
  "Férias Programadas",
  "Folga Compensatória",
  "Folga Médica",
  "Licença Maternidade/Paternidade",
  "Licença Especial",
  "Outro",
];

function VacationCard({ item, onCancel, colors }: {
  item: VacationRequest;
  onCancel: (id: string) => void;
  colors: ReturnType<typeof useColors>;
}) {
  const cfg = STATUS_CONFIG[item.status];
  const diasStr = `${item.dias} dia${item.dias !== 1 ? "s" : ""}`;

  return (
    <View style={[vStyles.card, { backgroundColor: colors.card }]}>
      <View style={vStyles.top}>
        <View style={{ flex: 1 }}>
          <Text style={[vStyles.tipo, { color: colors.foreground }]}>{item.tipo}</Text>
          <View style={vStyles.periodRow}>
            <Feather name="calendar" size={13} color={colors.primary} />
            <Text style={[vStyles.period, { color: colors.primary }]}>
              {formatDate(item.dataInicio)} — {formatDate(item.dataFim)}
            </Text>
          </View>
        </View>
        <View style={vStyles.right}>
          <View style={[vStyles.badge, { backgroundColor: cfg.bg }]}>
            <Text style={[vStyles.badgeText, { color: cfg.color }]}>{cfg.label}</Text>
          </View>
          <Text style={[vStyles.dias, { color: colors.mutedForeground }]}>{diasStr}</Text>
        </View>
      </View>

      {item.motivo ? (
        <Text style={[vStyles.motivo, { color: colors.mutedForeground }]} numberOfLines={2}>{item.motivo}</Text>
      ) : null}

      {item.observacoesGestor ? (
        <View style={[vStyles.gestor, { backgroundColor: item.status === "recusada" ? "#FEE2E2" : "#DCFCE7" }]}>
          <Feather name={item.status === "recusada" ? "x-circle" : "check-circle"} size={13} color={item.status === "recusada" ? "#DC2626" : "#16A34A"} />
          <Text style={[vStyles.gestorText, { color: item.status === "recusada" ? "#991B1B" : "#166534" }]}>
            {item.observacoesGestor}
          </Text>
        </View>
      ) : null}

      {item.status === "solicitada" && (
        <Pressable
          style={[vStyles.cancelBtn, { backgroundColor: colors.muted }]}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            Alert.alert("Cancelar solicitação", "Deseja cancelar esta solicitação de férias/folga?", [
              { text: "Não", style: "cancel" },
              { text: "Cancelar solicitação", style: "destructive", onPress: () => onCancel(item.id) },
            ]);
          }}
        >
          <Text style={[vStyles.cancelText, { color: colors.destructive }]}>Cancelar Solicitação</Text>
        </Pressable>
      )}
    </View>
  );
}

const vStyles = StyleSheet.create({
  card: {
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  top: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 },
  tipo: { fontSize: 15, fontFamily: "Inter_700Bold", marginBottom: 6 },
  periodRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  period: { fontSize: 13, fontFamily: "Inter_500Medium" },
  right: { alignItems: "flex-end", gap: 6 },
  badge: { borderRadius: 100, paddingHorizontal: 10, paddingVertical: 5 },
  badgeText: { fontSize: 11, fontFamily: "Inter_500Medium" },
  dias: { fontSize: 12, fontFamily: "Inter_400Regular" },
  motivo: { fontSize: 13, fontFamily: "Inter_400Regular", marginBottom: 8, fontStyle: "italic" },
  gestor: { flexDirection: "row", alignItems: "flex-start", gap: 8, borderRadius: 8, padding: 10, marginBottom: 10 },
  gestorText: { flex: 1, fontSize: 12, fontFamily: "Inter_400Regular" },
  cancelBtn: { borderRadius: 8, padding: 10, alignItems: "center" },
  cancelText: { fontSize: 13, fontFamily: "Inter_500Medium" },
});

function NewVacationModal({ visible, onClose, onSave, availableDays, colors }: {
  visible: boolean;
  onClose: () => void;
  onSave: (r: Omit<VacationRequest, "id" | "solicitadoEm">) => void;
  availableDays: number;
  colors: ReturnType<typeof useColors>;
}) {
  const today = new Date().toISOString().split("T")[0];
  const [form, setForm] = useState({
    tipo: TIPOS[0],
    dataInicio: today,
    dataFim: today,
    motivo: "",
  });

  const set = (k: string, v: string) => setForm((p) => ({ ...p, [k]: v }));

  const calcDias = () => {
    const start = new Date(form.dataInicio + "T00:00:00");
    const end = new Date(form.dataFim + "T00:00:00");
    const diff = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
    return Math.max(1, diff);
  };

  const handleSave = () => {
    const dias = calcDias();
    if (dias > availableDays && form.tipo === TIPOS[0]) {
      Alert.alert("Saldo insuficiente", `Você tem ${availableDays} dias disponíveis, mas solicitou ${dias} dias.`);
      return;
    }
    onSave({ tipo: form.tipo, dataInicio: form.dataInicio, dataFim: form.dataFim, dias, motivo: form.motivo, status: "solicitada" });
    onClose();
  };

  const inputStyle = [nStyles.input, { backgroundColor: colors.background, color: colors.foreground, borderColor: colors.border }];
  const labelStyle = [nStyles.label, { color: colors.foreground }];

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <View style={[nStyles.container, { backgroundColor: colors.card }]}>
        <View style={[nStyles.header, { borderBottomColor: colors.border }]}>
          <Pressable onPress={onClose}><Feather name="x" size={22} color={colors.foreground} /></Pressable>
          <Text style={[nStyles.title, { color: colors.foreground }]}>Solicitar Férias/Folga</Text>
          <Pressable onPress={() => { Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); handleSave(); }}>
            <Text style={[nStyles.saveText, { color: colors.primary }]}>Enviar</Text>
          </Pressable>
        </View>
        <ScrollView contentContainerStyle={nStyles.form} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          <View style={[nStyles.saldoBox, { backgroundColor: "#EFF6FF" }]}>
            <Feather name="sun" size={20} color={colors.primary} />
            <View>
              <Text style={[nStyles.saldoLabel, { color: colors.primary }]}>Saldo disponível</Text>
              <Text style={[nStyles.saldoValue, { color: colors.primary }]}>{availableDays} dias</Text>
            </View>
            <View style={nStyles.saldoRight}>
              <Text style={[nStyles.saldoLabel, { color: colors.primary }]}>Solicitando</Text>
              <Text style={[nStyles.saldoValue, { color: colors.primary }]}>{calcDias()} dias</Text>
            </View>
          </View>

          <Text style={[nStyles.sectionLabel, { color: colors.mutedForeground }]}>TIPO</Text>
          <View style={nStyles.chipGrid}>
            {TIPOS.map((t) => (
              <Pressable
                key={t}
                style={[nStyles.chip, form.tipo === t ? { backgroundColor: colors.primary } : { backgroundColor: colors.muted }]}
                onPress={() => set("tipo", t)}
              >
                <Text style={[nStyles.chipText, { color: form.tipo === t ? "#FFFFFF" : colors.mutedForeground }]}>{t}</Text>
              </Pressable>
            ))}
          </View>

          <Text style={[nStyles.sectionLabel, { color: colors.mutedForeground }]}>PERÍODO</Text>
          <View style={nStyles.row}>
            <View style={{ flex: 1 }}>
              <Text style={labelStyle}>Data Início</Text>
              <TextInput style={inputStyle} value={form.dataInicio} onChangeText={(v) => set("dataInicio", v)} placeholder="AAAA-MM-DD" placeholderTextColor={colors.mutedForeground} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={labelStyle}>Data Fim</Text>
              <TextInput style={inputStyle} value={form.dataFim} onChangeText={(v) => set("dataFim", v)} placeholder="AAAA-MM-DD" placeholderTextColor={colors.mutedForeground} />
            </View>
          </View>

          <Text style={labelStyle}>Motivo / Observação</Text>
          <TextInput
            style={[inputStyle, nStyles.textarea]}
            value={form.motivo}
            onChangeText={(v) => set("motivo", v)}
            multiline
            numberOfLines={4}
            placeholder="Descreva o motivo da solicitação..."
            placeholderTextColor={colors.mutedForeground}
            textAlignVertical="top"
          />
        </ScrollView>
      </View>
    </Modal>
  );
}

const nStyles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: 16, borderBottomWidth: 1, paddingTop: Platform.OS === "ios" ? 60 : 16 },
  title: { fontSize: 17, fontFamily: "Inter_700Bold" },
  saveText: { fontSize: 16, fontFamily: "Inter_600SemiBold" },
  form: { padding: 16, gap: 4, paddingBottom: 40 },
  saldoBox: { flexDirection: "row", alignItems: "center", gap: 14, borderRadius: 14, padding: 16, marginBottom: 8 },
  saldoLabel: { fontSize: 12, fontFamily: "Inter_400Regular" },
  saldoValue: { fontSize: 20, fontFamily: "Inter_700Bold" },
  saldoRight: { marginLeft: "auto" as any, alignItems: "flex-end" },
  sectionLabel: { fontSize: 11, fontFamily: "Inter_600SemiBold", letterSpacing: 1, marginTop: 16, marginBottom: 8 },
  row: { flexDirection: "row", gap: 10 },
  label: { fontSize: 13, fontFamily: "Inter_500Medium", marginBottom: 4 },
  input: { borderRadius: 10, borderWidth: 1, padding: 10, fontSize: 14, fontFamily: "Inter_400Regular", marginBottom: 10 },
  textarea: { minHeight: 90 },
  chipGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 10 },
  chip: { borderRadius: 100, paddingHorizontal: 14, paddingVertical: 8 },
  chipText: { fontSize: 12, fontFamily: "Inter_500Medium" },
});

export default function FeriasScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { vacationRequests, addVacationRequest, updateVacationRequest, profile } = useApp();
  const [showModal, setShowModal] = useState(false);
  const topPadding = Platform.OS === "web" ? 67 : insets.top;

  const sorted = [...vacationRequests].sort((a, b) => b.solicitadoEm.localeCompare(a.solicitadoEm));
  const diasUsados = vacationRequests
    .filter((r) => r.status === "aprovada")
    .reduce((acc, r) => acc + r.dias, 0);
  const saldo = profile.feriasDisponivel - diasUsados;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: topPadding + 16, backgroundColor: colors.card, borderBottomColor: colors.border }]}>
        <Pressable onPress={() => router.back()}><Feather name="x" size={22} color={colors.foreground} /></Pressable>
        <Text style={[styles.title, { color: colors.foreground }]}>Férias e Folgas</Text>
        <Pressable
          style={[styles.addBtn, { backgroundColor: colors.primary }]}
          onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setShowModal(true); }}
        >
          <Feather name="plus" size={20} color="#FFFFFF" />
        </Pressable>
      </View>

      <View style={[styles.saldoBar, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
        <View style={styles.saldoItem}>
          <Text style={[styles.saldoValue, { color: colors.primary }]}>{profile.feriasDisponivel}</Text>
          <Text style={[styles.saldoLabel, { color: colors.mutedForeground }]}>Dias direito</Text>
        </View>
        <View style={[styles.saldoItem, styles.saldoMiddle, { borderColor: colors.border }]}>
          <Text style={[styles.saldoValue, { color: colors.success }]}>{diasUsados}</Text>
          <Text style={[styles.saldoLabel, { color: colors.mutedForeground }]}>Aprovados</Text>
        </View>
        <View style={styles.saldoItem}>
          <Text style={[styles.saldoValue, { color: saldo >= 0 ? colors.gold : colors.destructive }]}>{saldo}</Text>
          <Text style={[styles.saldoLabel, { color: colors.mutedForeground }]}>Saldo</Text>
        </View>
      </View>

      <FlatList
        data={sorted}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <VacationCard
            item={item}
            onCancel={(id) => updateVacationRequest(id, { status: "cancelada" })}
            colors={colors}
          />
        )}
        contentContainerStyle={[styles.list, { paddingBottom: Platform.OS === "web" ? 84 + 34 : 40 }]}
        scrollEnabled={!!sorted.length}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Feather name="sun" size={40} color={colors.mutedForeground} />
            <Text style={[styles.emptyTitle, { color: colors.foreground }]}>Nenhuma solicitação</Text>
            <Text style={[styles.emptySub, { color: colors.mutedForeground }]}>Toque em + para solicitar férias ou folga</Text>
          </View>
        }
      />

      <NewVacationModal
        visible={showModal}
        onClose={() => setShowModal(false)}
        onSave={addVacationRequest}
        availableDays={saldo}
        colors={colors}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 16, paddingBottom: 16, borderBottomWidth: 1 },
  title: { fontSize: 18, fontFamily: "Inter_700Bold" },
  addBtn: { width: 38, height: 38, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  saldoBar: { flexDirection: "row", borderBottomWidth: 1, paddingVertical: 12 },
  saldoItem: { flex: 1, alignItems: "center" },
  saldoMiddle: { borderLeftWidth: 1, borderRightWidth: 1 },
  saldoValue: { fontSize: 22, fontFamily: "Inter_700Bold" },
  saldoLabel: { fontSize: 11, fontFamily: "Inter_400Regular", marginTop: 4 },
  list: { padding: 16 },
  empty: { alignItems: "center", paddingTop: 60, gap: 8 },
  emptyTitle: { fontSize: 16, fontFamily: "Inter_600SemiBold", marginTop: 8 },
  emptySub: { fontSize: 13, fontFamily: "Inter_400Regular", textAlign: "center" },
});
