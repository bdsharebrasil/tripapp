import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { WebView } from "react-native-webview";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useApp } from "@/context/AppContext";
import { useColors } from "@/hooks/useColors";
import type { FlightPlan } from "@/context/AppContext";

// ─── API ───────────────────────────────────────────────────────────────────
const API_BASE = "https://api.share-brasil.com";

type WeatherData = { loc: string; metar: string; taf: string; error?: string };
type FlightplanData = {
  flightplan: { adep: string; ades: string; route: string; distance_nm: number; estimated_time: string; cruise_speed: number };
  fuel: { burn_lh: number; trip_liters: number; reserve_liters: number; total_required: number };
  departure: { icao: string; name: string; lat: number; lon: number };
  destination: { icao: string; name: string; lat: number; lon: number };
  alternates: { icao: string; name: string; distance_km: number }[];
  notam_alerts: string[];
  error?: string;
};

async function fetchWeather(icao: string): Promise<WeatherData> {
  const r = await fetch(`${API_BASE}/api/weather/${icao}`);
  return r.json();
}

async function fetchFlightplan(adep: string, ades: string): Promise<FlightplanData> {
  const r = await fetch(`${API_BASE}/api/flightplan?adep=${adep}&ades=${ades}`);
  return r.json();
}

// ─── Helpers ───────────────────────────────────────────────────────────────
function buildLeafletHtml(
  depLat: number, depLon: number, depIcao: string,
  desLat: number, desLon: number, desIcao: string,
): string {
  return `<!DOCTYPE html>
<html>
<head>
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no">
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"/>
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
<style>
  * { margin:0; padding:0; box-sizing:border-box; }
  body { background:#000; }
  #map { height:100vh; width:100vw; }
  .pin-label {
    background:#1B3A6B; color:#fff; font-size:11px; font-weight:700;
    padding:3px 7px; border-radius:6px; border:2px solid #fff;
    white-space:nowrap; box-shadow:0 2px 6px rgba(0,0,0,0.5);
  }
  .pin-label.des { background:#4A6741; }
</style>
</head>
<body>
<div id="map"></div>
<script>
  var map = L.map('map',{zoomControl:true,attributionControl:false}).setView([${(depLat + desLat) / 2},${(depLon + desLon) / 2}],6);
  L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',{maxZoom:18}).addTo(map);
  L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}',{maxZoom:18}).addTo(map);
  
  var depIcon = L.divIcon({className:'',html:'<div class="pin-label">${depIcao}</div>',iconAnchor:[0,0]});
  var desIcon = L.divIcon({className:'',html:'<div class="pin-label des">${desIcao}</div>',iconAnchor:[0,0]});
  
  L.marker([${depLat},${depLon}],{icon:depIcon}).addTo(map);
  L.marker([${desLat},${desLon}],{icon:desIcon}).addTo(map);
  
  L.polyline([[${depLat},${depLon}],[${desLat},${desLon}]],{
    color:'#D4A832',weight:3,dashArray:'10,7',opacity:0.95
  }).addTo(map);
  
  L.circleMarker([${depLat},${depLon}],{radius:6,color:'#fff',fillColor:'#1B3A6B',fillOpacity:1,weight:2}).addTo(map);
  L.circleMarker([${desLat},${desLon}],{radius:6,color:'#fff',fillColor:'#4A6741',fillOpacity:1,weight:2}).addTo(map);
  
  var bounds = L.latLngBounds([[${depLat},${depLon}],[${desLat},${desLon}]]);
  map.fitBounds(bounds,{padding:[52,52]});
</script>
</body>
</html>`;
}

function metarConditionColor(metar: string): string {
  if (!metar) return "#6B7280";
  const u = metar.toUpperCase();
  if (u.includes("TS") || u.includes("FG") || u.includes("//") ) return "#DC2626";
  if (u.includes("OVC") || u.includes("BKN0") || u.includes("SCT0")) return "#D97706";
  return "#16A34A";
}

function formatDate(dateStr: string) {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" });
}

// ─── WeatherCard ────────────────────────────────────────────────────────────
function WeatherCard({ icao, data, loading, colors }: {
  icao: string;
  data: WeatherData | null;
  loading: boolean;
  colors: ReturnType<typeof useColors>;
}) {
  const [expanded, setExpanded] = useState(false);
  const dot = data?.metar ? metarConditionColor(data.metar) : "#6B7280";

  return (
    <View style={[wStyles.card, { backgroundColor: colors.card }]}>
      <Pressable style={wStyles.header} onPress={() => setExpanded(e => !e)}>
        <View style={wStyles.titleRow}>
          <View style={[wStyles.dot, { backgroundColor: dot }]} />
          <Text style={[wStyles.icao, { color: colors.foreground }]}>{icao}</Text>
          {loading && <ActivityIndicator size="small" color={colors.primary} style={{ marginLeft: 8 }} />}
        </View>
        <Feather name={expanded ? "chevron-up" : "chevron-down"} size={16} color={colors.mutedForeground} />
      </Pressable>

      {data?.error ? (
        <Text style={[wStyles.errorText, { color: colors.destructive }]}>{data.error}</Text>
      ) : data?.metar ? (
        <>
          <View style={[wStyles.metarBox, { backgroundColor: colors.muted }]}>
            <Text style={[wStyles.label, { color: colors.mutedForeground }]}>METAR</Text>
            <Text style={[wStyles.raw, { color: colors.foreground }]} selectable>{data.metar}</Text>
          </View>
          {expanded && data.taf ? (
            <View style={[wStyles.metarBox, { backgroundColor: colors.muted, marginTop: 6 }]}>
              <Text style={[wStyles.label, { color: colors.mutedForeground }]}>TAF</Text>
              <Text style={[wStyles.raw, { color: colors.foreground }]} selectable>{data.taf}</Text>
            </View>
          ) : null}
          {!expanded && (
            <Text style={[wStyles.tapHint, { color: colors.mutedForeground }]}>
              {data.taf ? "Toque para ver TAF" : "Sem TAF disponível"}
            </Text>
          )}
        </>
      ) : !loading ? (
        <Text style={[wStyles.errorText, { color: colors.mutedForeground }]}>Sem dados meteorológicos</Text>
      ) : null}
    </View>
  );
}

