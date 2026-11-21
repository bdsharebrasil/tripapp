import { Tabs } from "expo-router";
import { Feather } from "@expo/vector-icons";
import React from "react";
import { Platform, StyleSheet, View } from "react-native";
import { useColors } from "@/hooks/useColors";

export default function TabLayout() {
  const colors = useColors();
  const isWeb = Platform.OS === "web";

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: "#27b9f5",
        tabBarInactiveTintColor: "#9aacc3",
        headerShown: false,
        tabBarStyle: {
          position: "absolute",
          backgroundColor: "#0c1b30",
          borderTopWidth: 1,
          borderTopColor: "#25405c",
          elevation: 0,
          height: isWeb ? 84 : 68,
          paddingBottom: isWeb ? 34 : 12,
        },
        tabBarBackground: () => <View style={[StyleSheet.absoluteFill, { backgroundColor: "#0c1b30" }]} />,
        tabBarLabelStyle: {
          fontSize: 11,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Início",
          tabBarIcon: ({ color, size }) => (
            <Feather name="home" size={size ?? 22} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="agenda"
        options={{
          title: "Agenda",
          tabBarIcon: ({ color, size }) => (
            <Feather name="send" size={size ?? 22} color={color} />
          ),
        }}
      />
      <Tabs.Screen name="diario" options={{ href: null }} />
      <Tabs.Screen
        name="plano-voo"
        options={{ href: null,
          title: "Plano",
          tabBarIcon: ({ color, size }) => (
            <Feather name="navigation" size={size ?? 22} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="financeiro"
        options={{
          title: "Despesas",
          tabBarIcon: ({ color, size }) => (
            <Feather name="file-text" size={size ?? 22} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="perfil"
        options={{
          title: "Perfil",
          tabBarIcon: ({ color, size }) => (
            <Feather name="user" size={size ?? 22} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}
