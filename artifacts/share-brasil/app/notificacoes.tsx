import { Feather } from "@expo/vector-icons";
import { useFocusEffect } from "expo-router";
import React, { useCallback, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ApiError, apiFetch } from "@/src/lib/api";
import { useColors } from "@/hooks/useColors";

type NotificationItem = {
  id: string | number;
  mensagem?: string | null;
  criado_em?: string | null;
  status?: string | null;
  lido?: boolean | number | string | null;
};

type NotificationsResponse = { notificacoes: NotificationItem[] };

function isRead(item: NotificationItem) {
  const statusLido = ["lida", "lido", "read"].includes(String(item.status ?? "").toLowerCase());
  const flagLido = item.lido === true || item.lido === 1 || item.lido === "1";
  return statusLido || flagLido;
}

function formatDate(value?: string | null) {
  if (!value) return "Data indisponível";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Data indisponível";
  return date.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function NotificationsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [markingId, setMarkingId] = useState<string | number | null>(null);
  const [error, setError] = useState("");

  const loadNotifications = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError("");
    try {
      const response = await apiFetch<NotificationsResponse>("/api/sharebrasil/notificacoes?origem=geral");
      setNotifications(Array.isArray(response.notificacoes) ? response.notificacoes : []);
    } catch (cause) {
      setError(cause instanceof ApiError ? cause.message : "Não foi possível carregar suas notificações.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(useCallback(() => {
    void loadNotifications();
  }, [loadNotifications]));

  const markAsRead = async (item: NotificationItem) => {
    setMarkingId(item.id);
    setError("");
    try {
      await apiFetch(`/api/sharebrasil/notificacoes/${encodeURIComponent(String(item.id))}/lida?origem=geral`, {
        method: "PATCH",
      });
      setNotifications((current) => current.map((entry) =>
        String(entry.id) === String(item.id) ? { ...entry, lido: 1, status: "lida" } : entry,
      ));
    } catch (cause) {
      setError(cause instanceof ApiError ? cause.message : "Não foi possível atualizar a notificação.");
    } finally {
      setMarkingId(null);
    }
  };

  const unreadCount = notifications.filter((item) => !isRead(item)).length;

  return (
    <View style={[styles.container, { backgroundColor: colors.background, paddingTop: insets.top + 12 }]}>
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={[styles.eyebrow, { color: colors.secondary }]}>CENTRAL PESSOAL</Text>
          <Text style={[styles.title, { color: colors.foreground }]}>Notificações</Text>
          <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>Avisos destinados a você no sistema.</Text>
        </View>
        <View style={[styles.headerIcon, { backgroundColor: colors.primary + "14" }]}>
          <Feather name="bell" size={21} color={colors.primary} />
        </View>
      </View>

      <View style={[styles.summary, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <View style={styles.summaryLabel}>
          <Feather name="inbox" size={16} color={colors.mutedForeground} />
          <Text style={[styles.summaryText, { color: colors.foreground }]}>{notifications.length} avisos</Text>
        </View>
        <View style={[styles.countPill, { backgroundColor: colors.secondary + "18" }]}>
          <Text style={[styles.countText, { color: colors.secondary }]}>{unreadCount} não lidos</Text>
        </View>
      </View>

      {error ? (
        <View style={[styles.errorBox, { backgroundColor: colors.destructive + "12", borderColor: colors.destructive + "35" }]}>
          <Text style={[styles.errorText, { color: colors.destructive }]}>{error}</Text>
          <Pressable onPress={() => void loadNotifications()} accessibilityRole="button" accessibilityLabel="Tentar carregar notificações novamente">
            <Text style={[styles.retryText, { color: colors.primary }]}>Tentar novamente</Text>
          </Pressable>
        </View>
      ) : null}

      {loading ? (
        <View style={styles.centerState}>
          <ActivityIndicator color={colors.primary} />
          <Text style={[styles.stateText, { color: colors.mutedForeground }]}>Carregando seus avisos…</Text>
        </View>
      ) : (
        <FlatList
          data={notifications}
          keyExtractor={(item, index) => `${item.id}-${index}`}
          contentContainerStyle={notifications.length === 0 ? styles.emptyList : styles.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void loadNotifications(true)} tintColor={colors.primary} />}
          ListEmptyComponent={(
            <View style={[styles.emptyCard, { borderColor: colors.border, backgroundColor: colors.card }]}>
              <View style={[styles.emptyIcon, { backgroundColor: colors.muted }]}>
                <Feather name="inbox" size={23} color={colors.mutedForeground} />
              </View>
              <Text style={[styles.emptyTitle, { color: colors.foreground }]}>Tudo em dia</Text>
              <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>Não há notificações destinadas a você.</Text>
            </View>
          )}
          renderItem={({ item }) => {
            const read = isRead(item);
            return (
              <View style={[styles.notification, { backgroundColor: colors.card, borderColor: read ? colors.border : colors.secondary + "50" }]}>
                <View style={[styles.itemIcon, { backgroundColor: read ? colors.muted : colors.secondary + "18" }]}>
                  <Feather name={read ? "check" : "bell"} size={16} color={read ? colors.mutedForeground : colors.secondary} />
                </View>
                <View style={styles.itemContent}>
                  <Text style={[styles.message, { color: colors.foreground }]}>{item.mensagem?.trim() || "Você recebeu uma nova notificação."}</Text>
                  <View style={styles.itemFooter}>
                    <Feather name="clock" size={13} color={colors.mutedForeground} />
                    <Text style={[styles.date, { color: colors.mutedForeground }]}>{formatDate(item.criado_em)}</Text>
                  </View>
                  {!read && (
                    <Pressable
                      style={[styles.readButton, { borderColor: colors.secondary + "60" }]}
                      disabled={markingId !== null}
                      onPress={() => void markAsRead(item)}
                      accessibilityRole="button"
                      accessibilityLabel="Marcar notificação como lida"
                    >
                      {markingId === item.id ? <ActivityIndicator size="small" color={colors.secondary} /> : null}
                      <Text style={[styles.readButtonText, { color: colors.secondary }]}>
                        {markingId === item.id ? "Salvando…" : "Marcar como lida"}
                      </Text>
                    </Pressable>
                  )}
                </View>
              </View>
            );
          }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingHorizontal: 18 },
  header: { flexDirection: "row", alignItems: "center", gap: 14, marginBottom: 18 },
  eyebrow: { fontSize: 11, fontFamily: "Inter_600SemiBold", letterSpacing: 1.6, marginBottom: 5 },
  title: { fontSize: 25, fontFamily: "Inter_700Bold" },
  subtitle: { fontSize: 13, fontFamily: "Inter_400Regular", marginTop: 4 },
  headerIcon: { width: 48, height: 48, borderRadius: 16, alignItems: "center", justifyContent: "center" },
  summary: { minHeight: 54, borderWidth: 1, borderRadius: 14, paddingHorizontal: 14, flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 14 },
  summaryLabel: { flexDirection: "row", alignItems: "center", gap: 9 },
  summaryText: { fontSize: 13, fontFamily: "Inter_500Medium" },
  countPill: { borderRadius: 20, paddingHorizontal: 10, paddingVertical: 6 },
  countText: { fontSize: 12, fontFamily: "Inter_600SemiBold" },
  errorBox: { borderWidth: 1, borderRadius: 12, padding: 12, marginBottom: 12, gap: 8 },
  errorText: { fontSize: 13, fontFamily: "Inter_400Regular" },
  retryText: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  centerState: { flex: 1, alignItems: "center", justifyContent: "center", gap: 10 },
  stateText: { fontSize: 13, fontFamily: "Inter_400Regular" },
  list: { paddingBottom: 32, gap: 10 },
  emptyList: { flexGrow: 1, justifyContent: "center", paddingBottom: 50 },
  emptyCard: { borderWidth: 1, borderStyle: "dashed", borderRadius: 20, padding: 28, alignItems: "center" },
  emptyIcon: { height: 52, width: 52, borderRadius: 16, alignItems: "center", justifyContent: "center", marginBottom: 14 },
  emptyTitle: { fontSize: 17, fontFamily: "Inter_700Bold" },
  emptyText: { fontSize: 13, fontFamily: "Inter_400Regular", textAlign: "center", marginTop: 6 },
  notification: { borderWidth: 1, borderRadius: 16, padding: 14, flexDirection: "row", gap: 11 },
  itemIcon: { width: 36, height: 36, borderRadius: 11, alignItems: "center", justifyContent: "center" },
  itemContent: { flex: 1 },
  message: { fontSize: 14, lineHeight: 21, fontFamily: "Inter_400Regular" },
  itemFooter: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 10 },
  date: { fontSize: 11, fontFamily: "Inter_400Regular" },
  readButton: { alignSelf: "flex-start", minHeight: 36, borderWidth: 1, borderRadius: 10, paddingHorizontal: 11, marginTop: 10, flexDirection: "row", alignItems: "center", gap: 7 },
  readButtonText: { fontSize: 12, fontFamily: "Inter_600SemiBold" },
});
