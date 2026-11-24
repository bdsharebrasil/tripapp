import * as Haptics from "expo-haptics";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  type TextInputProps,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColors } from "@/hooks/useColors";
import { MapaVoo } from "@/src/components/MapaVoo";
import type { Icone } from "@/src/components/ui";
import { apiFetch } from "@/src/lib/api";
import { avisar, confirmar } from "@/src/lib/confirmar";
import { Icon, Toque } from "@/src/components/ui";

type Cores = ReturnType<typeof useColors>;
type StatusPlano = "rascunho" | "enviado" | "aprovado" | "cancelado";

type NovoPlano = {
  partida: string;
  chegada: string;
  trecho: string;
  data: string;
  aeronave: string;
  matricula: string;
  horaPrevista: string;
  estimativaVoo: string;
  combustivelPrevisto: number;
  alternates: string;
  passageiros: number;
  peso: number;
  piloto: string;
  copiloto: string;
  observacoes: string;
  condicoes: string;
  status: StatusPlano;
};
type PlanoVoo = NovoPlano & { id: string };

type PlanoRegistro = {
  id: string;
  numero_voo: string;
  adep: string;
  ades: string;
  data_voo: string;
  eobt: string;
  created_at: string;
  payload: { form?: Partial<NovoPlano> } | null;
};

type FormularioPlano = {
  partida: string;
  chegada: string;
  trecho: string;
  data: string;
  aeronave: string;
  matricula: string;
  horaPrevista: string;
  estimativaVoo: string;
  combustivelPrevisto: string;
  alternates: string;
  passageiros: string;
  peso: string;
  piloto: string;
  copiloto: string;
  observacoes: string;
  condicoes: string;
};

type Clima = { metar?: string; taf?: string; error?: string };
type Ponto = { icao: string; name: string; lat: number; lon: number };
type PlanoRota = {
  flightplan?: {
    route?: string;
    distance_nm?: number;
    estimated_time?: string;
  };
  fuel?: { total_required?: number };
  departure?: Ponto;
  destination?: Ponto;
  alternates?: { icao: string; name: string; distance_km: number }[];
  error?: string;
};

type VooSolicitacao = {
  solicitacao_id?: string | number;
  id?: string | number;
  numero_voo: string;
  origem?: string;
  destino?: string;
  data_agendada?: string;
  matricula?: string;
};

const ICAO = /^[A-Z]{4}$/;
const CONDICOES = ["VMC", "IMC", "IFR", "VFR"];
const STATUS_CONFIG: Record<StatusPlano, { label: string; color: string }> = {
  rascunho: { label: "Rascunho", color: "#94A3B8" },
  enviado: { label: "Enviado", color: "#F59E0B" },
  aprovado: { label: "Aprovado", color: "#22C55E" },
  cancelado: { label: "Cancelado", color: "#EF4444" },
};

const hoje = () => new Date().toISOString().split("T")[0];
const criarFormulario = (): FormularioPlano => ({
  partida: "",
  chegada: "",
  trecho: "",
  data: hoje(),
  aeronave: "Citation CJ3+",
  matricula: "PS-SBR",
  horaPrevista: "",
  estimativaVoo: "",
  combustivelPrevisto: "",
  alternates: "",
  passageiros: "0",
  peso: "",
  piloto: "",
  copiloto: "",
  observacoes: "",
  condicoes: "VMC",
});

const buscarClima = (icao: string) =>
  apiFetch<Clima>(`/api/v1/weather/${encodeURIComponent(icao)}`);
const buscarRota = (adep: string, ades: string) =>
  apiFetch<PlanoRota>(
    `/api/v1/flightplan?adep=${encodeURIComponent(adep)}&ades=${encodeURIComponent(ades)}`,
  );

const mensagemErro = (e: unknown) =>
  e instanceof Error ? e.message : "Tente novamente.";

function corMetar(metar?: string) {
  if (!metar) return "#6B7280";
  const u = metar.toUpperCase();
  if (u.includes("TS") || u.includes("FG") || u.includes("//"))
    return "#DC2626";
  if (u.includes("OVC") || u.includes("BKN0") || u.includes("SCT0"))
    return "#D97706";
  return "#16A34A";
}

