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
import type { MaintenanceReport } from "@/context/AppContext";

function formatDate(dateStr: string) {
  const d = new Date(dateStr.includes("T") ? dateStr : dateStr + "T00:00:00");
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" });
}

const PRIORIDADE_CONFIG = {
  baixa: { label: "Baixa", color: "#16A34A", bg: "#DCFCE7" },
  media: { label: "Média", color: "#D97706", bg: "#FEF3C7" },
  alta: { label: "Alta", color: "#EA580C", bg: "#FED7AA" },
  critica: { label: "Crítica", color: "#DC2626", bg: "#FEE2E2" },
};

const STATUS_CONFIG = {
  aberto: { label: "Aberto", color: "#DC2626", bg: "#FEE2E2" },
  em_andamento: { label: "Em andamento", color: "#D97706", bg: "#FEF3C7" },
  resolvido: { label: "Resolvido", color: "#16A34A", bg: "#DCFCE7" },
};

const TIPOS = ["Avaria", "Manutenção Preventiva", "Manutenção Corretiva", "Inspeção", "AOG", "Outro"];
const PRIORIDADES = ["baixa", "media", "alta", "critica"] as const;
const STATUS_OPTIONS = ["aberto", "em_andamento", "resolvido"] as const;

function MaintenanceCard({ item, onUpdateStatus, colors }: {
  item: MaintenanceReport;
  onUpdateStatus: (id: string, status: MaintenanceReport["status"]) => void;
  colors: ReturnType<typeof useColors>;
}) {
  const pCfg = PRIORIDADE_CONFIG[item.prioridade];
  const sCfg = STATUS_CONFIG[item.status];

  return (
    <View style={[mCardStyles.card, { backgroundColor: colors.card, borderLeftColor: pCfg.color }]}>
      <View style={mCardStyles.top}>
        <View style={{ flex: 1 }}>
          <View style={mCardStyles.tagsRow}>
            <View style={[mCardStyles.badge, { backgroundColor: pCfg.bg }]}>
              <Text style={[mCardStyles.badgeText, { color: pCfg.color }]}>{pCfg.label}</Text>
            </View>
            <View style={[mCardStyles.badge, { backgroundColor: sCfg.bg }]}>
              <Text style={[mCardStyles.badgeText, { color: sCfg.color }]}>{sCfg.label}</Text>
            </View>
          </View>
          <Text style={[mCardStyles.tipo, { color: colors.primary }]}>{item.tipo}</Text>
        </View>
        <Text style={[mCardStyles.data, { color: colors.mutedForeground }]}>{formatDate(item.data)}</Text>
      </View>
      <Text style={[mCardStyles.desc, { color: colors.foreground }]}>{item.descricao}</Text>
      <View style={mCardStyles.metaRow}>
        <View style={mCardStyles.meta}>
          <Feather name="cpu" size={12} color={colors.mutedForeground} />
          <Text style={[mCardStyles.metaText, { color: colors.mutedForeground }]}>{item.aeronave} · {item.matricula}</Text>
        </View>
        <View style={mCardStyles.meta}>
          <Feather name="map-pin" size={12} color={colors.mutedForeground} />
          <Text style={[mCardStyles.metaText, { color: colors.mutedForeground }]}>{item.local}</Text>
        </View>
      </View>
      {item.resolucao && (
        <View style={[mCardStyles.resolucaoBox, { backgroundColor: "#DCFCE7" }]}>
          <Feather name="check-circle" size={13} color="#16A34A" />
          <Text style={mCardStyles.resolucaoText}>{item.resolucao}</Text>
        </View>
      )}
      {item.status !== "resolvido" && (
        <View style={mCardStyles.actionsRow}>
          {item.status === "aberto" && (
            <Pressable
              style={[mCardStyles.actionBtn, { backgroundColor: "#FEF3C7" }]}
              onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); onUpdateStatus(item.id, "em_andamento"); }}
            >
              <Feather name="tool" size={13} color="#D97706" />
              <Text style={[mCardStyles.actionText, { color: "#D97706" }]}>Em andamento</Text>
            </Pressable>
          )}
          <Pressable
            style={[mCardStyles.actionBtn, { backgroundColor: "#DCFCE7" }]}
            onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); onUpdateStatus(item.id, "resolvido"); }}
          >
            <Feather name="check" size={13} color="#16A34A" />
            <Text style={[mCardStyles.actionText, { color: "#16A34A" }]}>Resolver</Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}

