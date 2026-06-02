import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import React, { useMemo, useState } from "react";
import {
  Alert,
  FlatList,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useApp } from "@/context/AppContext";
import { useColors } from "@/hooks/useColors";
import type { FlightEntry } from "@/context/AppContext";

function formatDate(dateStr: string) {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" });
}

function StatusBadge({ confirmado, assinado, colors }: { confirmado: boolean; assinado: boolean; colors: ReturnType<typeof useColors> }) {
  if (assinado) {
    return (
      <View style={[styles.badge, { backgroundColor: "#DCFCE7" }]}>
        <Feather name="check-circle" size={11} color="#16A34A" />
        <Text style={[styles.badgeText, { color: "#16A34A" }]}>Assinado</Text>
      </View>
    );
  }
  if (confirmado) {
    return (
      <View style={[styles.badge, { backgroundColor: "#DBEAFE" }]}>
        <Feather name="check" size={11} color="#2563EB" />
        <Text style={[styles.badgeText, { color: "#2563EB" }]}>Confirmado</Text>
      </View>
    );
  }
  return (
    <View style={[styles.badge, { backgroundColor: "#FEF9C3" }]}>
      <Feather name="clock" size={11} color="#CA8A04" />
      <Text style={[styles.badgeText, { color: "#CA8A04" }]}>Pendente</Text>
    </View>
  );
}

function FlightCard({ item, onDelete, colors }: { item: FlightEntry; onDelete: (id: string) => void; colors: ReturnType<typeof useColors> }) {
  const handleLongPress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    Alert.alert(
      "Excluir lançamento",
      "Deseja remover este lançamento do diário?",
      [
        { text: "Cancelar", style: "cancel" },
        { text: "Excluir", style: "destructive", onPress: () => onDelete(item.id) },
      ]
    );
  };

  return (
    <Pressable
      style={[flightCardStyles.card, { backgroundColor: colors.card }]}
      onLongPress={handleLongPress}
    >
      <View style={flightCardStyles.top}>
        <View style={flightCardStyles.routeRow}>
          <Text style={[flightCardStyles.iata, { color: colors.primary }]}>{item.partida}</Text>
          <View style={flightCardStyles.arrow}>
            <Feather name="arrow-right" size={14} color={colors.mutedForeground} />
          </View>
          <Text style={[flightCardStyles.iata, { color: colors.primary }]}>{item.chegada}</Text>
        </View>
        <StatusBadge confirmado={item.confirmado} assinado={item.assinado} colors={colors} />
      </View>
      <Text style={[flightCardStyles.aircraft, { color: colors.mutedForeground }]}>
        {item.aeronave} · {item.matricula}
      </Text>
      <View style={flightCardStyles.detailRow}>
        <View style={flightCardStyles.detail}>
          <Feather name="calendar" size={12} color={colors.mutedForeground} />
          <Text style={[flightCardStyles.detailText, { color: colors.mutedForeground }]}>{formatDate(item.data)}</Text>
        </View>
        <View style={flightCardStyles.detail}>
          <Feather name="clock" size={12} color={colors.mutedForeground} />
          <Text style={[flightCardStyles.detailText, { color: colors.mutedForeground }]}>{item.tempoVoo.toFixed(2)}h voo</Text>
        </View>
        <View style={flightCardStyles.detail}>
          <Feather name="sun" size={12} color={colors.mutedForeground} />
          <Text style={[flightCardStyles.detailText, { color: colors.mutedForeground }]}>{item.horasDiurnas.toFixed(2)}D / {item.horasNoturnas.toFixed(2)}N</Text>
        </View>
      </View>
      <View style={[flightCardStyles.divider, { backgroundColor: colors.border }]} />
      <View style={flightCardStyles.bottomRow}>
        <Text style={[flightCardStyles.bottomText, { color: colors.mutedForeground }]}>
          PIC: {item.picCanac}{item.sicCanac ? ` · SIC: ${item.sicCanac}` : ""}
        </Text>
        <Text style={[flightCardStyles.natureza, { color: colors.mutedForeground }]}>{item.naturezaVoo.split(" ")[0]}</Text>
      </View>
    </Pressable>
  );
}

