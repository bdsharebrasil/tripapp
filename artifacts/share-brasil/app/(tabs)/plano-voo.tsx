import { avisar, confirmar } from "@/src/lib/confirmar";
import { Feather } from "@expo/vector-icons";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColors } from "@/hooks/useColors";
import { Cabecalho, Botao } from "@/src/components/ui";
import { useRouter } from "expo-router";
import { apiFetch } from "@/src/lib/api";

type IcaoForm = {
  identificacao: string;
  regraVoo: string;
  tipoVoo: string;
  numeroAeronaves: string;
  tipoAeronave: string;
  esteira: string;
  equipamento: string;
  adep: string;
  dataVoo: string;
  eobt: string;
  velocidade: string;
  nivel: string;
  rota: string;
  ades: string;
  eet: string;
  alternado1: string;
  alternado2: string;
  outrasInformacoes: string;
  autonomia: string;
  pessoasABordo: string;
  radioEmergencia: string;
  sobrevivencia: string;
  coletes: string;
  botes: string;
  corAeronave: string;
  piloto: string;
  observacoes: string;
};
type FlightRecord = {
  id: string;
  numero_voo: string;
  adep: string;
  ades: string;
  data_voo: string;
  eobt: string;
  created_at: string;
  payload: any;
};
const blankForm = (): IcaoForm => ({
  identificacao: "",
  regraVoo: "I",
  tipoVoo: "G",
  numeroAeronaves: "1",
  tipoAeronave: "",
  esteira: "M",
  equipamento: "",
  adep: "",
  dataVoo: new Date().toISOString().slice(0, 10),
  eobt: "",
  velocidade: "",
  nivel: "",
  rota: "",
  ades: "",
  eet: "",
  alternado1: "",
  alternado2: "",
  outrasInformacoes: "",
  autonomia: "",
  pessoasABordo: "",
  radioEmergencia: "",
  sobrevivencia: "",
  coletes: "",
  botes: "",
  corAeronave: "",
  piloto: "",
  observacoes: "",
});
const fields: {
  key: keyof IcaoForm;
  label: string;
  section: string;
  multiline?: boolean;
  keyboard?: "numeric" | "default";
  hint?: string;
  options?: { value: string; label: string }[];
}[] = [
  {
    key: "identificacao",
    label: "Identificação da aeronave",
    section: "7 · IDENTIFICAÇÃO",
    hint: "Matrícula ou indicativo",
  },
  {
    key: "regraVoo",
    label: "Regras de voo",
    section: "8 · REGRAS E TIPO",
    options: [
      { value: "I", label: "I · IFR" },
      { value: "V", label: "V · VFR" },
      { value: "Y", label: "Y · IFR/VFR" },
      { value: "Z", label: "Z · VFR/IFR" },
    ],
  },
  {
    key: "tipoVoo",
    label: "Tipo de voo",
    section: "8 · REGRAS E TIPO",
    options: [
      { value: "S", label: "S · Regular" },
      { value: "N", label: "N · Não regular" },
      { value: "G", label: "G · Geral" },
      { value: "M", label: "M · Militar" },
      { value: "X", label: "X · Outro" },
    ],
  },
  {
    key: "numeroAeronaves",
    label: "Número de aeronaves",
    section: "8 · REGRAS E TIPO",
    keyboard: "numeric",
  },
  {
    key: "tipoAeronave",
    label: "Tipo de aeronave",
    section: "9 · AERONAVE",
    hint: "Ex.: C172",
  },
  {
    key: "esteira",
    label: "Categoria de esteira",
    section: "9 · AERONAVE",
    options: [
      { value: "L", label: "L · Leve" },
      { value: "M", label: "M · Média" },
      { value: "H", label: "H · Pesada" },
      { value: "J", label: "J · Super" },
    ],
  },
  {
    key: "equipamento",
    label: "Equipamento / capacidades",
    section: "10 · EQUIPAMENTO",
    hint: "Comunicações, navegação e vigilância",
  },
  {
    key: "adep",
    label: "ADEP · aeródromo de partida",
    section: "13 · PARTIDA",
    hint: "ICAO, 4 letras",
  },
  {
    key: "dataVoo",
    label: "Data do voo",
    section: "13 · PARTIDA",
    hint: "AAAA-MM-DD",
  },
  {
    key: "eobt",
    label: "EOBT UTC",
    section: "13 · PARTIDA",
    hint: "HHMM UTC",
    keyboard: "numeric",
  },
  {
    key: "velocidade",
    label: "Velocidade de cruzeiro",
    section: "15 · ROTA",
    hint: "Ex.: N0450",
  },
  {
    key: "nivel",
    label: "Nível de cruzeiro",
    section: "15 · ROTA",
    hint: "Ex.: F350",
  },
  { key: "rota", label: "Rota", section: "15 · ROTA", multiline: true },
  {
    key: "ades",
    label: "ADES · aeródromo de destino",
    section: "16 · DESTINO",
    hint: "ICAO, 4 letras",
  },
  { key: "eet", label: "EET total", section: "16 · DESTINO", hint: "HHMM" },
  {
    key: "alternado1",
    label: "Alternado 1",
    section: "16 · DESTINO",
    hint: "ICAO",
  },
  {
    key: "alternado2",
    label: "Alternado 2",
    section: "16 · DESTINO",
    hint: "ICAO",
  },
  {
    key: "outrasInformacoes",
    label: "Outras informações",
    section: "18 · OUTRAS INFORMAÇÕES",
    multiline: true,
  },
  {
    key: "autonomia",
    label: "Autonomia",
    section: "19 · INFORMAÇÕES SUPLEMENTARES",
    hint: "HHMM",
  },
  {
    key: "pessoasABordo",
    label: "Pessoas a bordo",
    section: "19 · INFORMAÇÕES SUPLEMENTARES",
    keyboard: "numeric",
  },
  {
    key: "radioEmergencia",
    label: "Rádio de emergência",
    section: "19 · INFORMAÇÕES SUPLEMENTARES",
    hint: "U · V · E",
  },
  {
    key: "sobrevivencia",
    label: "Equipamento de sobrevivência",
    section: "19 · INFORMAÇÕES SUPLEMENTARES",
  },
  {
    key: "coletes",
    label: "Coletes",
    section: "19 · INFORMAÇÕES SUPLEMENTARES",
  },
  { key: "botes", label: "Botes", section: "19 · INFORMAÇÕES SUPLEMENTARES" },
  {
    key: "corAeronave",
    label: "Cor / marcas da aeronave",
    section: "19 · INFORMAÇÕES SUPLEMENTARES",
  },
  {
    key: "piloto",
    label: "Piloto em comando",
    section: "19 · INFORMAÇÕES SUPLEMENTARES",
  },
  {
    key: "observacoes",
    label: "Observações",
    section: "19 · INFORMAÇÕES SUPLEMENTARES",
    multiline: true,
  },
];
const icao = (s: string) => s.trim().toUpperCase();