const wStyles = StyleSheet.create({
  card: { borderRadius: 12, padding: 12, marginBottom: 10 },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 8 },
  titleRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  dot: { width: 10, height: 10, borderRadius: 5 },
  icao: { fontSize: 15, fontFamily: "Inter_700Bold" },
  metarBox: { borderRadius: 8, padding: 10 },
  label: { fontSize: 10, fontFamily: "Inter_600SemiBold", letterSpacing: 1, marginBottom: 4 },
  raw: { fontSize: 12, fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace", lineHeight: 18 },
  tapHint: { fontSize: 11, fontFamily: "Inter_400Regular", marginTop: 6 },
  errorText: { fontSize: 12, fontFamily: "Inter_400Regular" },
});

// ─── RouteMap ────────────────────────────────────────────────────────────────
function RouteMap({ departure, destination, colors }: {
  departure: { icao: string; lat: number; lon: number };
  destination: { icao: string; lat: number; lon: number };
  colors: ReturnType<typeof useColors>;
}) {
  const html = buildLeafletHtml(
    departure.lat, departure.lon, departure.icao,
    destination.lat, destination.lon, destination.icao,
  );

  return (
    <WebView
      style={mapStyles.container}
      source={{ html }}
      originWhitelist={["*"]}
      javaScriptEnabled
      domStorageEnabled
      scrollEnabled={false}
    />
  );
}

const mapStyles = StyleSheet.create({
  container: { width: "100%", height: 260, borderRadius: 14, overflow: "hidden" },
});