const flightCardStyles = StyleSheet.create({
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
  top: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 4 },
  routeRow: { flexDirection: "row", alignItems: "center" },
  iata: { fontSize: 20, fontFamily: "Inter_700Bold" },
  arrow: { marginHorizontal: 8 },
  aircraft: { fontSize: 12, fontFamily: "Inter_400Regular", marginBottom: 8 },
  detailRow: { flexDirection: "row", gap: 12, flexWrap: "wrap" },
  detail: { flexDirection: "row", alignItems: "center", gap: 4 },
  detailText: { fontSize: 12, fontFamily: "Inter_400Regular" },
  divider: { height: 1, marginVertical: 10 },
  bottomRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  bottomText: { fontSize: 12, fontFamily: "Inter_400Regular" },
  natureza: { fontSize: 11, fontFamily: "Inter_500Medium" },
});

export default function DiarioScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { flights, deleteFlight } = useApp();
  const [search, setSearch] = useState("");
  const [filterMonth, setFilterMonth] = useState<number | null>(null);

  const filtered = useMemo(() => {
    let result = [...flights].sort((a, b) => b.data.localeCompare(a.data));
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(
        (f) =>
          f.partida.toLowerCase().includes(q) ||
          f.chegada.toLowerCase().includes(q) ||
          f.matricula.toLowerCase().includes(q) ||
          f.cliente.toLowerCase().includes(q) ||
          f.trecho.toLowerCase().includes(q)
      );
    }
    if (filterMonth !== null) {
      result = result.filter((f) => new Date(f.data + "T00:00:00").getMonth() === filterMonth);
    }
    return result;
  }, [flights, search, filterMonth]);

  const totalHours = useMemo(() => filtered.reduce((acc, f) => acc + f.tempoVoo, 0), [filtered]);

  const topPadding = Platform.OS === "web" ? 67 : insets.top;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: topPadding + 16, backgroundColor: colors.card, borderBottomColor: colors.border }]}>
        <View style={styles.headerRow}>
          <Text style={[styles.title, { color: colors.foreground }]}>Diário de Bordo</Text>
          <Pressable
            style={[styles.addBtn, { backgroundColor: colors.primary }]}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              router.push("/novo-lancamento" as any);
            }}
          >
            <Feather name="plus" size={20} color="#FFFFFF" />
          </Pressable>
        </View>
        <View style={[styles.searchBox, { backgroundColor: colors.muted }]}>
          <Feather name="search" size={16} color={colors.mutedForeground} />
          <TextInput
            style={[styles.searchInput, { color: colors.foreground }]}
            placeholder="Buscar por rota, matrícula..."
            placeholderTextColor={colors.mutedForeground}
            value={search}
            onChangeText={setSearch}
          />
          {search.length > 0 && (
            <Pressable onPress={() => setSearch("")}>
              <Feather name="x" size={16} color={colors.mutedForeground} />
            </Pressable>
          )}
        </View>
        {filtered.length > 0 && (
          <Text style={[styles.summary, { color: colors.mutedForeground }]}>
            {filtered.length} voo{filtered.length !== 1 ? "s" : ""} · {totalHours.toFixed(2)}h total
          </Text>
        )}
      </View>

      <FlatList
        data={filtered}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <FlightCard item={item} onDelete={deleteFlight} colors={colors} />
        )}
        contentContainerStyle={[
          styles.list,
          { paddingBottom: Platform.OS === "web" ? 84 + 34 : 80 },
        ]}
        scrollEnabled={filtered.length > 0}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Feather name="book-open" size={40} color={colors.mutedForeground} />
            <Text style={[styles.emptyTitle, { color: colors.foreground }]}>Nenhum lançamento encontrado</Text>
            <Text style={[styles.emptySub, { color: colors.mutedForeground }]}>
              {search ? "Tente outro termo de busca" : "Toque em + para adicionar o primeiro voo"}
            </Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
  },
  headerRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 },
  title: { fontSize: 24, fontFamily: "Inter_700Bold" },
  addBtn: { width: 38, height: 38, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  searchBox: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 8,
    marginBottom: 8,
  },
  searchInput: { flex: 1, fontSize: 14, fontFamily: "Inter_400Regular" },
  summary: { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 4 },
  list: { padding: 16 },
  badge: { flexDirection: "row", alignItems: "center", gap: 4, borderRadius: 100, paddingHorizontal: 8, paddingVertical: 4 },
  badgeText: { fontSize: 11, fontFamily: "Inter_500Medium" },
  empty: { alignItems: "center", paddingTop: 60, gap: 8 },
  emptyTitle: { fontSize: 16, fontFamily: "Inter_600SemiBold", marginTop: 8 },
  emptySub: { fontSize: 13, fontFamily: "Inter_400Regular", textAlign: "center" },
});