const mCardStyles = StyleSheet.create({
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
  tagsRow: { flexDirection: "row", gap: 6, marginBottom: 6 },
  badge: { borderRadius: 100, paddingHorizontal: 8, paddingVertical: 4 },
  badgeText: { fontSize: 11, fontFamily: "Inter_500Medium" },
  tipo: { fontSize: 14, fontFamily: "Inter_700Bold" },
  data: { fontSize: 11, fontFamily: "Inter_400Regular" },
  desc: { fontSize: 13, fontFamily: "Inter_400Regular", marginBottom: 10, lineHeight: 19 },
  metaRow: { flexDirection: "row", gap: 14, marginBottom: 8 },
  meta: { flexDirection: "row", alignItems: "center", gap: 4 },
  metaText: { fontSize: 12, fontFamily: "Inter_400Regular" },
  resolucaoBox: { flexDirection: "row", alignItems: "flex-start", gap: 8, borderRadius: 8, padding: 10, marginBottom: 8 },
  resolucaoText: { flex: 1, fontSize: 12, fontFamily: "Inter_400Regular", color: "#166534" },
  actionsRow: { flexDirection: "row", gap: 8 },
  actionBtn: { flexDirection: "row", alignItems: "center", gap: 6, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8 },
  actionText: { fontSize: 13, fontFamily: "Inter_500Medium" },
});

