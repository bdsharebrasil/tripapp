import { useColors } from "@/hooks/useColors";
import { Icon, Toque } from "@/src/components/ui";
import { avisar } from "@/src/lib/confirmar";
import React, { useState } from "react";
import {
  ActivityIndicator,
  Modal,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";
import { styles } from "./estilos";
import {
  Aircraft,
  SEVERITIES,
  Severity,
  severityInfo,
  todayISO,
  validISODate,
} from "./modelo";

export function NewReportModal({
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
