import { Tabs } from "expo-router";
import { Feather } from "@expo/vector-icons";
import React from "react";
import { View, type ColorValue } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { tema, type Icone } from "@/src/components/ui";
export default function TabLayout() {
  const insets = useSafeAreaInsets();
  const icon = (name: Icone, color: ColorValue, focused: boolean) => (
    <View
      style={{
        width: 43,
        height: 29,
        borderRadius: 10,
        backgroundColor: focused ? "#303b46" : "transparent",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Feather name={name} size={19} color={color} />
    </View>
  );
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: tema.azul,
        tabBarInactiveTintColor: tema.suave,
        tabBarHideOnKeyboard: true,
        tabBarStyle: {
          position: "absolute",
          bottom: Math.max(10, insets.bottom),
          left: 15,
          right: 15,
          height: 70,
          paddingTop: 7,
          paddingBottom: 9,
          backgroundColor: "#191d24",
          borderWidth: 1,
          borderTopWidth: 1,
          borderColor: tema.borda,
          borderRadius: 24,
          elevation: 0,
        },
        tabBarLabelStyle: { fontFamily: "Inter_600SemiBold", fontSize: 10 },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Início",
          tabBarIcon: ({ color, focused }) => icon("home", color, focused),
        }}
      />
      <Tabs.Screen
        name="agenda"
        options={{
          title: "Meus voos",
          tabBarIcon: ({ color, focused }) => icon("send", color, focused),
        }}
      />
      <Tabs.Screen
        name="financeiro"
        options={{
          title: "Despesas",
          tabBarIcon: ({ color, focused }) => icon("file-text", color, focused),
        }}
      />
      <Tabs.Screen
        name="perfil"
        options={{
          title: "Perfil",
          tabBarIcon: ({ color, focused }) => icon("user", color, focused),
        }}
      />
      <Tabs.Screen name="diario" options={{ href: null }} />
      <Tabs.Screen name="plano-voo" options={{ href: null }} />
    </Tabs>
  );
}
