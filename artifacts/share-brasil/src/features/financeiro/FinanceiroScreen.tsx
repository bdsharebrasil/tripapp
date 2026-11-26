import { Feather } from "@expo/vector-icons";
import React, { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Platform,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useFocusEffect } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColors } from "@/hooks/useColors";
import { apiFetch } from "@/src/lib/api";
import {
  PagamentoFolha,
  RelatorioReembolso,
  Recebimento,
  agruparPorCompetencia,
  deFolha,
  deReembolso,
  moedaCentavos,
} from "./modelo";

function formatDate(dateStr: string) {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" });
}

const TIPO_CONFIG = {
  folha: { label: "Pagamento", icon: "briefcase" as const, color: "#2563EB", bg: "#DBEAFE" },
  reembolso: { label: "Reembolso", icon: "file-text" as const, color: "#D97706", bg: "#FEF3C7" },
};

function FinancialCard({ item, colors }: { item: Recebimento; colors: ReturnType<typeof useColors> }) {
  const cfg = TIPO_CONFIG[item.origem];
  return (
    <View style={[fStyles.card, { backgroundColor: colors.card }]}>
      <View style={[fStyles.icon, { backgroundColor: cfg.bg }]}>
        <Feather name={cfg.icon} size={18} color={cfg.color} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[fStyles.desc, { color: colors.foreground }]} numberOfLines={1}>{item.titulo}</Text>
        <Text style={[fStyles.date, { color: colors.mutedForeground }]}>{item.detalhe} · {formatDate(item.data)}</Text>
      </View>
      <View style={{ alignItems: "flex-end" }}>
        <Text style={[fStyles.valor, { color: item.situacao === "previsto" ? colors.gold : item.situacao === "cancelado" ? colors.mutedForeground : colors.success }]}>
          {moedaCentavos(item.valorCentavos)}
        </Text>
        <View style={[fStyles.badge, { backgroundColor: item.situacao === "previsto" ? "#FEF9C3" : item.situacao === "cancelado" ? colors.muted : "#DCFCE7" }]}>
          <Text style={[fStyles.badgeText, { color: item.situacao === "previsto" ? "#CA8A04" : item.situacao === "cancelado" ? colors.mutedForeground : "#16A34A" }]}>
            {item.situacao === "previsto" ? "Previsto" : item.situacao === "cancelado" ? "Cancelado" : "Recebido"}
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

const FILTERS = ["Todos", "Recebido", "Previsto", "Reembolsos"] as const;

export default function FinanceiroScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const [itens, setItens] = useState<Recebimento[]>([]);
  const [activeFilter, setActiveFilter] = useState<string>("Todos");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [erro, setErro] = useState("");

  const topPadding = Platform.OS === "web" ? 67 : insets.top;

  const carregar = useCallback(async (refresh = false) => {
    if (refresh) setRefreshing(true);
    else setLoading(true);
    setErro("");
    try {
      const resultados = await Promise.allSettled([
        apiFetch<{ pagamentos: PagamentoFolha[] }>("/api/colaborador/folha-pagamento"),
        apiFetch<{ relatorios: RelatorioReembolso[] }>("/api/financeiro/relatorios-despesa-viagem/minhas"),
      ]);
      const unidos: Recebimento[] = [];
      if (resultados[0].status === "fulfilled") {
        unidos.push(...(resultados[0].value.pagamentos || []).map(deFolha));
      }
      if (resultados[1].status === "fulfilled") {
        for (const relatorio of resultados[1].value.relatorios || []) {
          unidos.push(...deReembolso(relatorio));
        }
      }
      if (resultados.some((x) => x.status === "rejected")) {
        setErro("Alguns dados financeiros não puderam ser atualizados.");
      }
      setItens(unidos);
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível consultar o financeiro.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { void carregar(); }, [carregar]));

  const filtrados = useMemo(() => {
    if (activeFilter === "Recebido") return itens.filter((x) => x.situacao === "recebido");
    if (activeFilter === "Previsto") return itens.filter((x) => x.situacao === "previsto");
    if (activeFilter === "Reembolsos") return itens.filter((x) => x.origem === "reembolso");
    return itens;
  }, [itens, activeFilter]);

  const summary = useMemo(() => {
    const recebido = itens.filter((x) => x.situacao === "recebido").reduce((sum, x) => sum + x.valorCentavos, 0);
    const previsto = itens.filter((x) => x.situacao === "previsto").reduce((sum, x) => sum + x.valorCentavos, 0);
    return { recebido, previsto };
  }, [itens]);

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}> 
      <View style={[styles.header, { paddingTop: topPadding + 16, backgroundColor: colors.card, borderBottomColor: colors.border }]}> 
        <Text style={[styles.title, { color: colors.foreground }]}>Financeiro</Text>
        <View style={styles.summaryCards}>
          <View style={[styles.summaryCard, { backgroundColor: "#EFF6FF" }]}> 
            <Text style={[styles.summaryLabel, { color: "#3B82F6" }]}>Recebido</Text>
            <Text style={[styles.summaryValue, { color: "#1D4ED8" }]}>{moedaCentavos(summary.recebido)}</Text>
          </View>
          <View style={[styles.summaryCard, { backgroundColor: "#FEF9C3" }]}> 
            <Text style={[styles.summaryLabel, { color: "#CA8A04" }]}>A Receber</Text>
            <Text style={[styles.summaryValue, { color: "#B45309" }]}>{moedaCentavos(summary.previsto)}</Text>
          </View>
        </View>
        {!!erro && (
          <View style={[styles.relAlert, { backgroundColor: "#FFFBEB", borderColor: "#FDE68A" }]}> 
            <Feather name="info" size={14} color="#D97706" />
            <Text style={[styles.relAlertText, { color: "#92400E" }]}>{erro}</Text>
          </View>
        )}
        <FlatList
          horizontal
          showsHorizontalScrollIndicator={false}
          data={[...FILTERS]}
          keyExtractor={(item) => item}
          renderItem={({ item }) => (
            <Pressable
              style={[styles.filterChip, activeFilter === item ? { backgroundColor: colors.primary } : { backgroundColor: colors.muted }]}
              onPress={() => setActiveFilter(item)}
            >
              <Text style={[styles.filterText, { color: activeFilter === item ? "#FFFFFF" : colors.mutedForeground }]}>{item}</Text>
            </Pressable>
          )}
          contentContainerStyle={{ paddingTop: 12, gap: 8 }}
        />
      </View>

      {loading ? (
        <ActivityIndicator color={colors.primary} style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          data={agruparPorCompetencia(filtrados).flatMap(([, grupo]) => grupo)}
          keyExtractor={(item) => item.id}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void carregar(true)} tintColor={colors.primary} />}
          renderItem={({ item }) => <FinancialCard item={item} colors={colors} />}
          contentContainerStyle={[styles.list, { paddingBottom: Platform.OS === "web" ? 84 + 34 : 80 }]}
          scrollEnabled={!!filtrados.length}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Feather name="dollar-sign" size={40} color={colors.mutedForeground} />
              <Text style={[styles.emptyTitle, { color: colors.foreground }]}>Nenhum lançamento</Text>
            </View>
          }
        />
      )}
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
