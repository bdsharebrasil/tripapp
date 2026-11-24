import { Icon, Toque } from "@/src/components/ui";
import { useState } from "react";
import {
  ActivityIndicator,
  Platform,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Clima, Cores, corMetar } from "./modelo";

export function CartaoClima({
  icao,
  dados,
  carregando,
  colors,
}: {
  icao: string;
  dados: Clima | null;
  carregando: boolean;
  colors: Cores;
}) {
  const [expandido, setExpandido] = useState(false);

  return (
    <View style={[wStyles.card, { backgroundColor: colors.card }]}>
      <Toque style={wStyles.header} onPress={() => setExpandido((v) => !v)}>
        <View style={wStyles.titleRow}>
          <View
            style={[wStyles.dot, { backgroundColor: corMetar(dados?.metar) }]}
          />
          <Text style={[wStyles.icao, { color: colors.foreground }]}>
            {icao}
          </Text>
          {carregando && (
            <ActivityIndicator
              size="small"
              color={colors.secondary}
              style={{ marginLeft: 8 }}
            />
          )}
        </View>
        <Icon
          name={expandido ? "chevron-up" : "chevron-down"}
          size={16}
          color={colors.mutedForeground}
        />
      </Toque>

      {dados?.error ? (
        <Text style={[wStyles.errorText, { color: colors.destructive }]}>
          {dados.error}
        </Text>
      ) : dados?.metar ? (
        <>
          <View style={[wStyles.metarBox, { backgroundColor: colors.muted }]}>
            <Text style={[wStyles.label, { color: colors.mutedForeground }]}>
              METAR
            </Text>
            <Text
              style={[wStyles.raw, { color: colors.foreground }]}
              selectable
            >
              {dados.metar}
            </Text>
          </View>
          {expandido && dados.taf ? (
            <View
              style={[
                wStyles.metarBox,
                { backgroundColor: colors.muted, marginTop: 6 },
              ]}
            >
              <Text style={[wStyles.label, { color: colors.mutedForeground }]}>
                TAF
              </Text>
              <Text
                style={[wStyles.raw, { color: colors.foreground }]}
                selectable
              >
                {dados.taf}
              </Text>
            </View>
          ) : null}
          {!expandido && (
            <Text style={[wStyles.tapHint, { color: colors.mutedForeground }]}>
              {dados.taf ? "Toque para ver TAF" : "Sem TAF disponível"}
            </Text>
          )}
        </>
      ) : !carregando ? (
        <Text style={[wStyles.errorText, { color: colors.mutedForeground }]}>
          Sem dados meteorológicos
        </Text>
      ) : null}
    </View>
  );
}

export const wStyles = StyleSheet.create({
  card: { borderRadius: 12, padding: 12, marginBottom: 10 },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  titleRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  dot: { width: 10, height: 10, borderRadius: 5 },
  icao: { fontSize: 15, fontFamily: "Inter_700Bold" },
  metarBox: { borderRadius: 8, padding: 10 },
  label: {
    fontSize: 10,
    fontFamily: "Inter_600SemiBold",
    letterSpacing: 1,
    marginBottom: 4,
  },
  raw: {
    fontSize: 12,
    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
    lineHeight: 18,
  },
  tapHint: { fontSize: 11, fontFamily: "Inter_400Regular", marginTop: 6 },
  errorText: { fontSize: 12, fontFamily: "Inter_400Regular" },
});