function formatarData(dateStr: string) {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function paraPlano(r: PlanoRegistro): PlanoVoo {
  const f: Partial<NovoPlano> = r.payload?.form ?? {};
  return {
    id: r.id,
    partida: r.adep,
    chegada: r.ades,
    trecho: f.trecho ?? `${r.adep}-${r.ades}`,
    data: r.data_voo,
    aeronave: f.aeronave ?? "",
    matricula: f.matricula ?? r.numero_voo,
    horaPrevista: f.horaPrevista ?? r.eobt,
    estimativaVoo: f.estimativaVoo ?? "",
    combustivelPrevisto: f.combustivelPrevisto ?? 0,
    alternates: f.alternates ?? "",
    passageiros: f.passageiros ?? 0,
    peso: f.peso ?? 0,
    piloto: f.piloto ?? "",
    copiloto: f.copiloto ?? "",
    observacoes: f.observacoes ?? "",
    condicoes: f.condicoes ?? "VMC",
    status: f.status ?? "rascunho",
  };
}

function paraRegistro(p: NovoPlano) {
  return {
    numero_voo: p.matricula || p.trecho,
    adep: p.partida,
    ades: p.chegada,
    data_voo: p.data,
    eobt: p.horaPrevista,
    form: p,
    contexto: null,
    rota: null,
    segmentos: [],
    distancia_total_nm: null,
    salvo_em: new Date().toISOString(),
  };
}

function CartaoClima({
  icao,
  dados,
  carregando,
  colors,
}: {
  icao: string;
  dados: Clima | null;
  carregando: boolean;
  colors: Cores;
}) {
  const [expandido, setExpandido] = useState(false);

  return (
    <View style={[wStyles.card, { backgroundColor: colors.card }]}>
      <Toque style={wStyles.header} onPress={() => setExpandido((v) => !v)}>
        <View style={wStyles.titleRow}>
          <View
            style={[wStyles.dot, { backgroundColor: corMetar(dados?.metar) }]}
          />
          <Text style={[wStyles.icao, { color: colors.foreground }]}>
            {icao}
          </Text>
          {carregando && (
            <ActivityIndicator
              size="small"
              color={colors.secondary}
              style={{ marginLeft: 8 }}
            />
          )}
        </View>
        <Icon
          name={expandido ? "chevron-up" : "chevron-down"}
          size={16}
          color={colors.mutedForeground}
        />
      </Toque>

      {dados?.error ? (
        <Text style={[wStyles.errorText, { color: colors.destructive }]}>
          {dados.error}
        </Text>
      ) : dados?.metar ? (
        <>
          <View style={[wStyles.metarBox, { backgroundColor: colors.muted }]}>
            <Text style={[wStyles.label, { color: colors.mutedForeground }]}>
              METAR
            </Text>
            <Text
              style={[wStyles.raw, { color: colors.foreground }]}
              selectable
            >
              {dados.metar}
            </Text>
          </View>
          {expandido && dados.taf ? (
            <View
              style={[
                wStyles.metarBox,
                { backgroundColor: colors.muted, marginTop: 6 },
              ]}
            >
              <Text style={[wStyles.label, { color: colors.mutedForeground }]}>
                TAF
              </Text>
              <Text
                style={[wStyles.raw, { color: colors.foreground }]}
                selectable
              >
                {dados.taf}
              </Text>
            </View>
          ) : null}
          {!expandido && (
            <Text style={[wStyles.tapHint, { color: colors.mutedForeground }]}>
              {dados.taf ? "Toque para ver TAF" : "Sem TAF disponível"}
            </Text>
          )}
        </>
      ) : !carregando ? (
        <Text style={[wStyles.errorText, { color: colors.mutedForeground }]}>
          Sem dados meteorológicos
        </Text>
      ) : null}
    </View>
  );
}

const wStyles = StyleSheet.create({
  card: { borderRadius: 12, padding: 12, marginBottom: 10 },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  titleRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  dot: { width: 10, height: 10, borderRadius: 5 },
  icao: { fontSize: 15, fontFamily: "Inter_700Bold" },
  metarBox: { borderRadius: 8, padding: 10 },
  label: {
    fontSize: 10,
    fontFamily: "Inter_600SemiBold",
    letterSpacing: 1,
    marginBottom: 4,
  },
  raw: {
    fontSize: 12,
    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
    lineHeight: 18,
  },
  tapHint: { fontSize: 11, fontFamily: "Inter_400Regular", marginTop: 6 },
  errorText: { fontSize: 12, fontFamily: "Inter_400Regular" },
});

function DetalheVoo({
  plano,
  visivel,
  onFechar,
  colors,
}: {
  plano: PlanoVoo | null;
  visivel: boolean;
  onFechar: () => void;
  colors: Cores;
}) {
  const insets = useSafeAreaInsets();
  const [rota, setRota] = useState<PlanoRota | null>(null);
  const [climaPartida, setClimaPartida] = useState<Clima | null>(null);
  const [climaChegada, setClimaChegada] = useState<Clima | null>(null);
  const [carregandoRota, setCarregandoRota] = useState(false);
  const [carregandoClima, setCarregandoClima] = useState(false);
  const [erroRota, setErroRota] = useState<string | null>(null);

  useEffect(() => {
    if (!visivel || !plano) return;
    let ativo = true;
    setRota(null);
    setClimaPartida(null);
    setClimaChegada(null);
    setErroRota(null);

    setCarregandoRota(true);
    buscarRota(plano.partida, plano.chegada)
      .then((d) => {
        if (!ativo) return;
        if (d.error) setErroRota(d.error);
        else setRota(d);
      })
      .catch((e: unknown) => {
        if (ativo) setErroRota(mensagemErro(e));
      })
      .finally(() => {
        if (ativo) setCarregandoRota(false);
      });

    setCarregandoClima(true);
    Promise.allSettled([buscarClima(plano.partida), buscarClima(plano.chegada)])
      .then(([p, c]) => {
        if (!ativo) return;
        setClimaPartida(
          p.status === "fulfilled" ? p.value : { error: "Falha ao buscar" },
        );
        setClimaChegada(
          c.status === "fulfilled" ? c.value : { error: "Falha ao buscar" },
        );
      })
      .finally(() => {
        if (ativo) setCarregandoClima(false);
      });

    return () => {
      ativo = false;
    };
  }, [visivel, plano]);

  if (!plano) return null;
  const cfg = STATUS_CONFIG[plano.status];
  const linhas: { icone: Icone; rotulo: string; valor: string }[] = [
    { icone: "user", rotulo: "Comandante", valor: plano.piloto || "—" },
    { icone: "users", rotulo: "Co-piloto", valor: plano.copiloto || "—" },
    {
      icone: "cpu",
      rotulo: "Aeronave",
      valor: `${plano.aeronave} · ${plano.matricula}`,
    },
    { icone: "calendar", rotulo: "Data", valor: formatarData(plano.data) },
    {
      icone: "clock",
      rotulo: "Hora prevista",
      valor: plano.horaPrevista || "—",
    },
    { icone: "wind", rotulo: "Condições", valor: plano.condicoes },
    {
      icone: "users",
      rotulo: "Passageiros",
      valor: `${plano.passageiros} pax`,
    },
  ];

  return (
    <Modal
      visible={visivel}
      animationType="slide"
      presentationStyle="pageSheet"
    >
      <View style={[dStyles.container, { backgroundColor: colors.background }]}>
        <View
          style={[
            dStyles.header,
            {
              backgroundColor: colors.card,
              borderBottomColor: colors.border,
              paddingTop: Platform.OS === "ios" ? 60 : 16,
            },
          ]}
        >
          <Toque
            accessibilityRole="button"
            accessibilityLabel="Fechar"
            onPress={onFechar}
          >
            <Icon name="x" size={22} color={colors.foreground} />
          </Toque>
          <View style={dStyles.headerCenter}>
            <Text style={[dStyles.headerTitle, { color: colors.foreground }]}>
              {plano.partida} → {plano.chegada}
            </Text>
            <Text style={[dStyles.headerSub, { color: cfg.color }]}>
              {cfg.label}
            </Text>
          </View>
          <View style={{ width: 22 }} />
        </View>

        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[
            dStyles.scroll,
            { paddingBottom: insets.bottom + 24 },
          ]}
        >
          <Text
            style={[dStyles.sectionLabel, { color: colors.mutedForeground }]}
          >
            ROTA
          </Text>
          {carregandoRota ? (
            <View
              style={[dStyles.mapLoader, { backgroundColor: colors.muted }]}
            >
              <ActivityIndicator color={colors.secondary} />
              <Text
                style={[dStyles.loadingText, { color: colors.mutedForeground }]}
              >
                Buscando coordenadas...
              </Text>
            </View>
          ) : erroRota ? (
            <View
              style={[dStyles.mapLoader, { backgroundColor: colors.muted }]}
            >
              <Icon name="alert-circle" size={24} color={colors.destructive} />
              <Text style={[dStyles.errorMsg, { color: colors.destructive }]}>
                {erroRota}
              </Text>
            </View>
          ) : rota ? (
            <>
              {rota.departure && rota.destination ? (
                <MapaVoo
                  origem={rota.departure}
                  destino={rota.destination}
                  posicao={null}
                  trilha={[]}
                  origemNome={rota.departure.icao}
                  destinoNome={rota.destination.icao}
                  atual={false}
                />
              ) : null}
              <View style={dStyles.airports}>
                <View style={{ flex: 1 }}>
                  <Text
                    style={[dStyles.airportCode, { color: colors.foreground }]}
                  >
                    {plano.partida}
                  </Text>
                  <Text
                    style={[
                      dStyles.airportName,
                      { color: colors.mutedForeground },
                    ]}
                    numberOfLines={2}
                  >
                    {rota.departure?.name ?? ""}
                  </Text>
                </View>
                <Icon
                  name="arrow-right"
                  size={16}
                  color={colors.mutedForeground}
                  style={{ marginTop: 4 }}
                />
                <View style={{ flex: 1, alignItems: "flex-end" }}>
                  <Text
                    style={[dStyles.airportCode, { color: colors.secondary }]}
                  >
                    {plano.chegada}
                  </Text>
                  <Text
                    style={[
                      dStyles.airportName,
                      { color: colors.mutedForeground, textAlign: "right" },
                    ]}
                    numberOfLines={2}
                  >
                    {rota.destination?.name ?? ""}
                  </Text>
                </View>
              </View>

              <View style={[dStyles.infoRow, { backgroundColor: colors.card }]}>
                <View style={dStyles.infoItem}>
                  <Icon name="navigation" size={14} color={colors.secondary} />
                  <Text
                    style={[dStyles.infoValue, { color: colors.foreground }]}
                  >
                    {rota.flightplan?.distance_nm ?? "—"} NM
                  </Text>
                  <Text
                    style={[
                      dStyles.infoLabel,
                      { color: colors.mutedForeground },
                    ]}
                  >
                    Distância
                  </Text>
                </View>
                <View
                  style={[dStyles.divider, { backgroundColor: colors.border }]}
                />
                <View style={dStyles.infoItem}>
                  <Icon name="clock" size={14} color={colors.secondary} />
                  <Text
                    style={[dStyles.infoValue, { color: colors.foreground }]}
                  >
                    {rota.flightplan?.estimated_time ?? "—"}
                  </Text>
                  <Text
                    style={[
                      dStyles.infoLabel,
                      { color: colors.mutedForeground },
                    ]}
                  >
                    Estimativa
                  </Text>
                </View>
                <View
                  style={[dStyles.divider, { backgroundColor: colors.border }]}
                />
                <View style={dStyles.infoItem}>
                  <Icon name="droplet" size={14} color={colors.secondary} />
                  <Text
                    style={[dStyles.infoValue, { color: colors.foreground }]}
                  >
                    {rota.fuel?.total_required ?? "—"}L
                  </Text>
                  <Text
                    style={[
                      dStyles.infoLabel,
                      { color: colors.mutedForeground },
                    ]}
                  >
                    Combustível
                  </Text>
                </View>
              </View>

              {rota.flightplan?.route ? (
                <View
                  style={[dStyles.routeBox, { backgroundColor: colors.muted }]}
                >
                  <Text
                    style={[
                      dStyles.routeLabel,
                      { color: colors.mutedForeground },
                    ]}
                  >
                    ROTA AIS
                  </Text>
                  <Text
                    style={[dStyles.routeText, { color: colors.foreground }]}
                    selectable
                  >
                    {rota.flightplan.route}
                  </Text>
                </View>
              ) : null}

              {!!rota.alternates?.length && (
                <View
                  style={[dStyles.altBox, { backgroundColor: colors.card }]}
                >
                  <Text
                    style={[dStyles.altTitle, { color: colors.foreground }]}
                  >
                    <Icon name="anchor" size={13} color={colors.foreground} />{" "}
                    Alternados próximos
                  </Text>
                  {rota.alternates.map((a) => (
                    <View key={a.icao} style={dStyles.altRow}>
                      <Text
                        style={[dStyles.altIcao, { color: colors.secondary }]}
                      >
                        {a.icao}
                      </Text>
                      <Text
                        style={[
                          dStyles.altName,
                          { color: colors.mutedForeground },
                        ]}
                        numberOfLines={1}
                      >
                        {a.name}
                      </Text>
                      <Text
                        style={[
                          dStyles.altDist,
                          { color: colors.mutedForeground },
                        ]}
                      >
                        {a.distance_km}km
                      </Text>
                    </View>
                  ))}
                </View>
              )}
            </>
          ) : null}

          <Text
            style={[
              dStyles.sectionLabel,
              { color: colors.mutedForeground, marginTop: 20 },
            ]}
          >
            METEOROLOGIA
          </Text>
          <CartaoClima
            icao={plano.partida}
            dados={climaPartida}
            carregando={carregandoClima && !climaPartida}
            colors={colors}
          />
          <CartaoClima
            icao={plano.chegada}
            dados={climaChegada}
            carregando={carregandoClima && !climaChegada}
            colors={colors}
          />

          <Text
            style={[
              dStyles.sectionLabel,
              { color: colors.mutedForeground, marginTop: 8 },
            ]}
          >
            DETALHES DO PLANO
          </Text>
          <View style={[dStyles.detailCard, { backgroundColor: colors.card }]}>
            {linhas.map(({ icone, rotulo, valor }) => (
              <View
                key={rotulo}
                style={[
                  dStyles.detailRow,
                  { borderBottomColor: colors.border },
                ]}
              >
                <Icon name={icone} size={13} color={colors.mutedForeground} />
                <Text
                  style={[
                    dStyles.detailLabel,
                    { color: colors.mutedForeground },
                  ]}
                >
                  {rotulo}
                </Text>
                <Text
                  style={[dStyles.detailValue, { color: colors.foreground }]}
                >
                  {valor}
                </Text>
              </View>
            ))}
            {plano.observacoes ? (
              <View style={dStyles.obsBox}>
                <Text
                  style={[
                    dStyles.detailLabel,
                    { color: colors.mutedForeground },
                  ]}
                >
                  Observações
                </Text>
                <Text style={[dStyles.obsText, { color: colors.foreground }]}>
                  {plano.observacoes}
                </Text>
              </View>
            ) : null}
          </View>
        </ScrollView>
      </View>
    </Modal>
  );
}

