import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import React, { useMemo } from "react";
import {
  Image,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useApp } from "@/context/AppContext";
import { useColors } from "@/hooks/useColors";

function formatDate(dateStr: string) {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
}

function formatCurrency(val: number) {
  return val.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export default function HomeScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { profile, flights, travelReports, maintenanceReports, financialEntries, flightPlans } = useApp();

  const stats = useMemo(() => {
    const now = new Date();
    const month = now.getMonth();
    const year = now.getFullYear();
    const monthFlights = flights.filter((f) => {
      const d = new Date(f.data + "T00:00:00");
      return d.getMonth() === month && d.getFullYear() === year;
    });
    const monthHours = monthFlights.reduce((acc, f) => acc + f.tempoVoo, 0);
    const pendingReports = travelReports.filter((r) => r.status === "enviado").length;
    const devolvidos = travelReports.filter((r) => r.status === "devolvido").length;
    const openMaintenance = maintenanceReports.filter((m) => m.status !== "resolvido").length;
    const pendingFinancial = financialEntries.filter((f) => f.status === "pendente").reduce((acc, f) => acc + f.valor, 0);
    const nextPlan = flightPlans.filter((p) => p.status === "aprovado" && p.data >= now.toISOString().split("T")[0]).sort((a, b) => a.data.localeCompare(b.data))[0];
    return { monthFlights: monthFlights.length, monthHours, pendingReports, devolvidos, openMaintenance, pendingFinancial, nextPlan };
  }, [flights, travelReports, maintenanceReports, financialEntries, flightPlans]);

  const topPadding = Platform.OS === "web" ? 67 : insets.top;

  const styles = makeStyles(colors);

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <LinearGradient
        colors={[colors.primary, "#0F2247"]}
        style={[styles.header, { paddingTop: topPadding + 16 }]}
      >
        <View style={styles.headerRow}>
          <View>
            <Text style={styles.greeting}>Bem-vindo,</Text>
            <Text style={styles.userName}>{profile.nome.split(" ")[0]} {profile.nome.split(" ")[1]}</Text>
            <Text style={styles.userRole}>{profile.cargo} · CANAC {profile.canac}</Text>
          </View>
          <Image
            source={require("../../assets/images/logo.png")}
            style={styles.logo}
            resizeMode="contain"
          />
        </View>

        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{stats.monthHours.toFixed(1)}h</Text>
            <Text style={styles.statLabel}>Horas no mês</Text>
          </View>
          <View style={[styles.statCard, styles.statCardMiddle]}>
            <Text style={styles.statValue}>{stats.monthFlights}</Text>
            <Text style={styles.statLabel}>Voos no mês</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{profile.horasAcumuladas.toLocaleString()}</Text>
            <Text style={styles.statLabel}>Horas totais</Text>
          </View>
        </View>
      </LinearGradient>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={{ paddingBottom: Platform.OS === "web" ? 84 + 34 : 80 }}
        showsVerticalScrollIndicator={false}
      >
        {stats.nextPlan && (
          <View style={[styles.section]}>
            <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Próximo Voo</Text>
            <Pressable
              style={[styles.nextFlightCard, { backgroundColor: colors.primary }]}
              onPress={() => router.push("/plano-voo" as any)}
            >
              <View style={styles.nextFlightRow}>
                <View style={styles.airportBox}>
                  <Text style={styles.iataCode}>{stats.nextPlan.partida}</Text>
                  <Text style={styles.airportLabel}>Partida</Text>
                </View>
                <View style={styles.flightLine}>
                  <Feather name="minus" size={12} color="rgba(255,255,255,0.4)" />
                  <Feather name="send" size={18} color={colors.gold} style={{ marginHorizontal: 4 }} />
                  <Feather name="minus" size={12} color="rgba(255,255,255,0.4)" />
                </View>
                <View style={[styles.airportBox, { alignItems: "flex-end" }]}>
                  <Text style={styles.iataCode}>{stats.nextPlan.chegada}</Text>
                  <Text style={styles.airportLabel}>Chegada</Text>
                </View>
              </View>
              <View style={styles.nextFlightDetails}>
                <Text style={styles.nextFlightText}>{formatDate(stats.nextPlan.data)} · {stats.nextPlan.horaPrevista} · {stats.nextPlan.matricula}</Text>
                <View style={[styles.badge, { backgroundColor: colors.gold }]}>
                  <Text style={[styles.badgeText, { color: "#1A1A2E" }]}>Aprovado</Text>
                </View>
              </View>
            </Pressable>
          </View>
        )}

        {(stats.pendingReports > 0 || stats.devolvidos > 0 || stats.openMaintenance > 0 || stats.pendingFinancial > 0) && (
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Pendências</Text>
            {stats.devolvidos > 0 && (
              <Pressable style={[styles.alertCard, { backgroundColor: colors.card, borderLeftColor: "#EF4444" }]} onPress={() => router.push("/relatorio-viagem" as any)}>
                <View style={[styles.alertIcon, { backgroundColor: "#FEE2E2" }]}>
                  <Feather name="alert-triangle" size={18} color="#EF4444" />
                </View>
                <View style={styles.alertContent}>
                  <Text style={[styles.alertTitle, { color: colors.foreground }]}>Relatório devolvido</Text>
                  <Text style={[styles.alertSub, { color: colors.mutedForeground }]}>{stats.devolvidos} relatório(s) precisam de correção</Text>
                </View>
                <Feather name="chevron-right" size={18} color={colors.mutedForeground} />
              </Pressable>
            )}
            {stats.pendingReports > 0 && (
              <Pressable style={[styles.alertCard, { backgroundColor: colors.card, borderLeftColor: colors.gold }]} onPress={() => router.push("/relatorio-viagem" as any)}>
                <View style={[styles.alertIcon, { backgroundColor: "#FEF9C3" }]}>
                  <Feather name="file-text" size={18} color={colors.gold} />
                </View>
                <View style={styles.alertContent}>
                  <Text style={[styles.alertTitle, { color: colors.foreground }]}>Relatórios pendentes</Text>
                  <Text style={[styles.alertSub, { color: colors.mutedForeground }]}>{stats.pendingReports} relatório(s) aguardando aprovação</Text>
                </View>
                <Feather name="chevron-right" size={18} color={colors.mutedForeground} />
              </Pressable>
            )}
            {stats.openMaintenance > 0 && (
              <Pressable style={[styles.alertCard, { backgroundColor: colors.card, borderLeftColor: colors.secondary }]} onPress={() => router.push("/manutencao" as any)}>
                <View style={[styles.alertIcon, { backgroundColor: "#DCFCE7" }]}>
                  <Feather name="tool" size={18} color={colors.secondary} />
                </View>
                <View style={styles.alertContent}>
                  <Text style={[styles.alertTitle, { color: colors.foreground }]}>Manutenção aberta</Text>
                  <Text style={[styles.alertSub, { color: colors.mutedForeground }]}>{stats.openMaintenance} ocorrência(s) em aberto</Text>
                </View>
                <Feather name="chevron-right" size={18} color={colors.mutedForeground} />
              </Pressable>
            )}
            {stats.pendingFinancial > 0 && (
              <Pressable style={[styles.alertCard, { backgroundColor: colors.card, borderLeftColor: colors.primary }]} onPress={() => router.push("/financeiro" as any)}>
                <View style={[styles.alertIcon, { backgroundColor: "#DBEAFE" }]}>
                  <Feather name="dollar-sign" size={18} color={colors.primary} />
                </View>
                <View style={styles.alertContent}>
                  <Text style={[styles.alertTitle, { color: colors.foreground }]}>Pagamentos pendentes</Text>
                  <Text style={[styles.alertSub, { color: colors.mutedForeground }]}>{formatCurrency(stats.pendingFinancial)} a receber</Text>
                </View>
                <Feather name="chevron-right" size={18} color={colors.mutedForeground} />
              </Pressable>
            )}
          </View>
        )}

        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Ações Rápidas</Text>
          <View style={styles.actionsGrid}>
            <Pressable style={[styles.actionBtn, { backgroundColor: colors.card }]} onPress={() => router.push("/novo-lancamento" as any)}>
              <View style={[styles.actionIcon, { backgroundColor: "#EFF6FF" }]}>
                <Feather name="book-open" size={22} color={colors.primary} />
              </View>
              <Text style={[styles.actionLabel, { color: colors.foreground }]}>Novo Lançamento</Text>
            </Pressable>
            <Pressable style={[styles.actionBtn, { backgroundColor: colors.card }]} onPress={() => router.push("/plano-voo" as any)}>
              <View style={[styles.actionIcon, { backgroundColor: "#F0FDF4" }]}>
                <Feather name="navigation" size={22} color={colors.secondary} />
              </View>
              <Text style={[styles.actionLabel, { color: colors.foreground }]}>Plano de Voo</Text>
            </Pressable>
            <Pressable style={[styles.actionBtn, { backgroundColor: colors.card }]} onPress={() => router.push("/relatorio-viagem" as any)}>
              <View style={[styles.actionIcon, { backgroundColor: "#FFFBEB" }]}>
                <Feather name="file-text" size={22} color={colors.gold} />
              </View>
              <Text style={[styles.actionLabel, { color: colors.foreground }]}>Rel. Viagem</Text>
            </Pressable>
            <Pressable style={[styles.actionBtn, { backgroundColor: colors.card }]} onPress={() => router.push("/manutencao" as any)}>
              <View style={[styles.actionIcon, { backgroundColor: "#F0FDF4" }]}>
                <Feather name="tool" size={22} color={colors.secondary} />
              </View>
              <Text style={[styles.actionLabel, { color: colors.foreground }]}>Manutenção</Text>
            </Pressable>
            <Pressable style={[styles.actionBtn, { backgroundColor: colors.card }]} onPress={() => router.push("/ferias" as any)}>
              <View style={[styles.actionIcon, { backgroundColor: "#FEF9C3" }]}>
                <Feather name="sun" size={22} color="#D97706" />
              </View>
              <Text style={[styles.actionLabel, { color: colors.foreground }]}>Férias</Text>
            </Pressable>
            <Pressable style={[styles.actionBtn, { backgroundColor: colors.card }]} onPress={() => router.push("/financeiro" as any)}>
              <View style={[styles.actionIcon, { backgroundColor: "#EFF6FF" }]}>
                <Feather name="trending-up" size={22} color={colors.primary} />
              </View>
              <Text style={[styles.actionLabel, { color: colors.foreground }]}>Financeiro</Text>
            </Pressable>
          </View>
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Últimos Voos</Text>
            <Pressable onPress={() => router.push("/diario" as any)}>
              <Text style={[styles.seeAll, { color: colors.primary }]}>Ver todos</Text>
            </Pressable>
          </View>
          {flights.slice(0, 3).map((f) => (
            <View key={f.id} style={[styles.flightRow, { backgroundColor: colors.card }]}>
              <View style={[styles.flightIconBox, { backgroundColor: "#EFF6FF" }]}>
                <Feather name="send" size={16} color={colors.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.flightRoute, { color: colors.foreground }]}>{f.partida} → {f.chegada}</Text>
                <Text style={[styles.flightMeta, { color: colors.mutedForeground }]}>{formatDate(f.data)} · {f.matricula} · {f.tempoVoo.toFixed(2)}h</Text>
              </View>
              {f.assinado ? (
                <Feather name="check-circle" size={16} color={colors.success} />
              ) : (
                <Feather name="clock" size={16} color={colors.gold} />
              )}
            </View>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

function makeStyles(colors: ReturnType<typeof useColors>) {
  return StyleSheet.create({
    container: { flex: 1 },
    header: {
      paddingHorizontal: 20,
      paddingBottom: 24,
    },
    headerRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "flex-start",
      marginBottom: 20,
    },
    logo: { width: 90, height: 40 },
    greeting: { fontSize: 14, color: "rgba(255,255,255,0.7)", fontFamily: "Inter_400Regular" },
    userName: { fontSize: 22, color: "#FFFFFF", fontFamily: "Inter_700Bold", marginTop: 2 },
    userRole: { fontSize: 12, color: "rgba(255,255,255,0.6)", fontFamily: "Inter_400Regular", marginTop: 2 },
    statsRow: { flexDirection: "row", gap: 8 },
    statCard: {
      flex: 1,
      backgroundColor: "rgba(255,255,255,0.12)",
      borderRadius: 12,
      padding: 12,
    },
    statCardMiddle: {
      borderLeftWidth: 1,
      borderRightWidth: 1,
      borderColor: "rgba(255,255,255,0.1)",
    },
    statValue: { fontSize: 20, color: "#FFFFFF", fontFamily: "Inter_700Bold" },
    statLabel: { fontSize: 11, color: "rgba(255,255,255,0.6)", fontFamily: "Inter_400Regular", marginTop: 2 },
    scroll: { flex: 1 },
    section: { paddingHorizontal: 16, paddingTop: 20 },
    sectionHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 },
    sectionTitle: { fontSize: 17, fontFamily: "Inter_700Bold", marginBottom: 12 },
    seeAll: { fontSize: 14, fontFamily: "Inter_500Medium" },
    nextFlightCard: {
      borderRadius: 16,
      padding: 16,
    },
    nextFlightRow: { flexDirection: "row", alignItems: "center", marginBottom: 12 },
    airportBox: { flex: 1 },
    iataCode: { fontSize: 26, color: "#FFFFFF", fontFamily: "Inter_700Bold" },
    airportLabel: { fontSize: 11, color: "rgba(255,255,255,0.6)", fontFamily: "Inter_400Regular" },
    flightLine: { flexDirection: "row", alignItems: "center", flex: 1, justifyContent: "center" },
    nextFlightDetails: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
    nextFlightText: { fontSize: 13, color: "rgba(255,255,255,0.7)", fontFamily: "Inter_400Regular" },
    badge: { borderRadius: 100, paddingHorizontal: 10, paddingVertical: 4 },
    badgeText: { fontSize: 11, fontFamily: "Inter_600SemiBold" },
    alertCard: {
      flexDirection: "row",
      alignItems: "center",
      borderRadius: 12,
      padding: 14,
      marginBottom: 8,
      borderLeftWidth: 4,
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.05,
      shadowRadius: 4,
      elevation: 1,
    },
    alertIcon: { width: 38, height: 38, borderRadius: 10, alignItems: "center", justifyContent: "center", marginRight: 12 },
    alertContent: { flex: 1 },
    alertTitle: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
    alertSub: { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 2 },
    actionsGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
    actionBtn: {
      width: "30.5%",
      borderRadius: 14,
      padding: 14,
      alignItems: "center",
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.06,
      shadowRadius: 4,
      elevation: 1,
    },
    actionIcon: { width: 44, height: 44, borderRadius: 12, alignItems: "center", justifyContent: "center", marginBottom: 8 },
    actionLabel: { fontSize: 12, fontFamily: "Inter_500Medium", textAlign: "center" },
    flightRow: {
      flexDirection: "row",
      alignItems: "center",
      borderRadius: 12,
      padding: 12,
      marginBottom: 8,
      gap: 12,
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.05,
      shadowRadius: 4,
      elevation: 1,
    },
    flightIconBox: { width: 36, height: 36, borderRadius: 10, alignItems: "center", justifyContent: "center" },
    flightRoute: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
    flightMeta: { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 2 },
  });
}
