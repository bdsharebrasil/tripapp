import { Icon, Toque } from "@/src/components/ui";
import { StyleSheet, Text, View } from "react-native";
import { Cores, PlanoVoo, STATUS_CONFIG, formatarData } from "./modelo";

export function CartaoPlano({
  plano,
  onAbrir,
  onExcluir,
  colors,
}: {
  plano: PlanoVoo;
  onAbrir: () => void;
  onExcluir: () => void;
  colors: Cores;
}) {
  const cfg = STATUS_CONFIG[plano.status];
  return (
    <Toque
      style={[
        pStyles.card,
        { backgroundColor: colors.card, borderColor: colors.border },
      ]}
      onPress={onAbrir}
    >
      <View style={pStyles.top}>
        <View style={pStyles.routeRow}>
          <Text style={[pStyles.iata, { color: colors.foreground }]}>
            {plano.partida}
          </Text>
          <Icon
            name="arrow-right"
            size={16}
            color={colors.mutedForeground}
            style={{ marginHorizontal: 8 }}
          />
          <Text style={[pStyles.iata, { color: colors.secondary }]}>
            {plano.chegada}
          </Text>
        </View>
        <View style={[pStyles.badge, { backgroundColor: `${cfg.color}26` }]}>
          <Text style={[pStyles.badgeText, { color: cfg.color }]}>
            {cfg.label}
          </Text>
        </View>
      </View>
      {!!plano.numeroVoo && (
        <Text style={[pStyles.flightNumber, { color: colors.secondary }]}>
          Voo {plano.numeroVoo}
        </Text>
      )}
      <Text style={[pStyles.aircraft, { color: colors.mutedForeground }]}>
        {plano.aeronave || "Aeronave não informada"}
        {plano.matricula ? ` · Matrícula ${plano.matricula}` : ""}
      </Text>
      <View style={pStyles.detailRow}>
        <View style={pStyles.detail}>
          <Icon name="calendar" size={12} color={colors.mutedForeground} />
          <Text style={[pStyles.detailText, { color: colors.mutedForeground }]}>
            {formatarData(plano.data)}
          </Text>
        </View>
        <View style={pStyles.detail}>
          <Icon name="clock" size={12} color={colors.mutedForeground} />
          <Text style={[pStyles.detailText, { color: colors.mutedForeground }]}>
            {plano.horaPrevista || "—"} · {plano.estimativaVoo || "—"}h
          </Text>
        </View>
        <View style={pStyles.detail}>
          <Icon name="users" size={12} color={colors.mutedForeground} />
          <Text style={[pStyles.detailText, { color: colors.mutedForeground }]}>
            {plano.passageiros} pax
          </Text>
        </View>
      </View>
      {plano.piloto || plano.copiloto ? (
        <View style={[pStyles.crewRow, { backgroundColor: colors.muted }]}>
          <Icon name="user" size={12} color={colors.mutedForeground} />
          <Text style={[pStyles.crewText, { color: colors.mutedForeground }]}>
            {plano.piloto}
            {plano.copiloto ? ` / ${plano.copiloto}` : ""}
          </Text>
        </View>
      ) : null}
      <View style={pStyles.actions}>
        <View style={pStyles.tapHintRow}>
          <Icon name="map" size={12} color={colors.mutedForeground} />
          <Text style={[pStyles.tapHint, { color: colors.mutedForeground }]}>
            Ver rota e meteorologia
          </Text>
        </View>
        <Toque
          accessibilityRole="button"
          accessibilityLabel="Excluir plano de voo"
          style={[pStyles.deleteBtn, { backgroundColor: colors.muted }]}
          onPress={onExcluir}
        >
          <Icon name="trash-2" size={13} color={colors.destructive} />
        </Toque>
      </View>
    </Toque>
  );
}

export const pStyles = StyleSheet.create({
  card: {
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 14,
    marginBottom: 10,
  },
  top: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 4,
  },
  routeRow: { flexDirection: "row", alignItems: "center" },
  iata: { fontSize: 20, fontFamily: "Inter_700Bold" },
  flightNumber: { fontSize: 12, fontFamily: "Inter_600SemiBold", marginTop: 3 },
  aircraft: { fontSize: 12, fontFamily: "Inter_400Regular", marginBottom: 8 },
  badge: { borderRadius: 100, paddingHorizontal: 10, paddingVertical: 4 },
  badgeText: { fontSize: 11, fontFamily: "Inter_500Medium" },
  detailRow: {
    flexDirection: "row",
    gap: 12,
    flexWrap: "wrap",
    marginBottom: 8,
  },
  detail: { flexDirection: "row", alignItems: "center", gap: 4 },
  detailText: { fontSize: 12, fontFamily: "Inter_400Regular" },
  crewRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderRadius: 8,
    padding: 8,
    marginBottom: 8,
  },
  crewText: { fontSize: 12, fontFamily: "Inter_400Regular" },
  actions: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  tapHintRow: { flexDirection: "row", alignItems: "center", gap: 4 },
  tapHint: { fontSize: 11, fontFamily: "Inter_400Regular" },
  deleteBtn: {
    width: 34,
    height: 34,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
});
