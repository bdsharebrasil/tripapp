import { useRouter } from "expo-router";
import React from "react";
import { StyleSheet, Text, View } from "react-native";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";
import { Icon, Toque } from "@/src/components/ui";

/**
 * O antigo formulário inventava aeronave, matrícula e lançamentos locais.
 * Até existir um formulário de diário integrado ao mês aberto no D1, ele não
 * deve mostrar botão "Salvar" com sucesso falso. Operações reais estão na Agenda.
 */
export default function NovoLancamentoScreen() {
  const router = useRouter(),
    insets = useSafeAreaInsets();
  return (
    <SafeAreaView
      edges={["top"]}
      style={[s.root, { paddingTop: 20, paddingBottom: insets.bottom + 30 }]}
    >
      <View style={s.header}>
        <Toque onPress={() => router.back()}>
          <Icon name="arrow-left" size={24} color="#fff" />
        </Toque>
        <Text style={s.heading}>Registro operacional</Text>
      </View>
      <View style={s.card}>
        <Icon name="book-open" size={30} color="#27b9f5" />
        <Text style={s.title}>Lançamentos de voo</Text>
        <Text style={s.note}>
          Registre AC, DEP, POU e COR na agenda do voo. Os horários criam
          automaticamente um rascunho no diário da aeronave.
        </Text>
        <Text style={s.note}>
          Depois, complete os dados do lançamento e assine como comandante no
          Diário de Bordo.
        </Text>
        <Toque
          onPress={() => router.replace("/(tabs)/agenda")}
          style={s.button}
        >
          <Icon name="send" size={18} color="#071323" />
          <Text style={s.buttonText}>Abrir Minha Agenda</Text>
        </Toque>
      </View>
    </SafeAreaView>
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
