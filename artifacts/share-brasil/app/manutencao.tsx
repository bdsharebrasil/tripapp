import { avisar } from "@/src/lib/confirmar";
import { useFocusEffect, useRouter } from "expo-router";
import React, { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Image,
  Modal,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";
import { ApiError, apiFetch } from "@/src/lib/api";
import { useColors } from "@/hooks/useColors";
import { Icon, Toque } from "@/src/components/ui";

type Severity = "low" | "medium" | "high" | "critical";
type ReportStatus = "open" | "in_analysis" | "in_maintenance" | "resolved";
type Aircraft = {
  id: string;
  registration: string;
  model: string;
  image_url?: string | null;
  in_maintenance: boolean;
};
type MaintenanceReport = {
  id: string;
  aircraft_id: string;
  report_date: string;
  description: string;
  severity: Severity;
  status: ReportStatus;
  aircraft: Aircraft;
  reporter?: { full_name: string } | null;
};
type ReportsResponse = { data: MaintenanceReport[]; aeronaves: Aircraft[] };
type StatusFilter = "all" | ReportStatus;

const API_PATH = "/api/ctm/relatorios-manutencao";
const SEVERITIES: Severity[] = ["low", "medium", "high", "critical"];
const STATUSES: StatusFilter[] = [
  "all",
  "open",
  "in_analysis",
  "in_maintenance",
  "resolved",
];
const severityInfo: Record<
  Severity,
  { label: string; color: string; bg: string }
> = {
  low: { label: "Baixa", color: "#15803D", bg: "#DCFCE7" },
  medium: { label: "Média", color: "#B45309", bg: "#FEF3C7" },
  high: { label: "Alta", color: "#C2410C", bg: "#FFEDD5" },
  critical: { label: "Crítica", color: "#B91C1C", bg: "#FEE2E2" },
};
const statusInfo: Record<
  ReportStatus,
  { label: string; color: string; bg: string }
> = {
  open: { label: "Aberto", color: "#B91C1C", bg: "#FEE2E2" },
  in_analysis: { label: "Em análise", color: "#1D4ED8", bg: "#DBEAFE" },
  in_maintenance: { label: "Em manutenção", color: "#B45309", bg: "#FEF3C7" },
  resolved: { label: "Resolvido", color: "#15803D", bg: "#DCFCE7" },
};
const filterLabels: Record<StatusFilter, string> = {
  all: "Todos",
  open: "Abertos",
  in_analysis: "Em análise",
  in_maintenance: "Em manutenção",
  resolved: "Resolvidos",
};

function formatDate(value: string) {
  const date = new Date(`${value.slice(0, 10)}T00:00:00`);
  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleDateString("pt-BR", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      });
}
function todayISO() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}
function validISODate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00`);
  return (
    !Number.isNaN(parsed.getTime()) &&
    parsed.toISOString().slice(0, 10) === value
  );
}

function ReportCard({
  report,
  colors,
}: {
  report: MaintenanceReport;
  colors: ReturnType<typeof useColors>;
}) {
  const severity = severityInfo[report.severity];
  const status = statusInfo[report.status];
  return (
    <View
      style={[
        styles.reportCard,
        {
          backgroundColor: colors.card,
          borderColor: colors.border,
          borderLeftColor: severity.color,
        },
      ]}
    >
      <View style={styles.reportTop}>
        <View style={styles.badges}>
          <Text
            style={[
              styles.badge,
              { color: severity.color, backgroundColor: severity.bg },
            ]}
          >
            {severity.label}
          </Text>
          <Text
            style={[
              styles.badge,
              { color: status.color, backgroundColor: status.bg },
            ]}
          >
            {status.label}
          </Text>
        </View>
        <Text style={[styles.date, { color: colors.mutedForeground }]}>
          {formatDate(report.report_date)}
        </Text>
      </View>
      <Text style={[styles.description, { color: colors.foreground }]}>
        {report.description}
      </Text>
      {report.reporter?.full_name ? (
        <View style={styles.reporter}>
          <Icon name="user" size={13} color={colors.mutedForeground} />
          <Text style={[styles.metaText, { color: colors.mutedForeground }]}>
            {report.reporter.full_name}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

function NewReportModal({
  visible,
  aircraft,
  onClose,
  onSave,
  saving,
  colors,
  insets,
  selectedAircraftId,
}: {
  selectedAircraftId?: string;
  visible: boolean;
  aircraft: Aircraft[];
  onClose: () => void;
  onSave: (payload: {
    aeronave_id: string;
    descricao: string;
    severidade: Severity;
    data_relatorio: string;
  }) => Promise<void>;
  saving: boolean;
  colors: ReturnType<typeof useColors>;
  insets: ReturnType<typeof useSafeAreaInsets>;
}) {
  const [aircraftId, setAircraftId] = useState("");
  const [description, setDescription] = useState("");
  const [severity, setSeverity] = useState<Severity>("medium");
  const [reportDate, setReportDate] = useState(todayISO);
  const [attempted, setAttempted] = useState(false);

  React.useEffect(() => {
    if (visible) {
      setAircraftId(selectedAircraftId || aircraft[0]?.id || "");
      setDescription("");
      setSeverity("medium");
      setReportDate(todayISO());
      setAttempted(false);
    }
  }, [visible, aircraft, selectedAircraftId]);

  const dateValid = validISODate(reportDate);
  const canSave = !!aircraftId && !!description.trim() && dateValid && !saving;
  const inputStyle = [
    styles.input,
    {
      backgroundColor: colors.background,
      color: colors.foreground,
      borderColor: colors.border,
    },
  ];
  const labelStyle = [styles.label, { color: colors.foreground }];

  const submit = async () => {
    setAttempted(true);
    if (!aircraft.length) {
      avisar(
        "Sem aeronaves",
        "Não há aeronaves disponíveis para registrar um report.",
      );
      return;
    }
    if (!aircraftId || !description.trim() || !dateValid) {
      avisar(
        "Revise os dados",
        !aircraftId
          ? "Selecione uma aeronave."
          : !description.trim()
            ? "Informe a descrição da ocorrência."
            : "Informe uma data válida no formato AAAA-MM-DD.",
      );
      return;
    }
    await onSave({
      aeronave_id: aircraftId,
      descricao: description.trim(),
      severidade: severity,
      data_relatorio: reportDate,
    });
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <SafeAreaView
        edges={["top"]}
        style={[
          styles.modal,
          {
            backgroundColor: colors.background,
            paddingTop: 8,
            paddingBottom: Math.max(insets.bottom, 16),
          },
        ]}
      >
        <View
          style={[styles.modalHeader, { borderBottomColor: colors.border }]}
        >
          <Toque
            onPress={onClose}
            accessibilityRole="button"
            accessibilityLabel="Fechar formulário"
          >
            <Icon name="x" size={23} color={colors.foreground} />
          </Toque>
          <Text style={[styles.modalTitle, { color: colors.foreground }]}>
            Novo report
          </Text>
          <Toque
            onPress={() => void submit()}
            disabled={saving}
            accessibilityRole="button"
          >
            <Text style={[styles.saveText, { color: colors.primary }]}>
              {saving ? "Salvando…" : "Salvar"}
            </Text>
          </Toque>
        </View>
        <ScrollView
          contentContainerStyle={styles.form}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <Text style={labelStyle}>Aeronave *</Text>
          {aircraft.length ? (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.aircraftPicker}
            >
              {aircraft.map((plane) => {
                const selected = aircraftId === plane.id;
                return (
                  <Toque
                    key={plane.id}
                    onPress={() => setAircraftId(plane.id)}
                    style={[
                      styles.aircraftOption,
                      {
                        borderColor: selected ? colors.primary : colors.border,
                        backgroundColor: selected
                          ? colors.primary + "14"
                          : colors.card,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.optionRegistration,
                        {
                          color: selected ? colors.primary : colors.foreground,
                        },
                      ]}
                    >
                      {plane.registration}
                    </Text>
                    <Text
                      style={[
                        styles.optionModel,
                        { color: colors.mutedForeground },
                      ]}
                    >
                      {plane.model}
                    </Text>
                  </Toque>
                );
              })}
            </ScrollView>
          ) : (
            <Text
              style={[styles.helperText, { color: colors.mutedForeground }]}
            >
              Nenhuma aeronave disponível.
            </Text>
          )}
          {attempted && !aircraftId ? (
            <Text style={[styles.validation, { color: colors.destructive }]}>
              Selecione uma aeronave.
            </Text>
          ) : null}

          <Text style={labelStyle}>Data do report *</Text>
          <TextInput
            style={inputStyle}
            value={reportDate}
            onChangeText={setReportDate}
            placeholder="AAAA-MM-DD"
            placeholderTextColor={colors.mutedForeground}
            autoCapitalize="none"
            accessibilityLabel="Data do report no formato ano-mês-dia"
          />
          {attempted && !dateValid ? (
            <Text style={[styles.validation, { color: colors.destructive }]}>
              Use uma data válida no formato AAAA-MM-DD.
            </Text>
          ) : null}

          <Text style={labelStyle}>Severidade *</Text>
          <View style={styles.chipRow}>
            {SEVERITIES.map((value) => {
              const option = severityInfo[value];
              const selected = severity === value;
              return (
                <Toque
                  key={value}
                  onPress={() => setSeverity(value)}
                  style={[
                    styles.choiceChip,
                    { backgroundColor: selected ? option.color : colors.muted },
                  ]}
                >
                  <Text
                    style={[
                      styles.choiceText,
                      { color: selected ? "#FFFFFF" : colors.mutedForeground },
                    ]}
                  >
                    {option.label}
                  </Text>
                </Toque>
              );
            })}
          </View>

          <Text style={labelStyle}>Descrição *</Text>
          <TextInput
            style={[inputStyle, styles.textarea]}
            value={description}
            onChangeText={setDescription}
            multiline
            numberOfLines={5}
            maxLength={4000}
            textAlignVertical="top"
            placeholder="Descreva a ocorrência ou necessidade de manutenção…"
            placeholderTextColor={colors.mutedForeground}
          />
          <Text style={[styles.helperText, { color: colors.mutedForeground }]}>
            {description.trim().length}/4000 caracteres
          </Text>
          {attempted && !description.trim() ? (
            <Text style={[styles.validation, { color: colors.destructive }]}>
              A descrição é obrigatória.
            </Text>
          ) : null}
          <Toque
            onPress={() => void submit()}
            disabled={!canSave}
            style={[
              styles.submitButton,
              { backgroundColor: colors.primary, opacity: canSave ? 1 : 0.55 },
            ]}
          >
            {saving ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.submitText}>Enviar report</Text>
            )}
          </Toque>
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

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

const styles = StyleSheet.create({
  container: { flex: 1, paddingHorizontal: 18 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 18,
  },
  headerIcon: {
    width: 44,
    height: 44,
    borderWidth: 1,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  heading: { flex: 1, minWidth: 0 },
  eyebrow: {
    fontSize: 9,
    fontFamily: "Inter_600SemiBold",
    letterSpacing: 1.2,
    marginBottom: 3,
  },
  title: { fontSize: 22, fontFamily: "Inter_700Bold" },
  subtitle: { fontSize: 11, fontFamily: "Inter_400Regular", marginTop: 2 },
  addButton: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  summary: {
    minHeight: 68,
    borderWidth: 1,
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 12,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  summaryBit: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
  },
  summaryText: { fontSize: 10, fontFamily: "Inter_500Medium" },
  searchBox: {
    height: 44,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    paddingVertical: 0,
  },
  filters: { gap: 7, paddingVertical: 11 },
  filterChip: { borderRadius: 100, paddingHorizontal: 12, paddingVertical: 7 },
  filterText: { fontSize: 11, fontFamily: "Inter_500Medium" },
  errorBox: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
    gap: 7,
  },
  errorText: { fontSize: 13, fontFamily: "Inter_400Regular" },
  retryText: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  centerState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
  },
  stateText: { fontSize: 13, fontFamily: "Inter_400Regular" },
  list: { paddingBottom: 32 },
  emptyList: { flexGrow: 1, justifyContent: "center", paddingBottom: 35 },
  aircraftGroup: { marginBottom: 16, gap: 8 },
  aircraftHeader: {
    minHeight: 61,
    borderWidth: 1,
    borderRadius: 14,
    padding: 11,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  aircraftIcon: {
    width: 36,
    height: 36,
    borderRadius: 11,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
  },
  aircraftImage: { width: "100%", height: "100%" },
  aircraftInfo: { flex: 1 },
  registration: { fontSize: 14, fontFamily: "Inter_700Bold" },
  model: { fontSize: 11, fontFamily: "Inter_400Regular", marginTop: 2 },
  maintenanceFlag: {
    overflow: "hidden",
    borderRadius: 20,
    paddingHorizontal: 8,
    paddingVertical: 5,
    fontSize: 9,
    fontFamily: "Inter_600SemiBold",
  },
  reportCount: {
    minWidth: 20,
    textAlign: "right",
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
  },
  reportCard: {
    borderWidth: 1,
    borderLeftWidth: 3,
    borderRadius: 13,
    padding: 12,
    marginLeft: 9,
  },
  reportTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 8,
    marginBottom: 8,
  },
  badges: { flexDirection: "row", gap: 6, flexWrap: "wrap" },
  badge: {
    overflow: "hidden",
    borderRadius: 20,
    paddingHorizontal: 8,
    paddingVertical: 4,
    fontSize: 10,
    fontFamily: "Inter_600SemiBold",
  },
  date: { fontSize: 10, fontFamily: "Inter_400Regular" },
  description: { fontSize: 13, lineHeight: 19, fontFamily: "Inter_400Regular" },
  reporter: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    marginTop: 9,
  },
  metaText: { fontSize: 11, fontFamily: "Inter_400Regular" },
  noReports: {
    marginLeft: 9,
    borderWidth: 1,
    borderStyle: "dashed",
    borderRadius: 12,
    padding: 14,
  },
  noReportsText: { fontSize: 12, fontFamily: "Inter_400Regular" },
  emptyCard: {
    borderWidth: 1,
    borderStyle: "dashed",
    borderRadius: 18,
    padding: 26,
    alignItems: "center",
    gap: 9,
  },
  emptyTitle: { fontSize: 16, fontFamily: "Inter_700Bold", marginTop: 3 },
  emptyText: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
  },
  modal: { flex: 1 },
  modalHeader: {
    height: 54,
    borderBottomWidth: 1,
    paddingHorizontal: 18,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  modalTitle: { fontSize: 16, fontFamily: "Inter_700Bold" },
  saveText: { fontSize: 15, fontFamily: "Inter_600SemiBold" },
  form: { padding: 18, paddingBottom: 34, gap: 8 },
  label: {
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
    marginTop: 7,
    marginBottom: 1,
  },
  input: {
    borderRadius: 11,
    borderWidth: 1,
    padding: 12,
    fontSize: 14,
    fontFamily: "Inter_400Regular",
  },
  textarea: { minHeight: 120 },
  aircraftPicker: { gap: 8, paddingVertical: 3 },
  aircraftOption: {
    minWidth: 122,
    borderWidth: 1,
    borderRadius: 12,
    padding: 10,
  },
  optionRegistration: { fontSize: 13, fontFamily: "Inter_700Bold" },
  optionModel: { fontSize: 10, fontFamily: "Inter_400Regular", marginTop: 3 },
  chipRow: {
    flexDirection: "row",
    gap: 7,
    flexWrap: "wrap",
    paddingVertical: 3,
  },
  choiceChip: { borderRadius: 30, paddingHorizontal: 13, paddingVertical: 8 },
  choiceText: { fontSize: 12, fontFamily: "Inter_600SemiBold" },
  helperText: { fontSize: 11, fontFamily: "Inter_400Regular" },
  validation: { fontSize: 11, fontFamily: "Inter_500Medium" },
  submitButton: {
    minHeight: 48,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 14,
  },
  submitText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
  },
});