// ─── FlightDetailModal ───────────────────────────────────────────────────────
function FlightDetailModal({ plan, visible, onClose, colors }: {
  plan: FlightPlan | null;
  visible: boolean;
  onClose: () => void;
  colors: ReturnType<typeof useColors>;
}) {
  const [fpData, setFpData] = useState<FlightplanData | null>(null);
  const [depWeather, setDepWeather] = useState<WeatherData | null>(null);
  const [desWeather, setDesWeather] = useState<WeatherData | null>(null);
  const [loadingFp, setLoadingFp] = useState(false);
  const [loadingWx, setLoadingWx] = useState(false);
  const [fpError, setFpError] = useState<string | null>(null);

  useEffect(() => {
    if (!visible || !plan) return;
    setFpData(null);
    setDepWeather(null);
    setDesWeather(null);
    setFpError(null);

    setLoadingFp(true);
    fetchFlightplan(plan.partida, plan.chegada)
      .then(d => {
        if (d.error) setFpError(d.error);
        else setFpData(d);
      })
      .catch(e => setFpError(e.message))
      .finally(() => setLoadingFp(false));

    setLoadingWx(true);
    Promise.allSettled([
      fetchWeather(plan.partida),
      fetchWeather(plan.chegada),
    ]).then(([dep, des]) => {
      setDepWeather(dep.status === "fulfilled" ? dep.value : { loc: plan.partida, metar: "", taf: "", error: "Falha ao buscar" });
      setDesWeather(des.status === "fulfilled" ? des.value : { loc: plan.chegada, metar: "", taf: "", error: "Falha ao buscar" });
    }).finally(() => setLoadingWx(false));
  }, [visible, plan?.partida, plan?.chegada]);

  const STATUS_CONFIG = {
    rascunho: { label: "Rascunho", color: "#6B7280" },
    enviado: { label: "Enviado", color: "#D97706" },
    aprovado: { label: "Aprovado", color: "#16A34A" },
    cancelado: { label: "Cancelado", color: "#DC2626" },
  };

  if (!plan) return null;
  const cfg = STATUS_CONFIG[plan.status];
  const insets = useSafeAreaInsets();

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <View style={[dStyles.container, { backgroundColor: colors.background }]}>
        <View style={[dStyles.header, { backgroundColor: colors.card, borderBottomColor: colors.border, paddingTop: Platform.OS === "ios" ? 60 : 16 }]}>
          <Pressable onPress={onClose}>
            <Feather name="x" size={22} color={colors.foreground} />
          </Pressable>
          <View style={dStyles.headerCenter}>
            <Text style={[dStyles.headerTitle, { color: colors.foreground }]}>
              {plan.partida} → {plan.chegada}
            </Text>
            <Text style={[dStyles.headerSub, { color: cfg.color }]}>{cfg.label}</Text>
          </View>
          <View style={{ width: 22 }} />
        </View>

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={[dStyles.scroll, { paddingBottom: insets.bottom + 24 }]}>
          {/* MAP SECTION */}
          <Text style={[dStyles.sectionLabel, { color: colors.mutedForeground }]}>ROTA</Text>
          {loadingFp ? (
            <View style={[dStyles.mapLoader, { backgroundColor: colors.muted }]}>
              <ActivityIndicator color={colors.primary} />
              <Text style={[dStyles.loadingText, { color: colors.mutedForeground }]}>Buscando coordenadas...</Text>
            </View>
          ) : fpError ? (
            <View style={[dStyles.mapLoader, { backgroundColor: colors.muted }]}>
              <Feather name="alert-circle" size={24} color={colors.destructive} />
              <Text style={[dStyles.errorMsg, { color: colors.destructive }]}>{fpError}</Text>
            </View>
          ) : fpData ? (
            <>
              <RouteMap
                departure={{ icao: fpData.departure.icao, lat: fpData.departure.lat, lon: fpData.departure.lon }}
                destination={{ icao: fpData.destination.icao, lat: fpData.destination.lat, lon: fpData.destination.lon }}
                colors={colors}
              />
              {/* AIRPORT NAMES */}
              <View style={dStyles.airports}>
                <View style={{ flex: 1 }}>
                  <Text style={[dStyles.airportCode, { color: colors.primary }]}>{fpData.departure.icao}</Text>
                  <Text style={[dStyles.airportName, { color: colors.mutedForeground }]} numberOfLines={2}>{fpData.departure.name}</Text>
                </View>
                <Feather name="arrow-right" size={16} color={colors.mutedForeground} style={{ marginTop: 4 }} />
                <View style={{ flex: 1, alignItems: "flex-end" }}>
                  <Text style={[dStyles.airportCode, { color: colors.secondary }]}>{fpData.destination.icao}</Text>
                  <Text style={[dStyles.airportName, { color: colors.mutedForeground, textAlign: "right" }]} numberOfLines={2}>{fpData.destination.name}</Text>
                </View>
              </View>

              {/* FLIGHT INFO */}
              <View style={[dStyles.infoRow, { backgroundColor: colors.card }]}>
                <View style={dStyles.infoItem}>
                  <Feather name="navigation" size={14} color={colors.primary} />
                  <Text style={[dStyles.infoValue, { color: colors.foreground }]}>{fpData.flightplan.distance_nm} NM</Text>
                  <Text style={[dStyles.infoLabel, { color: colors.mutedForeground }]}>Distância</Text>
                </View>
                <View style={[dStyles.divider, { backgroundColor: colors.border }]} />
                <View style={dStyles.infoItem}>
                  <Feather name="clock" size={14} color={colors.primary} />
                  <Text style={[dStyles.infoValue, { color: colors.foreground }]}>{fpData.flightplan.estimated_time}</Text>
                  <Text style={[dStyles.infoLabel, { color: colors.mutedForeground }]}>Estimativa</Text>
                </View>
                <View style={[dStyles.divider, { backgroundColor: colors.border }]} />
                <View style={dStyles.infoItem}>
                  <Feather name="droplet" size={14} color={colors.primary} />
                  <Text style={[dStyles.infoValue, { color: colors.foreground }]}>{fpData.fuel.total_required}L</Text>
                  <Text style={[dStyles.infoLabel, { color: colors.mutedForeground }]}>Combustível</Text>
                </View>
              </View>

              {/* ROUTE STRING */}
              {fpData.flightplan.route ? (
                <View style={[dStyles.routeBox, { backgroundColor: colors.muted }]}>
                  <Text style={[dStyles.routeLabel, { color: colors.mutedForeground }]}>ROTA AIS</Text>
                  <Text style={[dStyles.routeText, { color: colors.foreground }]} selectable>{fpData.flightplan.route}</Text>
                </View>
              ) : null}

              {/* ALTERNATES */}
              {fpData.alternates?.length > 0 && (
                <View style={[dStyles.altBox, { backgroundColor: colors.card }]}>
                  <Text style={[dStyles.altTitle, { color: colors.foreground }]}>
                    <Feather name="anchor" size={13} color={colors.foreground} /> Alternados próximos
                  </Text>
                  {fpData.alternates.map(a => (
                    <View key={a.icao} style={dStyles.altRow}>
                      <Text style={[dStyles.altIcao, { color: colors.primary }]}>{a.icao}</Text>
                      <Text style={[dStyles.altName, { color: colors.mutedForeground }]} numberOfLines={1}>{a.name}</Text>
                      <Text style={[dStyles.altDist, { color: colors.mutedForeground }]}>{a.distance_km}km</Text>
                    </View>
                  ))}
                </View>
              )}
            </>
          ) : null}

          {/* WEATHER SECTION */}
          <Text style={[dStyles.sectionLabel, { color: colors.mutedForeground, marginTop: 20 }]}>METEOROLOGIA</Text>
          <WeatherCard icao={plan.partida} data={depWeather} loading={loadingWx && !depWeather} colors={colors} />
          <WeatherCard icao={plan.chegada} data={desWeather} loading={loadingWx && !desWeather} colors={colors} />

          {/* PLAN DETAILS */}
          <Text style={[dStyles.sectionLabel, { color: colors.mutedForeground, marginTop: 8 }]}>DETALHES DO PLANO</Text>
          <View style={[dStyles.detailCard, { backgroundColor: colors.card }]}>
            {[
              { icon: "user", label: "Comandante", value: plan.piloto || "—" },
              { icon: "users", label: "Co-piloto", value: plan.copiloto || "—" },
              { icon: "cpu", label: "Aeronave", value: `${plan.aeronave} · ${plan.matricula}` },
              { icon: "calendar", label: "Data", value: formatDate(plan.data) },
              { icon: "clock", label: "Hora prevista", value: plan.horaPrevista || "—" },
              { icon: "wind", label: "Condições", value: plan.condicoes },
              { icon: "users", label: "Passageiros", value: `${plan.passageiros} pax` },
            ].map(({ icon, label, value }) => (
              <View key={label} style={[dStyles.detailRow, { borderBottomColor: colors.border }]}>
                <Feather name={icon as any} size={13} color={colors.mutedForeground} />
                <Text style={[dStyles.detailLabel, { color: colors.mutedForeground }]}>{label}</Text>
                <Text style={[dStyles.detailValue, { color: colors.foreground }]}>{value}</Text>
              </View>
            ))}
            {plan.observacoes ? (
              <View style={dStyles.obsBox}>
                <Text style={[dStyles.detailLabel, { color: colors.mutedForeground }]}>Observações</Text>
                <Text style={[dStyles.obsText, { color: colors.foreground }]}>{plan.observacoes}</Text>
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
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: 16, borderBottomWidth: 1 },
  headerCenter: { alignItems: "center" },
  headerTitle: { fontSize: 16, fontFamily: "Inter_700Bold" },
  headerSub: { fontSize: 12, fontFamily: "Inter_500Medium" },
  scroll: { padding: 16 },
  sectionLabel: { fontSize: 11, fontFamily: "Inter_600SemiBold", letterSpacing: 1, marginBottom: 10 },
  mapLoader: { height: 180, borderRadius: 14, alignItems: "center", justifyContent: "center", gap: 10 },
  loadingText: { fontSize: 13, fontFamily: "Inter_400Regular" },
  errorMsg: { fontSize: 13, fontFamily: "Inter_400Regular", textAlign: "center", maxWidth: 240 },
  airports: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", marginTop: 12, marginBottom: 10 },
  airportCode: { fontSize: 18, fontFamily: "Inter_700Bold" },
  airportName: { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 2 },
  infoRow: { flexDirection: "row", borderRadius: 12, padding: 12, marginBottom: 10 },
  infoItem: { flex: 1, alignItems: "center", gap: 4 },
  infoValue: { fontSize: 15, fontFamily: "Inter_700Bold" },
  infoLabel: { fontSize: 11, fontFamily: "Inter_400Regular" },
  divider: { width: 1, marginVertical: 4 },
  routeBox: { borderRadius: 10, padding: 12, marginBottom: 10 },
  routeLabel: { fontSize: 10, fontFamily: "Inter_600SemiBold", letterSpacing: 1, marginBottom: 4 },
  routeText: { fontSize: 12, fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace" },
  altBox: { borderRadius: 12, padding: 12, marginBottom: 10 },
  altTitle: { fontSize: 13, fontFamily: "Inter_600SemiBold", marginBottom: 8 },
  altRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 4 },
  altIcao: { fontSize: 13, fontFamily: "Inter_700Bold", width: 40 },
  altName: { flex: 1, fontSize: 12, fontFamily: "Inter_400Regular" },
  altDist: { fontSize: 12, fontFamily: "Inter_400Regular" },
  detailCard: { borderRadius: 12, overflow: "hidden" },
  detailRow: { flexDirection: "row", alignItems: "center", gap: 10, padding: 12, borderBottomWidth: StyleSheet.hairlineWidth },
  detailLabel: { fontSize: 12, fontFamily: "Inter_400Regular", width: 100 },
  detailValue: { flex: 1, fontSize: 13, fontFamily: "Inter_500Medium" },
  obsBox: { padding: 12 },
  obsText: { fontSize: 13, fontFamily: "Inter_400Regular", marginTop: 4, fontStyle: "italic" },
});

