import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import React, { useMemo, useState } from "react";
import {
  FlatList,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useApp } from "@/context/AppContext";
import { useColors } from "@/hooks/useColors";

function formatDate(dateStr: string) {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" });
}

export default function RelatorioVooScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { flights } = useApp();
  const [activeFilter, setActiveFilter] = useState<"todos" | "pendente" | "confirmado" | "assinado">("todos");
  const topPadding = Platform.OS === "web" ? 67 : insets.top;

  const filtered = useMemo(() => {
    const sorted = [...flights].sort((a, b) => b.data.localeCompare(a.data));
    switch (activeFilter) {
      case "pendente": return sorted.filter((f) => !f.confirmado && !f.assinado);
      case "confirmado": return sorted.filter((f) => f.confirmado && !f.assinado);
      case "assinado": return sorted.filter((f) => f.assinado);
      default: return sorted;
    }
  }, [flights, activeFilter]);

  const stats = useMemo(() => ({
    total: flights.length,
    pendentes: flights.filter((f) => !f.confirmado && !f.assinado).length,
    confirmados: flights.filter((f) => f.confirmado && !f.assinado).length,
    assinados: flights.filter((f) => f.assinado).length,
    totalHoras: flights.reduce((acc, f) => acc + f.tempoVoo, 0),
  }), [flights]);

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: topPadding + 16, backgroundColor: colors.card, borderBottomColor: colors.border }]}>
        <Pressable onPress={() => router.back()} style={styles.closeBtn}>
          <Feather name="x" size={22} color={colors.foreground} />
        </Pressable>
        <Text style={[styles.title, { color: colors.foreground }]}>Relatórios de Voo</Text>
        <View style={{ width: 38 }} />
      </View>

      <View style={[styles.statsRow, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
        <View style={styles.statItem}>
          <Text style={[styles.statVal, { color: colors.foreground }]}>{stats.total}</Text>
          <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>Total</Text>
        </View>
        <View style={[styles.statItem, styles.statMiddle, { borderColor: colors.border }]}>
          <Text style={[styles.statVal, { color: colors.gold }]}>{stats.pendentes}</Text>
          <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>Pendentes</Text>
        </View>
        <View style={[styles.statItem, styles.statMiddle, { borderColor: colors.border }]}>
          <Text style={[styles.statVal, { color: colors.primary }]}>{stats.confirmados}</Text>
          <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>Confirmados</Text>
        </View>
        <View style={styles.statItem}>
          <Text style={[styles.statVal, { color: colors.success }]}>{stats.assinados}</Text>
          <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>Assinados</Text>
        </View>
      </View>

      <View style={[styles.filterBar, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
        {([
          ["todos", "Todos"],
          ["pendente", "Pendentes"],
          ["confirmado", "Confirmados"],
          ["assinado", "Assinados"],
        ] as [typeof activeFilter, string][]).map(([key, label]) => (
          <Pressable
            key={key}
            style={[styles.filterChip, activeFilter === key ? { backgroundColor: colors.primary } : { backgroundColor: colors.muted }]}
            onPress={() => setActiveFilter(key)}
          >
            <Text style={[styles.filterText, { color: activeFilter === key ? "#FFFFFF" : colors.mutedForeground }]}>
              {label}
            </Text>
          </Pressable>
        ))}
      </View>

      <FlatList
        data={filtered}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <View style={[styles.card, { backgroundColor: colors.card }]}>
            <View style={styles.cardTop}>
              <View style={styles.routeRow}>
                <Text style={[styles.iata, { color: colors.primary }]}>{item.partida}</Text>
                <Feather name="arrow-right" size={14} color={colors.mutedForeground} style={{ marginHorizontal: 6 }} />
                <Text style={[styles.iata, { color: colors.primary }]}>{item.chegada}</Text>
              </View>
              <View style={styles.statusBadges}>
                {item.assinado ? (
                  <View style={[styles.badge, { backgroundColor: "#DCFCE7" }]}>
                    <Feather name="check-circle" size={11} color="#16A34A" />
                    <Text style={[styles.badgeText, { color: "#16A34A" }]}>Assinado</Text>
                  </View>
                ) : item.confirmado ? (
                  <View style={[styles.badge, { backgroundColor: "#DBEAFE" }]}>
                    <Feather name="check" size={11} color="#2563EB" />
                    <Text style={[styles.badgeText, { color: "#2563EB" }]}>Confirmado</Text>
                  </View>
                ) : (
                  <View style={[styles.badge, { backgroundColor: "#FEF9C3" }]}>
                    <Feather name="clock" size={11} color="#CA8A04" />
                    <Text style={[styles.badgeText, { color: "#CA8A04" }]}>Pendente</Text>
                  </View>
                )}
              </View>
            </View>
            <Text style={[styles.aircraft, { color: colors.mutedForeground }]}>{item.aeronave} · {item.matricula}</Text>
            <View style={styles.detailRow}>
              <View style={styles.detail}>
                <Feather name="calendar" size={11} color={colors.mutedForeground} />
                <Text style={[styles.detailText, { color: colors.mutedForeground }]}>{formatDate(item.data)}</Text>
              </View>
              <View style={styles.detail}>
                <Feather name="clock" size={11} color={colors.mutedForeground} />
                <Text style={[styles.detailText, { color: colors.mutedForeground }]}>{item.tempoVoo.toFixed(2)}h</Text>
              </View>
              <View style={styles.detail}>
                <Feather name="sun" size={11} color={colors.mutedForeground} />
                <Text style={[styles.detailText, { color: colors.mutedForeground }]}>{item.horasDiurnas.toFixed(2)}D · {item.horasNoturnas.toFixed(2)}N</Text>
              </View>
            </View>
            <View style={[styles.divider, { backgroundColor: colors.border }]} />
            <View style={styles.footerRow}>
              <Text style={[styles.footerText, { color: colors.mutedForeground }]}>
                PIC: {item.picCanac}{item.sicCanac ? ` · SIC: ${item.sicCanac}` : ""} · {item.naturezaVoo.split(" ")[0]}
              </Text>
              {!item.assinado && (
                <Pressable
                  style={[styles.signBtn, { backgroundColor: item.confirmado ? colors.primary : colors.muted }]}
                  onPress={() => {
                    if (!item.confirmado) {
                      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
                      return;
                    }
                    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                  }}
                  disabled={!item.confirmado}
                >
                  <Feather name="edit-3" size={12} color={item.confirmado ? "#FFFFFF" : colors.mutedForeground} />
                  <Text style={[styles.signBtnText, { color: item.confirmado ? "#FFFFFF" : colors.mutedForeground }]}>
                    {item.confirmado ? "Assinar" : "Aguard. confirmação"}
                  </Text>
                </Pressable>
              )}
            </View>
          </View>
        )}
        contentContainerStyle={[styles.list, { paddingBottom: Platform.OS === "web" ? 84 + 34 : 40 }]}
        scrollEnabled={!!filtered.length}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Feather name="send" size={40} color={colors.mutedForeground} />
            <Text style={[styles.emptyTitle, { color: colors.foreground }]}>Nenhum voo encontrado</Text>
            <Text style={[styles.emptySub, { color: colors.mutedForeground }]}>
              {activeFilter !== "todos" ? "Tente outro filtro" : "Adicione voos no Diário de Bordo"}
            </Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 16, paddingBottom: 16, borderBottomWidth: 1 },
  closeBtn: { padding: 4 },
  title: { fontSize: 18, fontFamily: "Inter_700Bold" },
  statsRow: { flexDirection: "row", borderBottomWidth: 1, paddingVertical: 12 },
  statItem: { flex: 1, alignItems: "center" },
  statMiddle: { borderLeftWidth: 1 },
  statVal: { fontSize: 20, fontFamily: "Inter_700Bold" },
  statLabel: { fontSize: 11, fontFamily: "Inter_400Regular", marginTop: 3 },
  filterBar: { flexDirection: "row", gap: 8, paddingHorizontal: 16, paddingVertical: 10, borderBottomWidth: 1 },
  filterChip: { borderRadius: 100, paddingHorizontal: 12, paddingVertical: 7 },
  filterText: { fontSize: 12, fontFamily: "Inter_500Medium" },
  list: { padding: 16 },
  card: {
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  cardTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 4 },
  routeRow: { flexDirection: "row", alignItems: "center" },
  iata: { fontSize: 20, fontFamily: "Inter_700Bold" },
  statusBadges: { flexDirection: "row", gap: 6 },
  badge: { flexDirection: "row", alignItems: "center", gap: 4, borderRadius: 100, paddingHorizontal: 8, paddingVertical: 4 },
  badgeText: { fontSize: 11, fontFamily: "Inter_500Medium" },
  aircraft: { fontSize: 12, fontFamily: "Inter_400Regular", marginBottom: 8 },
  detailRow: { flexDirection: "row", gap: 12, flexWrap: "wrap" },
  detail: { flexDirection: "row", alignItems: "center", gap: 4 },
  detailText: { fontSize: 12, fontFamily: "Inter_400Regular" },
  divider: { height: 1, marginVertical: 10 },
  footerRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  footerText: { flex: 1, fontSize: 12, fontFamily: "Inter_400Regular" },
  signBtn: { flexDirection: "row", alignItems: "center", gap: 6, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 7 },
  signBtnText: { fontSize: 12, fontFamily: "Inter_500Medium" },
  empty: { alignItems: "center", paddingTop: 60, gap: 8 },
  emptyTitle: { fontSize: 16, fontFamily: "Inter_600SemiBold", marginTop: 8 },
  emptySub: { fontSize: 13, fontFamily: "Inter_400Regular", textAlign: "center" },
});