const dStyles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 16,
    borderBottomWidth: 1,
  },
  headerCenter: { alignItems: "center" },
  headerTitle: { fontSize: 16, fontFamily: "Inter_700Bold" },
  headerSub: { fontSize: 12, fontFamily: "Inter_500Medium" },
  scroll: { padding: 16 },
  sectionLabel: {
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
    letterSpacing: 1,
    marginBottom: 10,
  },
  mapLoader: {
    height: 180,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
  },
  loadingText: { fontSize: 13, fontFamily: "Inter_400Regular" },
  errorMsg: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
    maxWidth: 240,
  },
  airports: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    marginTop: 12,
    marginBottom: 10,
  },
  airportCode: { fontSize: 18, fontFamily: "Inter_700Bold" },
  airportName: { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 2 },
  infoRow: {
    flexDirection: "row",
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
  },
  infoItem: { flex: 1, alignItems: "center", gap: 4 },
  infoValue: { fontSize: 15, fontFamily: "Inter_700Bold" },
  infoLabel: { fontSize: 11, fontFamily: "Inter_400Regular" },
  divider: { width: 1, marginVertical: 4 },
  routeBox: { borderRadius: 10, padding: 12, marginBottom: 10 },
  routeLabel: {
    fontSize: 10,
    fontFamily: "Inter_600SemiBold",
    letterSpacing: 1,
    marginBottom: 4,
  },
  routeText: {
    fontSize: 12,
    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
  },
  altBox: { borderRadius: 12, padding: 12, marginBottom: 10 },
  altTitle: { fontSize: 13, fontFamily: "Inter_600SemiBold", marginBottom: 8 },
  altRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 4,
  },
  altIcao: { fontSize: 13, fontFamily: "Inter_700Bold", width: 40 },
  altName: { flex: 1, fontSize: 12, fontFamily: "Inter_400Regular" },
  altDist: { fontSize: 12, fontFamily: "Inter_400Regular" },
  detailCard: { borderRadius: 12, overflow: "hidden" },
  detailRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  detailLabel: { fontSize: 12, fontFamily: "Inter_400Regular", width: 100 },
  detailValue: { flex: 1, fontSize: 13, fontFamily: "Inter_500Medium" },
  obsBox: { padding: 12 },
  obsText: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    marginTop: 4,
    fontStyle: "italic",
  },
});