export default function PlanoVooScreen() {
  const router = useRouter();
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const [form, setForm] = useState<IcaoForm>(blankForm);
  const [records, setRecords] = useState<FlightRecord[]>([]);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [wx, setWx] = useState<Record<string, string>>({});
  const [routeInfo, setRouteInfo] = useState("");
  const [error, setError] = useState("");
  const [showForm, setShowForm] = useState(false);
  const set = (key: keyof IcaoForm, value: string) =>
    setForm((current) => ({ ...current, [key]: value }));
  const load = useCallback(async () => {
    setError("");
    try {
      const result = await apiFetch<FlightRecord[]>(
        "/api/interno/planos-voo?mine=true",
      );
      setRecords(Array.isArray(result) ? result : []);
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Não foi possível carregar os planos.",
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);
  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const dep = icao(form.adep),
      dest = icao(form.ades);
    if (!/^[A-Z]{4}$/.test(dep) || !/^[A-Z]{4}$/.test(dest) || dep === dest) {
      setWx({});
      setRouteInfo("");
      return;
    }
    let active = true;
    const timer = setTimeout(async () => {
      const [a, b, route] = await Promise.allSettled([
        apiFetch<{ metar?: string; error?: string }>(
          `/api/v1/weather/${encodeURIComponent(dep)}`,
        ),
        apiFetch<{ metar?: string; error?: string }>(
          `/api/v1/weather/${encodeURIComponent(dest)}`,
        ),
        apiFetch<any>(
          `/api/v1/flightplan?adep=${encodeURIComponent(dep)}&ades=${encodeURIComponent(dest)}`,
        ),
      ]);
      if (!active) return;
      const next: Record<string, string> = {};
      if (a.status === "fulfilled")
        next[dep] = a.value.metar || a.value.error || "Sem METAR disponível";
      if (b.status === "fulfilled")
        next[dest] = b.value.metar || b.value.error || "Sem METAR disponível";
      setWx(next);
      setRouteInfo(
        route.status === "fulfilled"
          ? route.value?.flightplan?.route || route.value?.error || ""
          : "",
      );
      if (
        route.status === "fulfilled" &&
        route.value?.flightplan?.route &&
        !form.rota.trim()
      )
        setForm((prev) => ({ ...prev, rota: route.value.flightplan.route }));
    }, 650);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [form.adep, form.ades]);

  const create = async () => {
    const adep = icao(form.adep),
      ades = icao(form.ades);
    if (!/^[A-Z]{4}$/.test(adep) || !/^[A-Z]{4}$/.test(ades) || adep === ades) {
      avisar(
        "Aeródromos inválidos",
        "ADEP e ADES devem ter quatro letras ICAO e ser diferentes.",
      );
      return;
    }
    if (
      !form.identificacao.trim() ||
      !/^\d{4}-\d{2}-\d{2}$/.test(form.dataVoo.trim()) ||
      !/^\d{4}$/.test(form.eobt.trim())
    ) {
      avisar(
        "Dados necessários",
        "Informe identificação, data do voo e EOBT em UTC (HHMM).",
      );
      return;
    }
    setSaving(true);
    const normalized: IcaoForm = {
      ...form,
      adep,
      ades,
      identificacao: form.identificacao.trim().toUpperCase(),
      eobt: form.eobt.trim(),
    };
    const payload = {
      numero_voo: normalized.identificacao,
      adep,
      ades,
      data_voo: normalized.dataVoo,
      eobt: normalized.eobt,
      form: normalized,
      contexto: null,
      rota: null,
      segmentos: [],
      distancia_total_nm: null,
      salvo_em: new Date().toISOString(),
    };
    try {
      await apiFetch("/api/interno/planos-voo", {
        method: "POST",
        body: JSON.stringify(payload),
      });
      setForm(blankForm());
      setShowForm(false);
      await load();
      avisar(
        "Plano salvo",
        "O formulário foi salvo na sua conta. Este serviço não envia o plano ao órgão AIS.",
      );
    } catch (e) {
      avisar(
        "Falha ao salvar",
        e instanceof Error ? e.message : "Tente novamente.",
      );
    } finally {
      setSaving(false);
    }
  };
  const remove = (id: string) =>
    confirmar(
      "Excluir plano",
      "Esta ação remove o registro da sua conta.",
      async () => {
        try {
          await apiFetch(`/api/interno/planos-voo/${encodeURIComponent(id)}`, {
            method: "DELETE",
          });
          setRecords((items) => items.filter((item) => item.id !== id));
        } catch (e) {
          avisar(
            "Falha ao excluir",
            e instanceof Error ? e.message : "Tente novamente.",
          );
        }
      },
      true,
    );
  const ordered = useMemo(
    () =>
      [...records].sort((a, b) =>
        (b.created_at || "").localeCompare(a.created_at || ""),
      ),
    [records],
  );
  const sections = [...new Set(fields.map((f) => f.section))];
  const inputStyle = [
    styles.input,
    {
      backgroundColor: colors.card,
      borderColor: colors.border,
      color: colors.foreground,
    },
  ];

  return (
    <View
      style={[
        styles.screen,
        { backgroundColor: colors.background, paddingTop: insets.top },
      ]}
    >
      <Cabecalho
        titulo="Plano de voo"
        apoio="PLANEJAMENTO ICAO"
        voltar={() => router.back()}
      />
      <View style={{ paddingHorizontal: 20, paddingBottom: 12 }}>
        <Botao
          texto={showForm ? "Fechar formulário" : "Criar plano de voo"}
          icone={showForm ? "x" : "plus"}
          onPress={() => {
            setForm(blankForm());
            setShowForm((v) => !v);
          }}
        />
      </View>
      {showForm && (
        <View style={[styles.formShell, { borderBottomColor: colors.border }]}>
          <ScrollView
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{ padding: 16, paddingBottom: 20 }}
          >
            <Text
              style={[
                styles.notice,
                {
                  color: colors.mutedForeground,
                  backgroundColor: colors.muted,
                },
              ]}
            >
              Salvar armazena o formulário no serviço; não o transmite a um
              órgão AIS nem confirma aprovação.
            </Text>
            {sections.map((section) => (
              <View key={section}>
                <Text style={[styles.section, { color: colors.primary }]}>
                  {section}
                </Text>
                {fields
                  .filter((f) => f.section === section)
                  .map((field) => (
                    <View key={field.key} style={styles.field}>
                      <Text
                        style={[styles.label, { color: colors.foreground }]}
                      >
                        {field.label}
                      </Text>
                      {field.options ? (
                        <View style={styles.optionRow}>
                          {field.options.map((option) => (
                            <Pressable
                              key={option.value}
                              onPress={() => set(field.key, option.value)}
                              style={[
                                styles.optionChip,
                                {
                                  backgroundColor:
                                    form[field.key] === option.value
                                      ? colors.primary
                                      : colors.muted,
                                },
                              ]}
                            >
                              <Text
                                style={{
                                  color:
                                    form[field.key] === option.value
                                      ? "#fff"
                                      : colors.foreground,
                                  fontSize: 11,
                                }}
                              >
                                {option.label}
                              </Text>
                            </Pressable>
                          ))}
                        </View>
                      ) : (
                        <TextInput
                          value={form[field.key]}
                          onChangeText={(v) =>
                            set(
                              field.key,
                              [
                                "adep",
                                "ades",
                                "identificacao",
                                "regraVoo",
                                "tipoVoo",
                                "tipoAeronave",
                                "esteira",
                                "eobt",
                              ].includes(field.key)
                                ? v.toUpperCase()
                                : v,
                            )
                          }
                          placeholder={field.hint || ""}
                          placeholderTextColor={colors.mutedForeground}
                          autoCapitalize="characters"
                          keyboardType={field.keyboard || "default"}
                          multiline={field.multiline}
                          style={[
                            inputStyle,
                            field.multiline && styles.multiline,
                          ]}
                        />
                      )}
                    </View>
                  ))}
              </View>
            ))}
            {Object.keys(wx).length > 0 && (
              <View style={[styles.weather, { backgroundColor: colors.muted }]}>
                <Text style={[styles.section, { color: colors.foreground }]}>
                  METEOROLOGIA (AUXILIAR)
                </Text>
                {Object.entries(wx).map(([key, value]) => (
                  <Text
                    key={key}
                    style={[styles.wxText, { color: colors.mutedForeground }]}
                  >
                    {key} · {value}
                  </Text>
                ))}
              </View>
            )}
            {!!routeInfo && (
              <Text
                style={[
                  styles.wxText,
                  { color: colors.mutedForeground, marginBottom: 10 },
                ]}
              >
                Rota sugerida pela API: {routeInfo}
              </Text>
            )}
            <Pressable
              disabled={saving}
              onPress={create}
              style={[
                styles.primaryButton,
                { backgroundColor: colors.primary, opacity: saving ? 0.7 : 1 },
              ]}
            >
              {saving ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.buttonText}>Salvar formulário ICAO</Text>
              )}
            </Pressable>
          </ScrollView>
        </View>
      )}
      <View style={styles.listHead}>
        <Text style={[styles.listTitle, { color: colors.foreground }]}>
          Meus planos ({records.length})
        </Text>
        <Pressable
          onPress={() => {
            setRefreshing(true);
            void load();
          }}
        >
          <Feather name="refresh-cw" size={18} color={colors.primary} />
        </Pressable>
      </View>
      {loading || refreshing ? (
        <ActivityIndicator style={{ marginTop: 30 }} color={colors.primary} />
      ) : (
        <ScrollView
          contentContainerStyle={[
            styles.list,
            { paddingBottom: 90 + insets.bottom },
          ]}
        >
          {!!error && (
            <Text style={[styles.error, { color: colors.destructive }]}>
              {error}
            </Text>
          )}
          {ordered.length === 0 && !error ? (
            <View style={styles.empty}>
              <Feather
                name="navigation"
                size={34}
                color={colors.mutedForeground}
              />
              <Text
                style={[styles.emptyText, { color: colors.mutedForeground }]}
              >
                Nenhum formulário salvo ainda.
              </Text>
            </View>
          ) : null}
          {ordered.map((item) => {
            const data: IcaoForm | undefined = item.payload?.form;
            const open = expanded === item.id;
            return (
              <View
                key={item.id}
                style={[
                  styles.card,
                  { backgroundColor: colors.card, borderColor: colors.border },
                ]}
              >
                <Pressable
                  onPress={() => setExpanded(open ? null : item.id)}
                  style={styles.cardTop}
                >
                  <View style={{ flex: 1 }}>
                    <Text
                      style={[styles.routeTitle, { color: colors.foreground }]}
                    >
                      {item.adep} → {item.ades}
                    </Text>
                    <Text
                      style={[
                        styles.cardMeta,
                        { color: colors.mutedForeground },
                      ]}
                    >
                      {item.numero_voo || data?.identificacao || "Plano ICAO"} ·{" "}
                      {item.data_voo || "Data não informada"} · EOBT{" "}
                      {item.eobt || "—"}Z
                    </Text>
                  </View>
                  <Feather
                    name={open ? "chevron-up" : "chevron-down"}
                    size={18}
                    color={colors.mutedForeground}
                  />
                </Pressable>
                {open && (
                  <View
                    style={[styles.details, { borderTopColor: colors.border }]}
                  >
                    {data ? (
                      fields.map((f) =>
                        data[f.key] ? (
                          <Text
                            key={f.key}
                            style={[
                              styles.detail,
                              { color: colors.foreground },
                            ]}
                          >
                            <Text style={{ color: colors.mutedForeground }}>
                              {f.label}:{" "}
                            </Text>
                            {data[f.key]}
                          </Text>
                        ) : null,
                      )
                    ) : (
                      <Text
                        style={[
                          styles.detail,
                          { color: colors.mutedForeground },
                        ]}
                      >
                        Detalhes não disponíveis no registro.
                      </Text>
                    )}
                    <Pressable
                      onPress={() => remove(item.id)}
                      style={[styles.delete, { backgroundColor: colors.muted }]}
                    >
                      <Feather
                        name="trash-2"
                        size={15}
                        color={colors.destructive}
                      />
                      <Text
                        style={[
                          styles.deleteText,
                          { color: colors.destructive },
                        ]}
                      >
                        Excluir meu formulário
                      </Text>
                    </Pressable>
                  </View>
                )}
              </View>
            );
          })}
        </ScrollView>
      )}
    </View>
  );
}
const styles = StyleSheet.create({
  screen: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 18,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  title: { fontSize: 21, fontFamily: "Inter_700Bold" },
  subtitle: { fontSize: 12, marginTop: 3, fontFamily: "Inter_400Regular" },
  add: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  formShell: { maxHeight: "72%", borderBottomWidth: StyleSheet.hairlineWidth },
  notice: {
    padding: 11,
    borderRadius: 10,
    fontSize: 12,
    lineHeight: 18,
    marginBottom: 8,
  },
  section: {
    fontSize: 11,
    letterSpacing: 0.7,
    fontFamily: "Inter_700Bold",
    marginTop: 14,
    marginBottom: 8,
  },
  field: { marginBottom: 9 },
  label: { fontSize: 13, fontFamily: "Inter_500Medium", marginBottom: 5 },
  input: {
    borderWidth: 1,
    borderRadius: 10,
    minHeight: 44,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    fontFamily: "Inter_400Regular",
  },
  multiline: { minHeight: 82, textAlignVertical: "top" },
  optionRow: { flexDirection: "row", flexWrap: "wrap", gap: 7 },
  optionChip: { borderRadius: 18, paddingHorizontal: 10, paddingVertical: 9 },
  weather: { padding: 12, borderRadius: 10, marginVertical: 8 },
  wxText: { fontSize: 12, lineHeight: 18, marginBottom: 4 },
  primaryButton: {
    minHeight: 48,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 10,
  },
  buttonText: { color: "#fff", fontSize: 15, fontFamily: "Inter_600SemiBold" },
  listHead: {
    paddingHorizontal: 18,
    paddingTop: 16,
    paddingBottom: 8,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  listTitle: { fontSize: 16, fontFamily: "Inter_700Bold" },
  list: { paddingHorizontal: 16, paddingTop: 6 },
  empty: { alignItems: "center", paddingTop: 42, gap: 10 },
  emptyText: { fontSize: 13, fontFamily: "Inter_400Regular" },
  error: { padding: 12, fontSize: 13 },
  card: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 14,
    marginBottom: 10,
    overflow: "hidden",
  },
  cardTop: { flexDirection: "row", alignItems: "center", padding: 14 },
  routeTitle: { fontSize: 17, fontFamily: "Inter_700Bold" },
  cardMeta: { fontSize: 12, marginTop: 5, fontFamily: "Inter_400Regular" },
  details: { borderTopWidth: StyleSheet.hairlineWidth, padding: 13 },
  detail: { fontSize: 12, lineHeight: 18, marginBottom: 5 },
  delete: {
    minHeight: 40,
    borderRadius: 9,
    paddingHorizontal: 12,
    flexDirection: "row",
    gap: 7,
    alignItems: "center",
    alignSelf: "flex-start",
    marginTop: 8,
  },
  deleteText: { fontSize: 12, fontFamily: "Inter_600SemiBold" },
});