// ─── STATUS CONFIG ────────────────────────────────────────────────────────────
const STATUS_CONFIG = {
  rascunho: { label: "Rascunho", color: "#6B7280", bg: "#F3F4F6" },
  enviado: { label: "Enviado", color: "#D97706", bg: "#FEF3C7" },
  aprovado: { label: "Aprovado", color: "#16A34A", bg: "#DCFCE7" },
  cancelado: { label: "Cancelado", color: "#DC2626", bg: "#FEE2E2" },
};

// ─── PlanCard ────────────────────────────────────────────────────────────────
function PlanCard({ item, onPress, onDelete, onSend, colors }: {
  item: FlightPlan;
  onPress: () => void;
  onDelete: (id: string) => void;
  onSend: (id: string) => void;
  colors: ReturnType<typeof useColors>;
}) {
  const cfg = STATUS_CONFIG[item.status];
  return (
    <Pressable
      style={[pStyles.card, { backgroundColor: colors.card }]}
      onPress={onPress}
    >
      <View style={pStyles.top}>
        <View style={pStyles.routeRow}>
          <Text style={[pStyles.iata, { color: colors.primary }]}>{item.partida}</Text>
          <Feather name="arrow-right" size={16} color={colors.mutedForeground} style={{ marginHorizontal: 8 }} />
          <Text style={[pStyles.iata, { color: colors.secondary }]}>{item.chegada}</Text>
        </View>
        <View style={[pStyles.badge, { backgroundColor: cfg.bg }]}>
          <Text style={[pStyles.badgeText, { color: cfg.color }]}>{cfg.label}</Text>
        </View>
      </View>
      <Text style={[pStyles.aircraft, { color: colors.mutedForeground }]}>{item.aeronave} · {item.matricula}</Text>
      <View style={pStyles.detailRow}>
        <View style={pStyles.detail}>
          <Feather name="calendar" size={12} color={colors.mutedForeground} />
          <Text style={[pStyles.detailText, { color: colors.mutedForeground }]}>{formatDate(item.data)}</Text>
        </View>
        <View style={pStyles.detail}>
          <Feather name="clock" size={12} color={colors.mutedForeground} />
          <Text style={[pStyles.detailText, { color: colors.mutedForeground }]}>{item.horaPrevista || "—"} · {item.estimativaVoo || "—"}h</Text>
        </View>
        <View style={pStyles.detail}>
          <Feather name="users" size={12} color={colors.mutedForeground} />
          <Text style={[pStyles.detailText, { color: colors.mutedForeground }]}>{item.passageiros} pax</Text>
        </View>
      </View>
      {item.piloto || item.copiloto ? (
        <View style={[pStyles.crewRow, { backgroundColor: colors.muted }]}>
          <Feather name="user" size={12} color={colors.mutedForeground} />
          <Text style={[pStyles.crewText, { color: colors.mutedForeground }]}>
            {item.piloto}{item.copiloto ? ` / ${item.copiloto}` : ""}
          </Text>
        </View>
      ) : null}
      <View style={pStyles.actions}>
        <View style={pStyles.tapHintRow}>
          <Feather name="map" size={12} color={colors.mutedForeground} />
          <Text style={[pStyles.tapHint, { color: colors.mutedForeground }]}>Ver rota e meteorologia</Text>
        </View>
        <View style={pStyles.btns}>
          {item.status === "rascunho" && (
            <Pressable
              style={[pStyles.actionBtn, { backgroundColor: colors.primary }]}
              onPress={(e) => { e.stopPropagation?.(); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); onSend(item.id); }}
            >
              <Feather name="send" size={13} color="#FFFFFF" />
              <Text style={pStyles.actionBtnText}>Enviar</Text>
            </Pressable>
          )}
          <Pressable
            style={[pStyles.actionBtn, { backgroundColor: colors.muted }]}
            onPress={(e) => {
              e.stopPropagation?.();
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              Alert.alert("Excluir plano", "Deseja remover este plano de voo?", [
                { text: "Cancelar", style: "cancel" },
                { text: "Excluir", style: "destructive", onPress: () => onDelete(item.id) },
              ]);
            }}
          >
            <Feather name="trash-2" size={13} color={colors.destructive} />
          </Pressable>
        </View>
      </View>
    </Pressable>
  );
}