function CartaoPlano({
  plano,
  onAbrir,
  onExcluir,
  colors,
}: {
  plano: PlanoVoo;
  onAbrir: () => void;
  onExcluir: () => void;
  colors: Cores;
}) {
  const cfg = STATUS_CONFIG[plano.status];
  return (
    <Toque
      style={[
        pStyles.card,
        { backgroundColor: colors.card, borderColor: colors.border },
      ]}
      onPress={onAbrir}
    >
      <View style={pStyles.top}>
        <View style={pStyles.routeRow}>
          <Text style={[pStyles.iata, { color: colors.foreground }]}>
            {plano.partida}
          </Text>
          <Icon
            name="arrow-right"
            size={16}
            color={colors.mutedForeground}
            style={{ marginHorizontal: 8 }}
          />
          <Text style={[pStyles.iata, { color: colors.secondary }]}>
            {plano.chegada}
          </Text>
        </View>
        <View style={[pStyles.badge, { backgroundColor: `${cfg.color}26` }]}>
          <Text style={[pStyles.badgeText, { color: cfg.color }]}>
            {cfg.label}
          </Text>
        </View>
      </View>
      <Text style={[pStyles.aircraft, { color: colors.mutedForeground }]}>
        {plano.aeronave} · {plano.matricula}
      </Text>
      <View style={pStyles.detailRow}>
        <View style={pStyles.detail}>
          <Icon name="calendar" size={12} color={colors.mutedForeground} />
          <Text style={[pStyles.detailText, { color: colors.mutedForeground }]}>
            {formatarData(plano.data)}
          </Text>
        </View>
        <View style={pStyles.detail}>
          <Icon name="clock" size={12} color={colors.mutedForeground} />
          <Text style={[pStyles.detailText, { color: colors.mutedForeground }]}>
            {plano.horaPrevista || "—"} · {plano.estimativaVoo || "—"}h
          </Text>
        </View>
        <View style={pStyles.detail}>
          <Icon name="users" size={12} color={colors.mutedForeground} />
          <Text style={[pStyles.detailText, { color: colors.mutedForeground }]}>
            {plano.passageiros} pax
          </Text>
        </View>
      </View>
      {plano.piloto || plano.copiloto ? (
        <View style={[pStyles.crewRow, { backgroundColor: colors.muted }]}>
          <Icon name="user" size={12} color={colors.mutedForeground} />
          <Text style={[pStyles.crewText, { color: colors.mutedForeground }]}>
            {plano.piloto}
            {plano.copiloto ? ` / ${plano.copiloto}` : ""}
          </Text>
        </View>
      ) : null}
      <View style={pStyles.actions}>
        <View style={pStyles.tapHintRow}>
          <Icon name="map" size={12} color={colors.mutedForeground} />
          <Text style={[pStyles.tapHint, { color: colors.mutedForeground }]}>
            Ver rota e meteorologia
          </Text>
        </View>
        <Toque
          accessibilityRole="button"
          accessibilityLabel="Excluir plano de voo"
          style={[pStyles.deleteBtn, { backgroundColor: colors.muted }]}
          onPress={onExcluir}
        >
          <Icon name="trash-2" size={13} color={colors.destructive} />
        </Toque>
      </View>
    </Toque>
  );
}