function NewMaintenanceModal({ visible, onClose, onSave, colors }: {
  visible: boolean;
  onClose: () => void;
  onSave: (r: Omit<MaintenanceReport, "id" | "criadoEm">) => void;
  colors: ReturnType<typeof useColors>;
}) {
  const today = new Date().toISOString().split("T")[0];
  const [form, setForm] = useState({
    data: today,
    aeronave: "Citation CJ3+",
    matricula: "PS-SBR",
    tipo: "Avaria",
    descricao: "",
    local: "",
    prioridade: "media" as MaintenanceReport["prioridade"],
    status: "aberto" as MaintenanceReport["status"],
    resolucao: "",
  });

  const set = (k: string, v: string) => setForm((p) => ({ ...p, [k]: v }));

  const handleSave = () => {
    if (!form.descricao.trim()) { Alert.alert("Campo obrigatório", "Descreva a ocorrência."); return; }
    onSave({ ...form });
    onClose();
  };

  const inputStyle = [newStyles.input, { backgroundColor: colors.background, color: colors.foreground, borderColor: colors.border }];
  const labelStyle = [newStyles.label, { color: colors.foreground }];

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <View style={[newStyles.container, { backgroundColor: colors.card }]}>
        <View style={[newStyles.header, { borderBottomColor: colors.border }]}>
          <Pressable onPress={onClose}><Feather name="x" size={22} color={colors.foreground} /></Pressable>
          <Text style={[newStyles.title, { color: colors.foreground }]}>Report de Manutenção</Text>
          <Pressable onPress={() => { Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); handleSave(); }}>
            <Text style={[newStyles.saveText, { color: colors.primary }]}>Salvar</Text>
          </Pressable>
        </View>
        <ScrollView contentContainerStyle={newStyles.form} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          <View style={newStyles.row}>
            <View style={{ flex: 1 }}>
              <Text style={labelStyle}>Aeronave</Text>
              <TextInput style={inputStyle} value={form.aeronave} onChangeText={(v) => set("aeronave", v)} placeholderTextColor={colors.mutedForeground} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={labelStyle}>Matrícula</Text>
              <TextInput style={inputStyle} value={form.matricula} onChangeText={(v) => set("matricula", v)} autoCapitalize="characters" placeholderTextColor={colors.mutedForeground} />
            </View>
          </View>
          <Text style={labelStyle}>Data da ocorrência</Text>
          <TextInput style={inputStyle} value={form.data} onChangeText={(v) => set("data", v)} placeholder="AAAA-MM-DD" placeholderTextColor={colors.mutedForeground} />
          <Text style={labelStyle}>Local</Text>
          <TextInput style={inputStyle} value={form.local} onChangeText={(v) => set("local", v)} placeholder="Ex: SBGR" placeholderTextColor={colors.mutedForeground} autoCapitalize="characters" />

          <Text style={[newStyles.sectionLabel, { color: colors.mutedForeground }]}>TIPO DE OCORRÊNCIA</Text>
          <View style={newStyles.chipGrid}>
            {TIPOS.map((t) => (
              <Pressable key={t} style={[newStyles.chip, form.tipo === t ? { backgroundColor: colors.primary } : { backgroundColor: colors.muted }]} onPress={() => set("tipo", t)}>
                <Text style={[newStyles.chipText, { color: form.tipo === t ? "#FFFFFF" : colors.mutedForeground }]}>{t}</Text>
              </Pressable>
            ))}
          </View>

          <Text style={[newStyles.sectionLabel, { color: colors.mutedForeground }]}>PRIORIDADE</Text>
          <View style={newStyles.chipRow}>
            {PRIORIDADES.map((p) => {
              const cfg = PRIORIDADE_CONFIG[p];
              return (
                <Pressable
                  key={p}
                  style={[newStyles.chip, form.prioridade === p ? { backgroundColor: cfg.color } : { backgroundColor: colors.muted }]}
                  onPress={() => set("prioridade", p)}
                >
                  <Text style={[newStyles.chipText, { color: form.prioridade === p ? "#FFFFFF" : colors.mutedForeground }]}>{cfg.label}</Text>
                </Pressable>
              );
            })}
          </View>

          <Text style={[newStyles.sectionLabel, { color: colors.mutedForeground }]}>DESCRIÇÃO</Text>
          <Text style={labelStyle}>Descreva a ocorrência *</Text>
          <TextInput
            style={[inputStyle, newStyles.textarea]}
            value={form.descricao}
            onChangeText={(v) => set("descricao", v)}
            multiline
            numberOfLines={5}
            placeholder="Descreva detalhadamente a avaria ou necessidade de manutenção..."
            placeholderTextColor={colors.mutedForeground}
            textAlignVertical="top"
          />
          <Text style={labelStyle}>Resolução (se já resolvida)</Text>
          <TextInput
            style={[inputStyle, newStyles.textarea]}
            value={form.resolucao}
            onChangeText={(v) => set("resolucao", v)}
            multiline
            numberOfLines={3}
            placeholder="Descreva como foi resolvido..."
            placeholderTextColor={colors.mutedForeground}
            textAlignVertical="top"
          />

          <Text style={[newStyles.sectionLabel, { color: colors.mutedForeground }]}>STATUS ATUAL</Text>
          <View style={newStyles.chipRow}>
            {STATUS_OPTIONS.map((s) => {
              const cfg = STATUS_CONFIG[s];
              return (
                <Pressable key={s} style={[newStyles.chip, form.status === s ? { backgroundColor: cfg.color } : { backgroundColor: colors.muted }]} onPress={() => set("status", s)}>
                  <Text style={[newStyles.chipText, { color: form.status === s ? "#FFFFFF" : colors.mutedForeground }]}>{cfg.label}</Text>
                </Pressable>
              );
            })}
          </View>
        </ScrollView>
      </View>
    </Modal>
  );
}

const newStyles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: 16, borderBottomWidth: 1, paddingTop: Platform.OS === "ios" ? 60 : 16 },
  title: { fontSize: 17, fontFamily: "Inter_700Bold" },
  saveText: { fontSize: 16, fontFamily: "Inter_600SemiBold" },
  form: { padding: 16, gap: 4, paddingBottom: 40 },
  sectionLabel: { fontSize: 11, fontFamily: "Inter_600SemiBold", letterSpacing: 1, marginTop: 16, marginBottom: 8 },
  row: { flexDirection: "row", gap: 10 },
  label: { fontSize: 13, fontFamily: "Inter_500Medium", marginBottom: 4 },
  input: { borderRadius: 10, borderWidth: 1, padding: 10, fontSize: 14, fontFamily: "Inter_400Regular", marginBottom: 10 },
  textarea: { minHeight: 80 },
  chipRow: { flexDirection: "row", gap: 8, marginBottom: 10, flexWrap: "wrap" },
  chipGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 10 },
  chip: { borderRadius: 100, paddingHorizontal: 14, paddingVertical: 8 },
  chipText: { fontSize: 12, fontFamily: "Inter_500Medium" },
});

