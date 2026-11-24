import { avisar } from "@/src/lib/confirmar";
import { Cabecalho, tema, Icon, Toque } from "@/src/components/ui";
import { useFocusEffect, useRouter } from "expo-router";
import React, { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
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
import { apiFetch } from "@/src/lib/api";

type Ferias = {
  id: string;
  data_inicio: string;
  data_fim: string;
  quantidade_dias: number;
  status: string;
  observacoes?: string | null;
  motivo_reprovacao?: string | null;
  aprovado_em?: string | null;
  criado_em?: string | null;
};
const localISO = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
const labelDate = (d: string) =>
  d?.slice(0, 10).split("-").reverse().join("/") || "—";
const daysInPeriod = (start: string, end: string) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(start) || !/^\d{4}-\d{2}-\d{2}$/.test(end))
    return 0;
  const s = Date.parse(start + "T12:00:00Z"),
    e = Date.parse(end + "T12:00:00Z");
  if (
    !Number.isFinite(s) ||
    !Number.isFinite(e) ||
    new Date(s).toISOString().slice(0, 10) !== start ||
    new Date(e).toISOString().slice(0, 10) !== end
  )
    return 0;
  const n = Math.floor((e - s) / 86400000) + 1;
  return n > 0 && n <= 30 ? n : 0;
};
const statusLabel = (value: string) =>
  ({
    solicitada: "Solicitada",
    aprovada: "Aprovada",
    reprovada: "Reprovada",
    recusada: "Reprovada",
    cancelada: "Cancelada",
  })[value.toLowerCase()] || value;

