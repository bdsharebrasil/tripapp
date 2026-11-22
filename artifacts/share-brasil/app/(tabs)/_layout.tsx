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
      <Tabs.Screen name="financeiro" options={{ title: "Despesas" }} />
      <Tabs.Screen name="perfil" options={{ title: "Perfil" }} />
      <Tabs.Screen name="diario" options={{ href: null }} />
      <Tabs.Screen name="plano-voo" options={{ href: null }} />
    </Tabs>
  );
}
