import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
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
import type { FlightPlan } from "@/context/AppContext";

function formatDate(dateStr: string) {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" });
}

const STATUS_CONFIG = {
  rascunho: { label: "Rascunho", color: "#6B7280", bg: "#F3F4F6" },
  enviado: { label: "Enviado", color: "#D97706", bg: "#FEF3C7" },
  aprovado: { label: "Aprovado", color: "#16A34A", bg: "#DCFCE7" },
  cancelado: { label: "Cancelado", color: "#DC2626", bg: "#FEE2E2" },
};

function PlanCard({ item, onDelete, onSend, colors }: {
  item: FlightPlan;
  onDelete: (id: string) => void;
  onSend: (id: string) => void;
  colors: ReturnType<typeof useColors>;
}) {
  const cfg = STATUS_CONFIG[item.status];
  return (
    <View style={[pStyles.card, { backgroundColor: colors.card }]}>
      <View style={pStyles.top}>
        <View style={pStyles.routeRow}>
          <Text style={[pStyles.iata, { color: colors.primary }]}>{item.partida}</Text>
          <Feather name="arrow-right" size={16} color={colors.mutedForeground} style={{ marginHorizontal: 8 }} />
          <Text style={[pStyles.iata, { color: colors.primary }]}>{item.chegada}</Text>
        </View>
        <View style={[pStyles.badge, { backgroundColor: cfg.bg }]}>
          <Text style={[pStyles.badgeText, { color: cfg.color }]}>{cfg.label}</Text>
        </View>
      </View>
      <Text style={[pStyles.aircraft, { color: colors.mutedForeground }]}>{item.aeronave} · {item.matricula}</Text>
      <View style={pStyles.detailRow}>
        <View style={pStyles.detail}>
          <Feather name="calendar" size={12} color={colors.mutedForeground} />
          <Text style={[pStyles.detailText, { color: colors.mutedForeground }]}>{formatDate(item.data)}</Text>
        </View>
        <View style={pStyles.detail}>
          <Feather name="clock" size={12} color={colors.mutedForeground} />
          <Text style={[pStyles.detailText, { color: colors.mutedForeground }]}>{item.horaPrevista} · {item.estimativaVoo}h est.</Text>
        </View>
        <View style={pStyles.detail}>
          <Feather name="users" size={12} color={colors.mutedForeground} />
          <Text style={[pStyles.detailText, { color: colors.mutedForeground }]}>{item.passageiros} pax</Text>
        </View>
      </View>
      {item.piloto || item.copiloto ? (
        <View style={[pStyles.crewRow, { backgroundColor: colors.muted }]}>
          <Feather name="user" size={12} color={colors.mutedForeground} />
          <Text style={[pStyles.crewText, { color: colors.mutedForeground }]}>
            {item.piloto}{item.copiloto ? ` / ${item.copiloto}` : ""}
          </Text>
        </View>
      ) : null}
      {item.observacoes ? (
        <Text style={[pStyles.obs, { color: colors.mutedForeground }]} numberOfLines={2}>{item.observacoes}</Text>
      ) : null}
      <View style={pStyles.actions}>
        {item.status === "rascunho" && (
          <Pressable
            style={[pStyles.actionBtn, { backgroundColor: colors.primary }]}
            onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); onSend(item.id); }}
          >
            <Feather name="send" size={13} color="#FFFFFF" />
            <Text style={pStyles.actionBtnText}>Enviar</Text>
          </Pressable>
        )}
        <Pressable
          style={[pStyles.actionBtn, { backgroundColor: colors.muted }]}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            Alert.alert("Excluir plano", "Deseja remover este plano de voo?", [
              { text: "Cancelar", style: "cancel" },
              { text: "Excluir", style: "destructive", onPress: () => onDelete(item.id) },
            ]);
          }}
        >
          <Feather name="trash-2" size={13} color={colors.destructive} />
        </Pressable>
      </View>
    </View>
  );
}