const pStyles = StyleSheet.create({
  card: {
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 14,
    marginBottom: 10,
  },
  top: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 4,
  },
  routeRow: { flexDirection: "row", alignItems: "center" },
  iata: { fontSize: 20, fontFamily: "Inter_700Bold" },
  aircraft: { fontSize: 12, fontFamily: "Inter_400Regular", marginBottom: 8 },
  badge: { borderRadius: 100, paddingHorizontal: 10, paddingVertical: 4 },
  badgeText: { fontSize: 11, fontFamily: "Inter_500Medium" },
  detailRow: {
    flexDirection: "row",
    gap: 12,
    flexWrap: "wrap",
    marginBottom: 8,
  },
  detail: { flexDirection: "row", alignItems: "center", gap: 4 },
  detailText: { fontSize: 12, fontFamily: "Inter_400Regular" },
  crewRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderRadius: 8,
    padding: 8,
    marginBottom: 8,
  },
  crewText: { fontSize: 12, fontFamily: "Inter_400Regular" },
  actions: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  tapHintRow: { flexDirection: "row", alignItems: "center", gap: 4 },
  tapHint: { fontSize: 11, fontFamily: "Inter_400Regular" },
  deleteBtn: {
    width: 34,
    height: 34,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
});

function Campo({
  rotulo,
  colors,
  multilinha,
  ...entrada
}: { rotulo: string; colors: Cores; multilinha?: boolean } & TextInputProps) {
  return (
    <View style={mStyles.campo}>
      <Text style={[mStyles.label, { color: colors.foreground }]}>
        {rotulo}
      </Text>
      <TextInput
        placeholderTextColor={colors.mutedForeground}
        style={[
          mStyles.input,
          multilinha && mStyles.textarea,
          {
            backgroundColor: colors.card,
            color: colors.foreground,
            borderColor: colors.border,
          },
        ]}
        {...entrada}
      />
    </View>
  );
}

function SeletorSolicitacao({
  voos,
  carregando,
  erro,
  onSelecionar,
  colors,
}: {
  voos: VooSolicitacao[];
  carregando: boolean;
  erro: string;
  onSelecionar: (voo: VooSolicitacao) => void;
  colors: Cores;
}) {
  const [busca, setBusca] = useState("");
  const [aberto, setAberto] = useState(false);
  const termo = busca.trim().toUpperCase();
  const resultados = useMemo(
    () =>
      voos
        .filter((voo) => voo.numero_voo.toUpperCase().includes(termo))
        .slice(0, 10),
    [voos, termo],
  );

  const escolher = (voo: VooSolicitacao) => {
    setBusca(voo.numero_voo);
    setAberto(false);
    onSelecionar(voo);
  };

  return (
    <View style={cStyles.wrap}>
      <View
        style={[
          cStyles.caixa,
          { backgroundColor: colors.card, borderColor: colors.border },
        ]}
      >
        <Icon name="search" size={16} color={colors.mutedForeground} />
        <TextInput
          accessibilityLabel="Buscar solicitação de voo"
          value={busca}
          onChangeText={(texto) => {
            setBusca(texto);
            setAberto(true);
          }}
          onFocus={() => setAberto(true)}
          onBlur={() => setAberto(false)}
          placeholder="Número da solicitação, ex.: EBL-0003/26"
          placeholderTextColor={colors.mutedForeground}
          autoCapitalize="characters"
          autoCorrect={false}
          style={[cStyles.input, { color: colors.foreground }]}
        />
        {carregando && (
          <ActivityIndicator size="small" color={colors.secondary} />
        )}
      </View>
      {!!erro && (
        <Text style={[cStyles.msg, { color: colors.destructive }]}>{erro}</Text>
      )}
      {aberto && (
        <View
          style={[
            cStyles.lista,
            { backgroundColor: colors.card, borderColor: colors.border },
          ]}
        >
          {resultados.length ? (
            resultados.map((voo, i) => (
              <Toque
                key={`${voo.numero_voo}-${i}`}
                accessibilityRole="button"
                onPress={() => escolher(voo)}
                style={[cStyles.item, { borderBottomColor: colors.border }]}
              >
                <Text style={[cStyles.numero, { color: colors.foreground }]}>
                  {voo.numero_voo}
                </Text>
                <Text
                  style={[cStyles.detalhe, { color: colors.mutedForeground }]}
                >
                  {[voo.origem, voo.destino].filter(Boolean).join(" → ")}
                  {voo.data_agendada
                    ? ` · ${formatarData(voo.data_agendada.slice(0, 10))}`
                    : ""}
                </Text>
              </Toque>
            ))
          ) : (
            <Text style={[cStyles.msg, { color: colors.mutedForeground }]}>
              {carregando
                ? "Carregando solicitações…"
                : "Nenhuma solicitação encontrada"}
            </Text>
          )}
        </View>
      )}
    </View>
  );
}

const cStyles = StyleSheet.create({
  wrap: { marginBottom: 10 },
  caixa: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 10,
  },
  input: {
    flex: 1,
    paddingVertical: 10,
    fontSize: 14,
    fontFamily: "Inter_400Regular",
  },
  lista: {
    marginTop: 6,
    borderRadius: 10,
    borderWidth: 1,
    overflow: "hidden",
  },
  item: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  numero: { fontSize: 14, fontFamily: "Inter_700Bold" },
  detalhe: { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 2 },
  msg: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
});

