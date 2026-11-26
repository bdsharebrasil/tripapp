import { Icon, Toque } from "@/src/components/ui";
import { useMemo, useState } from "react";
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TextInput,
  type TextInputProps,
  View,
} from "react-native";
import { Cores, VooSolicitacao, formatarData } from "./modelo";
import { mStyles } from "./NovoPlanoModal";

export function Campo({
  rotulo,
  colors,
  multilinha,
  ...entrada
}: { rotulo: string; colors: Cores; multilinha?: boolean } & TextInputProps) {
  return (
    <View style={mStyles.campo}>
      <Text style={[mStyles.label, { color: colors.foreground }]}>
        {rotulo}
      </Text>
      <TextInput
        placeholderTextColor={colors.mutedForeground}
        style={[
          mStyles.input,
          multilinha && mStyles.textarea,
          {
            backgroundColor: colors.card,
            color: colors.foreground,
            borderColor: colors.border,
          },
        ]}
        {...entrada}
      />
    </View>
  );
}

export function SeletorSolicitacao({
  voos,
  carregando,
  erro,
  valor,
  onChangeText,
  onSelecionar,
  colors,
}: {
  voos: VooSolicitacao[];
  carregando: boolean;
  erro: string;
  valor: string;
  onChangeText: (valor: string) => void;
  onSelecionar: (voo: VooSolicitacao) => void;
  colors: Cores;
}) {
  const [aberto, setAberto] = useState(false);
  const termo = valor.trim().toUpperCase();
  const resultados = useMemo(
    () =>
      voos
        .filter((voo) => voo.numero_voo.toUpperCase().includes(termo))
        .slice(0, 10),
    [voos, termo],
  );

  const escolher = (voo: VooSolicitacao) => {
    setAberto(false);
    onSelecionar(voo);
  };

  return (
    <View style={cStyles.wrap}>
      <Text style={[mStyles.label, { color: colors.foreground }]}>
        Número do voo
      </Text>
      <View
        style={[
          cStyles.caixa,
          { backgroundColor: colors.card, borderColor: colors.border },
        ]}
      >
        <TextInput
          accessibilityLabel="Número do voo"
          value={valor}
          onChangeText={(texto) => {
            onChangeText(texto.toUpperCase());
            setAberto(true);
          }}
          onFocus={() => setAberto(true)}
          onSubmitEditing={() => {
            const exato = voos.find(
              (voo) =>
                voo.numero_voo.trim().toUpperCase() ===
                valor.trim().toUpperCase(),
            );
            if (exato) escolher(exato);
            else setAberto(false);
          }}
          placeholder="Selecionar ou digitar número do voo"
          placeholderTextColor={colors.mutedForeground}
          autoCapitalize="characters"
          autoCorrect={false}
          style={[cStyles.input, { color: colors.foreground }]}
        />
        {carregando && (
          <ActivityIndicator size="small" color={colors.secondary} />
        )}
        <Toque
          accessibilityRole="button"
          accessibilityLabel={
            aberto ? "Ocultar solicitações" : "Mostrar solicitações"
          }
          onPress={() => setAberto((atual) => !atual)}
          style={cStyles.expandir}
        >
          <Icon
            name={aberto ? "chevron-up" : "chevron-down"}
            size={18}
            color={colors.mutedForeground}
          />
        </Toque>
      </View>
      {!!erro && (
        <Text style={[cStyles.msg, { color: colors.destructive }]}>{erro}</Text>
      )}
      {aberto && (
        <View
          style={[
            cStyles.lista,
            { backgroundColor: colors.card, borderColor: colors.border },
          ]}
        >
          {resultados.length ? (
            resultados.map((voo, i) => (
              <Toque
                key={`${voo.numero_voo}-${i}`}
                accessibilityRole="button"
                onPress={() => escolher(voo)}
                style={[cStyles.item, { borderBottomColor: colors.border }]}
              >
                <Text style={[cStyles.numero, { color: colors.foreground }]}>
                  {voo.numero_voo}
                </Text>
                <Text
                  style={[cStyles.detalhe, { color: colors.mutedForeground }]}
                >
                  {[voo.origem, voo.destino].filter(Boolean).join(" → ")}
                  {voo.data_agendada
                    ? ` · ${formatarData(voo.data_agendada.slice(0, 10))}`
                    : ""}
                </Text>
              </Toque>
            ))
          ) : (
            <Text style={[cStyles.msg, { color: colors.mutedForeground }]}>
              {carregando
                ? "Carregando solicitações…"
                : "Nenhuma solicitação encontrada. O número digitado pode ser usado manualmente."}
            </Text>
          )}
        </View>
      )}
    </View>
  );
}

export const cStyles = StyleSheet.create({
  wrap: { marginBottom: 10 },
  caixa: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 10,
    borderWidth: 1,
    paddingLeft: 10,
  },
  input: {
    flex: 1,
    paddingVertical: 10,
    fontSize: 14,
    fontFamily: "Inter_400Regular",
  },
  expandir: { padding: 10 },
  lista: {
    marginTop: 6,
    borderRadius: 10,
    borderWidth: 1,
    overflow: "hidden",
  },
  item: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  numero: { fontSize: 14, fontFamily: "Inter_700Bold" },
  detalhe: { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 2 },
  msg: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
});
