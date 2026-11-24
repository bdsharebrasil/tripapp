import { Tabs } from "expo-router";
import React from "react";
import { MenuInferior } from "@/src/components/MenuInferior";
export default function TabLayout() {
  return (
    <Tabs
      tabBar={(props) => <MenuInferior {...props} />}
      screenOptions={{ headerShown: false }}
    >
      <Tabs.Screen name="index" options={{ title: "Início" }} />
      <Tabs.Screen name="agenda" options={{ title: "Meus voos" }} />
      <Tabs.Screen name="plano-voo" options={{ title: "Plano de voo" }} />
      <Tabs.Screen
        name="despesa-viagem"
        options={{ title: "Despesa viagem" }}
      />
      <Tabs.Screen name="diario" options={{ title: "Diário de bordo" }} />
      <Tabs.Screen name="manutencao" options={{ title: "Manutenção" }} />
      <Tabs.Screen name="financeiro" options={{ title: "Financeiro" }} />
      <Tabs.Screen name="perfil" options={{ title: "Perfil" }} />
      <Tabs.Screen name="horas" options={{ href: null }} />
    </Tabs>
  );
}
