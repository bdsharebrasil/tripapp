import { Feather } from "@expo/vector-icons";
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
import type { FinancialEntry } from "@/context/AppContext";

function formatCurrency(val: number) {
  return val.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function formatDate(dateStr: string) {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" });
}

const TIPO_CONFIG = {
  salario: { label: "Salário", icon: "briefcase" as const, color: "#2563EB", bg: "#DBEAFE" },
  ressarcimento: { label: "Ressarcimento", icon: "file-text" as const, color: "#D97706", bg: "#FEF3C7" },
  diaria: { label: "Diária", icon: "sun" as const, color: "#7C3AED", bg: "#EDE9FE" },
  bonus: { label: "Bônus", icon: "star" as const, color: "#16A34A", bg: "#DCFCE7" },
};

function FinancialCard({ item, colors }: { item: FinancialEntry; colors: ReturnType<typeof useColors> }) {
  const cfg = TIPO_CONFIG[item.tipo];
  return (
    <View style={[fStyles.card, { backgroundColor: colors.card }]}>
      <View style={[fStyles.icon, { backgroundColor: cfg.bg }]}>
        <Feather name={cfg.icon} size={18} color={cfg.color} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[fStyles.desc, { color: colors.foreground }]} numberOfLines={1}>{item.descricao}</Text>
        <Text style={[fStyles.date, { color: colors.mutedForeground }]}>{formatDate(item.data)}{item.referencia ? ` · ${item.referencia}` : ""}</Text>
      </View>
      <View style={{ alignItems: "flex-end" }}>
        <Text style={[fStyles.valor, { color: item.status === "pendente" ? colors.gold : colors.success }]}>
          {formatCurrency(item.valor)}
        </Text>
        <View style={[fStyles.badge, { backgroundColor: item.status === "pendente" ? "#FEF9C3" : "#DCFCE7" }]}>
          <Text style={[fStyles.badgeText, { color: item.status === "pendente" ? "#CA8A04" : "#16A34A" }]}>
            {item.status === "pendente" ? "Pendente" : "Pago"}
          </Text>
        </View>
      </View>
    </View>
  );
}