const pStyles = StyleSheet.create({
  card: {
    borderRadius: 14, padding: 14, marginBottom: 10,
    shadowColor: "#000", shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06, shadowRadius: 4, elevation: 2,
  },
  top: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 4 },
  routeRow: { flexDirection: "row", alignItems: "center" },
  iata: { fontSize: 20, fontFamily: "Inter_700Bold" },
  aircraft: { fontSize: 12, fontFamily: "Inter_400Regular", marginBottom: 8 },
  badge: { borderRadius: 100, paddingHorizontal: 10, paddingVertical: 4 },
  badgeText: { fontSize: 11, fontFamily: "Inter_500Medium" },
  detailRow: { flexDirection: "row", gap: 12, flexWrap: "wrap", marginBottom: 8 },
  detail: { flexDirection: "row", alignItems: "center", gap: 4 },
  detailText: { fontSize: 12, fontFamily: "Inter_400Regular" },
  crewRow: { flexDirection: "row", alignItems: "center", gap: 6, borderRadius: 8, padding: 8, marginBottom: 8 },
  crewText: { fontSize: 12, fontFamily: "Inter_400Regular" },
  actions: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  tapHintRow: { flexDirection: "row", alignItems: "center", gap: 4 },
  tapHint: { fontSize: 11, fontFamily: "Inter_400Regular" },
  btns: { flexDirection: "row", gap: 8 },
  actionBtn: { flexDirection: "row", alignItems: "center", gap: 6, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8 },
  actionBtnText: { fontSize: 13, color: "#FFFFFF", fontFamily: "Inter_500Medium" },
});

// ─── NewPlanModal ─────────────────────────────────────────────────────────────
const CONDICOES = ["VMC", "IMC", "IFR", "VFR"];

