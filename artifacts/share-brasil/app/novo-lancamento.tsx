import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

/**
 * O antigo formulário inventava aeronave, matrícula e lançamentos locais.
 * Até existir um formulário de diário integrado ao mês aberto no D1, ele não
 * deve mostrar botão "Salvar" com sucesso falso. Operações reais estão na Agenda.
 */
export default function NovoLancamentoScreen() {
  const router = useRouter(),
    insets = useSafeAreaInsets();
  return (
    <View
      style={[
        s.root,
        { paddingTop: insets.top + 20, paddingBottom: insets.bottom + 30 },
      ]}
    >
      <View style={s.header}>
        <Pressable onPress={() => router.back()}>
          <Feather name="arrow-left" size={24} color="#fff" />
        </Pressable>
        <Text style={s.heading}>Registro operacional</Text>
      </View>
      <View style={s.card}>
        <Feather name="book-open" size={30} color="#27b9f5" />
        <Text style={s.title}>Lançamentos de voo</Text>
        <Text style={s.note}>
          Registre AC, DEP, POU e COR na agenda do voo. Os horários criam
          automaticamente um rascunho no diário da aeronave.
        </Text>
        <Text style={s.note}>
          Depois, complete os dados do lançamento e assine como comandante no
          Diário de Bordo.
        </Text>
        <Pressable
          onPress={() => router.replace("/(tabs)/agenda")}
          style={s.button}
        >
          <Feather name="send" size={18} color="#071323" />
          <Text style={s.buttonText}>Abrir Minha Agenda</Text>
        </Pressable>
      </View>
    </View>
  );
}
const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#080D18", paddingHorizontal: 20 },
  header: {
    flexDirection: "row",
    gap: 14,
    alignItems: "center",
    marginBottom: 30,
  },
  heading: { fontSize: 23, fontWeight: "800", color: "#fff" },
  card: {
    backgroundColor: "#122238",
    padding: 22,
    borderRadius: 20,
    borderColor: "#294461",
    borderWidth: 1,
    gap: 13,
  },
  title: { fontSize: 19, fontWeight: "800", color: "#fff" },
  note: { color: "#b2c4d8", fontSize: 14, lineHeight: 22 },
  button: {
    backgroundColor: "#27b9f5",
    minHeight: 56,
    borderRadius: 14,
    flexDirection: "row",
    gap: 10,
    justifyContent: "center",
    alignItems: "center",
    marginTop: 8,
  },
  buttonText: { color: "#071323", fontSize: 15, fontWeight: "800" },
});