const fStyles = StyleSheet.create({
  card: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  icon: { width: 40, height: 40, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  desc: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  date: { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 2 },
  valor: { fontSize: 16, fontFamily: "Inter_700Bold" },
  badge: { borderRadius: 100, paddingHorizontal: 8, paddingVertical: 3, marginTop: 4 },
  badgeText: { fontSize: 11, fontFamily: "Inter_500Medium" },
});

const FILTERS = ["Todos", "Salário", "Ressarcimento", "Diária", "Bônus"] as const;
const FILTER_MAP: Record<string, FinancialEntry["tipo"] | null> = {
  Todos: null,
  Salário: "salario",
  Ressarcimento: "ressarcimento",
  Diária: "diaria",
  Bônus: "bonus",
};

export default function FinanceiroScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { financialEntries, travelReports } = useApp();
  const [activeFilter, setActiveFilter] = useState<string>("Todos");

  const topPadding = Platform.OS === "web" ? 67 : insets.top;

  const filtered = useMemo(() => {
    const tipo = FILTER_MAP[activeFilter];
    if (!tipo) return [...financialEntries].sort((a, b) => b.data.localeCompare(a.data));
    return [...financialEntries].filter((f) => f.tipo === tipo).sort((a, b) => b.data.localeCompare(a.data));
  }, [financialEntries, activeFilter]);

  const summary = useMemo(() => {
    const totalRecebido = financialEntries.filter((f) => f.status === "pago").reduce((acc, f) => acc + f.valor, 0);
    const totalPendente = financialEntries.filter((f) => f.status === "pendente").reduce((acc, f) => acc + f.valor, 0);
    const relPendentes = travelReports.filter((r) => r.status === "enviado").length;
    const relDevolvidos = travelReports.filter((r) => r.status === "devolvido").length;
    return { totalRecebido, totalPendente, relPendentes, relDevolvidos };
  }, [financialEntries, travelReports]);

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: topPadding + 16, backgroundColor: colors.card, borderBottomColor: colors.border }]}>
        <Text style={[styles.title, { color: colors.foreground }]}>Financeiro</Text>
        <View style={styles.summaryCards}>
          <View style={[styles.summaryCard, { backgroundColor: "#EFF6FF" }]}>
            <Text style={[styles.summaryLabel, { color: "#3B82F6" }]}>Recebido</Text>
            <Text style={[styles.summaryValue, { color: "#1D4ED8" }]}>{formatCurrency(summary.totalRecebido)}</Text>
          </View>
          <View style={[styles.summaryCard, { backgroundColor: "#FEF9C3" }]}>
            <Text style={[styles.summaryLabel, { color: "#CA8A04" }]}>A Receber</Text>
            <Text style={[styles.summaryValue, { color: "#B45309" }]}>{formatCurrency(summary.totalPendente)}</Text>
          </View>
        </View>
        {(summary.relPendentes > 0 || summary.relDevolvidos > 0) && (
          <View style={[styles.relAlert, { backgroundColor: "#FFFBEB", borderColor: "#FDE68A" }]}>
            <Feather name="info" size={14} color="#D97706" />
            <Text style={[styles.relAlertText, { color: "#92400E" }]}>
              {summary.relPendentes > 0 ? `${summary.relPendentes} relatório(s) em análise` : ""}
              {summary.relPendentes > 0 && summary.relDevolvidos > 0 ? " · " : ""}
              {summary.relDevolvidos > 0 ? `${summary.relDevolvidos} devolvido(s) para correção` : ""}
            </Text>
          </View>
        )}
        <FlatList
          horizontal
          showsHorizontalScrollIndicator={false}
          data={FILTERS as unknown as string[]}
          keyExtractor={(item) => item}
          renderItem={({ item }) => (
            <Pressable
              style={[
                styles.filterChip,
                activeFilter === item
                  ? { backgroundColor: colors.primary }
                  : { backgroundColor: colors.muted },
              ]}
              onPress={() => setActiveFilter(item)}
            >
              <Text
                style={[
                  styles.filterText,
                  { color: activeFilter === item ? "#FFFFFF" : colors.mutedForeground },
                ]}
              >
                {item}
              </Text>
            </Pressable>
          )}
          contentContainerStyle={{ paddingTop: 12, gap: 8 }}
        />
      </View>

      <FlatList
        data={filtered}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => <FinancialCard item={item} colors={colors} />}
        contentContainerStyle={[
          styles.list,
          { paddingBottom: Platform.OS === "web" ? 84 + 34 : 80 },
        ]}
        scrollEnabled={!!filtered.length}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Feather name="dollar-sign" size={40} color={colors.mutedForeground} />
            <Text style={[styles.emptyTitle, { color: colors.foreground }]}>Nenhum lançamento</Text>
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
  title: { fontSize: 24, fontFamily: "Inter_700Bold", marginBottom: 14 },
  summaryCards: { flexDirection: "row", gap: 10, marginBottom: 10 },
  summaryCard: { flex: 1, borderRadius: 12, padding: 12 },
  summaryLabel: { fontSize: 12, fontFamily: "Inter_500Medium" },
  summaryValue: { fontSize: 18, fontFamily: "Inter_700Bold", marginTop: 4 },
  relAlert: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderRadius: 10,
    padding: 10,
    borderWidth: 1,
    marginBottom: 4,
  },
  relAlertText: { fontSize: 12, fontFamily: "Inter_400Regular", flex: 1 },
  filterChip: { borderRadius: 100, paddingHorizontal: 14, paddingVertical: 7 },
  filterText: { fontSize: 13, fontFamily: "Inter_500Medium" },
  list: { padding: 16 },
  empty: { alignItems: "center", paddingTop: 60, gap: 8 },
  emptyTitle: { fontSize: 16, fontFamily: "Inter_600SemiBold" },
});