function NewPlanModal({ visible, onClose, onSave, colors }: {
  visible: boolean;
  onClose: () => void;
  onSave: (plan: Omit<FlightPlan, "id" | "criadoEm">) => void;
  colors: ReturnType<typeof useColors>;
}) {
  const [form, setForm] = useState({
    partida: "", chegada: "", trecho: "",
    data: new Date().toISOString().split("T")[0],
    aeronave: "Citation CJ3+", matricula: "PS-SBR",
    horaPrevista: "", estimativaVoo: "", combustivelPrevisto: "",
    alternates: "", passageiros: "0", peso: "", piloto: "", copiloto: "",
    observacoes: "", condicoes: "VMC",
  });
  const [wxDep, setWxDep] = useState<WeatherData | null>(null);
  const [wxDes, setWxDes] = useState<WeatherData | null>(null);
  const [loadingWx, setLoadingWx] = useState(false);
  const wxTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const set = (k: string, v: string) => setForm(p => ({ ...p, [k]: v }));

  // Auto-fetch weather when both ICAO codes are 4 chars
  useEffect(() => {
    const dep = form.partida.toUpperCase();
    const des = form.chegada.toUpperCase();
    if (dep.length === 4 && des.length === 4) {
      if (wxTimer.current) clearTimeout(wxTimer.current);
      wxTimer.current = setTimeout(() => {
        setLoadingWx(true);
        setWxDep(null);
        setWxDes(null);
        Promise.allSettled([fetchWeather(dep), fetchWeather(des)])
          .then(([d, a]) => {
            setWxDep(d.status === "fulfilled" ? d.value : null);
            setWxDes(a.status === "fulfilled" ? a.value : null);
          })
          .finally(() => setLoadingWx(false));
      }, 800);
    } else {
      setWxDep(null);
      setWxDes(null);
    }
    return () => { if (wxTimer.current) clearTimeout(wxTimer.current); };
  }, [form.partida, form.chegada]);

  const handleSave = (status: FlightPlan["status"]) => {
    if (!form.partida || !form.chegada || !form.data) {
      Alert.alert("Campos obrigatórios", "Preencha partida, chegada e data.");
      return;
    }
    onSave({
      partida: form.partida.toUpperCase(), chegada: form.chegada.toUpperCase(),
      trecho: form.trecho || `${form.partida.toUpperCase()}-${form.chegada.toUpperCase()}`,
      data: form.data, aeronave: form.aeronave, matricula: form.matricula,
      horaPrevista: form.horaPrevista, estimativaVoo: form.estimativaVoo,
      combustivelPrevisto: parseFloat(form.combustivelPrevisto) || 0,
      alternates: form.alternates, passageiros: parseInt(form.passageiros) || 0,
      peso: parseFloat(form.peso) || 0, piloto: form.piloto, copiloto: form.copiloto,
      observacoes: form.observacoes, condicoes: form.condicoes, status,
    });
    onClose();
  };

  const showWxPreview = (form.partida.length === 4 || form.chegada.length === 4);

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <View style={[mStyles.container, { backgroundColor: colors.background }]}>
        <View style={[mStyles.header, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
          <Pressable onPress={onClose}><Feather name="x" size={22} color={colors.foreground} /></Pressable>
          <Text style={[mStyles.title, { color: colors.foreground }]}>Novo Plano de Voo</Text>
          <Pressable onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); handleSave("enviado"); }}>
            <Text style={[mStyles.saveText, { color: colors.primary }]}>Enviar</Text>
          </Pressable>
        </View>
        <ScrollView contentContainerStyle={mStyles.form} showsVerticalScrollIndicator={false}>
          <Text style={[mStyles.sectionLabel, { color: colors.mutedForeground }]}>ROTA</Text>
          <View style={mStyles.row}>
            <View style={{ flex: 1 }}>
              <Text style={[mStyles.label, { color: colors.foreground }]}>Partida *</Text>
              <TextInput
                style={[mStyles.input, { backgroundColor: colors.card, color: colors.foreground, borderColor: colors.border }]}
                value={form.partida} onChangeText={v => set("partida", v)}
                placeholder="SBGR" placeholderTextColor={colors.mutedForeground}
                autoCapitalize="characters" maxLength={4}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[mStyles.label, { color: colors.foreground }]}>Chegada *</Text>
              <TextInput
                style={[mStyles.input, { backgroundColor: colors.card, color: colors.foreground, borderColor: colors.border }]}
                value={form.chegada} onChangeText={v => set("chegada", v)}
                placeholder="SBBR" placeholderTextColor={colors.mutedForeground}
                autoCapitalize="characters" maxLength={4}
              />
            </View>
          </View>

          {/* WEATHER PREVIEW */}
          {showWxPreview && (
            <View style={[mStyles.wxPreview, { backgroundColor: colors.muted }]}>
              <View style={mStyles.wxRow}>
                <Feather name="cloud" size={14} color={colors.primary} />
                <Text style={[mStyles.wxTitle, { color: colors.foreground }]}>Meteorologia</Text>
                {loadingWx && <ActivityIndicator size="small" color={colors.primary} style={{ marginLeft: 4 }} />}
              </View>
              {wxDep && (
                <View style={mStyles.wxItem}>
                  <View style={[mStyles.wxDot, { backgroundColor: metarConditionColor(wxDep.metar) }]} />
                  <Text style={[mStyles.wxIcao, { color: colors.foreground }]}>{form.partida.toUpperCase()}</Text>
                  <Text style={[mStyles.wxMetar, { color: colors.mutedForeground }]} numberOfLines={1}>
                    {wxDep.metar || wxDep.error || "Sem dados"}
                  </Text>
                </View>
              )}
              {wxDes && (
                <View style={mStyles.wxItem}>
                  <View style={[mStyles.wxDot, { backgroundColor: metarConditionColor(wxDes.metar) }]} />
                  <Text style={[mStyles.wxIcao, { color: colors.foreground }]}>{form.chegada.toUpperCase()}</Text>
                  <Text style={[mStyles.wxMetar, { color: colors.mutedForeground }]} numberOfLines={1}>
                    {wxDes.metar || wxDes.error || "Sem dados"}
                  </Text>
                </View>
              )}
              {!loadingWx && !wxDep && !wxDes && (
                <Text style={[mStyles.wxHint, { color: colors.mutedForeground }]}>Preencha os ICAOs para ver o METAR</Text>
              )}
            </View>
          )}

          <Text style={[mStyles.label, { color: colors.foreground }]}>Aeródromo Alternado</Text>
          <TextInput
            style={[mStyles.input, { backgroundColor: colors.card, color: colors.foreground, borderColor: colors.border }]}
            value={form.alternates} onChangeText={v => set("alternates", v)}
            placeholder="SBSP" placeholderTextColor={colors.mutedForeground} autoCapitalize="characters"
          />

          <Text style={[mStyles.sectionLabel, { color: colors.mutedForeground }]}>AERONAVE E DATA</Text>
          <View style={mStyles.row}>
            <View style={{ flex: 1 }}>
              <Text style={[mStyles.label, { color: colors.foreground }]}>Aeronave</Text>
              <TextInput style={[mStyles.input, { backgroundColor: colors.card, color: colors.foreground, borderColor: colors.border }]} value={form.aeronave} onChangeText={v => set("aeronave", v)} placeholderTextColor={colors.mutedForeground} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[mStyles.label, { color: colors.foreground }]}>Matrícula</Text>
              <TextInput style={[mStyles.input, { backgroundColor: colors.card, color: colors.foreground, borderColor: colors.border }]} value={form.matricula} onChangeText={v => set("matricula", v)} autoCapitalize="characters" placeholderTextColor={colors.mutedForeground} />
            </View>
          </View>
          <View style={mStyles.row}>
            <View style={{ flex: 1 }}>
              <Text style={[mStyles.label, { color: colors.foreground }]}>Data *</Text>
              <TextInput style={[mStyles.input, { backgroundColor: colors.card, color: colors.foreground, borderColor: colors.border }]} value={form.data} onChangeText={v => set("data", v)} placeholder="AAAA-MM-DD" placeholderTextColor={colors.mutedForeground} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[mStyles.label, { color: colors.foreground }]}>Hora Prevista</Text>
              <TextInput style={[mStyles.input, { backgroundColor: colors.card, color: colors.foreground, borderColor: colors.border }]} value={form.horaPrevista} onChangeText={v => set("horaPrevista", v)} placeholder="10:00" placeholderTextColor={colors.mutedForeground} keyboardType="numbers-and-punctuation" />
            </View>
          </View>
          <View style={mStyles.row}>
            <View style={{ flex: 1 }}>
              <Text style={[mStyles.label, { color: colors.foreground }]}>Estimativa (h)</Text>
              <TextInput style={[mStyles.input, { backgroundColor: colors.card, color: colors.foreground, borderColor: colors.border }]} value={form.estimativaVoo} onChangeText={v => set("estimativaVoo", v)} placeholder="01:30" placeholderTextColor={colors.mutedForeground} keyboardType="numbers-and-punctuation" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[mStyles.label, { color: colors.foreground }]}>Combustível (L)</Text>
              <TextInput style={[mStyles.input, { backgroundColor: colors.card, color: colors.foreground, borderColor: colors.border }]} value={form.combustivelPrevisto} onChangeText={v => set("combustivelPrevisto", v)} keyboardType="numeric" placeholderTextColor={colors.mutedForeground} />
            </View>
          </View>
          <View style={mStyles.row}>
            <View style={{ flex: 1 }}>
              <Text style={[mStyles.label, { color: colors.foreground }]}>Pax</Text>
              <TextInput style={[mStyles.input, { backgroundColor: colors.card, color: colors.foreground, borderColor: colors.border }]} value={form.passageiros} onChangeText={v => set("passageiros", v)} keyboardType="numeric" placeholderTextColor={colors.mutedForeground} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[mStyles.label, { color: colors.foreground }]}>Peso (kg)</Text>
              <TextInput style={[mStyles.input, { backgroundColor: colors.card, color: colors.foreground, borderColor: colors.border }]} value={form.peso} onChangeText={v => set("peso", v)} keyboardType="numeric" placeholderTextColor={colors.mutedForeground} />
            </View>
          </View>

          <Text style={[mStyles.sectionLabel, { color: colors.mutedForeground }]}>TRIPULAÇÃO</Text>
          <Text style={[mStyles.label, { color: colors.foreground }]}>Comandante (PIC)</Text>
          <TextInput style={[mStyles.input, { backgroundColor: colors.card, color: colors.foreground, borderColor: colors.border }]} value={form.piloto} onChangeText={v => set("piloto", v)} placeholderTextColor={colors.mutedForeground} />
          <Text style={[mStyles.label, { color: colors.foreground }]}>Co-piloto (SIC)</Text>
          <TextInput style={[mStyles.input, { backgroundColor: colors.card, color: colors.foreground, borderColor: colors.border }]} value={form.copiloto} onChangeText={v => set("copiloto", v)} placeholderTextColor={colors.mutedForeground} />

          <Text style={[mStyles.sectionLabel, { color: colors.mutedForeground }]}>CONDIÇÕES E OBS.</Text>
          <View style={mStyles.chipRow}>
            {CONDICOES.map(c => (
              <Pressable
                key={c}
                style={[mStyles.chip, form.condicoes === c ? { backgroundColor: colors.primary } : { backgroundColor: colors.muted }]}
                onPress={() => set("condicoes", c)}
              >
                <Text style={[mStyles.chipText, { color: form.condicoes === c ? "#FFFFFF" : colors.mutedForeground }]}>{c}</Text>
              </Pressable>
            ))}
          </View>
          <Text style={[mStyles.label, { color: colors.foreground }]}>Observações</Text>
          <TextInput
            style={[mStyles.textarea, { backgroundColor: colors.card, color: colors.foreground, borderColor: colors.border }]}
            value={form.observacoes} onChangeText={v => set("observacoes", v)}
            multiline numberOfLines={4} placeholderTextColor={colors.mutedForeground}
            placeholder="Informações adicionais..."
          />
          <Pressable
            style={[mStyles.rascunhoBtn, { backgroundColor: colors.muted }]}
            onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); handleSave("rascunho"); }}
          >
            <Text style={[mStyles.rascunhoText, { color: colors.foreground }]}>Salvar como Rascunho</Text>
          </Pressable>
        </ScrollView>
      </View>
    </Modal>
  );
}

