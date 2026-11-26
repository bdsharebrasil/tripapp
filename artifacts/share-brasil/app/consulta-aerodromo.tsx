import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Linking,
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
import { Cabecalho, Icon, tema, Toque } from "@/src/components/ui";
import { avisar } from "@/src/lib/confirmar";
import { API_URL, apiFetch } from "@/src/lib/api";

type Weather = { metar?: string; taf?: string; source?: string };
type Notam = {
  id?: string;
  number?: string | null;
  type?: string | null;
  message?: string;
  start?: string | null;
  end?: string | null;
};
type Chart = {
  title?: string;
  tipo?: string;
  descricao?: string;
  url?: string;
};
type Airport = {
  icao?: string;
  name?: string;
  city?: string | null;
  state?: string | null;
  elevation?: string | number | null;
  coordinates?: { lat: number; lng: number } | null;
  runways?: Record<string, unknown>[];
  frequencies?: Record<string, unknown>[];
  restrictions?: unknown[];
  operational?: Record<string, unknown>;
  contact?: Record<string, unknown>;
  raw_data?: { rotaer?: Record<string, unknown> } | Record<string, unknown>;
};
type Report = {
  weather?: Weather;
  notams: Notam[];
  charts: Chart[];
  solar: { date?: string; sunrise?: string; sunset?: string }[];
  airport?: Airport;
  errors: string[];
};

function texto(valor: unknown): string {
  if (valor == null || valor === "") return "";
  if (
    typeof valor === "string" ||
    typeof valor === "number" ||
    typeof valor === "boolean"
  )
    return String(valor);
  try {
    return JSON.stringify(valor);
  } catch {
    return String(valor);
  }
}

function apresentarCampo(item: Record<string, unknown>, chaves: string[]) {
  return chaves
    .map((chave) => item[chave])
    .find((valor) => valor != null && valor !== "");
}

