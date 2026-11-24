import React, { useEffect, useRef, useState } from "react";
import { Tabs, useRouter, type Href } from "expo-router";
import {
  AccessibilityInfo,
  Animated,
  Easing,
  Keyboard,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Icon, Toque, tema, type Icone } from "./ui";

type Props = Parameters<
  NonNullable<React.ComponentProps<typeof Tabs>["tabBar"]>
>[0];
const itens: Record<string, { titulo: string; icone: Icone }> = {
  index: { titulo: "Início", icone: "home" },
  agenda: { titulo: "Meus voos", icone: "send" },
  "plano-voo": { titulo: "Plano de voo", icone: "map" },
  "despesa-viagem": { titulo: "Despesas", icone: "file-text" },
  diario: { titulo: "Diário", icone: "book-open" },
  manutencao: { titulo: "Manutenção", icone: "tool" },
  financeiro: { titulo: "Financeiro", icone: "credit-card" },
  perfil: { titulo: "Perfil", icone: "user" },
};
const LARGURA_ITEM = 76;
function Item({
  titulo,
  icone,
  ativo,
  reduzir,
  onPress,
}: {
  titulo: string;
  icone: Icone;
  ativo: boolean;
  reduzir: boolean;
  onPress: () => void;
}) {
  const anim = useRef(new Animated.Value(ativo ? 1 : 0)).current;
  useEffect(() => {
    const run = Animated.timing(anim, {
      toValue: ativo ? 1 : 0,
      duration: reduzir ? 0 : 220,
      easing: Easing.bezier(0.23, 1, 0.32, 1),
      useNativeDriver: true,
    });
    run.start();
    return () => run.stop();
  }, [ativo, reduzir, anim]);
  return (
    <Toque
      haptico="selecao"
      accessibilityRole="tab"
      accessibilityLabel={titulo}
      accessibilityState={{ selected: ativo }}
      aria-selected={ativo}
      onPress={onPress}
      style={s.item}
    >
      <View style={s.iconWrap}>
        <Animated.View
          style={[
            StyleSheet.absoluteFill,
            s.indicador,
            { opacity: anim, transform: [{ scaleX: anim }] },
          ]}
        />
        <Icon
          name={icone}
          size={22}
          strokeWidth={ativo ? 2.4 : 2}
          color={ativo ? tema.destaque : tema.suave}
        />
      </View>
      <Text numberOfLines={1} style={[s.label, ativo && { color: tema.texto }]}>
        {titulo}
      </Text>
    </Toque>
  );
}
export function MenuInferior({ state }: Props) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const scroll = useRef<React.ComponentRef<typeof ScrollView>>(null);
  const [largura, setLargura] = useState(0);
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
  const rotas = state.routes.filter((r) => itens[r.name]);
  const selected = state.routes[state.index].name;
  const visible = itens[selected] ? selected : "agenda";
  const indice = rotas.findIndex((r) => r.name === visible);
  useEffect(() => {
    if (keyboard || !largura || indice < 0) return;
    const x = indice * LARGURA_ITEM - (largura - LARGURA_ITEM) / 2;
    scroll.current?.scrollTo({ x: Math.max(0, x), animated: !reduzir });
  }, [indice, largura, reduzir, keyboard]);
  if (keyboard) return null;
  return (
    <View
      accessibilityRole="tablist"
      style={[s.bar, { paddingBottom: Math.max(8, insets.bottom) }]}
      onLayout={(e) => setLargura(e.nativeEvent.layout.width)}
    >
      <ScrollView
        ref={scroll}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={[
          s.items,
          largura >= rotas.length * LARGURA_ITEM && {
            flexGrow: 1,
            justifyContent: "space-around",
          },
        ]}
      >
        {rotas.map((route) => (
          <Item
            key={route.key}
            {...itens[route.name]}
            ativo={route.name === visible}
            reduzir={reduzir}
            onPress={() => {
              if (route.name !== selected) {
                const path =
                  route.name === "index" ? "/(tabs)" : `/(tabs)/${route.name}`;
                router.navigate(path as Href);
              }
            }}
          />
        ))}
      </ScrollView>
    </View>
  );
}
const s = StyleSheet.create({
  bar: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    paddingTop: 8,
    backgroundColor: tema.superficie,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: tema.borda,
  },
  items: { flexDirection: "row", alignItems: "center" },
  item: {
    width: LARGURA_ITEM,
    minHeight: 56,
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
  },
  iconWrap: {
    width: 60,
    height: 32,
    alignItems: "center",
    justifyContent: "center",
  },
  indicador: { borderRadius: 16, backgroundColor: tema.destaque + "26" },
  label: {
    color: tema.suave,
    fontFamily: "Inter_600SemiBold",
    fontSize: 11,
  },
});
