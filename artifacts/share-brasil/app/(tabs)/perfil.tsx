import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React from "react";
import {
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
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function isExpiringSoon(dateStr: string) {
  const d = new Date(dateStr + "T00:00:00");
  const now = new Date();
  const diff = (d.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
  return diff <= 60;
}

function InfoRow({ label, value, alert, colors }: { label: string; value: string; alert?: boolean; colors: ReturnType<typeof useColors> }) {
  return (
    <View style={iStyles.row}>
      <Text style={[iStyles.label, { color: colors.mutedForeground }]}>{label}</Text>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
        {alert && <Feather name="alert-triangle" size={12} color="#EF4444" />}
        <Text style={[iStyles.value, { color: alert ? "#EF4444" : colors.foreground }]}>{value}</Text>
      </View>
    </View>
  );
}

const iStyles = StyleSheet.create({
  row: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 10 },
  label: { fontSize: 13, fontFamily: "Inter_400Regular" },
  value: { fontSize: 14, fontFamily: "Inter_500Medium" },
});

export default function PerfilScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { profile, vacationRequests, travelReports } = useApp();

  const topPadding = Platform.OS === "web" ? 67 : insets.top;
  const cmaVencendo = isExpiringSoon(profile.cmaValidade);

  const vacAprovada = vacationRequests.find((v) => v.status === "aprovada");
  const relSent = travelReports.filter((r) => r.status === "enviado").length;
  const relDevolvido = travelReports.filter((r) => r.status === "devolvido").length;

  const initials = profile.nome.split(" ").slice(0, 2).map((n) => n[0]).join("").toUpperCase();

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView
        contentContainerStyle={{ paddingBottom: Platform.OS === "web" ? 84 + 34 : 80 }}
        showsVerticalScrollIndicator={false}
      >
        <View style={[styles.hero, { paddingTop: topPadding + 24, backgroundColor: colors.primary }]}>
          <View style={[styles.avatar, { backgroundColor: colors.gold }]}>
            <Text style={styles.avatarText}>{initials}</Text>
          </View>
          <Text style={styles.name}>{profile.nome}</Text>
          <Text style={styles.role}>{profile.cargo}</Text>
          <View style={styles.canacBadge}>
            <Feather name="award" size={12} color="rgba(255,255,255,0.8)" />
            <Text style={styles.canacText}>CANAC {profile.canac}</Text>
          </View>
          <View style={styles.horasRow}>
            <View style={styles.horaBox}>
              <Text style={styles.horaValue}>{profile.horasAcumuladas.toLocaleString()}</Text>
              <Text style={styles.horaLabel}>Horas Totais</Text>
            </View>
            <View style={[styles.horaBox, styles.horaBoxMiddle]}>
              <Text style={styles.horaValue}>{profile.feriasDisponivel}</Text>
              <Text style={styles.horaLabel}>Dias de Férias</Text>
            </View>
            <View style={styles.horaBox}>
              <Text style={styles.horaValue}>{profile.habilitacoes.length}</Text>
              <Text style={styles.horaLabel}>Habilitações</Text>
            </View>
          </View>
        </View>

        <View style={styles.content}>
          {cmaVencendo && (
            <View style={[styles.alertCard, { backgroundColor: "#FEE2E2", borderColor: "#FECACA" }]}>
              <Feather name="alert-triangle" size={16} color="#DC2626" />
              <Text style={styles.alertText}>CMA vence em {formatDate(profile.cmaValidade)} — renove antes do prazo!</Text>
            </View>
          )}

          <View style={[styles.card, { backgroundColor: colors.card }]}>
            <Text style={[styles.cardTitle, { color: colors.foreground }]}>Documentação</Text>
            <InfoRow label="CMA" value={`${profile.cmaClasse} – Válido até ${formatDate(profile.cmaValidade)}`} alert={cmaVencendo} colors={colors} />
            <View style={[styles.divider, { backgroundColor: colors.border }]} />
            <InfoRow label="Tipo Sanguíneo" value={profile.tipoSanguineo} colors={colors} />
            <View style={[styles.divider, { backgroundColor: colors.border }]} />
            <InfoRow label="E-mail" value={profile.email} colors={colors} />
            <View style={[styles.divider, { backgroundColor: colors.border }]} />
            <InfoRow label="Telefone" value={profile.telefone} colors={colors} />
          </View>

          <View style={[styles.card, { backgroundColor: colors.card }]}>
            <Text style={[styles.cardTitle, { color: colors.foreground }]}>Habilitações</Text>
            <View style={styles.habRow}>
              {profile.habilitacoes.map((h) => (
                <View key={h} style={[styles.habChip, { backgroundColor: "#EFF6FF" }]}>
                  <Feather name="check" size={11} color={colors.primary} />
                  <Text style={[styles.habText, { color: colors.primary }]}>{h}</Text>
                </View>
              ))}
            </View>
          </View>

          <View style={[styles.card, { backgroundColor: colors.card }]}>
            <Text style={[styles.cardTitle, { color: colors.foreground }]}>Acesso Rápido</Text>
            <Pressable style={[styles.menuItem, { borderBottomColor: colors.border }]} onPress={() => router.push("/ferias" as any)}>
              <View style={[styles.menuIcon, { backgroundColor: "#FEF9C3" }]}>
                <Feather name="sun" size={16} color="#D97706" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.menuLabel, { color: colors.foreground }]}>Férias e Folgas</Text>
                {vacAprovada && (
                  <Text style={[styles.menuSub, { color: colors.mutedForeground }]}>
                    Próximas férias: {formatDate(vacAprovada.dataInicio)}
                  </Text>
                )}
              </View>
              <Feather name="chevron-right" size={18} color={colors.mutedForeground} />
            </Pressable>
            <Pressable style={[styles.menuItem, { borderBottomColor: colors.border }]} onPress={() => router.push("/relatorio-viagem" as any)}>
              <View style={[styles.menuIcon, { backgroundColor: "#FFFBEB" }]}>
                <Feather name="file-text" size={16} color="#D97706" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.menuLabel, { color: colors.foreground }]}>Relatórios de Viagem</Text>
                {(relSent > 0 || relDevolvido > 0) && (
                  <Text style={[styles.menuSub, { color: colors.mutedForeground }]}>
                    {relSent > 0 ? `${relSent} em análise` : ""}{relSent > 0 && relDevolvido > 0 ? " · " : ""}{relDevolvido > 0 ? `${relDevolvido} devolvido(s)` : ""}
                  </Text>
                )}
              </View>
              <Feather name="chevron-right" size={18} color={colors.mutedForeground} />
            </Pressable>
            <Pressable style={[styles.menuItem, { borderBottomColor: colors.border }]} onPress={() => router.push("/manutencao" as any)}>
              <View style={[styles.menuIcon, { backgroundColor: "#F0FDF4" }]}>
                <Feather name="tool" size={16} color={colors.secondary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.menuLabel, { color: colors.foreground }]}>Manutenção</Text>
              </View>
              <Feather name="chevron-right" size={18} color={colors.mutedForeground} />
            </Pressable>
            <Pressable style={[styles.menuItem, { borderBottomColor: "transparent" }]} onPress={() => router.push("/relatorio-voo" as any)}>
              <View style={[styles.menuIcon, { backgroundColor: "#EFF6FF" }]}>
                <Feather name="send" size={16} color={colors.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.menuLabel, { color: colors.foreground }]}>Relatórios de Voo</Text>
              </View>
              <Feather name="chevron-right" size={18} color={colors.mutedForeground} />
            </Pressable>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  hero: {
    alignItems: "center",
    paddingBottom: 24,
    paddingHorizontal: 16,
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  avatarText: { fontSize: 28, fontFamily: "Inter_700Bold", color: "#1A1A2E" },
  name: { fontSize: 22, fontFamily: "Inter_700Bold", color: "#FFFFFF", marginBottom: 4 },
  role: { fontSize: 14, color: "rgba(255,255,255,0.7)", fontFamily: "Inter_400Regular", marginBottom: 8 },
  canacBadge: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 16 },
  canacText: { fontSize: 13, color: "rgba(255,255,255,0.8)", fontFamily: "Inter_500Medium" },
  horasRow: { flexDirection: "row", backgroundColor: "rgba(255,255,255,0.12)", borderRadius: 16, overflow: "hidden", width: "100%" },
  horaBox: { flex: 1, alignItems: "center", padding: 14 },
  horaBoxMiddle: { borderLeftWidth: 1, borderRightWidth: 1, borderColor: "rgba(255,255,255,0.1)" },
  horaValue: { fontSize: 20, fontFamily: "Inter_700Bold", color: "#FFFFFF" },
  horaLabel: { fontSize: 11, color: "rgba(255,255,255,0.6)", fontFamily: "Inter_400Regular", marginTop: 4 },
  content: { padding: 16, gap: 12 },
  alertCard: { flexDirection: "row", alignItems: "center", gap: 10, borderRadius: 12, padding: 12, borderWidth: 1 },
  alertText: { flex: 1, fontSize: 13, fontFamily: "Inter_500Medium", color: "#991B1B" },
  card: { borderRadius: 16, padding: 16, shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 4, elevation: 1 },
  cardTitle: { fontSize: 15, fontFamily: "Inter_700Bold", marginBottom: 4 },
  divider: { height: 1 },
  habRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, paddingTop: 10 },
  habChip: { flexDirection: "row", alignItems: "center", gap: 5, borderRadius: 100, paddingHorizontal: 10, paddingVertical: 6 },
  habText: { fontSize: 13, fontFamily: "Inter_500Medium" },
  menuItem: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 12, borderBottomWidth: 1 },
  menuIcon: { width: 36, height: 36, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  menuLabel: { fontSize: 14, fontFamily: "Inter_500Medium" },
  menuSub: { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 2 },
});