export default function FeriasScreen() {
  const router = useRouter(),
    insets = useSafeAreaInsets();
  const [requests, setRequests] = useState<Ferias[]>([]);
  const [loading, setLoading] = useState(true),
    [refreshing, setRefreshing] = useState(false);
  const [creating, setCreating] = useState(false),
    [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [from, setFrom] = useState(localISO());
  const [to, setTo] = useState(localISO());
  const [notes, setNotes] = useState("");
  const used = useMemo(
    () =>
      requests
        .filter((r) => r.status === "aprovada")
        .reduce((v, r) => v + Number(r.quantidade_dias || 0), 0),
    [requests],
  );
  const reserved = useMemo(
    () =>
      requests
        .filter((r) => ["aprovada", "solicitada"].includes(r.status))
        .reduce((v, r) => v + Number(r.quantidade_dias || 0), 0),
    [requests],
  );
  const available = Math.max(0, 30 - reserved);
  const days = daysInPeriod(from, to);
  const load = useCallback(async (refresh = false) => {
    if (refresh) setRefreshing(true);
    else setLoading(true);
    setError("");
    try {
      const data = await apiFetch<Ferias[]>("/api/colaborador/ferias");
      setRequests(Array.isArray(data) ? data : []);
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Não foi possível consultar férias.",
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);
  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const submit = async () => {
    if (saving) return;
    if (!days)
      return avisar(
        "Período inválido",
        "Informe datas no formato AAAA-MM-DD. O período deve ter de 1 a 30 dias.",
      );
    if (days > available)
      return avisar(
        "Saldo insuficiente",
        `O período possui ${days} dias, mas o saldo estimado disponível é de ${available} dias.`,
      );
    setSaving(true);
    try {
      await apiFetch("/api/colaborador/ferias", {
        method: "POST",
        body: JSON.stringify({
          data_inicio: from,
          data_fim: to,
          observacoes: notes.trim(),
        }),
      });
      setCreating(false);
      setNotes("");
      await load(true);
      avisar(
        "Solicitação registrada",
        "Seu pedido de férias foi enviado para análise.",
      );
    } catch (e) {
      avisar(
        "Não foi possível solicitar",
        e instanceof Error ? e.message : "Tente novamente.",
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView edges={["top"]} style={[s.root, { paddingTop: 8 }]}>
      <Cabecalho
        titulo={creating ? "Solicitar férias" : "Minhas férias"}
        apoio="Férias"
        voltar={() => (creating ? setCreating(false) : router.back())}
      />
      {!!error && (
        <Toque style={s.alert} onPress={() => void load(true)}>
          <Text style={s.text}>{error} · Atualizar</Text>
        </Toque>
      )}
      {loading ? (
        <ActivityIndicator color={tema.azul} style={{ marginTop: 32 }} />
      ) : (
        <ScrollView
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => void load(true)}
              tintColor={tema.azul}
            />
          }
          contentContainerStyle={{
            padding: 18,
            paddingBottom: insets.bottom + 55,
          }}
          keyboardShouldPersistTaps="handled"
        >
          <View style={s.summary}>
            <Text style={s.kicker}>SALDO DE FÉRIAS</Text>
            <Text style={s.big}>
              {available} <Text style={s.bigUnit}>dias disponíveis*</Text>
            </Text>
            <View style={s.divider} />
            <Text style={s.muted}>
              30 dias de referência · {used} aprovados · {reserved - used}{" "}
              solicitados
            </Text>
            <Text style={[s.muted, { marginTop: 6 }]}>
              *Saldo estimado para pedidos neste fluxo; a aprovação e o cálculo
              oficial seguem o RH.
            </Text>
          </View>
          {creating ? (
            <View style={s.card}>
              <Text style={s.heading}>Novo pedido</Text>
              <Text style={s.muted}>
                Somente férias. Folgas e outros afastamentos devem utilizar seus
                próprios fluxos de RH.
              </Text>
              <Text style={s.label}>Data de início (AAAA-MM-DD)</Text>
              <TextInput
                value={from}
                onChangeText={setFrom}
                style={s.input}
                placeholder="2026-12-01"
                placeholderTextColor={tema.suave}
              />
              <Text style={s.label}>Data final (AAAA-MM-DD)</Text>
              <TextInput
                value={to}
                onChangeText={setTo}
                style={s.input}
                placeholder="2026-12-15"
                placeholderTextColor={tema.suave}
              />
              <Text style={s.muted}>
                Período calculado: {days || "—"} dia(s)
              </Text>
              <Text style={s.label}>Observações (opcional)</Text>
              <TextInput
                value={notes}
                onChangeText={setNotes}
                multiline
                style={[s.input, { minHeight: 90, textAlignVertical: "top" }]}
                placeholder="Informe observações ao RH"
                placeholderTextColor={tema.suave}
              />
              <Toque
                disabled={saving}
                onPress={() => void submit()}
                style={s.primary}
              >
                <Icon name="send" color={tema.fundo} size={18} />
                <Text style={s.primaryText}>
                  {saving ? "Enviando…" : "Enviar solicitação"}
                </Text>
              </Toque>
            </View>
          ) : (
            <>
              <Toque onPress={() => setCreating(true)} style={s.primary}>
                <Icon name="plus-circle" color={tema.fundo} size={20} />
                <Text style={s.primaryText}>Solicitar férias</Text>
              </Toque>
              <Text style={s.section}>HISTÓRICO DE SOLICITAÇÕES</Text>
              {!requests.length && (
                <View style={s.card}>
                  <Text style={s.muted}>
                    Nenhuma solicitação de férias encontrada.
                  </Text>
                </View>
              )}
              {requests.map((r) => (
                <View key={r.id} style={s.card}>
                  <View style={s.between}>
                    <Text style={s.heading}>
                      {labelDate(r.data_inicio)} — {labelDate(r.data_fim)}
                    </Text>
                    <Text style={s.status}>{statusLabel(r.status)}</Text>
                  </View>
                  <Text style={s.muted}>
                    {r.quantidade_dias} dia(s) ·{" "}
                    {r.criado_em
                      ? `Solicitado em ${labelDate(r.criado_em)}`
                      : "Pedido registrado"}
                  </Text>
                  {r.observacoes ? (
                    <Text style={s.text}>{r.observacoes}</Text>
                  ) : null}
                  {r.motivo_reprovacao ? (
                    <Text style={s.rejected}>
                      Motivo da reprovação: {r.motivo_reprovacao}
                    </Text>
                  ) : null}
                </View>
              ))}
            </>
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}
const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: tema.fundo },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 18,
    paddingVertical: 16,
  },
  iconBtn: {
    width: 44,
    height: 44,
    borderRadius: 13,
    backgroundColor: tema.superficie,
    alignItems: "center",
    justifyContent: "center",
  },
  kicker: {
    color: tema.azul,
    fontSize: 10,
    letterSpacing: 1.7,
    fontWeight: "800",
  },
  title: { fontSize: 24, color: "#fff", fontWeight: "800", marginTop: 4 },
  summary: {
    backgroundColor: "#143553",
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: "#326181",
    marginBottom: 16,
  },
  big: { color: "#fff", fontWeight: "800", fontSize: 36, marginTop: 13 },
  bigUnit: { color: "#bad0df", fontSize: 14 },
  divider: { height: 1, backgroundColor: tema.borda, marginVertical: 12 },
  card: {
    backgroundColor: tema.superficie,
    borderRadius: 18,
    padding: 16,
    marginBottom: 12,
  },
  heading: { color: "#fff", fontSize: 15, fontWeight: "700", flexShrink: 1 },
  muted: { color: tema.suave, fontSize: 12, lineHeight: 19, marginTop: 7 },
  text: { color: "#e9f1f9", fontSize: 13, lineHeight: 20, marginTop: 11 },
  rejected: { color: "#ffada8", fontSize: 13, marginTop: 11 },
  between: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  status: {
    color: "#9bddc6",
    backgroundColor: "#194938",
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 8,
    overflow: "hidden",
    fontSize: 11,
  },
  section: {
    color: tema.suave,
    letterSpacing: 1.5,
    fontSize: 11,
    fontWeight: "800",
    marginBottom: 11,
    marginTop: 13,
  },
  label: {
    color: tema.suave,
    fontSize: 12,
    fontWeight: "700",
    marginTop: 16,
    marginBottom: 6,
  },
  input: {
    borderWidth: 1,
    borderColor: tema.borda,
    backgroundColor: tema.fundo,
    color: "#fff",
    borderRadius: 10,
    padding: 12,
    minHeight: 48,
    fontSize: 15,
  },
  primary: {
    minHeight: 56,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    backgroundColor: tema.azul,
    borderRadius: 15,
    marginTop: 18,
    marginBottom: 12,
  },
  primaryText: { color: tema.fundo, fontSize: 15, fontWeight: "800" },
  alert: {
    marginHorizontal: 18,
    padding: 12,
    backgroundColor: "#542637",
    borderRadius: 11,
  },
});