const pStyles = StyleSheet.create({
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
  top: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 4 },
  routeRow: { flexDirection: "row", alignItems: "center" },
  iata: { fontSize: 20, fontFamily: "Inter_700Bold" },
  aircraft: { fontSize: 12, fontFamily: "Inter_400Regular", marginBottom: 8 },
  badge: { borderRadius: 100, paddingHorizontal: 10, paddingVertical: 4 },
  badgeText: { fontSize: 11, fontFamily: "Inter_500Medium" },
  detailRow: { flexDirection: "row", gap: 12, flexWrap: "wrap", marginBottom: 8 },
  detail: { flexDirection: "row", alignItems: "center", gap: 4 },
  detailText: { fontSize: 12, fontFamily: "Inter_400Regular" },
  crewRow: { flexDirection: "row", alignItems: "center", gap: 6, borderRadius: 8, padding: 8, marginBottom: 8 },
  crewText: { fontSize: 12, fontFamily: "Inter_400Regular" },
  obs: { fontSize: 12, fontFamily: "Inter_400Regular", marginBottom: 8, fontStyle: "italic" },
  actions: { flexDirection: "row", gap: 8, justifyContent: "flex-end" },
  actionBtn: { flexDirection: "row", alignItems: "center", gap: 6, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8 },
  actionBtnText: { fontSize: 13, color: "#FFFFFF", fontFamily: "Inter_500Medium" },
});

const CONDICOES = ["VMC", "IMC", "IFR", "VFR"];
const NATUREZAS_VOO = ["EX - Executivo", "AE - Aérea/Regular", "NR - Não Remunerado", "TR - Traslado", "PV - Privado"];

