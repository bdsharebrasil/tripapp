import React from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
  type PressableProps,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { SafeAreaView, type Edge } from "react-native-safe-area-context";
import { vibrar, type Haptico } from "../lib/haptics";
import { Icon, type Icone } from "./Icone";

export { Icon, type Icone };

export const tema = {
  fundo: "#0A1020",
  superficie: "#141C2F",
  elevado: "#1E2841",
  borda: "#252F48",
  azul: "#3563E9",
  destaque: "#F4C542",
  texto: "#F2F4FA",
  suave: "#98A2BC",
  verde: "#6FCF97",
  perigo: "#FF8A8A",
  sobreDestaque: "#0A1020",
};

export type ToqueProps = PressableProps & {
  haptico?: Haptico | false;
};

/** Pressable com feedback visual suave (opacidade + escala) e háptico. */
export function Toque({
  haptico = "leve",
  onPress,
  style,
  disabled,
  ...rest
}: ToqueProps) {
  return (
    <Pressable
      {...rest}
      disabled={disabled}
      onPress={
        onPress
          ? (event) => {
              if (haptico) vibrar(haptico);
              onPress(event);
            }
          : undefined
      }
      style={(state) => [
        typeof style === "function" ? style(state) : style,
        state.pressed && !disabled && u.pressionado,
      ]}
    />
  );
}

/** Raiz de tela com área segura (notch, barra de status e Dynamic Island). */
export function Tela({
  children,
  style,
  edges = ["top"],
}: {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  edges?: Edge[];
}) {
  return (
    <SafeAreaView edges={edges} style={[u.root, style]}>
      {children}
    </SafeAreaView>
  );
}

export function BotaoIcone({
  icone,
  rotulo,
  onPress,
  destaque,
}: {
  icone: Icone;
  rotulo: string;
  onPress: () => void;
  destaque?: boolean;
}) {
  return (
    <Toque
      accessibilityLabel={rotulo}
      accessibilityRole="button"
      hitSlop={6}
      onPress={onPress}
      style={[u.icon, destaque && { backgroundColor: tema.destaque }]}
    >
      <Icon
        name={icone}
        size={20}
        color={destaque ? tema.sobreDestaque : tema.texto}
      />
    </Toque>
  );
}

export function Cabecalho({
  titulo,
  apoio,
  icone = "refresh-cw",
  acao,
  voltar,
}: {
  titulo: string;
  apoio: string;
  icone?: Icone;
  acao?: () => void;
  voltar?: () => void;
}) {
  return (
    <View style={u.header}>
      {voltar && (
        <BotaoIcone icone="chevron-left" rotulo="Voltar" onPress={voltar} />
      )}
      <View style={{ flex: 1 }}>
        <Text style={u.kicker} numberOfLines={1}>
          {apoio}
        </Text>
        <Text style={u.title} numberOfLines={2}>
          {titulo}
        </Text>
      </View>
      {acao && (
        <BotaoIcone
          icone={icone}
          rotulo={
            icone === "refresh-cw" ? "Atualizar dados" : "Abrir notificações"
          }
          onPress={acao}
        />
      )}
    </View>
  );
}