function NovoPlanoModal({
  visivel,
  onFechar,
  onSalvar,
  colors,
}: {
  visivel: boolean;
  onFechar: () => void;
  onSalvar: (plano: NovoPlano) => Promise<boolean>;
  colors: Cores;
}) {
  const [form, setForm] = useState<FormularioPlano>(criarFormulario);
  const [salvando, setSalvando] = useState(false);
  const [clima, setClima] = useState<{ partida?: Clima; chegada?: Clima }>({});
  const [carregandoClima, setCarregandoClima] = useState(false);
  const [voos, setVoos] = useState<VooSolicitacao[]>([]);
  const [carregandoVoos, setCarregandoVoos] = useState(false);
  const [erroVoos, setErroVoos] = useState("");

  const partidaIcao = form.partida.trim().toUpperCase();
  const chegadaIcao = form.chegada.trim().toUpperCase();
  const icaoValidos = ICAO.test(partidaIcao) && ICAO.test(chegadaIcao);

  const set = (campo: keyof FormularioPlano, valor: string) =>
    setForm((atual) => ({ ...atual, [campo]: valor }));

  useEffect(() => {
    if (visivel) setForm(criarFormulario());
  }, [visivel]);

  useEffect(() => {
    if (!icaoValidos) {
      setClima({});
      setCarregandoClima(false);
      return;
    }
    let ativo = true;
    setCarregandoClima(true);
    const timer = setTimeout(() => {
      Promise.allSettled([buscarClima(partidaIcao), buscarClima(chegadaIcao)])
        .then(([p, c]) => {
          if (!ativo) return;
          setClima({
            partida: p.status === "fulfilled" ? p.value : undefined,
            chegada: c.status === "fulfilled" ? c.value : undefined,
          });
        })
        .finally(() => {
          if (ativo) setCarregandoClima(false);
        });
    }, 800);
    return () => {
      ativo = false;
      clearTimeout(timer);
    };
  }, [partidaIcao, chegadaIcao, icaoValidos]);

  useEffect(() => {
    if (!visivel) return;
    let ativo = true;
    setCarregandoVoos(true);
    setErroVoos("");
    apiFetch<{ voos: VooSolicitacao[] }>(
      "/api/financeiro/relatorios-despesa-viagem/meus-voos",
    )
      .then((r) => {
        if (ativo)
          setVoos(
            Array.isArray(r.voos) ? r.voos.filter((voo) => voo.numero_voo) : [],
          );
      })
      .catch((e) => {
        if (ativo) setErroVoos(mensagemErro(e));
      })
      .finally(() => {
        if (ativo) setCarregandoVoos(false);
      });
    return () => {
      ativo = false;
    };
  }, [visivel]);

  const selecionarVoo = (voo: VooSolicitacao) =>
    setForm((atual) => ({
      ...atual,
      partida: voo.origem?.trim().toUpperCase() || atual.partida,
      chegada: voo.destino?.trim().toUpperCase() || atual.chegada,
      data: voo.data_agendada?.slice(0, 10) || atual.data,
      matricula: voo.matricula?.trim().toUpperCase() || atual.matricula,
    }));

  const enviar = async (status: StatusPlano) => {
    if (!icaoValidos || !form.data.trim()) {
      avisar(
        "Campos obrigatórios",
        "Preencha partida e chegada (ICAO, 4 letras) e a data.",
      );
      return;
    }
    setSalvando(true);
    const ok = await onSalvar({
      partida: partidaIcao,
      chegada: chegadaIcao,
      trecho: form.trecho.trim() || `${partidaIcao}-${chegadaIcao}`,
      data: form.data.trim(),
      aeronave: form.aeronave.trim(),
      matricula: form.matricula.trim().toUpperCase(),
      horaPrevista: form.horaPrevista.trim(),
      estimativaVoo: form.estimativaVoo.trim(),
      combustivelPrevisto: Number(form.combustivelPrevisto) || 0,
      alternates: form.alternates.trim().toUpperCase(),
      passageiros: Number.parseInt(form.passageiros, 10) || 0,
      peso: Number(form.peso) || 0,
      piloto: form.piloto.trim(),
      copiloto: form.copiloto.trim(),
      observacoes: form.observacoes.trim(),
      condicoes: form.condicoes,
      status,
    });
    setSalvando(false);
    if (ok) onFechar();
  };

  const mostrarClima = partidaIcao.length > 0 || chegadaIcao.length > 0;

  return (
    <Modal
      visible={visivel}
      animationType="slide"
      presentationStyle="pageSheet"
    >
      <View style={[mStyles.container, { backgroundColor: colors.background }]}>
        <View
          style={[
            mStyles.header,
            {
              backgroundColor: colors.card,
              borderBottomColor: colors.border,
              paddingTop: Platform.OS === "ios" ? 60 : 16,
            },
          ]}
        >
          <Toque
            accessibilityRole="button"
            accessibilityLabel="Fechar"
            onPress={onFechar}
          >
            <Icon name="x" size={22} color={colors.foreground} />
          </Toque>
          <Text style={[mStyles.title, { color: colors.foreground }]}>
            Novo plano de voo
          </Text>
          <Toque
            disabled={salvando}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              void enviar("enviado");
            }}
          >
            {salvando ? (
              <ActivityIndicator color={colors.secondary} />
            ) : (
              <Text style={[mStyles.saveText, { color: colors.secondary }]}>
                Enviar
              </Text>
            )}
          </Toque>
        </View>

        <ScrollView
          contentContainerStyle={mStyles.form}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <Text style={[mStyles.secao, { color: colors.mutedForeground }]}>
            SOLICITAÇÃO DE VOO
          </Text>
          <SeletorSolicitacao
            voos={voos}
            carregando={carregandoVoos}
            erro={erroVoos}
            onSelecionar={selecionarVoo}
            colors={colors}
          />

          <Text style={[mStyles.secao, { color: colors.mutedForeground }]}>
            ROTA
          </Text>
          <View style={mStyles.row}>
            <Campo
              rotulo="Partida *"
              colors={colors}
              value={form.partida}
              onChangeText={(v) => set("partida", v)}
              placeholder="SBGR"
              autoCapitalize="characters"
              maxLength={4}
            />
            <Campo
              rotulo="Chegada *"
              colors={colors}
              value={form.chegada}
              onChangeText={(v) => set("chegada", v)}
              placeholder="SBBR"
              autoCapitalize="characters"
              maxLength={4}
            />
          </View>

          {mostrarClima && (
            <View
              style={[mStyles.wxPreview, { backgroundColor: colors.muted }]}
            >
              <View style={mStyles.wxRow}>
                <Icon name="cloud" size={14} color={colors.secondary} />
                <Text style={[mStyles.wxTitle, { color: colors.foreground }]}>
                  Meteorologia
                </Text>
                {carregandoClima && (
                  <ActivityIndicator
                    size="small"
                    color={colors.secondary}
                    style={{ marginLeft: 4 }}
                  />
                )}
              </View>
              {clima.partida && (
                <View style={mStyles.wxItem}>
                  <View
                    style={[
                      mStyles.wxDot,
                      { backgroundColor: corMetar(clima.partida.metar) },
                    ]}
                  />
                  <Text style={[mStyles.wxIcao, { color: colors.foreground }]}>
                    {partidaIcao}
                  </Text>
                  <Text
                    style={[mStyles.wxMetar, { color: colors.mutedForeground }]}
                    numberOfLines={1}
                  >
                    {clima.partida.metar || clima.partida.error || "Sem dados"}
                  </Text>
                </View>
              )}
              {clima.chegada && (
                <View style={mStyles.wxItem}>
                  <View
                    style={[
                      mStyles.wxDot,
                      { backgroundColor: corMetar(clima.chegada.metar) },
                    ]}
                  />
                  <Text style={[mStyles.wxIcao, { color: colors.foreground }]}>
                    {chegadaIcao}
                  </Text>
                  <Text
                    style={[mStyles.wxMetar, { color: colors.mutedForeground }]}
                    numberOfLines={1}
                  >
                    {clima.chegada.metar || clima.chegada.error || "Sem dados"}
                  </Text>
                </View>
              )}
              {!carregandoClima && !clima.partida && !clima.chegada && (
                <Text
                  style={[mStyles.wxHint, { color: colors.mutedForeground }]}
                >
                  Preencha os ICAOs para ver o METAR
                </Text>
              )}
            </View>
          )}

          <Campo
            rotulo="Aeródromo alternado"
            colors={colors}
            value={form.alternates}
            onChangeText={(v) => set("alternates", v)}
            placeholder="SBSP"
            autoCapitalize="characters"
          />

          <Text style={[mStyles.secao, { color: colors.mutedForeground }]}>
            AERONAVE E DATA
          </Text>
          <View style={mStyles.row}>
            <Campo
              rotulo="Aeronave"
              colors={colors}
              value={form.aeronave}
              onChangeText={(v) => set("aeronave", v)}
            />
            <Campo
              rotulo="Matrícula"
              colors={colors}
              value={form.matricula}
              onChangeText={(v) => set("matricula", v)}
              autoCapitalize="characters"
            />
          </View>
          <View style={mStyles.row}>
            <Campo
              rotulo="Data *"
              colors={colors}
              value={form.data}
              onChangeText={(v) => set("data", v)}
              placeholder="AAAA-MM-DD"
            />
            <Campo
              rotulo="Hora prevista"
              colors={colors}
              value={form.horaPrevista}
              onChangeText={(v) => set("horaPrevista", v)}
              placeholder="10:00"
              keyboardType="numbers-and-punctuation"
            />
          </View>
          <View style={mStyles.row}>
            <Campo
              rotulo="Estimativa (h)"
              colors={colors}
              value={form.estimativaVoo}
              onChangeText={(v) => set("estimativaVoo", v)}
              placeholder="01:30"
              keyboardType="numbers-and-punctuation"
            />
            <Campo
              rotulo="Combustível (L)"
              colors={colors}
              value={form.combustivelPrevisto}
              onChangeText={(v) => set("combustivelPrevisto", v)}
              keyboardType="numeric"
            />
          </View>
          <View style={mStyles.row}>
            <Campo
              rotulo="Pax"
              colors={colors}
              value={form.passageiros}
              onChangeText={(v) => set("passageiros", v)}
              keyboardType="numeric"
            />
            <Campo
              rotulo="Peso (kg)"
              colors={colors}
              value={form.peso}
              onChangeText={(v) => set("peso", v)}
              keyboardType="numeric"
            />
          </View>

          <Text style={[mStyles.secao, { color: colors.mutedForeground }]}>
            TRIPULAÇÃO
          </Text>
          <Campo
            rotulo="Comandante (PIC)"
            colors={colors}
            value={form.piloto}
            onChangeText={(v) => set("piloto", v)}
          />
          <Campo
            rotulo="Co-piloto (SIC)"
            colors={colors}
            value={form.copiloto}
            onChangeText={(v) => set("copiloto", v)}
          />

          <Text style={[mStyles.secao, { color: colors.mutedForeground }]}>
            CONDIÇÕES E OBS.
          </Text>
          <View style={mStyles.chipRow}>
            {CONDICOES.map((c) => {
              const ativo = form.condicoes === c;
              return (
                <Toque
                  key={c}
                  accessibilityRole="button"
                  onPress={() => set("condicoes", c)}
                  style={[
                    mStyles.chip,
                    { backgroundColor: ativo ? colors.primary : colors.muted },
                  ]}
                >
                  <Text
                    style={[
                      mStyles.chipText,
                      { color: ativo ? "#FFFFFF" : colors.mutedForeground },
                    ]}
                  >
                    {c}
                  </Text>
                </Toque>
              );
            })}
          </View>
          <Campo
            rotulo="Observações"
            colors={colors}
            multilinha
            multiline
            numberOfLines={4}
            value={form.observacoes}
            onChangeText={(v) => set("observacoes", v)}
            placeholder="Informações adicionais..."
          />
          <Toque
            disabled={salvando}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              void enviar("rascunho");
            }}
            style={[mStyles.rascunhoBtn, { backgroundColor: colors.muted }]}
          >
            <Text style={[mStyles.rascunhoText, { color: colors.foreground }]}>
              Salvar como rascunho
            </Text>
          </Toque>
        </ScrollView>
      </View>
    </Modal>
  );
}