export default function ConsultaAerodromoScreen({
  integrado = false,
}: {
  integrado?: boolean;
} = {}) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ icao?: string | string[] }>();
  const parametroIcao = Array.isArray(params.icao)
    ? params.icao[0]
    : params.icao;
  const [icao, setIcao] = useState("");
  const [pesquisado, setPesquisado] = useState("");
  const [relatorio, setRelatorio] = useState<Report | null>(null);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState("");

  const consultar = async (codigo: string) => {
    setCarregando(true);
    setErro("");
    setPesquisado(codigo);
    setRelatorio(null);
    const erros: string[] = [];
    const seguro = async <T,>(rotulo: string, requisicao: () => Promise<T>) => {
      try {
        return await requisicao();
      } catch (cause) {
        erros.push(
          `${rotulo}: ${cause instanceof Error ? cause.message : "indisponível"}`,
        );
        return undefined;
      }
    };
    try {
      const [
        weather,
        notamResponse,
        chartResponse,
        solarResponse,
        airportResponse,
      ] = await Promise.all([
        seguro("Meteorologia", () =>
          apiFetch<Weather>(`/api/weather/${encodeURIComponent(codigo)}`),
        ),
        seguro("NOTAM", () =>
          apiFetch<{ notams?: Notam[] }>(
            `/api/notam/${encodeURIComponent(codigo)}`,
          ),
        ),
        seguro("Cartas", () =>
          apiFetch<{ charts?: Chart[] }>(
            `/api/charts/${encodeURIComponent(codigo)}`,
          ),
        ),
        seguro("Horários solares", () =>
          apiFetch<{ solar?: Report["solar"] }>(
            `/api/solar/${encodeURIComponent(codigo)}`,
          ),
        ),
        seguro("Ficha ROTAER", () =>
          apiFetch<{ airport?: Airport }>(
            `/api/rotaer/${encodeURIComponent(codigo)}`,
          ),
        ),
      ]);
      const hasAnyData =
        weather ||
        notamResponse ||
        chartResponse ||
        solarResponse ||
        airportResponse;
      if (!hasAnyData) {
        setErro(
          erros.join("\n") ||
            "Não foi possível consultar os dados do aeródromo.",
        );
        return;
      }
      setRelatorio({
        weather,
        notams: notamResponse?.notams ?? [],
        charts: chartResponse?.charts ?? [],
        solar: solarResponse?.solar ?? [],
        airport: airportResponse?.airport,
        errors: erros,
      });
    } finally {
      setCarregando(false);
    }
  };

  useEffect(() => {
    const codigo = parametroIcao?.trim().toUpperCase();
    if (codigo && /^[A-Z]{4}$/.test(codigo)) {
      setIcao(codigo);
      void consultar(codigo);
    }
  }, [parametroIcao]);

  const consultarFormulario = () => {
    const codigo = icao.trim().toUpperCase();
    if (!/^[A-Z]{4}$/.test(codigo)) {
      setErro("Informe um código ICAO de quatro letras, por exemplo SBGR.");
      setRelatorio(null);
      return;
    }
    void consultar(codigo);
  };

  const abrirCarta = async (url?: string, baixar = false) => {
    if (!url) return;
    const destino = `${API_URL}/api/charts/preview?url=${encodeURIComponent(url)}${baixar ? "&download=1" : ""}`;
    try {
      await Linking.openURL(destino);
    } catch {
      avisar(
        "Carta indisponível",
        "Não foi possível abrir o PDF. Tente novamente mais tarde.",
      );
    }
  };

  const airport = relatorio?.airport;
  const solar = relatorio?.solar[0];
  const runways = Array.isArray(airport?.runways) ? airport.runways : [];
  const frequencies = Array.isArray(airport?.frequencies)
    ? airport.frequencies
    : [];
  const rawFicha = useMemo(() => {
    const source = airport?.raw_data;
    if (!source || typeof source !== "object") return {};
    const nested = (source as { rotaer?: Record<string, unknown> }).rotaer;
    return nested && typeof nested === "object"
      ? nested
      : (source as Record<string, unknown>);
  }, [airport?.raw_data]);
  const detalhes = useMemo(() => {
    if (!airport) return [] as [string, string][];
    const known: [string, unknown][] = [
      ["Restrições", airport.restrictions],
      ["Procedimentos operacionais", airport.operational?.opea],
      ["Obstáculos", airport.operational?.obstacles],
      ["Iluminação", airport.operational?.other_lighting],
      ["Energia secundária", airport.operational?.secondary_power],
      ["Regulamentos locais", airport.operational?.local_regulations],
      ["Contato", airport.contact],
    ];
    const ignored = new Set([
      "icao",
      "icaoCode",
      "AeroCode",
      "name",
      "nome",
      "city",
      "cidade",
      "state",
      "uf",
      "elevation",
      "altitude",
      "coordinates",
      "coordenadas",
      "runways",
      "pistas",
      "frequencies",
      "frequencias",
    ]);
    const raw = Object.entries(rawFicha).filter(
      ([key, value]) => !ignored.has(key) && value != null && value !== "",
    );
    return [
      ...known,
      ...raw.map(
        ([key, value]) => [key.replace(/_/g, " "), value] as [string, unknown],
      ),
    ]
      .map(([label, value]) => [label, texto(value)] as [string, string])
      .filter(([, value]) => value);
  }, [airport, rawFicha]);

  return (
    <SafeAreaView edges={integrado ? [] : ["top"]} style={styles.root}>
      {!integrado && (
        <Cabecalho
          titulo="Consulta aeronáutica"
          apoio="AISWEB · ROTAER · DECEA"
          voltar={() => router.back()}
        />
      )}
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingBottom: insets.bottom + 28 },
        ]}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.card}>
          <Text style={styles.label}>CÓDIGO ICAO</Text>
          <View style={styles.searchRow}>
            <TextInput
              accessibilityLabel="Código ICAO do aeródromo"
              value={icao}
              onChangeText={(value) =>
                setIcao(
                  value
                    .toUpperCase()
                    .replace(/[^A-Z]/g, "")
                    .slice(0, 4),
                )
              }
              onSubmitEditing={consultarFormulario}
              placeholder="Ex.: SBGR"
              placeholderTextColor={tema.suave}
              autoCapitalize="characters"
              autoCorrect={false}
              maxLength={4}
              returnKeyType="search"
              style={styles.searchInput}
            />
            <Toque
              accessibilityRole="button"
              disabled={carregando}
              onPress={consultarFormulario}
              style={styles.searchButton}
            >
              {carregando ? (
                <ActivityIndicator color={tema.sobreDestaque} />
              ) : (
                <Icon name="search" size={18} color={tema.sobreDestaque} />
              )}
              <Text style={styles.searchButtonText}>Consultar</Text>
            </Toque>
          </View>
          <Text style={styles.helper}>
            Consulta independente por qualquer aeródromo com código ICAO.
          </Text>
        </View>

        {!!erro && (
          <View style={styles.error}>
            <Icon name="alert-circle" size={18} color={tema.perigo} />
            <Text style={styles.errorText}>{erro}</Text>
          </View>
        )}
        {carregando && (
          <View style={styles.loading}>
            <ActivityIndicator color={tema.destaque} />
            <Text style={styles.helper}>
              Consultando os serviços AISWEB/DECEA…
            </Text>
          </View>
        )}

        {relatorio && (
          <>
            <View style={styles.card}>
              <Text style={styles.kicker}>{pesquisado} · AISWEB/DECEA</Text>
              <Text style={styles.airportName}>
                {airport?.name || pesquisado}
              </Text>
              <Text style={styles.helper}>
                {[airport?.city, airport?.state].filter(Boolean).join(" / ") ||
                  "Localização não informada"}
              </Text>
            </View>

            <View style={styles.stats}>
              <Info
                label="Elevação"
                value={
                  airport?.elevation == null ? "—" : `${airport.elevation} ft`
                }
              />
              <Info
                label="Coordenadas"
                value={
                  airport?.coordinates
                    ? `${Number(airport.coordinates.lat).toFixed(4)}, ${Number(airport.coordinates.lng).toFixed(4)}`
                    : "—"
                }
              />
              <Info label="Nascer do sol" value={solar?.sunrise || "—"} />
              <Info label="Pôr do sol" value={solar?.sunset || "—"} />
            </View>

            <Section title="METEOROLOGIA" icon="cloud">
              <DataBlock
                title="METAR"
                value={relatorio.weather?.metar || "Sem METAR disponível."}
              />
              <DataBlock
                title="TAF"
                value={relatorio.weather?.taf || "Sem TAF disponível."}
              />
            </Section>

            <Section title="PISTAS E FREQUÊNCIAS" icon="navigation">
              {!runways.length && !frequencies.length && (
                <Text style={styles.helper}>
                  Sem dados de pista ou frequência publicados nesta consulta.
                </Text>
              )}
              {!!runways.length && (
                <DataBlock
                  title="Pistas"
                  value={runways
                    .map(
                      (item) =>
                        [
                          apresentarCampo(item, [
                            "ident",
                            "designator",
                            "designacao",
                            "rwy",
                          ]),
                          apresentarCampo(item, ["length", "comprimento"]),
                          apresentarCampo(item, ["width", "largura"]),
                          apresentarCampo(item, ["surface", "piso"]),
                        ]
                          .filter(Boolean)
                          .map(texto)
                          .join(" · ") || texto(item),
                    )
                    .join("\n\n")}
                />
              )}
              {!!frequencies.length && (
                <DataBlock
                  title="Frequências"
                  value={frequencies
                    .map(
                      (item) =>
                        [
                          apresentarCampo(item, ["type", "tipo", "servico"]),
                          apresentarCampo(item, [
                            "frequency",
                            "freq",
                            "frequencia",
                          ]),
                        ]
                          .filter(Boolean)
                          .map(texto)
                          .join(" · ") || texto(item),
                    )
                    .join("\n\n")}
                />
              )}
            </Section>

            <Section
              title={`NOTAM · ${relatorio.notams.length}`}
              icon="alert-circle"
            >
              {relatorio.notams.length ? (
                relatorio.notams.map((item, index) => (
                  <View
                    key={item.id || `${item.number}-${index}`}
                    style={styles.dataBlock}
                  >
                    <Text style={styles.kicker}>
                      {[item.number, item.type].filter(Boolean).join(" · ") ||
                        `NOTAM ${index + 1}`}
                    </Text>
                    <Text selectable style={styles.mono}>
                      {item.message || "Sem descrição disponível."}
                    </Text>
                    {item.start || item.end ? (
                      <Text style={styles.small}>
                        {item.start || "—"} → {item.end || "—"}
                      </Text>
                    ) : null}
                  </View>
                ))
              ) : (
                <Text style={styles.helper}>
                  Nenhum NOTAM em vigor retornado.
                </Text>
              )}
            </Section>

            <Section title={`CARTAS · ${relatorio.charts.length}`} icon="map">
              {relatorio.charts.length ? (
                relatorio.charts.map((chart, index) => (
                  <View
                    key={`${chart.url || chart.title}-${index}`}
                    style={styles.dataBlock}
                  >
                    <Text style={styles.dataTitle}>
                      {chart.title || "Carta aeronáutica"}
                    </Text>
                    <Text style={styles.small}>
                      {[chart.tipo, chart.descricao]
                        .filter(Boolean)
                        .join(" · ")}
                    </Text>
                    {chart.url ? (
                      <View style={styles.chartActions}>
                        <Toque
                          accessibilityRole="button"
                          onPress={() => void abrirCarta(chart.url)}
                          style={styles.chartButton}
                        >
                          <Icon
                            name="external-link"
                            size={15}
                            color={tema.sobreDestaque}
                          />
                          <Text style={styles.chartButtonText}>Abrir PDF</Text>
                        </Toque>
                        <Toque
                          accessibilityRole="button"
                          onPress={() => void abrirCarta(chart.url, true)}
                          style={[
                            styles.chartButton,
                            styles.chartButtonSecondary,
                          ]}
                        >
                          <Icon name="download" size={15} color={tema.texto} />
                          <Text
                            style={[
                              styles.chartButtonText,
                              { color: tema.texto },
                            ]}
                          >
                            Baixar
                          </Text>
                        </Toque>
                      </View>
                    ) : (
                      <Text style={styles.small}>
                        Link da carta indisponível.
                      </Text>
                    )}
                  </View>
                ))
              ) : (
                <Text style={styles.helper}>
                  Nenhuma carta retornada para este aeródromo.
                </Text>
              )}
            </Section>

            {!!detalhes.length && (
              <Section title="ROTAER · DADOS ADICIONAIS" icon="file-text">
                {detalhes.map(([label, value], index) => (
                  <View key={`${label}-${index}`} style={styles.detailRow}>
                    <Text style={styles.label}>{label}</Text>
                    <Text selectable style={styles.detailValue}>
                      {value}
                    </Text>
                  </View>
                ))}
              </Section>
            )}

            {!!relatorio.errors.length && (
              <View style={styles.warning}>
                <Text style={styles.warningText}>
                  Alguns serviços não retornaram dados:{" "}
                  {relatorio.errors.join(" · ")}
                </Text>
              </View>
            )}
            <Text style={styles.disclaimer}>
              Consulta de apoio. Confirme a informação vigente nas publicações
              oficiais AIS/DECEA e nos procedimentos do operador antes de
              qualquer decisão operacional.
            </Text>
            <Toque
              accessibilityRole="button"
              disabled={carregando}
              onPress={() => void consultar(pesquisado)}
              style={styles.refresh}
            >
              <Icon name="refresh-cw" size={16} color={tema.texto} />
              <Text style={styles.refreshText}>Atualizar consulta</Text>
            </Toque>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.info}>
      <Text style={styles.label}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  );
}
function DataBlock({ title, value }: { title: string; value: string }) {
  return (
    <View style={styles.dataBlock}>
      <Text style={styles.label}>{title}</Text>
      <Text selectable style={styles.mono}>
        {value}
      </Text>
    </View>
  );
}
function Section({
  title,
  icon,
  children,
}: {
  title: string;
  icon: "cloud" | "navigation" | "alert-circle" | "map" | "file-text";
  children: React.ReactNode;
}) {
  return (
    <View style={styles.card}>
      <View style={styles.sectionTitle}>
        <Icon name={icon} size={16} color={tema.destaque} />
        <Text style={styles.sectionTitleText}>{title}</Text>
      </View>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: tema.fundo },
  content: { paddingHorizontal: 18, paddingTop: 4, gap: 12 },
  card: {
    backgroundColor: tema.superficie,
    borderRadius: 18,
    padding: 15,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: tema.borda,
  },
  searchRow: {
    flexDirection: "row",
    gap: 8,
    alignItems: "center",
    marginTop: 8,
  },
  searchInput: {
    flex: 1,
    minHeight: 48,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: tema.borda,
    backgroundColor: tema.fundo,
    color: tema.texto,
    paddingHorizontal: 13,
    fontSize: 16,
    fontFamily: "monospace",
    letterSpacing: 2,
  },
  searchButton: {
    minHeight: 48,
    borderRadius: 12,
    paddingHorizontal: 13,
    backgroundColor: tema.destaque,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  searchButtonText: {
    color: tema.sobreDestaque,
    fontFamily: "Inter_600SemiBold",
    fontSize: 13,
  },
  label: {
    color: tema.suave,
    fontSize: 10,
    fontFamily: "Inter_600SemiBold",
    letterSpacing: 0.8,
    textTransform: "uppercase",
    marginBottom: 5,
  },
  helper: { color: tema.suave, fontSize: 12, lineHeight: 18, marginTop: 5 },
  kicker: {
    color: tema.destaque,
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
    letterSpacing: 0.8,
  },
  airportName: {
    color: tema.texto,
    fontSize: 19,
    fontFamily: "Inter_700Bold",
    marginTop: 5,
  },
  stats: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  info: {
    width: "48%",
    minHeight: 68,
    backgroundColor: tema.superficie,
    borderRadius: 14,
    padding: 11,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: tema.borda,
  },
  infoValue: { color: tema.texto, fontSize: 12, fontFamily: "Inter_500Medium" },
  sectionTitle: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 10,
  },
  sectionTitleText: {
    flex: 1,
    color: tema.texto,
    fontSize: 13,
    fontFamily: "Inter_700Bold",
  },
  dataBlock: {
    backgroundColor: tema.fundo,
    borderRadius: 12,
    padding: 12,
    marginTop: 7,
  },
  dataTitle: {
    color: tema.texto,
    fontFamily: "Inter_600SemiBold",
    fontSize: 13,
  },
  mono: {
    color: tema.texto,
    fontFamily: "monospace",
    fontSize: 11,
    lineHeight: 17,
    marginTop: 4,
  },
  small: { color: tema.suave, fontSize: 10, lineHeight: 15, marginTop: 7 },
  chartActions: { flexDirection: "row", gap: 8, marginTop: 10 },
  chartButton: {
    minHeight: 38,
    paddingHorizontal: 11,
    borderRadius: 10,
    backgroundColor: tema.destaque,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  chartButtonSecondary: {
    backgroundColor: tema.elevado,
    borderWidth: 1,
    borderColor: tema.borda,
  },
  chartButtonText: {
    color: tema.sobreDestaque,
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
  },
  detailRow: {
    paddingVertical: 9,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: tema.borda,
  },
  detailValue: { color: tema.texto, fontSize: 11, lineHeight: 16 },
  loading: {
    backgroundColor: tema.superficie,
    padding: 22,
    borderRadius: 16,
    alignItems: "center",
    gap: 10,
  },
  error: {
    borderRadius: 12,
    padding: 12,
    backgroundColor: "#FF8A8A16",
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  errorText: { flex: 1, color: tema.perigo, fontSize: 12, lineHeight: 18 },
  warning: {
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: "#F4C54240",
    backgroundColor: "#F4C54212",
  },
  warningText: { color: tema.suave, fontSize: 11, lineHeight: 17 },
  disclaimer: {
    color: tema.suave,
    fontSize: 11,
    lineHeight: 17,
    textAlign: "center",
    paddingHorizontal: 8,
  },
  refresh: {
    minHeight: 46,
    borderRadius: 12,
    backgroundColor: tema.elevado,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  refreshText: {
    color: tema.texto,
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
  },
});