export function Botao({
  texto,
  icone,
  onPress,
  secundario,
  carregando,
  disabled,
  style,
}: {
  texto: string;
  icone?: Icone;
  onPress: () => void;
  secundario?: boolean;
  carregando?: boolean;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const cor = secundario ? tema.texto : tema.sobreDestaque;
  return (
    <Toque
      haptico="medio"
      accessibilityRole="button"
      accessibilityState={{ disabled: disabled || carregando }}
      disabled={disabled || carregando}
      onPress={onPress}
      style={[
        u.button,
        secundario && u.secondary,
        (disabled || carregando) && { opacity: 0.45 },
        style,
      ]}
    >
      {carregando ? (
        <ActivityIndicator color={cor} />
      ) : (
        icone && <Icon name={icone} size={19} color={cor} />
      )}
      <Text style={[u.buttonText, { color: cor }]}>{texto}</Text>
    </Toque>
  );
}

export function Secao({
  titulo,
  acao,
  onPress,
}: {
  titulo: string;
  acao?: string;
  onPress?: () => void;
}) {
  return (
    <View style={u.section}>
      <Text style={u.sectionText}>{titulo}</Text>
      {acao && (
        <Toque
          haptico="selecao"
          accessibilityRole="button"
          onPress={onPress}
          hitSlop={12}
          style={u.linkRow}
        >
          <Text style={u.link}>{acao}</Text>
          <Icon name="chevron-right" size={14} color={tema.destaque} />
        </Toque>
      )}
    </View>
  );
}

/** Linha de lista nativa: ícone em pastilha, título, apoio e chevron. */
export function ItemLista({
  icone,
  titulo,
  apoio,
  direita,
  onPress,
  ultimo,
  cor = tema.destaque,
}: {
  icone?: Icone;
  titulo: string;
  apoio?: string;
  direita?: React.ReactNode;
  onPress?: () => void;
  ultimo?: boolean;
  cor?: string;
}) {
  return (
    <Toque
      accessibilityRole={onPress ? "button" : undefined}
      disabled={!onPress}
      onPress={onPress}
      style={[u.item, !ultimo && u.itemDivisor]}
    >
      {icone && (
        <View style={[u.itemIcone, { backgroundColor: cor + "1F" }]}>
          <Icon name={icone} size={18} color={cor} />
        </View>
      )}
      <View style={{ flex: 1, gap: 3 }}>
        <Text style={u.itemTitulo} numberOfLines={1}>
          {titulo}
        </Text>
        {!!apoio && (
          <Text style={u.itemApoio} numberOfLines={2}>
            {apoio}
          </Text>
        )}
      </View>
      {direita}
      {onPress && <Icon name="chevron-right" size={18} color={tema.suave} />}
    </Toque>
  );
}

export function Vazio({
  icone = "inbox",
  titulo,
  texto,
}: {
  icone?: Icone;
  titulo: string;
  texto?: string;
}) {
  return (
    <View style={u.empty}>
      <View style={u.emptyIcon}>
        <Icon name={icone} size={24} color={tema.destaque} />
      </View>
      <Text style={u.emptyTitle}>{titulo}</Text>
      {texto && <Text style={u.note}>{texto}</Text>}
    </View>
  );
}

export function ErroConsulta({
  mensagem,
  atualizar,
}: {
  mensagem: string;
  atualizar: () => void;
}) {
  return (
    <Toque accessibilityRole="button" onPress={atualizar} style={u.error}>
      <Icon name="alert-circle" size={18} color={tema.perigo} />
      <View style={{ flex: 1 }}>
        <Text style={u.errorText}>{mensagem}</Text>
        <Text style={[u.link, { marginTop: 6 }]}>Tentar novamente</Text>
      </View>
    </Toque>
  );
}

export function Etiqueta({
  texto,
  alerta,
}: {
  texto: string;
  alerta?: boolean;
}) {
  return (
    <Text
      style={[
        u.badge,
        alerta && { color: tema.perigo, backgroundColor: "#FF8A8A1F" },
      ]}
    >
      {texto.replace(/_/g, " ")}
    </Text>
  );
}

export function Painel({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  return <View style={[u.panel, style]}>{children}</View>;
}

export const u = StyleSheet.create({
  root: { flex: 1, backgroundColor: tema.fundo },
  pressionado: { opacity: 0.82, transform: [{ scale: 0.98 }] },
  header: {
    flexDirection: "row",
    gap: 12,
    alignItems: "center",
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 18,
  },
  title: {
    fontSize: 30,
    lineHeight: 36,
    fontFamily: "Inter_700Bold",
    letterSpacing: -0.8,
    color: tema.texto,
    marginTop: 2,
  },
  kicker: {
    fontSize: 12,
    letterSpacing: 0.6,
    fontFamily: "Inter_500Medium",
    color: tema.suave,
    textTransform: "uppercase",
  },
  icon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: tema.elevado,
    alignItems: "center",
    justifyContent: "center",
  },
  panel: {
    padding: 18,
    borderRadius: 22,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: tema.borda,
    backgroundColor: tema.superficie,
    marginBottom: 12,
  },
  button: {
    minHeight: 56,
    borderRadius: 16,
    paddingHorizontal: 20,
    backgroundColor: tema.destaque,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
  },
  secondary: { backgroundColor: tema.elevado },
  buttonText: {
    fontSize: 16,
    fontFamily: "Inter_600SemiBold",
    color: tema.sobreDestaque,
  },
  section: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 28,
    marginBottom: 12,
    gap: 12,
  },
  sectionText: {
    fontSize: 18,
    fontFamily: "Inter_700Bold",
    letterSpacing: -0.3,
    color: tema.texto,
  },
  linkRow: { flexDirection: "row", alignItems: "center", gap: 2 },
  link: { fontSize: 14, fontFamily: "Inter_500Medium", color: tema.destaque },
  item: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    paddingVertical: 14,
    minHeight: 64,
  },
  itemDivisor: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: tema.borda,
  },
  itemIcone: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  itemTitulo: {
    color: tema.texto,
    fontFamily: "Inter_600SemiBold",
    fontSize: 16,
  },
  itemApoio: { color: tema.suave, fontSize: 13, lineHeight: 18 },
  badge: {
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
    color: tema.verde,
    backgroundColor: "#6FCF971F",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    textTransform: "uppercase",
    letterSpacing: 0.3,
    overflow: "hidden",
  },
  empty: {
    padding: 28,
    borderRadius: 22,
    backgroundColor: tema.superficie,
    alignItems: "center",
    gap: 10,
    marginBottom: 12,
  },
  emptyIcon: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: tema.elevado,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyTitle: {
    color: tema.texto,
    fontFamily: "Inter_600SemiBold",
    fontSize: 16,
    textAlign: "center",
  },
  note: {
    color: tema.suave,
    fontSize: 14,
    lineHeight: 20,
    textAlign: "center",
  },
  error: {
    padding: 16,
    marginHorizontal: 20,
    marginBottom: 12,
    flexDirection: "row",
    gap: 12,
    borderRadius: 18,
    backgroundColor: "#FF8A8A14",
  },
  errorText: { color: tema.perigo, fontSize: 14, lineHeight: 20 },
});
