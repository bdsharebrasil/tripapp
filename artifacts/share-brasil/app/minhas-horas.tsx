import React from "react";
import { ScrollView, View } from "react-native";
import { useRouter } from "expo-router";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";
import { Cabecalho, u } from "@/src/components/ui";
import { HorasVoo } from "@/src/components/HorasVoo";
export default function MinhasHoras() {
  const router = useRouter(),
    insets = useSafeAreaInsets();
  return (
    <SafeAreaView edges={["top"]} style={u.root}>
      <Cabecalho
        titulo="Minhas horas"
        apoio="HISTÓRICO DE VOO"
        voltar={() => router.back()}
      />
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{
          padding: 18,
          paddingBottom: insets.bottom + 40,
        }}
      >
        <HorasVoo />
      </ScrollView>
    </SafeAreaView>
  );
}
