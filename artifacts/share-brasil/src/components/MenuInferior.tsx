import React, { useEffect, useRef, useState } from "react";
import { Tabs } from "expo-router";
import { Feather } from "@expo/vector-icons";
import {
  AccessibilityInfo,
  Animated,
  Easing,
  Keyboard,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { tema, type Icone } from "./ui";

type Props = Parameters<
  NonNullable<React.ComponentProps<typeof Tabs>["tabBar"]>
>[0];
const itens: Record<string, { titulo: string; icone: Icone }> = {
  index: { titulo: "Início", icone: "home" },
  agenda: { titulo: "Meus voos", icone: "send" },
  financeiro: { titulo: "Despesas", icone: "file-text" },
  perfil: { titulo: "Perfil", icone: "user" },
};
function Item({
  titulo,
  icone,
  ativo,
  reduzir,
  onPress,
  onLongPress,
}: {
  titulo: string;
  icone: Icone;
  ativo: boolean;
  reduzir: boolean;
  onPress: () => void;
  onLongPress: () => void;
}) {
  const anim = useRef(new Animated.Value(ativo ? 1 : 0)).current;
  useEffect(() => {
    const run = Animated.timing(anim, {
      toValue: ativo ? 1 : 0,
      duration: reduzir ? 0 : 260,
      easing: Easing.bezier(0.23, 1, 0.32, 1),
      useNativeDriver: false,
    });
    run.start();
    return () => run.stop();
  }, [ativo, reduzir, anim]);
  return (
    <Animated.View
      style={{
        flexBasis: 0,
        minWidth: 44,
        flexGrow: anim.interpolate({
          inputRange: [0, 1],
          outputRange: [1, 2.5],
        }),
      }}
    >
      <Pressable
        accessibilityRole="tab"
        accessibilityLabel={titulo}
        accessibilityState={{ selected: ativo }}
        aria-selected={ativo}
        onPress={onPress}
        onLongPress={onLongPress}
        style={({ pressed }) => [
          s.item,
          { backgroundColor: ativo ? tema.azul : tema.elevado },
          pressed && { opacity: 0.75 },
        ]}
      >
        <Feather
          name={icone}
          size={21}
          color={ativo ? tema.texto : tema.suave}
        />
        <Animated.View
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          style={{
            overflow: "hidden",
            flexShrink: 1,
            maxWidth: anim.interpolate({
              inputRange: [0, 1],
              outputRange: [0, 82],
            }),
            opacity: anim,
            marginLeft: anim.interpolate({
              inputRange: [0, 1],
              outputRange: [0, 8],
            }),
          }}
        >
          {ativo && (
            <Text numberOfLines={1} style={s.label}>
              {titulo}
            </Text>
          )}
        </Animated.View>
      </Pressable>
    </Animated.View>
  );
}
export function MenuInferior({ state, navigation }: Props) {
  const insets = useSafeAreaInsets();
  const [keyboard, setKeyboard] = useState(false),
    [reduzir, setReduzir] = useState(true);
  useEffect(() => {
    let active = true;
    void AccessibilityInfo.isReduceMotionEnabled().then((v) => {
      if (active) setReduzir(v);
    });
    const motion = AccessibilityInfo.addEventListener(
      "reduceMotionChanged",
      setReduzir,
    );
    const show = Keyboard.addListener("keyboardDidShow", () =>
      setKeyboard(true),
    );
    const hide = Keyboard.addListener("keyboardDidHide", () =>
      setKeyboard(false),
    );
    return () => {
      active = false;
      motion.remove();
      show.remove();
      hide.remove();
    };
  }, []);
  if (keyboard) return null;
  const selected = state.routes[state.index].name;
  const visible = itens[selected] ? selected : "agenda";
  return (
    <View
      accessibilityRole="tablist"
      style={[s.bar, { bottom: Math.max(10, insets.bottom) }]}
    >
      {state.routes
        .filter((r) => itens[r.name])
        .map((route) => {
          const item = itens[route.name],
            ativo = route.name === visible;
          return (
            <Item
              key={route.key}
              {...item}
              ativo={ativo}
              reduzir={reduzir}
              onPress={() => {
                const event = navigation.emit({
                  type: "tabPress",
                  target: route.key,
                  canPreventDefault: true,
                });
                if (route.name !== selected && !event.defaultPrevented)
                  navigation.navigate(route.name, route.params);
              }}
              onLongPress={() =>
                navigation.emit({ type: "tabLongPress", target: route.key })
              }
            />
          );
        })}
    </View>
  );
}
const s = StyleSheet.create({
  bar: {
    position: "absolute",
    left: 15,
    right: 15,
    padding: 8,
    gap: 6,
    flexDirection: "row",
    backgroundColor: tema.superficie,
    borderWidth: 1,
    borderColor: tema.borda,
    borderRadius: 32,
    elevation: 0,
  },
  item: {
    height: 48,
    borderRadius: 24,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 10,
  },
  label: { color: tema.texto, fontFamily: "Inter_600SemiBold", fontSize: 12 },
});
