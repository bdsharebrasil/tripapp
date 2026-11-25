import React, { useEffect, useRef, useState } from "react";
import { Tabs, useRouter, useSegments, type Href } from "expo-router";
import {
  AccessibilityInfo,
  Animated,
  Easing,
  Keyboard,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Icon, Toque, type Icone } from "./ui";

type Props = Parameters<
  NonNullable<React.ComponentProps<typeof Tabs>["tabBar"]>
>[0];

const CORES = {
  barra: "#10152B",
  amarelo: "#F5CE3E",
  bordaCentral: "#FFFFFF",
  iconeInativo: "#8E96B0",
};

const ORDEM_ROTAS = [
  "agenda",
  "diario",
  "index",
  "plano-voo",
  "perfil",
] as const;

const itens: Record<string, { titulo: string; icone: Icone }> = {
  agenda: { titulo: "Voos", icone: "send" },
  diario: { titulo: "Diário", icone: "file-text" },
  index: { titulo: "Início", icone: "home" },
  "plano-voo": { titulo: "Plano", icone: "navigation" },
  perfil: { titulo: "Perfil", icone: "user" },
};

function Item({
  titulo,
  icone,
  isHome,
  ativo,
  reduzir,
  onPress,
}: {
  titulo: string;
  icone: Icone;
  isHome: boolean;
  ativo: boolean;
  reduzir: boolean;
  onPress: () => void;
}) {
  const anim = useRef(new Animated.Value(ativo ? 1 : 0)).current;

  useEffect(() => {
    const run = Animated.timing(anim, {
      toValue: ativo ? 1 : 0,
      duration: reduzir ? 0 : 200,
      easing: Easing.bezier(0.23, 1, 0.32, 1),
      useNativeDriver: true,
    });
    run.start();
    return () => run.stop();
  }, [ativo, reduzir, anim]);

  const homeScale = anim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.96, 1.03],
  });

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
      {isHome ? (
        <View style={s.homeSlot}>
          <Animated.View
            style={[
              s.homeOuter,
              ativo && s.homeOuterAtivo,
              { transform: [{ scale: homeScale }] },
            ]}
          >
            <View style={s.homeInner}>
              <Icon
                name={icone}
                size={25}
                strokeWidth={2.5}
                color={CORES.barra}
              />
            </View>
          </Animated.View>
        </View>
      ) : (
        <View style={s.iconWrap}>
          <Icon
            name={icone}
            size={22}
            strokeWidth={ativo ? 2.4 : 1.9}
            color={ativo ? CORES.amarelo : CORES.iconeInativo}
          />
        </View>
      )}

      <Text
        numberOfLines={1}
        style={[s.label, ativo && s.labelAtivo]}
      >
        {titulo}
      </Text>
    </Toque>
  );
}

export function MenuInferiorGlobal() {
  const router = useRouter();
  const segments: readonly string[] = useSegments();
  const insets = useSafeAreaInsets();
  const [keyboard, setKeyboard] = useState(false);
  const [reduzir, setReduzir] = useState(true);

  useEffect(() => {
    let active = true;
    void AccessibilityInfo.isReduceMotionEnabled().then((v) => {
      if (active) setReduzir(v);
    });
    const show = Keyboard.addListener("keyboardDidShow", () => setKeyboard(true));
    const hide = Keyboard.addListener("keyboardDidHide", () => setKeyboard(false));
    return () => {
      active = false;
      show.remove();
      hide.remove();
    };
  }, []);

  if (keyboard) return null;

  const raiz = String(segments[0] || "");
  const segunda = String(segments[1] || "");
  let selected = "index";
  if (raiz === "(tabs)") {
    selected = itens[segunda] ? segunda : "index";
  } else if (["diario-bordo", "novo-lancamento", "relatorio-viagem", "relatorio-voo"].includes(raiz)) {
    selected = "diario";
  } else if (raiz === "plano-voo") {
    selected = "plano-voo";
  } else if (["perfil", "minhas-horas", "ferias"].includes(raiz)) {
    selected = "perfil";
  } else if (raiz === "agenda" || raiz === "criar-agendamento") {
    selected = "agenda";
  }

  return (
    <View
      accessibilityRole="tablist"
      style={[s.bar, { zIndex: 1000, elevation: 1000, paddingBottom: Math.max(10, insets.bottom) }]}
    >
      <View style={s.items}>
        {ORDEM_ROTAS.map((nome) => (
          <Item
            key={nome}
            {...itens[nome]}
            isHome={nome === "index"}
            ativo={nome === selected}
            reduzir={reduzir}
            onPress={() => {
              if (nome !== selected) {
                const path = nome === "index" ? "/(tabs)" : `/(tabs)/${nome}`;
                router.navigate(path as Href);
              }
            }}
          />
        ))}
      </View>
    </View>
  );
}

export function MenuInferior({ state }: Props) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [keyboard, setKeyboard] = useState(false);
  const [reduzir, setReduzir] = useState(true);

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

  const rotas = ORDEM_ROTAS.map((nome) =>
    state.routes.find((r) => r.name === nome),
  ).filter((r): r is (typeof state.routes)[number] => Boolean(r));

  const selected = state.routes[state.index]?.name ?? "index";
  const visible = itens[selected] ? selected : "index";

  return (
    <View
      accessibilityRole="tablist"
      style={[s.bar, { paddingBottom: Math.max(10, insets.bottom) }]}
    >
      <View style={s.items}>
        {rotas.map((route) => (
          <Item
            key={route.key}
            {...itens[route.name]}
            isHome={route.name === "index"}
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
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  bar: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    paddingTop: 10,
    paddingHorizontal: 10,
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    backgroundColor: CORES.barra,
    overflow: "visible",
    shadowColor: "#000000",
    shadowOpacity: 0.22,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: -6 },
    elevation: 16,
  },
  items: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    overflow: "visible",
  },
  item: {
    flex: 1,
    minHeight: 54,
    alignItems: "center",
    justifyContent: "flex-end",
    gap: 4,
    overflow: "visible",
  },
  iconWrap: {
    width: 32,
    height: 30,
    alignItems: "center",
    justifyContent: "center",
  },
  homeSlot: {
    width: 68,
    height: 30,
    alignItems: "center",
    justifyContent: "flex-end",
    overflow: "visible",
  },
  homeOuter: {
    width: 66,
    height: 66,
    borderRadius: 33,
    marginBottom: 2,
    backgroundColor: CORES.bordaCentral,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000000",
    shadowOpacity: 0.16,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 10,
  },
  homeOuterAtivo: {
    shadowOpacity: 0,
    shadowRadius: 0,
    elevation: 0,
  },
  homeInner: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: "rgba(233, 217, 57, 1)",
    alignItems: "center",
    justifyContent: "center",
  },
  label: {
    color: CORES.iconeInativo,
    fontFamily: "Inter_600SemiBold",
    fontSize: 11,
    lineHeight: 14,
  },
  labelAtivo: {
    color: CORES.amarelo,
  },
});
