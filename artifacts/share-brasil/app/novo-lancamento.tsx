import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import React, { useState } from "react";
import {
  Alert,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useApp } from "@/context/AppContext";
import { useColors } from "@/hooks/useColors";

const NATUREZAS = [
  "EX - Executivo",
  "AE - Aérea/Regular",
  "NR - Não Remunerado",
  "RE - Retorno/Reposição",
  "PV - Privado",
  "TR - Traslado",
  "SA - Serviço Aéreo",
  "TN - Táxi Aéreo",
  "VOO_TESTE",
];

export default function NovoLancamentoScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { addFlight, profile } = useApp();

  const today = new Date().toISOString().split("T")[0];
  const [form, setForm] = useState({
    data: today,
    aeronave: "Citation CJ3+",
    matricula: "PS-SBR",
    partida: "",
    chegada: "",
    trecho: "",
    horaDecolagem: "",
    horaPouso: "",
    tempoVoo: "",
    horasDiurnas: "",
    horasNoturnas: "",
    pousos: "1",
    naturezaVoo: "EX - Executivo",
    picCanac: profile.canac,
    sicCanac: "",
    cliente: "",
    observacoes: "",
    confirmado: false,
    assinado: false,
    combustivelInicio: "",
    combustivelFim: "",
  });

  const set = (k: string, v: string | boolean) => setForm((p) => ({ ...p, [k]: v }));

  const handleSave = async () => {
    if (!form.partida || !form.chegada) {
      Alert.alert("Campos obrigatórios", "Preencha partida e chegada.");
      return;
    }
    if (!form.data) {
      Alert.alert("Campos obrigatórios", "Preencha a data do voo.");
      return;
    }
    if (!form.tempoVoo || parseFloat(form.tempoVoo) <= 0) {
      Alert.alert("Campos obrigatórios", "Preencha o tempo de voo.");
      return;
    }
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    await addFlight({
      data: form.data,
      aeronave: form.aeronave,
      matricula: form.matricula,
      partida: form.partida.toUpperCase(),
      chegada: form.chegada.toUpperCase(),
      trecho: form.trecho || `${form.partida.toUpperCase()}-${form.chegada.toUpperCase()}`,
      horaDecolagem: form.horaDecolagem,
      horaPouso: form.horaPouso,
      tempoVoo: parseFloat(form.tempoVoo) || 0,
      horasDiurnas: parseFloat(form.horasDiurnas) || parseFloat(form.tempoVoo) || 0,
      horasNoturnas: parseFloat(form.horasNoturnas) || 0,
      pousos: parseInt(form.pousos) || 1,
      naturezaVoo: form.naturezaVoo,
      picCanac: form.picCanac,
      sicCanac: form.sicCanac,
      cliente: form.cliente,
      observacoes: form.observacoes,
      confirmado: form.confirmado,
      assinado: form.assinado,
      combustivelInicio: parseFloat(form.combustivelInicio) || 0,
      combustivelFim: parseFloat(form.combustivelFim) || 0,
    });
    router.back();
  };

  const topPadding = Platform.OS === "web" ? 67 : insets.top;

  const inputStyle = [styles.input, { backgroundColor: colors.card, color: colors.foreground, borderColor: colors.border }];
  const labelStyle = [styles.label, { color: colors.foreground }];
  const sectionStyle = [styles.sectionLabel, { color: colors.mutedForeground }];

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: topPadding + 16, backgroundColor: colors.card, borderBottomColor: colors.border }]}>
        <Pressable onPress={() => router.back()} style={styles.closeBtn}>
          <Feather name="x" size={22} color={colors.foreground} />
        </Pressable>
        <Text style={[styles.title, { color: colors.foreground }]}>Novo Lançamento</Text>
        <Pressable
          style={[styles.saveBtn, { backgroundColor: colors.primary }]}
          onPress={handleSave}
        >
          <Text style={styles.saveBtnText}>Salvar</Text>
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={[styles.form, { paddingBottom: Platform.OS === "web" ? 34 + 40 : 40 }]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={sectionStyle}>AERONAVE E DATA</Text>
        <View style={styles.row}>
          <View style={{ flex: 1 }}>
            <Text style={labelStyle}>Aeronave</Text>
            <TextInput style={inputStyle} value={form.aeronave} onChangeText={(v) => set("aeronave", v)} placeholderTextColor={colors.mutedForeground} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={labelStyle}>Matrícula</Text>
            <TextInput style={inputStyle} value={form.matricula} onChangeText={(v) => set("matricula", v)} autoCapitalize="characters" placeholderTextColor={colors.mutedForeground} />
          </View>
        </View>
        <Text style={labelStyle}>Data do Voo *</Text>
        <TextInput style={inputStyle} value={form.data} onChangeText={(v) => set("data", v)} placeholder="AAAA-MM-DD" placeholderTextColor={colors.mutedForeground} />

        <Text style={sectionStyle}>ROTA</Text>
        <View style={styles.row}>
          <View style={{ flex: 1 }}>
            <Text style={labelStyle}>Partida *</Text>
            <TextInput style={inputStyle} value={form.partida} onChangeText={(v) => set("partida", v)} placeholder="SBGR" placeholderTextColor={colors.mutedForeground} autoCapitalize="characters" maxLength={4} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={labelStyle}>Chegada *</Text>
            <TextInput style={inputStyle} value={form.chegada} onChangeText={(v) => set("chegada", v)} placeholder="SBBR" placeholderTextColor={colors.mutedForeground} autoCapitalize="characters" maxLength={4} />
          </View>
        </View>
        <Text style={labelStyle}>Trecho (ex: GRU-BSB)</Text>
        <TextInput style={inputStyle} value={form.trecho} onChangeText={(v) => set("trecho", v)} placeholder="Deixe vazio para preencher auto" placeholderTextColor={colors.mutedForeground} autoCapitalize="characters" />

        <Text style={sectionStyle}>HORÁRIOS</Text>
        <View style={styles.row}>
          <View style={{ flex: 1 }}>
            <Text style={labelStyle}>Decolagem</Text>
            <TextInput style={inputStyle} value={form.horaDecolagem} onChangeText={(v) => set("horaDecolagem", v)} placeholder="08:00" placeholderTextColor={colors.mutedForeground} keyboardType="numbers-and-punctuation" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={labelStyle}>Pouso</Text>
            <TextInput style={inputStyle} value={form.horaPouso} onChangeText={(v) => set("horaPouso", v)} placeholder="10:00" placeholderTextColor={colors.mutedForeground} keyboardType="numbers-and-punctuation" />
          </View>
        </View>

        <Text style={sectionStyle}>HORAS DE VOO *</Text>
        <View style={styles.row}>
          <View style={{ flex: 1 }}>
            <Text style={labelStyle}>Tempo Total (h) *</Text>
            <TextInput style={inputStyle} value={form.tempoVoo} onChangeText={(v) => set("tempoVoo", v)} placeholder="1.50" placeholderTextColor={colors.mutedForeground} keyboardType="decimal-pad" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={labelStyle}>Horas Diurnas</Text>
            <TextInput style={inputStyle} value={form.horasDiurnas} onChangeText={(v) => set("horasDiurnas", v)} placeholder="1.50" placeholderTextColor={colors.mutedForeground} keyboardType="decimal-pad" />
          </View>
        </View>
        <View style={styles.row}>
          <View style={{ flex: 1 }}>
            <Text style={labelStyle}>Horas Noturnas</Text>
            <TextInput style={inputStyle} value={form.horasNoturnas} onChangeText={(v) => set("horasNoturnas", v)} placeholder="0.00" placeholderTextColor={colors.mutedForeground} keyboardType="decimal-pad" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={labelStyle}>Pousos</Text>
            <TextInput style={inputStyle} value={form.pousos} onChangeText={(v) => set("pousos", v)} keyboardType="numeric" placeholderTextColor={colors.mutedForeground} />
          </View>
        </View>

        <Text style={sectionStyle}>COMBUSTÍVEL (L)</Text>
        <View style={styles.row}>
          <View style={{ flex: 1 }}>
            <Text style={labelStyle}>Início do Voo</Text>
            <TextInput style={inputStyle} value={form.combustivelInicio} onChangeText={(v) => set("combustivelInicio", v)} keyboardType="numeric" placeholder="2400" placeholderTextColor={colors.mutedForeground} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={labelStyle}>Fim do Voo</Text>
            <TextInput style={inputStyle} value={form.combustivelFim} onChangeText={(v) => set("combustivelFim", v)} keyboardType="numeric" placeholder="1800" placeholderTextColor={colors.mutedForeground} />
          </View>
        </View>

        <Text style={sectionStyle}>TRIPULAÇÃO</Text>
        <View style={styles.row}>
          <View style={{ flex: 1 }}>
            <Text style={labelStyle}>PIC (CANAC)</Text>
            <TextInput style={inputStyle} value={form.picCanac} onChangeText={(v) => set("picCanac", v)} keyboardType="numeric" placeholderTextColor={colors.mutedForeground} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={labelStyle}>SIC (CANAC)</Text>
            <TextInput style={inputStyle} value={form.sicCanac} onChangeText={(v) => set("sicCanac", v)} keyboardType="numeric" placeholder="Opcional" placeholderTextColor={colors.mutedForeground} />
          </View>
        </View>

        <Text style={sectionStyle}>NATUREZA DO VOO</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
          {NATUREZAS.map((n) => (
            <Pressable
              key={n}
              style={[styles.chip, form.naturezaVoo === n ? { backgroundColor: colors.primary } : { backgroundColor: colors.muted }]}
              onPress={() => set("naturezaVoo", n)}
            >
              <Text style={[styles.chipText, { color: form.naturezaVoo === n ? "#FFFFFF" : colors.mutedForeground }]}>
                {n.split(" ")[0]}
              </Text>
            </Pressable>
          ))}
        </ScrollView>

        <Text style={sectionStyle}>CLIENTE E DETALHES</Text>
        <Text style={labelStyle}>Cliente / Cotista</Text>
        <TextInput style={inputStyle} value={form.cliente} onChangeText={(v) => set("cliente", v)} placeholder="Nome do cliente" placeholderTextColor={colors.mutedForeground} />
        <Text style={labelStyle}>Observações</Text>
        <TextInput
          style={[inputStyle, styles.textarea]}
          value={form.observacoes}
          onChangeText={(v) => set("observacoes", v)}
          multiline
          numberOfLines={3}
          placeholder="Observações adicionais..."
          placeholderTextColor={colors.mutedForeground}
          textAlignVertical="top"
        />

        <Text style={sectionStyle}>STATUS</Text>
        <View style={[styles.switchRow, { backgroundColor: colors.card }]}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.switchLabel, { color: colors.foreground }]}>Confirmado</Text>
            <Text style={[styles.switchSub, { color: colors.mutedForeground }]}>Voo confirmado pela operação</Text>
          </View>
          <Switch
            value={form.confirmado}
            onValueChange={(v) => set("confirmado", v)}
            trackColor={{ true: colors.primary, false: colors.muted }}
            thumbColor="#FFFFFF"
          />
        </View>
        <View style={[styles.switchRow, { backgroundColor: colors.card }]}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.switchLabel, { color: colors.foreground }]}>Assinado pelo Piloto</Text>
            <Text style={[styles.switchSub, { color: colors.mutedForeground }]}>Lançamento assinado digitalmente</Text>
          </View>
          <Switch
            value={form.assinado}
            onValueChange={(v) => set("assinado", v)}
            trackColor={{ true: colors.primary, false: colors.muted }}
            thumbColor="#FFFFFF"
          />
        </View>
      </ScrollView>
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
  closeBtn: { padding: 4 },
  title: { fontSize: 17, fontFamily: "Inter_700Bold" },
  saveBtn: { borderRadius: 10, paddingHorizontal: 16, paddingVertical: 8 },
  saveBtnText: { color: "#FFFFFF", fontSize: 14, fontFamily: "Inter_600SemiBold" },
  form: { padding: 16, gap: 4 },
  sectionLabel: { fontSize: 11, fontFamily: "Inter_600SemiBold", letterSpacing: 1, marginTop: 16, marginBottom: 4 },
  row: { flexDirection: "row", gap: 10 },
  label: { fontSize: 13, fontFamily: "Inter_500Medium", marginBottom: 4 },
  input: { borderRadius: 10, borderWidth: 1, padding: 10, fontSize: 14, fontFamily: "Inter_400Regular", marginBottom: 10 },
  textarea: { minHeight: 70 },
  chipRow: { gap: 8, paddingBottom: 12 },
  chip: { borderRadius: 100, paddingHorizontal: 14, paddingVertical: 8 },
  chipText: { fontSize: 12, fontFamily: "Inter_500Medium" },
  switchRow: { flexDirection: "row", alignItems: "center", gap: 12, borderRadius: 12, padding: 14, marginBottom: 10 },
  switchLabel: { fontSize: 14, fontFamily: "Inter_500Medium" },
  switchSub: { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 2 },
});
