import { useColors } from "@/hooks/useColors";
import { Icon, Toque } from "@/src/components/ui";
import { ApiError, apiFetch } from "@/src/lib/api";
import { avisar } from "@/src/lib/confirmar";
import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Image,
  RefreshControl,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";
import { styles } from "@/src/features/manutencao/estilos";
import {
  API_PATH,
  Aircraft,
  MaintenanceReport,
  ReportsResponse,
  STATUSES,
  Severity,
  StatusFilter,
  filterLabels,
} from "@/src/features/manutencao/modelo";
import { NewReportModal } from "@/src/features/manutencao/NewReportModal";
import { ReportCard } from "@/src/features/manutencao/ReportCard";

export default function ManutencaoScreen() {
  const router = useRouter();
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const [reports, setReports] = useState<MaintenanceReport[]>([]);
  const [aircraft, setAircraft] = useState<Aircraft[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [showModal, setShowModal] = useState(false);
  const [selectedAircraftId, setSelectedAircraftId] = useState("");
  const selectedAircraft = aircraft.find((a) => a.id === selectedAircraftId);
  const modalAircraft = useMemo(
    () => (selectedAircraft ? [selectedAircraft] : aircraft),
    [selectedAircraft, aircraft],
  );

  const loadReports = useCallback(async (refresh = false) => {
    if (refresh) setRefreshing(true);
    else setLoading(true);
    setError("");
    try {
      const response = await apiFetch<ReportsResponse>(API_PATH);
      setReports(Array.isArray(response?.data) ? response.data : []);
      setAircraft(Array.isArray(response?.aeronaves) ? response.aeronaves : []);
    } catch (cause) {
      setError(
        cause instanceof ApiError
          ? cause.message
          : "Não foi possível carregar os reports de manutenção.",
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void loadReports();
    }, [loadReports]),
  );

  const filteredReports = useMemo(
    () =>
      reports.filter((report) => {
        if (statusFilter !== "all" && report.status !== statusFilter)
          return false;
        const needle = query.trim().toLocaleLowerCase("pt-BR");
        if (!needle) return true;
        return [
          report.description,
          report.aircraft?.registration,
          report.aircraft?.model,
          report.reporter?.full_name,
        ].some((value) => value?.toLocaleLowerCase("pt-BR").includes(needle));
      }),
    [reports, query, statusFilter],
  );

  const reportsByAircraft = useMemo(() => {
    const groups = new Map<
      string,
      { aircraft: Aircraft; reports: MaintenanceReport[] }
    >();
    filteredReports.forEach((report) => {
      const id = report.aircraft?.id ?? report.aircraft_id;
      const known = aircraft.find((plane) => plane.id === id);
      const plane = report.aircraft ?? known;
      if (!plane) return;
      const group = groups.get(id) ?? { aircraft: plane, reports: [] };
      group.reports.push(report);
      groups.set(id, group);
    });
    aircraft.forEach((plane) => {
      if (!groups.has(plane.id))
        groups.set(plane.id, { aircraft: plane, reports: [] });
    });
    return Array.from(groups.values()).sort((a, b) =>
      a.aircraft.registration.localeCompare(b.aircraft.registration),
    );
  }, [filteredReports, aircraft]);

  const createReport = async (payload: {
    aeronave_id: string;
    descricao: string;
    severidade: Severity;
    data_relatorio: string;
  }) => {
    setSaving(true);
    try {
      await apiFetch<MaintenanceReport>(API_PATH, {
        method: "POST",
        body: JSON.stringify(payload),
      });
      setShowModal(false);
      avisar("Report enviado", "O report de manutenção foi registrado.");
      await loadReports();
    } catch (cause) {
      const message =
        cause instanceof ApiError
          ? cause.message
          : "Não foi possível enviar o report. Tente novamente.";
      avisar("Falha ao salvar", message);
    } finally {
      setSaving(false);
    }
  };

  const activeCount = reports.filter(
    (report) => report.status !== "resolved",
  ).length;
  const goBack = () => {
    if (selectedAircraftId) {
      setSelectedAircraftId("");
      setQuery("");
      setStatusFilter("all");
    } else router.back();
  };

  return (
    <SafeAreaView
      edges={["top"]}
      style={[
        styles.container,
        { backgroundColor: colors.background, paddingTop: 12 },
      ]}
    >
      <View style={styles.header}>
        <Toque
          onPress={goBack}
          accessibilityRole="button"
          accessibilityLabel={
            selectedAircraftId ? "Voltar para aeronaves" : "Voltar"
          }
          style={[
            styles.headerIcon,
            { backgroundColor: colors.card, borderColor: colors.border },
          ]}
        >
          <Icon name="arrow-left" size={20} color={colors.foreground} />
        </Toque>
        <View style={styles.heading}>
          <Text style={[styles.eyebrow, { color: colors.secondary }]}>
            OCORRÊNCIAS DA AERONAVE
          </Text>
          <Text
            numberOfLines={1}
            style={[styles.title, { color: colors.foreground }]}
          >
            {selectedAircraft?.registration || "Manutenção"}
          </Text>
          <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
            Histórico e reports técnicos
          </Text>
        </View>
        <Toque
          onPress={() => setShowModal(true)}
          disabled={!aircraft.length || saving}
          accessibilityRole="button"
          accessibilityLabel="Reportar ocorrência"
          accessibilityState={{ disabled: !aircraft.length || saving }}
          style={({ pressed }) => [
            styles.addButton,
            {
              backgroundColor: colors.secondary,
              opacity: !aircraft.length || saving ? 0.5 : pressed ? 0.75 : 1,
            },
          ]}
        >
          <Icon name="plus" size={22} color={colors.secondaryForeground} />
        </Toque>
      </View>

      <View
        style={[
          styles.summary,
          { backgroundColor: colors.card, borderColor: colors.border },
        ]}
      >
        <View style={styles.summaryBit}>
          <Icon name="send" size={15} color={colors.primary} />
          <Text style={[styles.summaryText, { color: colors.foreground }]}>
            {reports.length} reports
          </Text>
        </View>
        <View style={styles.summaryBit}>
          <Icon name="tool" size={15} color={colors.secondary} />
          <Text style={[styles.summaryText, { color: colors.foreground }]}>
            {activeCount} em aberto
          </Text>
        </View>
        <View style={styles.summaryBit}>
          <Icon name="airplay" size={15} color={colors.mutedForeground} />
          <Text style={[styles.summaryText, { color: colors.foreground }]}>
            {aircraft.length} aeronaves
          </Text>
        </View>
      </View>

      <View
        style={[
          styles.searchBox,
          { backgroundColor: colors.card, borderColor: colors.border },
        ]}
      >
        <Icon name="search" size={17} color={colors.mutedForeground} />
        <TextInput
          style={[styles.searchInput, { color: colors.foreground }]}
          value={query}
          onChangeText={setQuery}
          placeholder={
            selectedAircraftId
              ? "Buscar descrição do report"
              : "Buscar aeronave por matrícula ou modelo"
          }
          placeholderTextColor={colors.mutedForeground}
          returnKeyType="search"
        />
        {!!query && (
          <Toque onPress={() => setQuery("")} accessibilityLabel="Limpar busca">
            <Icon name="x-circle" size={17} color={colors.mutedForeground} />
          </Toque>
        )}
      </View>
      {!!selectedAircraftId && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={{ flexGrow: 0 }}
          contentContainerStyle={styles.filters}
        >
          {STATUSES.map((filter) => (
            <Toque
              key={filter}
              onPress={() => setStatusFilter(filter)}
              style={[
                styles.filterChip,
                {
                  backgroundColor:
                    statusFilter === filter ? colors.primary : colors.muted,
                },
              ]}
            >
              <Text
                style={[
                  styles.filterText,
                  {
                    color:
                      statusFilter === filter
                        ? "#FFFFFF"
                        : colors.mutedForeground,
                  },
                ]}
              >
                {filterLabels[filter]}
              </Text>
            </Toque>
          ))}
        </ScrollView>
      )}

      {error ? (
        <View
          style={[
            styles.errorBox,
            {
              backgroundColor: colors.destructive + "12",
              borderColor: colors.destructive + "35",
            },
          ]}
        >
          <Text style={[styles.errorText, { color: colors.destructive }]}>
            {error}
          </Text>
          <Toque onPress={() => void loadReports()}>
            <Text style={[styles.retryText, { color: colors.primary }]}>
              Tentar novamente
            </Text>
          </Toque>
        </View>
      ) : null}
      {loading ? (
        <View style={styles.centerState}>
          <ActivityIndicator color={colors.primary} />
          <Text style={[styles.stateText, { color: colors.mutedForeground }]}>
            Carregando reports…
          </Text>
        </View>
      ) : (
        <FlatList
          key={selectedAircraftId ? "reports" : "folders"}
          numColumns={selectedAircraftId ? 1 : 2}
          columnWrapperStyle={selectedAircraftId ? undefined : { gap: 12 }}
          data={
            selectedAircraftId
              ? reportsByAircraft.filter(
                  (g) => g.aircraft.id === selectedAircraftId,
                )
              : reportsByAircraft.filter((g) =>
                  [g.aircraft.registration, g.aircraft.model]
                    .join(" ")
                    .toLowerCase()
                    .includes(query.toLowerCase()),
                )
          }
          keyExtractor={(group) => group.aircraft.id}
          contentContainerStyle={
            reportsByAircraft.length ? styles.list : styles.emptyList
          }
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => void loadReports(true)}
              tintColor={colors.primary}
            />
          }
          showsVerticalScrollIndicator={false}
          renderItem={({ item }) =>
            !selectedAircraftId ? (
              <Toque
                accessibilityRole="button"
                accessibilityLabel={`Abrir pasta ${item.aircraft.registration}`}
                onPress={() => {
                  setSelectedAircraftId(item.aircraft.id);
                  setQuery("");
                  setStatusFilter("all");
                }}
                style={{
                  width: "48%",
                  marginBottom: 14,
                  borderRadius: 18,
                  overflow: "hidden",
                  borderWidth: 1,
                  borderColor: colors.border,
                  backgroundColor: colors.card,
                }}
              >
                <View
                  style={{
                    height: 105,
                    backgroundColor: colors.muted,
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  {item.aircraft.image_url ? (
                    <Image
                      source={{ uri: item.aircraft.image_url }}
                      style={{ width: "100%", height: "100%" }}
                      resizeMode="cover"
                    />
                  ) : (
                    <Icon name="folder" size={36} color={colors.primary} />
                  )}
                  <View
                    style={{
                      position: "absolute",
                      top: 8,
                      right: 8,
                      backgroundColor: colors.background,
                      borderRadius: 10,
                      padding: 5,
                    }}
                  >
                    <Text style={{ color: colors.foreground, fontSize: 11 }}>
                      {
                        reports.filter(
                          (r) =>
                            r.aircraft_id === item.aircraft.id &&
                            r.status !== "resolved",
                        ).length
                      }{" "}
                      abertos
                    </Text>
                  </View>
                </View>
                <View style={{ padding: 13 }}>
                  <Text
                    style={[styles.registration, { color: colors.foreground }]}
                  >
                    {item.aircraft.registration}
                  </Text>
                  <Text
                    style={[styles.model, { color: colors.mutedForeground }]}
                  >
                    {item.aircraft.model}
                  </Text>
                  {item.aircraft.in_maintenance && (
                    <Text
                      style={{ color: "#d6b58c", fontSize: 11, marginTop: 7 }}
                    >
                      Em manutenção
                    </Text>
                  )}
                </View>
              </Toque>
            ) : (
              <View style={styles.aircraftGroup}>
                <View
                  style={[
                    styles.aircraftHeader,
                    {
                      backgroundColor: colors.card,
                      borderColor: colors.border,
                    },
                  ]}
                >
                  <View
                    style={[
                      styles.aircraftIcon,
                      { backgroundColor: colors.primary + "14" },
                    ]}
                  >
                    {item.aircraft.image_url ? (
                      <Image
                        source={{ uri: item.aircraft.image_url }}
                        style={styles.aircraftImage}
                        resizeMode="cover"
                      />
                    ) : (
                      <Icon name="send" size={17} color={colors.primary} />
                    )}
                  </View>
                  <View style={styles.aircraftInfo}>
                    <Text
                      style={[
                        styles.registration,
                        { color: colors.foreground },
                      ]}
                    >
                      {item.aircraft.registration}
                    </Text>
                    <Text
                      style={[styles.model, { color: colors.mutedForeground }]}
                    >
                      {item.aircraft.model}
                    </Text>
                  </View>
                  {item.aircraft.in_maintenance ? (
                    <Text
                      style={[
                        styles.maintenanceFlag,
                        { color: "#B45309", backgroundColor: "#FEF3C7" },
                      ]}
                    >
                      Em manutenção
                    </Text>
                  ) : null}
                  <Text
                    style={[
                      styles.reportCount,
                      { color: colors.mutedForeground },
                    ]}
                  >
                    {item.reports.length}
                  </Text>
                </View>
                {item.reports.length ? (
                  item.reports.map((report) => (
                    <ReportCard
                      key={report.id}
                      report={report}
                      colors={colors}
                    />
                  ))
                ) : (
                  <View
                    style={[styles.noReports, { borderColor: colors.border }]}
                  >
                    <Text
                      style={[
                        styles.noReportsText,
                        { color: colors.mutedForeground },
                      ]}
                    >
                      {query || statusFilter !== "all"
                        ? "Nenhum report corresponde aos filtros."
                        : "Nenhum report registrado."}
                    </Text>
                  </View>
                )}
              </View>
            )
          }
          ListEmptyComponent={
            <View
              style={[
                styles.emptyCard,
                { borderColor: colors.border, backgroundColor: colors.card },
              ]}
            >
              <Icon name="tool" size={28} color={colors.mutedForeground} />
              <Text style={[styles.emptyTitle, { color: colors.foreground }]}>
                {reports.length
                  ? "Nada encontrado"
                  : "Sem reports de manutenção"}
              </Text>
              <Text
                style={[styles.emptyText, { color: colors.mutedForeground }]}
              >
                {reports.length
                  ? "Ajuste a busca ou o filtro de status."
                  : "Os reports registrados para a frota aparecerão aqui."}
              </Text>
            </View>
          }
        />
      )}
      <NewReportModal
        visible={showModal}
        selectedAircraftId={selectedAircraftId}
        aircraft={modalAircraft}
        onClose={() => setShowModal(false)}
        onSave={createReport}
        saving={saving}
        colors={colors}
        insets={insets}
      />
    </SafeAreaView>
  );
}