const mStyles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: 16, borderBottomWidth: 1, paddingTop: Platform.OS === "ios" ? 60 : 16 },
  title: { fontSize: 17, fontFamily: "Inter_700Bold" },
  saveText: { fontSize: 16, fontFamily: "Inter_600SemiBold" },
  form: { padding: 16, gap: 4, paddingBottom: 40 },
  sectionLabel: { fontSize: 11, fontFamily: "Inter_600SemiBold", letterSpacing: 1, marginTop: 16, marginBottom: 4 },
  row: { flexDirection: "row", gap: 10 },
  label: { fontSize: 13, fontFamily: "Inter_500Medium", marginBottom: 4 },
  input: { borderRadius: 10, borderWidth: 1, padding: 10, fontSize: 14, fontFamily: "Inter_400Regular", marginBottom: 10 },
  textarea: { borderRadius: 10, borderWidth: 1, padding: 10, fontSize: 14, fontFamily: "Inter_400Regular", marginBottom: 16, minHeight: 80, textAlignVertical: "top" },
  chipRow: { flexDirection: "row", gap: 8, marginBottom: 12 },
  chip: { borderRadius: 100, paddingHorizontal: 14, paddingVertical: 8 },
  chipText: { fontSize: 13, fontFamily: "Inter_500Medium" },
  rascunhoBtn: { borderRadius: 12, padding: 14, alignItems: "center" },
  rascunhoText: { fontSize: 15, fontFamily: "Inter_600SemiBold" },
  wxPreview: { borderRadius: 10, padding: 12, marginBottom: 12 },
  wxRow: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 8 },
  wxTitle: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  wxItem: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 4 },
  wxDot: { width: 8, height: 8, borderRadius: 4 },
  wxIcao: { fontSize: 13, fontFamily: "Inter_700Bold", width: 38 },
  wxMetar: { flex: 1, fontSize: 11, fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace" },
  wxHint: { fontSize: 12, fontFamily: "Inter_400Regular" },
});

