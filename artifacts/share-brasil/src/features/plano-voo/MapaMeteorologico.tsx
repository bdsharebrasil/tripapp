import { createElement, useEffect, useMemo, useState } from "react";
import { Platform, ScrollView, StyleSheet, Text, View } from "react-native";
import { WebView } from "react-native-webview";
import { Icon, Toque } from "@/src/components/ui";
import type { Cores } from "./modelo";

type Camada = "temp" | "clouds" | "wind" | "rain" | "pressure" | "visibility";
const CAMADAS: { id: Camada; nome: string }[] = [
  { id: "temp", nome: "Temperatura" },
  { id: "clouds", nome: "Nuvens" },
  { id: "wind", nome: "Vento" },
  { id: "rain", nome: "Chuva" },
  { id: "pressure", nome: "Pressão" },
  { id: "visibility", nome: "Visibilidade" },
];

export function MapaMeteorologico({
  latitude,
  longitude,
  icao,
  colors,
  altura = 320,
}: {
  latitude: number;
  longitude: number;
  icao?: string;
  colors: Cores;
  altura?: number;
}) {
  const [camada, setCamada] = useState<Camada>("wind");
  const [versao, setVersao] = useState(0);
  useEffect(() => {
    const timer = setInterval(
      () => setVersao((value) => value + 1),
      10 * 60 * 1000,
    );
    return () => clearInterval(timer);
  }, []);
  const url = useMemo(() => {
    const query = new URLSearchParams({
      type: "map",
      location: "coordinates",
      metricRain: "mm",
      metricTemp: "°C",
      metricWind: "kt",
      zoom: "7",
      overlay: camada,
      product: "ecmwf",
      level: "surface",
      lat: String(latitude),
      lon: String(longitude),
      detailLat: String(latitude),
      detailLon: String(longitude),
      marker: "true",
    });
    return `https://embed.windy.com/embed.html?${query.toString()}&refresh=${versao}`;
  }, [camada, latitude, longitude, versao]);
  const iframe = createElement("iframe" as never, {
    title: `Mapa meteorológico${icao ? ` de ${icao}` : " da rota"}`,
    src: url,
    loading: "lazy",
    allowFullScreen: true,
    referrerPolicy: "strict-origin-when-cross-origin",
    style: {
      display: "block",
      width: "100%",
      height: altura,
      border: 0,
      backgroundColor: colors.card,
    },
  });

  return (
    <View style={styles.container}>
      <View style={styles.heading}>
        <View style={styles.titleRow}>
          <Icon name="cloud" size={16} color={colors.secondary} />
          <Text style={[styles.title, { color: colors.foreground }]}>
            Mapa meteorológico
          </Text>
          {icao ? (
            <Text style={[styles.icao, { color: colors.mutedForeground }]}>
              {icao}
            </Text>
          ) : null}
        </View>
        <Toque
          accessibilityRole="button"
          accessibilityLabel="Atualizar mapa meteorológico"
          onPress={() => setVersao((value) => value + 1)}
          style={[styles.refresh, { backgroundColor: colors.muted }]}
        >
          <Icon name="refresh-cw" size={15} color={colors.foreground} />
        </Toque>
      </View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.layers}
      >
        {CAMADAS.map((item) => {
          const selected = camada === item.id;
          return (
            <Toque
              key={item.id}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              onPress={() => setCamada(item.id)}
              style={[
                styles.layer,
                {
                  backgroundColor: selected ? colors.primary : colors.card,
                  borderColor: selected ? colors.primary : colors.border,
                },
              ]}
            >
              <Text
                style={[
                  styles.layerText,
                  { color: selected ? "#FFFFFF" : colors.mutedForeground },
                ]}
              >
                {item.nome}
              </Text>
            </Toque>
          );
        })}
      </ScrollView>
      <View
        style={[
          styles.map,
          {
            height: altura,
            backgroundColor: colors.card,
            borderColor: colors.border,
          },
        ]}
      >
        {Platform.OS === "web" ? (
          iframe
        ) : (
          <WebView
            key={url}
            source={{ uri: url }}
            originWhitelist={["https://*"]}
            javaScriptEnabled
            domStorageEnabled
            setSupportMultipleWindows={false}
            style={{ flex: 1, backgroundColor: colors.card }}
            accessibilityLabel={`Mapa meteorológico${icao ? ` de ${icao}` : " da rota"}`}
          />
        )}
      </View>
      <Text style={[styles.caption, { color: colors.mutedForeground }]}>
        Previsão ECMWF · camadas Windy atualizadas a cada 10 min. METAR/TAF são
        atualizados a cada 5 min; confirme fontes oficiais antes do voo.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: 9 },
  heading: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  titleRow: { flexDirection: "row", alignItems: "center", gap: 7 },
  title: { fontSize: 14, fontFamily: "Inter_700Bold" },
  icao: { fontSize: 11, fontFamily: "Inter_600SemiBold" },
  refresh: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  layers: { gap: 7, paddingVertical: 1 },
  layer: {
    minHeight: 36,
    justifyContent: "center",
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 11,
  },
  layerText: { fontSize: 11, fontFamily: "Inter_600SemiBold" },
  map: { width: "100%", overflow: "hidden", borderWidth: 1, borderRadius: 14 },
  caption: { fontSize: 10, lineHeight: 15, fontFamily: "Inter_400Regular" },
});
