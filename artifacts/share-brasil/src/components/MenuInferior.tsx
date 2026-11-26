import React, { useEffect, useRef, useState } from "react";
import { useRouter, useSegments, type Href } from "expo-router";
import { Tabs } from "expo-router/js-tabs";
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
  barra: "#0E1424",
  borda: "rgba(255, 255, 255, 0.10)",
  pilula: "#FFFFFF",
  pilulaOculta: "rgba(255, 255, 255, 0)",
  textoAtivo: "#10152B",
  iconeInativo: "#9AA3BC",
  homeAtivo: "#2F70E8",
};

const ORDEM_ROTAS = [
  "agenda",
  "diario",
  "index",
  "plano-voo",
  "perfil",
] as const;

const itens: Record<string, { titulo: string; icone: Icone }> = {
  agenda: { titulo: "Voos", icone: "airplane" },
  diario: { titulo: "Diário", icone: "file-text" },
  index: { titulo: "Início", icone: "home" },
  "plano-voo": { titulo: "Plano", icone: "navigation" },
  perfil: { titulo: "Perfil", icone: "user" },
};

function Item({
  titulo,
  icone,
  ativo,
  destaqueHome = false,
  reduzir,
  onPress,
}: {
  titulo: string;
  icone: Icone;
  ativo: boolean;
  destaqueHome?: boolean;
  reduzir: boolean;
  onPress: () => void;
}) {
  const anim = useRef(new Animated.Value(ativo ? 1 : 0)).current;
  const [larguraTexto, setLarguraTexto] = useState(0);

  useEffect(() => {
    const run = Animated.timing(anim, {
      toValue: ativo ? 1 : 0,
      duration: reduzir ? 0 : 280,
      easing: Easing.bezier(0.23, 1, 0.32, 1),
      // width/padding/backgroundColor não suportam o driver nativo
      useNativeDriver: false,
    });
    run.start();
    return () => run.stop();
  }, [ativo, reduzir, anim]);

  const larguraLabel = anim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, larguraTexto],
  });
  const margemLabel = anim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 8],
  });
  const paddingPilula = anim.interpolate({
    inputRange: [0, 1],
    outputRange: [11, 18],
  });
  const fundoPilula = anim.interpolate({
    inputRange: [0, 1],
    outputRange: [
      CORES.pilulaOculta,
      destaqueHome ? CORES.homeAtivo : CORES.pilula,
    ],
  });
  const escalaPilula = anim.interpolate({
    inputRange: [0, 1],
    outputRange: [1, destaqueHome ? 1.08 : 1],
  });
  const elevacaoHome = anim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, destaqueHome ? -5 : 0],
  });
  const opacidadeLabel = anim.interpolate({
    inputRange: [0, 0.4, 1],
    outputRange: [0, 0, 1],
  });
  const corDestaqueHome = destaqueHome && ativo;
  const corIcone = ativo
    ? corDestaqueHome
      ? "#FFFFFF"
      : CORES.textoAtivo
    : CORES.iconeInativo;

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
      {/* Medidor invisível: descobre a largura real do texto */}
      <Text
        style={[s.label, s.medidor]}
        numberOfLines={1}
        onLayout={(e) =>
          setLarguraTexto(Math.ceil(e.nativeEvent.layout.width) + 2)
        }
      >
        {titulo}
      </Text>

      <Animated.View
        style={[
          s.pilula,
          corDestaqueHome && s.pilulaHomeAtiva,
          {
            backgroundColor: fundoPilula,
            paddingHorizontal: paddingPilula,
            transform: [
              { translateY: elevacaoHome },
              { scale: escalaPilula },
            ],
          },
        ]}
      >
        <Icon
          name={icone}
          size={22}
          strokeWidth={ativo ? 2.4 : 2}
          color={corIcone}
        />
        <Animated.View
          style={[
            s.labelWrap,
            { width: larguraLabel, marginLeft: margemLabel },
          ]}
        >
          <Animated.Text
            numberOfLines={1}
            style={[
              s.label,
              {
                width: larguraTexto,
                opacity: opacidadeLabel,
                color: corDestaqueHome ? "#FFFFFF" : CORES.textoAtivo,
              },
            ]}
          >
            {titulo}
          </Animated.Text>
        </Animated.View>
      </Animated.View>
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
    const motion = AccessibilityInfo.addEventListener(
      "reduceMotionChanged",
      setReduzir,
    );
    const show = Keyboard.addListener("keyboardDidShow", () => setKeyboard(true));
    const hide = Keyboard.addListener("keyboardDidHide", () => setKeyboard(false));
    return () => {
      active = false;
      motion.remove();
      show.remove();
      hide.remove();
    };
  }, []);

  if (keyboard) return null;

  const raiz = String(segments[0] || "");
  const segunda = segments
    .slice(1)
    .find((segment) => Boolean(itens[String(segment)]));
  let selected = "";
  if (raiz === "(tabs)") {
    selected = segunda
      ? String(segunda)
      : segments.length === 1
        ? "index"
        : "";
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
      style={[
        s.bar,
        { zIndex: 1000, elevation: 1000, bottom: Math.max(12, insets.bottom) },
      ]}
    >
      <View style={s.items}>
        {ORDEM_ROTAS.map((nome) => (
          <Item
            key={nome}
            {...itens[nome]}
            ativo={nome === selected}
            destaqueHome={nome === "index"}
            reduzir={reduzir}
            onPress={() => {
              if (nome === "index") {
                router.replace("/(tabs)" as Href);
              } else if (nome !== selected) {
                router.navigate(`/(tabs)/${nome}` as Href);
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

  const selected = state.routes[state.index]?.name ?? "";
  const visible = itens[selected] ? selected : "";

  return (
    <View
      accessibilityRole="tablist"
      style={[s.bar, { bottom: Math.max(12, insets.bottom) }]}
    >
      <View style={s.items}>
        {rotas.map((route) => (
          <Item
            key={route.key}
            {...itens[route.name]}
            ativo={route.name === visible}
            destaqueHome={route.name === "index"}
            reduzir={reduzir}
            onPress={() => {
              if (route.name === "index") {
                router.replace("/(tabs)" as Href);
              } else if (route.name !== selected) {
                router.navigate(`/(tabs)/${route.name}` as Href);
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
    left: 16,
    right: 16,
    padding: 8,
    borderRadius: 999,
    backgroundColor: CORES.barra,
    borderWidth: 1,
    borderColor: CORES.borda,
    shadowColor: "#000000",
    shadowOpacity: 0.3,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 16,
  },
  items: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  item: {
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  pilula: {
    height: 44,
    minWidth: 44,
    borderRadius: 999,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  pilulaHomeAtiva: {
    borderWidth: 1,
    borderColor: "#285DBB",
    shadowColor: "#000000",
    shadowOpacity: 0.3,
    shadowRadius: 5,
    shadowOffset: { width: 0, height: 4 },
    elevation: 7,
  },
  labelWrap: {
    overflow: "hidden",
    justifyContent: "center",
  },
  label: {
    color: CORES.textoAtivo,
    fontFamily: "Inter_600SemiBold",
    fontSize: 14,
    lineHeight: 18,
  },
  medidor: {
    position: "absolute",
    opacity: 0,
    left: 0,
    top: 0,
  },
});