export default function ManutencaoScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { maintenanceReports, addMaintenanceReport, updateMaintenanceReport } = useApp();
  const [showModal, setShowModal] = useState(false);
  const [activeFilter, setActiveFilter] = useState<"todos" | "aberto" | "em_andamento" | "resolvido">("todos");
  const topPadding = Platform.OS === "web" ? 67 : insets.top;

  const filtered = maintenanceReports
    .filter((r) => activeFilter === "todos" || r.status === activeFilter)
    .sort((a, b) => {
      const order = { critica: 0, alta: 1, media: 2, baixa: 3 };
      return order[a.prioridade] - order[b.prioridade];
    });

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: topPadding + 16, backgroundColor: colors.card, borderBottomColor: colors.border }]}>
        <Pressable onPress={() => router.back()}><Feather name="x" size={22} color={colors.foreground} /></Pressable>
        <Text style={[styles.title, { color: colors.foreground }]}>Manutenção</Text>
        <Pressable style={[styles.addBtn, { backgroundColor: colors.primary }]} onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setShowModal(true); }}>
          <Feather name="plus" size={20} color="#FFFFFF" />
        </Pressable>
      </View>

      <View style={[styles.filterBar, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
        {(["todos", "aberto", "em_andamento", "resolvido"] as const).map((f) => (
          <Pressable
            key={f}
            style={[styles.filterChip, activeFilter === f ? { backgroundColor: colors.primary } : { backgroundColor: colors.muted }]}
            onPress={() => setActiveFilter(f)}
          >
            <Text style={[styles.filterText, { color: activeFilter === f ? "#FFFFFF" : colors.mutedForeground }]}>
              {f === "todos" ? "Todos" : f === "em_andamento" ? "Andamento" : f.charAt(0).toUpperCase() + f.slice(1)}
            </Text>
          </Pressable>
        ))}
      </View>

      <FlatList
        data={filtered}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <MaintenanceCard
            item={item}
            onUpdateStatus={(id, status) => updateMaintenanceReport(id, { status, ...(status === "resolvido" ? {} : {}) })}
            colors={colors}
          />
        )}
        contentContainerStyle={[styles.list, { paddingBottom: Platform.OS === "web" ? 84 + 34 : 40 }]}
        scrollEnabled={!!filtered.length}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Feather name="tool" size={40} color={colors.mutedForeground} />
            <Text style={[styles.emptyTitle, { color: colors.foreground }]}>Nenhuma ocorrência</Text>
            <Text style={[styles.emptySub, { color: colors.mutedForeground }]}>Toque em + para reportar uma ocorrência de manutenção</Text>
          </View>
        }
      />
      <NewMaintenanceModal visible={showModal} onClose={() => setShowModal(false)} onSave={addMaintenanceReport} colors={colors} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 16, paddingBottom: 16, borderBottomWidth: 1 },
  title: { fontSize: 18, fontFamily: "Inter_700Bold" },
  addBtn: { width: 38, height: 38, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  filterBar: { flexDirection: "row", gap: 8, paddingHorizontal: 16, paddingVertical: 10, borderBottomWidth: 1 },
  filterChip: { borderRadius: 100, paddingHorizontal: 12, paddingVertical: 7 },
  filterText: { fontSize: 12, fontFamily: "Inter_500Medium" },
  list: { padding: 16 },
  empty: { alignItems: "center", paddingTop: 60, gap: 8 },
  emptyTitle: { fontSize: 16, fontFamily: "Inter_600SemiBold", marginTop: 8 },
  emptySub: { fontSize: 13, fontFamily: "Inter_400Regular", textAlign: "center" },
});