function NewPlanModal({ visible, onClose, onSave, colors }: {
  visible: boolean;
  onClose: () => void;
  onSave: (plan: Omit<FlightPlan, "id" | "criadoEm">) => void;
  colors: ReturnType<typeof useColors>;
}) {
  const [form, setForm] = useState({
    partida: "",
    chegada: "",
    trecho: "",
    data: new Date().toISOString().split("T")[0],
    aeronave: "Citation CJ3+",
    matricula: "PS-SBR",
    horaPrevista: "",
    estimativaVoo: "",
    combustivelPrevisto: "",
    alternates: "",
    passageiros: "0",
    peso: "",
    piloto: "",
    copiloto: "",
    observacoes: "",
    condicoes: "VMC",
  });

  const set = (k: string, v: string) => setForm((p) => ({ ...p, [k]: v }));

  const handleSave = (status: FlightPlan["status"]) => {
    if (!form.partida || !form.chegada || !form.data) {
      Alert.alert("Campos obrigatórios", "Preencha partida, chegada e data.");
      return;
    }
    onSave({
      partida: form.partida.toUpperCase(),
      chegada: form.chegada.toUpperCase(),
      trecho: form.trecho || `${form.partida.toUpperCase()}-${form.chegada.toUpperCase()}`,
      data: form.data,
      aeronave: form.aeronave,
      matricula: form.matricula,
      horaPrevista: form.horaPrevista,
      estimativaVoo: form.estimativaVoo,
      combustivelPrevisto: parseFloat(form.combustivelPrevisto) || 0,
      alternates: form.alternates,
      passageiros: parseInt(form.passageiros) || 0,
      peso: parseFloat(form.peso) || 0,
      piloto: form.piloto,
      copiloto: form.copiloto,
      observacoes: form.observacoes,
      condicoes: form.condicoes,
      status,
    });
    onClose();
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <View style={[mStyles.container, { backgroundColor: colors.background }]}>
        <View style={[mStyles.header, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
          <Pressable onPress={onClose}><Feather name="x" size={22} color={colors.foreground} /></Pressable>
          <Text style={[mStyles.title, { color: colors.foreground }]}>Novo Plano de Voo</Text>
          <Pressable onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); handleSave("enviado"); }}>
            <Text style={[mStyles.saveText, { color: colors.primary }]}>Enviar</Text>
          </Pressable>
        </View>
        <ScrollView contentContainerStyle={mStyles.form} showsVerticalScrollIndicator={false}>
          <Text style={[mStyles.sectionLabel, { color: colors.mutedForeground }]}>ROTA</Text>
          <View style={mStyles.row}>
            <View style={{ flex: 1 }}>
              <Text style={[mStyles.label, { color: colors.foreground }]}>Partida *</Text>
              <TextInput style={[mStyles.input, { backgroundColor: colors.card, color: colors.foreground, borderColor: colors.border }]} value={form.partida} onChangeText={(v) => set("partida", v)} placeholder="SBGR" placeholderTextColor={colors.mutedForeground} autoCapitalize="characters" maxLength={4} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[mStyles.label, { color: colors.foreground }]}>Chegada *</Text>
              <TextInput style={[mStyles.input, { backgroundColor: colors.card, color: colors.foreground, borderColor: colors.border }]} value={form.chegada} onChangeText={(v) => set("chegada", v)} placeholder="SBBR" placeholderTextColor={colors.mutedForeground} autoCapitalize="characters" maxLength={4} />
            </View>
          </View>
          <Text style={[mStyles.label, { color: colors.foreground }]}>Aeródromo Alternado</Text>
          <TextInput style={[mStyles.input, { backgroundColor: colors.card, color: colors.foreground, borderColor: colors.border }]} value={form.alternates} onChangeText={(v) => set("alternates", v)} placeholder="SBSP" placeholderTextColor={colors.mutedForeground} autoCapitalize="characters" />

          <Text style={[mStyles.sectionLabel, { color: colors.mutedForeground }]}>AERONAVE E DATA</Text>
          <View style={mStyles.row}>
            <View style={{ flex: 1 }}>
              <Text style={[mStyles.label, { color: colors.foreground }]}>Aeronave</Text>
              <TextInput style={[mStyles.input, { backgroundColor: colors.card, color: colors.foreground, borderColor: colors.border }]} value={form.aeronave} onChangeText={(v) => set("aeronave", v)} placeholderTextColor={colors.mutedForeground} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[mStyles.label, { color: colors.foreground }]}>Matrícula</Text>
              <TextInput style={[mStyles.input, { backgroundColor: colors.card, color: colors.foreground, borderColor: colors.border }]} value={form.matricula} onChangeText={(v) => set("matricula", v)} autoCapitalize="characters" placeholderTextColor={colors.mutedForeground} />
            </View>
          </View>
          <View style={mStyles.row}>
            <View style={{ flex: 1 }}>
              <Text style={[mStyles.label, { color: colors.foreground }]}>Data *</Text>
              <TextInput style={[mStyles.input, { backgroundColor: colors.card, color: colors.foreground, borderColor: colors.border }]} value={form.data} onChangeText={(v) => set("data", v)} placeholder="AAAA-MM-DD" placeholderTextColor={colors.mutedForeground} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[mStyles.label, { color: colors.foreground }]}>Hora Prevista</Text>
              <TextInput style={[mStyles.input, { backgroundColor: colors.card, color: colors.foreground, borderColor: colors.border }]} value={form.horaPrevista} onChangeText={(v) => set("horaPrevista", v)} placeholder="10:00" placeholderTextColor={colors.mutedForeground} keyboardType="numbers-and-punctuation" />
            </View>
          </View>
          <View style={mStyles.row}>
            <View style={{ flex: 1 }}>
              <Text style={[mStyles.label, { color: colors.foreground }]}>Estimativa (h)</Text>
              <TextInput style={[mStyles.input, { backgroundColor: colors.card, color: colors.foreground, borderColor: colors.border }]} value={form.estimativaVoo} onChangeText={(v) => set("estimativaVoo", v)} placeholder="01:30" placeholderTextColor={colors.mutedForeground} keyboardType="numbers-and-punctuation" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[mStyles.label, { color: colors.foreground }]}>Combustível (L)</Text>
              <TextInput style={[mStyles.input, { backgroundColor: colors.card, color: colors.foreground, borderColor: colors.border }]} value={form.combustivelPrevisto} onChangeText={(v) => set("combustivelPrevisto", v)} keyboardType="numeric" placeholderTextColor={colors.mutedForeground} />
            </View>
          </View>
          <View style={mStyles.row}>
            <View style={{ flex: 1 }}>
              <Text style={[mStyles.label, { color: colors.foreground }]}>Pax</Text>
              <TextInput style={[mStyles.input, { backgroundColor: colors.card, color: colors.foreground, borderColor: colors.border }]} value={form.passageiros} onChangeText={(v) => set("passageiros", v)} keyboardType="numeric" placeholderTextColor={colors.mutedForeground} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[mStyles.label, { color: colors.foreground }]}>Peso (kg)</Text>
              <TextInput style={[mStyles.input, { backgroundColor: colors.card, color: colors.foreground, borderColor: colors.border }]} value={form.peso} onChangeText={(v) => set("peso", v)} keyboardType="numeric" placeholderTextColor={colors.mutedForeground} />
            </View>
          </View>

          <Text style={[mStyles.sectionLabel, { color: colors.mutedForeground }]}>TRIPULAÇÃO</Text>
          <Text style={[mStyles.label, { color: colors.foreground }]}>Comandante (PIC)</Text>
          <TextInput style={[mStyles.input, { backgroundColor: colors.card, color: colors.foreground, borderColor: colors.border }]} value={form.piloto} onChangeText={(v) => set("piloto", v)} placeholderTextColor={colors.mutedForeground} />
          <Text style={[mStyles.label, { color: colors.foreground }]}>Co-piloto (SIC)</Text>
          <TextInput style={[mStyles.input, { backgroundColor: colors.card, color: colors.foreground, borderColor: colors.border }]} value={form.copiloto} onChangeText={(v) => set("copiloto", v)} placeholderTextColor={colors.mutedForeground} />

          <Text style={[mStyles.sectionLabel, { color: colors.mutedForeground }]}>CONDIÇÕES E OBS.</Text>
          <View style={mStyles.chipRow}>
            {CONDICOES.map((c) => (
              <Pressable
                key={c}
                style={[mStyles.chip, form.condicoes === c ? { backgroundColor: colors.primary } : { backgroundColor: colors.muted }]}
                onPress={() => set("condicoes", c)}
              >
                <Text style={[mStyles.chipText, { color: form.condicoes === c ? "#FFFFFF" : colors.mutedForeground }]}>{c}</Text>
              </Pressable>
            ))}
          </View>
          <Text style={[mStyles.label, { color: colors.foreground }]}>Observações</Text>
          <TextInput
            style={[mStyles.textarea, { backgroundColor: colors.card, color: colors.foreground, borderColor: colors.border }]}
            value={form.observacoes}
            onChangeText={(v) => set("observacoes", v)}
            multiline
            numberOfLines={4}
            placeholderTextColor={colors.mutedForeground}
            placeholder="Informações adicionais..."
          />
          <Pressable
            style={[mStyles.rascunhoBtn, { backgroundColor: colors.muted }]}
            onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); handleSave("rascunho"); }}
          >
            <Text style={[mStyles.rascunhoText, { color: colors.foreground }]}>Salvar como Rascunho</Text>
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
  row: { flexDirection: "row", gap: 10 },
  label: { fontSize: 13, fontFamily: "Inter_500Medium", marginBottom: 4 },
  input: { borderRadius: 10, borderWidth: 1, padding: 10, fontSize: 14, fontFamily: "Inter_400Regular", marginBottom: 10 },
  textarea: { borderRadius: 10, borderWidth: 1, padding: 10, fontSize: 14, fontFamily: "Inter_400Regular", marginBottom: 16, minHeight: 80, textAlignVertical: "top" },
  chipRow: { flexDirection: "row", gap: 8, marginBottom: 12 },
  chip: { borderRadius: 100, paddingHorizontal: 14, paddingVertical: 8 },
  chipText: { fontSize: 13, fontFamily: "Inter_500Medium" },
  rascunhoBtn: { borderRadius: 12, padding: 14, alignItems: "center" },
  rascunhoText: { fontSize: 15, fontFamily: "Inter_600SemiBold" },
});