// ─── Main Screen ─────────────────────────────────────────────────────────────
export default function PlanoVooScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { flightPlans, addFlightPlan, deleteFlightPlan, updateFlightPlan } = useApp();
  const [showModal, setShowModal] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<FlightPlan | null>(null);
  const topPadding = Platform.OS === "web" ? 67 : insets.top;

  const sorted = [...flightPlans].sort((a, b) => b.data.localeCompare(a.data));

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: topPadding + 16, backgroundColor: colors.card, borderBottomColor: colors.border }]}>
        <Text style={[styles.title, { color: colors.foreground }]}>Plano de Voo</Text>
        <Pressable
          style={[styles.addBtn, { backgroundColor: colors.primary }]}
          onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setShowModal(true); }}
        >
          <Feather name="plus" size={20} color="#FFFFFF" />
        </Pressable>
      </View>

      <FlatList
        data={sorted}
        keyExtractor={item => item.id}
        renderItem={({ item }) => (
          <PlanCard
            item={item}
            onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setSelectedPlan(item); }}
            onDelete={deleteFlightPlan}
            onSend={id => updateFlightPlan(id, { status: "enviado" })}
            colors={colors}
          />
        )}
        contentContainerStyle={[styles.list, { paddingBottom: Platform.OS === "web" ? 84 + 34 : 80 }]}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Feather name="navigation" size={40} color={colors.mutedForeground} />
            <Text style={[styles.emptyTitle, { color: colors.foreground }]}>Nenhum plano de voo</Text>
            <Text style={[styles.emptySub, { color: colors.mutedForeground }]}>Toque em + para criar o primeiro plano</Text>
          </View>
        }
      />

      <NewPlanModal visible={showModal} onClose={() => setShowModal(false)} onSave={addFlightPlan} colors={colors} />
      <FlightDetailModal plan={selectedPlan} visible={!!selectedPlan} onClose={() => setSelectedPlan(null)} colors={colors} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
    paddingHorizontal: 16, paddingBottom: 16, borderBottomWidth: 1,
  },
  title: { fontSize: 24, fontFamily: "Inter_700Bold" },
  addBtn: { width: 38, height: 38, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  list: { padding: 16 },
  empty: { alignItems: "center", paddingTop: 60, gap: 8 },
  emptyTitle: { fontSize: 16, fontFamily: "Inter_600SemiBold", marginTop: 8 },
  emptySub: { fontSize: 13, fontFamily: "Inter_400Regular", textAlign: "center" },
});
