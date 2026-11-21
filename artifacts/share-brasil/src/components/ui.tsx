import { Feather } from "@expo/vector-icons";
import React from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
  type ViewStyle,
} from "react-native";

export const tema = {
  fundo: "#0c0e12",
  superficie: "#191d24",
  elevado: "#252b34",
  borda: "#343c47",
  azul: "#a9bdce",
  texto: "#f4f8ff",
  suave: "#9ba5b2",
  verde: "#74dcb3",
  perigo: "#ff9da6",
};
export type Icone = React.ComponentProps<typeof Feather>["name"];
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
        <Pressable
          accessibilityLabel="Voltar"
          accessibilityRole="button"
          onPress={voltar}
          style={u.icon}
        >
          <Feather name="arrow-left" size={21} color={tema.texto} />
        </Pressable>
      )}
      <View style={{ flex: 1 }}>
        <Text style={u.kicker}>{apoio}</Text>
        <Text style={u.title}>{titulo}</Text>
      </View>
      {acao && (
        <Pressable
          accessibilityLabel={
            icone === "refresh-cw" ? "Atualizar dados" : "Abrir notificações"
          }
          accessibilityRole="button"
          onPress={acao}
          style={u.icon}
        >
          <Feather name={icone} size={20} color={tema.texto} />
        </Pressable>
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
}: {
  texto: string;
  icone?: Icone;
  onPress: () => void;
  secundario?: boolean;
  carregando?: boolean;
  disabled?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: disabled || carregando }}
      disabled={disabled || carregando}
      onPress={onPress}
      style={({ pressed }) => [
        u.button,
        secundario && u.secondary,
        (disabled || carregando) && { opacity: 0.45 },
        pressed && { opacity: 0.75 },
      ]}
    >
      {carregando ? (
        <ActivityIndicator color={tema.texto} />
      ) : (
        icone && (
          <Feather
            name={icone}
            size={18}
            color={secundario ? tema.azul : tema.fundo}
          />
        )
      )}
      <Text style={[u.buttonText, secundario && { color: tema.azul }]}>
        {texto}
      </Text>
    </Pressable>
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
        <Pressable accessibilityRole="button" onPress={onPress} hitSlop={12}>
          <Text style={u.link}>{acao}</Text>
        </Pressable>
      )}
    </View>
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
        <Feather name={icone} size={24} color={tema.azul} />
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
    <Pressable accessibilityRole="button" onPress={atualizar} style={u.error}>
      <Feather name="alert-circle" size={18} color={tema.perigo} />
      <View style={{ flex: 1 }}>
        <Text style={u.errorText}>{mensagem}</Text>
        <Text style={[u.link, { marginTop: 6 }]}>Tentar novamente</Text>
      </View>
    </Pressable>
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
        alerta && { color: tema.perigo, backgroundColor: "#3b2332" },
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
  style?: ViewStyle;
}) {
  return <View style={[u.panel, style]}>{children}</View>;
}
export const u = StyleSheet.create({
  root: { flex: 1, backgroundColor: tema.fundo },
  header: {
    flexDirection: "row",
    gap: 12,
    alignItems: "center",
    paddingHorizontal: 22,
    paddingTop: 14,
    paddingBottom: 20,
  },
  title: {
    fontSize: 28,
    fontFamily: "Inter_700Bold",
    letterSpacing: -0.8,
    color: tema.texto,
    marginTop: 6,
  },
  kicker: {
    fontSize: 10,
    letterSpacing: 2,
    fontFamily: "Inter_600SemiBold",
    color: tema.azul,
    textTransform: "uppercase",
  },
  icon: {
    width: 44,
    height: 44,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: tema.borda,
    backgroundColor: tema.superficie,
    alignItems: "center",
    justifyContent: "center",
  },
  panel: {
    padding: 18,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: tema.borda,
    backgroundColor: tema.superficie,
    marginBottom: 12,
  },
  button: {
    minHeight: 52,
    borderRadius: 15,
    paddingHorizontal: 16,
    backgroundColor: tema.azul,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 9,
  },
  secondary: {
    backgroundColor: tema.elevado,
    borderWidth: 1,
    borderColor: tema.borda,
  },
  buttonText: { fontSize: 14, fontFamily: "Inter_700Bold", color: tema.fundo },
  section: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 22,
    marginBottom: 13,
    gap: 12,
  },
  sectionText: {
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
    color: tema.texto,
  },
  link: { fontSize: 12, fontFamily: "Inter_600SemiBold", color: tema.azul },
  badge: {
    fontSize: 10,
    fontFamily: "Inter_600SemiBold",
    color: tema.verde,
    backgroundColor: "#153b38",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 7,
    textTransform: "uppercase",
    overflow: "hidden",
  },
  empty: {
    padding: 26,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: tema.borda,
    backgroundColor: tema.superficie,
    alignItems: "center",
    gap: 10,
    marginBottom: 12,
  },
  emptyIcon: { padding: 12, borderRadius: 16, backgroundColor: tema.elevado },
  emptyTitle: {
    color: tema.texto,
    fontFamily: "Inter_600SemiBold",
    fontSize: 15,
    textAlign: "center",
  },
  note: {
    color: tema.suave,
    fontSize: 12,
    lineHeight: 19,
    textAlign: "center",
  },
  error: {
    padding: 15,
    marginHorizontal: 20,
    marginBottom: 12,
    flexDirection: "row",
    gap: 10,
    borderRadius: 15,
    backgroundColor: "#301e2c",
    borderWidth: 1,
    borderColor: "#643b4b",
  },
  errorText: { color: tema.perigo, fontSize: 13, lineHeight: 20 },
});