export default function PlanoVooScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { flightPlans, addFlightPlan, deleteFlightPlan, updateFlightPlan } = useApp();
  const [showModal, setShowModal] = useState(false);
  const topPadding = Platform.OS === "web" ? 67 : insets.top;

  const sorted = [...flightPlans].sort((a, b) => b.data.localeCompare(a.data));

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: topPadding + 16, backgroundColor: colors.card, borderBottomColor: colors.border }]}>
        <Text style={[styles.title, { color: colors.foreground }]}>Plano de Voo</Text>
        <Pressable
          style={[styles.addBtn, { backgroundColor: colors.primary }]}
          onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setShowModal(true); }}
        >
          <Feather name="plus" size={20} color="#FFFFFF" />
        </Pressable>
      </View>

      <FlatList
        data={sorted}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <PlanCard
            item={item}
            onDelete={deleteFlightPlan}
            onSend={(id) => updateFlightPlan(id, { status: "enviado" })}
            colors={colors}
          />
        )}
        contentContainerStyle={[styles.list, { paddingBottom: Platform.OS === "web" ? 84 + 34 : 80 }]}
        scrollEnabled={!!sorted.length}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Feather name="navigation" size={40} color={colors.mutedForeground} />
            <Text style={[styles.emptyTitle, { color: colors.foreground }]}>Nenhum plano de voo</Text>
            <Text style={[styles.emptySub, { color: colors.mutedForeground }]}>Toque em + para criar o primeiro plano</Text>
          </View>
        }
      />

      <NewPlanModal
        visible={showModal}
        onClose={() => setShowModal(false)}
        onSave={addFlightPlan}
        colors={colors}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
  },
  title: { fontSize: 24, fontFamily: "Inter_700Bold" },
  addBtn: { width: 38, height: 38, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  list: { padding: 16 },
  empty: { alignItems: "center", paddingTop: 60, gap: 8 },
  emptyTitle: { fontSize: 16, fontFamily: "Inter_600SemiBold", marginTop: 8 },
  emptySub: { fontSize: 13, fontFamily: "Inter_400Regular", textAlign: "center" },
});
