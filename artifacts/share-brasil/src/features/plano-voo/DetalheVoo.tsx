import { MapaVoo } from "@/src/components/MapaVoo";
import type { Icone } from "@/src/components/ui";
import { Icon, Toque } from "@/src/components/ui";
import { avisar } from "@/src/lib/confirmar";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Platform,
  Share,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { CartaoClima } from "./CartaoClima";
import {
  Clima,
  Cores,
  PlanoRota,
  PlanoVoo,
  STATUS_CONFIG,
  buscarClima,
  buscarRota,
  formatarTempoVoo,
  formatarData,
  gerarMensagemIcao,
  mensagemErro,
  validarFpl,
} from "./modelo";

export function DetalheVoo({
  plano,
  visivel,
  onFechar,
  onAbrirAerodromo,
  onAbrirChecklist,
  onAbrirPreparacaoOperacional,
  colors,
}: {
  plano: PlanoVoo | null;
  visivel: boolean;
  onFechar: () => void;
  onAbrirAerodromo: (icao: string) => void;
  onAbrirChecklist: (plano: PlanoVoo) => void;
  onAbrirPreparacaoOperacional: (solicitacaoId: string) => void;
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
    buscarRota(
      plano.partida,
      plano.chegada,
      plano.aeronaveId,
      Number(plano.fpl.velocidade.replace(/^[NKM]/i, "")) || undefined,
    )
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

    const atualizarClima = () => {
      setCarregandoClima(true);
      Promise.allSettled([
        buscarClima(plano.partida),
        buscarClima(plano.chegada),
      ])
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
    };
    atualizarClima();
    const climaTimer = setInterval(atualizarClima, 5 * 60 * 1000);

    return () => {
      ativo = false;
      clearInterval(climaTimer);
    };
  }, [visivel, plano]);

  if (!plano) return null;
  const cfg = STATUS_CONFIG[plano.status];
  const fplCompartilhavel = {
    ...plano.fpl,
    adep: plano.fpl.adep || plano.partida,
    ades: plano.fpl.ades || plano.chegada,
    rota: plano.fpl.rota || plano.trecho,
    piloto: plano.fpl.piloto || plano.piloto,
  };
  const errosFpl = validarFpl(fplCompartilhavel);
  const compartilharFpl = async () => {
    if (errosFpl.length) {
      avisar("FPL incompleto", errosFpl.join("\n"));
      return;
    }
    try {
      await Share.share({
        title: `Plano FPL ${fplCompartilhavel.identificacao}`,
        message: gerarMensagemIcao(fplCompartilhavel),
      });
    } catch (cause) {
      avisar("Não foi possível compartilhar", mensagemErro(cause));
    }
  };
  const linhas: { icone: Icone; rotulo: string; valor: string }[] = [
    {
      icone: "airplane",
      rotulo: "Número do voo",
      valor: plano.numeroVoo || "—",
    },
    { icone: "user", rotulo: "Comandante", valor: plano.piloto || "—" },
    { icone: "users", rotulo: "Co-piloto", valor: plano.copiloto || "—" },
    {
      icone: "cpu",
      rotulo: "Aeronave / matrícula",
      valor:
        [plano.aeronave, plano.matricula].filter(Boolean).join(" · ") || "—",
    },
    { icone: "calendar", rotulo: "Data", valor: formatarData(plano.data) },
    {
      icone: "clock",
      rotulo: "Hora prevista (UTC)",
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
                <>
                  <MapaVoo
                    origem={rota.departure}
                    destino={rota.destination}
                    posicao={null}
                    trilha={[]}
                    origemNome={rota.departure.icao}
                    destinoNome={rota.destination.icao}
                    atual={false}
                    meteorologia={{
                      latitude: (rota.departure.lat + rota.destination.lat) / 2,
                      longitude:
                        (rota.departure.lon + rota.destination.lon) / 2,
                      icao: `${plano.partida}–${plano.chegada}`,
                    }}
                  />
                </>
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
                    {rota.flightplan?.distance_nm != null
                      ? `${Math.round(rota.flightplan.distance_nm)} NM`
                      : "— NM"}
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
                    {rota.flightplan?.flight_minutes
                      ? formatarTempoVoo(rota.flightplan.flight_minutes)
                      : rota.flightplan?.estimated_time || "—"}
                  </Text>
                  <Text
                    style={[
                      dStyles.infoLabel,
                      { color: colors.mutedForeground },
                    ]}
                  >
                    Tempo de voo
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

          <View
            style={[
              dStyles.actionsCard,
              { backgroundColor: colors.card, borderColor: colors.border },
            ]}
          >
            <Text style={[dStyles.actionTitle, { color: colors.foreground }]}>
              PREPARAÇÃO E ENCAMINHAMENTO
            </Text>
            <Text
              style={[dStyles.actionHelp, { color: colors.mutedForeground }]}
            >
              O app prepara e compartilha o texto para revisão. Não transmite
              nem recebe aceite do SIGMA.
            </Text>
            <View style={dStyles.actionButtons}>
              <Toque
                accessibilityRole="button"
                onPress={() => onAbrirChecklist(plano)}
                style={[
                  dStyles.actionButton,
                  { backgroundColor: colors.primary },
                ]}
              >
                <Icon name="check-square" size={15} color="#FFFFFF" />
                <Text style={dStyles.actionButtonPrimaryText}>
                  Checklist do plano
                </Text>
              </Toque>
              <Toque
                accessibilityRole="button"
                onPress={() => void compartilharFpl()}
                style={[
                  dStyles.actionButton,
                  { backgroundColor: colors.muted, borderColor: colors.border },
                ]}
              >
                <Icon name="send" size={15} color={colors.foreground} />
                <Text
                  style={[
                    dStyles.actionButtonText,
                    { color: colors.foreground },
                  ]}
                >
                  Compartilhar FPL
                </Text>
              </Toque>
            </View>
            {plano.solicitacaoId ? (
              <Toque
                accessibilityRole="button"
                onPress={() =>
                  onAbrirPreparacaoOperacional(plano.solicitacaoId)
                }
                style={[
                  dStyles.operationalButton,
                  { borderColor: colors.border },
                ]}
              >
                <Icon name="check-square" size={15} color={colors.secondary} />
                <Text
                  style={[
                    dStyles.actionButtonText,
                    { color: colors.foreground },
                  ]}
                >
                  Preparação operacional do agendamento
                </Text>
              </Toque>
            ) : null}
          </View>

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
          <View style={dStyles.aerodromeActions}>
            {[plano.partida, plano.chegada].filter(Boolean).map((icao) => (
              <Toque
                key={icao}
                accessibilityRole="button"
                accessibilityLabel={`Consultar meteorologia, NOTAM, ROTAER e cartas de ${icao}`}
                onPress={() => onAbrirAerodromo(icao)}
                style={[
                  dStyles.aerodromeButton,
                  { backgroundColor: colors.muted, borderColor: colors.border },
                ]}
              >
                <Icon name="map" size={14} color={colors.secondary} />
                <Text
                  style={[
                    dStyles.actionButtonText,
                    { color: colors.foreground },
                  ]}
                >
                  Consultar {icao}
                </Text>
              </Toque>
            ))}
          </View>
        </ScrollView>
      </View>
    </Modal>
  );
}

export const dStyles = StyleSheet.create({
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
  actionsCard: {
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 13,
    marginTop: 16,
  },
  actionTitle: {
    fontSize: 11,
    fontFamily: "Inter_700Bold",
    letterSpacing: 0.8,
  },
  actionHelp: { fontSize: 11, lineHeight: 16, marginTop: 5, marginBottom: 10 },
  actionButtons: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  actionButton: {
    minHeight: 40,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    borderRadius: 10,
    paddingHorizontal: 11,
    borderWidth: StyleSheet.hairlineWidth,
  },
  actionButtonPrimaryText: {
    color: "#FFFFFF",
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
  },
  actionButtonText: { fontSize: 11, fontFamily: "Inter_600SemiBold" },
  operationalButton: {
    minHeight: 40,
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    paddingHorizontal: 11,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 10,
    marginTop: 8,
  },
  aerodromeActions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 14,
  },
  aerodromeButton: {
    minHeight: 36,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 9,
  },
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