const mStyles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 16,
    borderBottomWidth: 1,
  },
  title: { fontSize: 17, fontFamily: "Inter_700Bold" },
  saveText: { fontSize: 16, fontFamily: "Inter_600SemiBold" },
  form: { padding: 16, gap: 4, paddingBottom: 40 },
  secao: {
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
    letterSpacing: 1,
    marginTop: 16,
    marginBottom: 4,
  },
  row: { flexDirection: "row", gap: 10 },
  campo: { flex: 1 },
  label: { fontSize: 13, fontFamily: "Inter_500Medium", marginBottom: 4 },
  input: {
    borderRadius: 10,
    borderWidth: 1,
    padding: 10,
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    marginBottom: 10,
  },
  textarea: {
    marginBottom: 16,
    minHeight: 80,
    textAlignVertical: "top",
  },
  chipRow: { flexDirection: "row", gap: 8, marginBottom: 12 },
  chip: { borderRadius: 100, paddingHorizontal: 14, paddingVertical: 8 },
  chipText: { fontSize: 13, fontFamily: "Inter_500Medium" },
  rascunhoBtn: { borderRadius: 12, padding: 14, alignItems: "center" },
  rascunhoText: { fontSize: 15, fontFamily: "Inter_600SemiBold" },
  wxPreview: { borderRadius: 10, padding: 12, marginBottom: 12 },
  wxRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 8,
  },
  wxTitle: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  wxItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 4,
  },
  wxDot: { width: 8, height: 8, borderRadius: 4 },
  wxIcao: { fontSize: 13, fontFamily: "Inter_700Bold", width: 38 },
  wxMetar: {
    flex: 1,
    fontSize: 11,
    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
  },
  wxHint: { fontSize: 12, fontFamily: "Inter_400Regular" },
});

export default function PlanoVooScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const [planos, setPlanos] = useState<PlanoVoo[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState("");
  const [mostrarNovo, setMostrarNovo] = useState(false);
  const [planoSelecionado, setPlanoSelecionado] = useState<PlanoVoo | null>(
    null,
  );

  const carregar = useCallback(async () => {
    setErro("");
    try {
      const registros = await apiFetch<PlanoRegistro[]>(
        "/api/interno/planos-voo?mine=true",
      );
      setPlanos(Array.isArray(registros) ? registros.map(paraPlano) : []);
    } catch (e) {
      setErro(mensagemErro(e));
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  const ordenados = useMemo(
    () => [...planos].sort((a, b) => b.data.localeCompare(a.data)),
    [planos],
  );

  const salvarPlano = async (novo: NovoPlano): Promise<boolean> => {
    try {
      await apiFetch("/api/interno/planos-voo", {
        method: "POST",
        body: JSON.stringify(paraRegistro(novo)),
      });
      await carregar();
      return true;
    } catch (e) {
      avisar("Falha ao salvar", mensagemErro(e));
      return false;
    }
  };

  const excluirPlano = (id: string) =>
    confirmar(
      "Excluir plano",
      "Deseja remover este plano de voo?",
      async () => {
        try {
          await apiFetch(`/api/interno/planos-voo/${encodeURIComponent(id)}`, {
            method: "DELETE",
          });
          setPlanos((lista) => lista.filter((p) => p.id !== id));
        } catch (e) {
          avisar("Falha ao excluir", mensagemErro(e));
        }
      },
      true,
    );

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View
        style={[
          styles.header,
          {
            paddingTop: insets.top + 16,
            backgroundColor: colors.card,
            borderBottomColor: colors.border,
          },
        ]}
      >
        <Text style={[styles.title, { color: colors.foreground }]}>
          Plano de Voo
        </Text>
        <View style={styles.headerActions}>
          <Toque
            accessibilityRole="button"
            accessibilityLabel="Atualizar planos"
            style={[styles.iconBtn, { backgroundColor: colors.muted }]}
            onPress={() => {
              setCarregando(true);
              void carregar();
            }}
          >
            <Icon name="refresh-cw" size={18} color={colors.foreground} />
          </Toque>
          <Toque
            accessibilityRole="button"
            accessibilityLabel="Novo plano de voo"
            style={[styles.iconBtn, { backgroundColor: colors.primary }]}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              setMostrarNovo(true);
            }}
          >
            <Icon name="plus" size={20} color="#FFFFFF" />
          </Toque>
        </View>
      </View>

      {carregando ? (
        <ActivityIndicator style={{ marginTop: 30 }} color={colors.secondary} />
      ) : (
        <FlatList
          data={ordenados}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <CartaoPlano
              plano={item}
              onAbrir={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                setPlanoSelecionado(item);
              }}
              onExcluir={() => excluirPlano(item.id)}
              colors={colors}
            />
          )}
          contentContainerStyle={[
            styles.list,
            { paddingBottom: 90 + insets.bottom },
          ]}
          showsVerticalScrollIndicator={false}
          ListHeaderComponent={
            erro ? (
              <Text style={[styles.erro, { color: colors.destructive }]}>
                {erro}
              </Text>
            ) : undefined
          }
          ListEmptyComponent={
            erro ? undefined : (
              <View style={styles.empty}>
                <Icon
                  name="navigation"
                  size={40}
                  color={colors.mutedForeground}
                />
                <Text style={[styles.emptyTitle, { color: colors.foreground }]}>
                  Nenhum plano de voo
                </Text>
                <Text
                  style={[styles.emptySub, { color: colors.mutedForeground }]}
                >
                  Toque em + para criar o primeiro plano
                </Text>
              </View>
            )
          }
        />
      )}

      <NovoPlanoModal
        visivel={mostrarNovo}
        onFechar={() => setMostrarNovo(false)}
        onSalvar={salvarPlano}
        colors={colors}
      />
      <DetalheVoo
        plano={planoSelecionado}
        visivel={!!planoSelecionado}
        onFechar={() => setPlanoSelecionado(null)}
        colors={colors}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
  },
  title: { fontSize: 24, fontFamily: "Inter_700Bold" },
  headerActions: { flexDirection: "row", gap: 8 },
  iconBtn: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  list: { padding: 16 },
  erro: { padding: 12, fontSize: 13, fontFamily: "Inter_400Regular" },
  empty: { alignItems: "center", paddingTop: 60, gap: 8 },
  emptyTitle: { fontSize: 16, fontFamily: "Inter_600SemiBold", marginTop: 8 },
  emptySub: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
  },
});
