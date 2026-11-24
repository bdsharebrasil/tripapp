import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  AppState,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";
import * as Location from "expo-location";
import { apiFetch, ApiError } from "@/src/lib/api";
import { Cabecalho, Botao, tema, u } from "@/src/components/ui";
import { MapaVoo } from "@/src/components/MapaVoo";
import {
  escolherPosicao,
  coordValida,
  idadeSegundos,
  metricasRota,
  type Posicao,
  type VooAoVivo,
} from "@/src/lib/acompanhamento";
import {
  identidadeCache,
  lerCache,
  salvarCache,
  type CacheVoo,
  type LocalPonto,
} from "@/src/lib/acompanhamento-cache";
const hh = (v?: string | null) => {
  if (!v) return "—";
  const t = Date.parse(v);
  return Number.isFinite(t)
    ? new Date(t).toISOString().slice(11, 16)
    : v.match(/\d{2}:\d{2}/)?.[0] || "—";
};
const fmt = (v: number | null | undefined, unit: string) =>
  v != null && Number.isFinite(v) ? `${Math.round(v)} ${unit}` : "—";
export default function AcompanharVoo() {
  const { vooId } = useLocalSearchParams<{ vooId?: string }>(),
    router = useRouter(),
    insets = useSafeAreaInsets();
  const [user, setUser] = useState<string | null>(null),
    [voo, setVoo] = useState<VooAoVivo | null>(null),
    [gps, setGps] = useState<Posicao | null>(null);
  const [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [online, setOnline] = useState(false),
    [busy, setBusy] = useState(false);
  const [focus, setFocus] = useState(false),
    [foreground, setForeground] = useState(AppState.currentState === "active"),
    [enabled, setEnabled] = useState(false),
    [gpsNote, setGpsNote] = useState("");
  const [pending, setPending] = useState(0),
    [pontos, setPontos] = useState<LocalPonto[]>([]),
    [now, setNow] = useState(Date.now());
  const cache = useRef<CacheVoo>({ voo: null, pontos: [], pendentes: [] }),
    serial = useRef(Promise.resolve()),
    fetching = useRef(false),
    generation = useRef(0);
  useFocusEffect(
    useCallback(() => {
      setFocus(true);
      return () => setFocus(false);
    }, []),
  );
  useEffect(() => {
    const s = AppState.addEventListener("change", (v) =>
      setForeground(v === "active"),
    );
    return () => s.remove();
  }, []);
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  useEffect(() => {
    let alive = true;
    void (async () => {
      try {
        const uid = await identidadeCache();
        if (!alive) return;
        if (!uid || !vooId)
          throw new Error(
            "Entre na sua conta e selecione um voo para acompanhar.",
          );
        const saved = await lerCache(uid, vooId);
        if (!alive) return;
        const expirados = saved.pendentes.filter(
          (p) => idadeSegundos(p.registrado_em, Date.now()) > 7 * 86400,
        );
        if (expirados.length) {
          saved.pendentes = saved.pendentes.filter(
            (p) => !expirados.includes(p),
          );
          setGpsNote(
            `${expirados.length} posições com mais de 7 dias permanecem apenas no histórico deste aparelho.`,
          );
          await salvarCache(uid, vooId, saved);
          if (!alive) return;
        }
        cache.current = saved;
        setVoo(saved.voo);
        setPontos(saved.pontos);
        setGps(saved.pontos.at(-1) || null);
        setPending(saved.pendentes.length);
        setUser(uid);
      } catch (e) {
        if (alive)
          setError(
            e instanceof Error ? e.message : "Não foi possível abrir o voo.",
          );
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
      generation.current++;
    };
  }, [vooId]);
  const persist = useCallback(() => {
    if (!user || !vooId) return;
    const snapshot = JSON.parse(JSON.stringify(cache.current)) as CacheVoo;
    serial.current = serial.current
      .catch(() => {})
      .then(() => salvarCache(user, vooId, snapshot));
    void serial.current.catch(() =>
      setError(
        "Não foi possível salvar no aparelho. Mantenha conexão antes de encerrar o acompanhamento.",
      ),
    );
  }, [user, vooId]);
  const refresh = useCallback(async () => {
    if (!user || !vooId || fetching.current) return;
    fetching.current = true;
    setBusy(true);
    const gen = generation.current;
    try {
      const data = await apiFetch<VooAoVivo>(
        `/api/colaborador/meus-voos/${encodeURIComponent(vooId)}/acompanhamento`,
        { timeoutMs: 10000 },
      );
      if (gen !== generation.current) return;
      cache.current.voo = data;
      setVoo(data);
      setOnline(true);
      setError("");
      persist();
      const lote = cache.current.pendentes.slice(0, 100);
      if (lote.length) {
        const result = await apiFetch<{ recebidos: string[] }>(
          `/api/colaborador/meus-voos/${encodeURIComponent(vooId)}/posicoes-gps`,
          {
            method: "POST",
            body: JSON.stringify({ pontos: lote }),
            timeoutMs: 10000,
          },
        );
        if (gen !== generation.current) return;
        const confirmed = new Set(result.recebidos);
        cache.current.pendentes = cache.current.pendentes.filter(
          (p) => !confirmed.has(p.id),
        );
        setPending(cache.current.pendentes.length);
        persist();
      }
    } catch (e) {
      if (gen !== generation.current) return;
      setOnline(false);
      if (e instanceof ApiError && [401, 403].includes(e.status))
        setEnabled(false);
      setError(
        e instanceof ApiError && [401, 403].includes(e.status)
          ? "Sem autorização para atualizar este voo."
          : e instanceof Error
            ? e.message
            : "Sem conexão com o rastreamento.",
      );
    } finally {
      fetching.current = false;
      if (gen === generation.current) setBusy(false);
    }
  }, [user, vooId, persist]);
  useEffect(() => {
    if (!focus || !foreground || !user) return;
    void refresh();
    const t = setInterval(() => void refresh(), 15000);
    return () => clearInterval(t);
  }, [focus, foreground, user, refresh]);
  useEffect(() => {
    if (!enabled || !focus || !foreground || !user) return;
    let alive = true,
      subscription: Location.LocationSubscription | undefined;
    void (async () => {
      try {
        const permission = await Location.getForegroundPermissionsAsync();
        if (!alive) return;
        if (permission.status !== "granted")
          throw new Error("Autorize a localização para acompanhar por GPS.");
        const watch = await Location.watchPositionAsync(
          {
            accuracy: Location.Accuracy.High,
            timeInterval: 15000,
            distanceInterval: 50,
          },
          (position) => {
            if (!alive) return;
            const { coords: c, timestamp } = position;
            if (
              !coordValida({ lat: c.latitude, lon: c.longitude }) ||
              c.accuracy == null ||
              c.accuracy < 0 ||
              c.accuracy > 200 ||
              idadeSegundos(new Date(timestamp).toISOString(), Date.now()) > 30
            ) {
              setGpsNote("GPS sem precisão suficiente. Aguardando novo sinal.");
              return;
            }
            if (cache.current.pendentes.length >= 5000) {
              setEnabled(false);
              setGpsNote(
                "Fila GPS cheia. Conecte à internet para sincronizar antes de continuar.",
              );
              return;
            }
            if (
              cache.current.pontos.at(-1)?.registrado_em ===
              new Date(timestamp).toISOString()
            )
              return;
            const p: LocalPonto = {
              id: `gps-${timestamp}-${Math.random().toString(36).slice(2, 10)}`,
              lat: c.latitude,
              lon: c.longitude,
              registrado_em: new Date(timestamp).toISOString(),
              precisao_m: c.accuracy,
              alt_ft:
                c.altitude != null && c.altitude >= -457 && c.altitude <= 19812
                  ? c.altitude * 3.28084
                  : null,
              gs_kt:
                c.speed != null && c.speed >= 0 && c.speed <= 617
                  ? c.speed * 1.943844
                  : null,
              rumo_graus:
                c.heading != null && c.heading >= 0 && c.heading <= 360
                  ? c.heading
                  : null,
            };
            cache.current.pontos = [...cache.current.pontos, p].slice(-5000);
            cache.current.pendentes.push(p);
            setGps(p);
            setPontos(cache.current.pontos);
            setPending(cache.current.pendentes.length);
            setGpsNote("");
            persist();
          },
        );
        if (!alive) watch.remove();
        else subscription = watch;
      } catch (e) {
        if (alive) {
          setEnabled(false);
          setGpsNote(e instanceof Error ? e.message : "GPS indisponível.");
        }
      }
    })();
    return () => {
      alive = false;
      subscription?.remove();
    };
  }, [enabled, focus, foreground, user, persist]);
  const toggleGps = async () => {
    if (!voo) return;
    if (enabled) {
      setEnabled(false);
      setGpsNote("GPS pausado.");
      return;
    }
    try {
      const p = await Location.requestForegroundPermissionsAsync();
      if (p.status !== "granted") {
        setGpsNote(
          "Localização não autorizada. O rastreamento ADS-B continua disponível com internet.",
        );
        return;
      }
      setEnabled(true);
      setGpsNote("Aguardando sinal GPS…");
    } catch (e) {
      setGpsNote(
        e instanceof Error ? e.message : "Não foi possível ativar o GPS.",
      );
    }
  };
  const selectedPosition = escolherPosicao(voo, gps, now);
  const source =
    selectedPosition.fonte === "ADSB" && !online
      ? { ...selectedPosition, atual: false }
      : selectedPosition;
  const metrics = metricasRota(voo, source.posicao, source.atual, now);
  const labels = {
    GPS_LOCAL: "GPS local",
    ADSB: "ADS-B atualizado",
    SEM_SINAL: "Sem sinal atual",
  };
  const trail =
    source.fonte === "GPS_LOCAL" || (!online && pontos.length)
      ? pontos
      : voo?.trilha || [];
  const elapsed = voo?.perna_atual?.horario_dep
    ? Math.max(
        0,
        Math.floor(
          ((voo.perna_atual.horario_pouso
            ? Date.parse(voo.perna_atual.horario_pouso)
            : now) -
            Date.parse(voo.perna_atual.horario_dep)) /
            60000,
        ),
      )
    : null;
  return (
    <SafeAreaView edges={["top"]} style={u.root}>
      <Cabecalho
        titulo={voo?.numero_voo || "Acompanhar voo"}
        apoio={voo?.matricula_registro || "MEUS VOOS"}
        voltar={() => router.back()}
        acao={() => void refresh()}
      />
      {loading ? (
        <ActivityIndicator color={tema.azul} />
      ) : (
        <ScrollView
          contentContainerStyle={{
            padding: 18,
            paddingBottom: insets.bottom + 40,
          }}
        >
          <View style={s.source}>
            <Text
              style={{
                color: source.atual ? tema.verde : tema.suave,
                fontSize: 12,
                fontWeight: "700",
              }}
            >
              {!online && source.fonte === "ADSB"
                ? "Última posição ADS-B"
                : labels[source.fonte]}
            </Text>
            <Text style={s.small}>
              {source.posicao
                ? `Posição ${hh(source.posicao.registrado_em)} UTC`
                : "Aguardando posição"}
            </Text>
          </View>
          <MapaVoo
            origem={voo?.origem_coord || null}
            destino={voo?.destino_coord || null}
            origemNome={voo?.origem || ""}
            destinoNome={voo?.destino || ""}
            posicao={source.posicao}
            trilha={trail}
            atual={source.atual}
          />
          {!source.atual && (
            <Text style={s.notice}>
              {source.posicao
                ? "Última posição conhecida. A aeronave não está sendo atualizada."
                : "Sem posição disponível. Ative o GPS ou atualize com internet."}
            </Text>
          )}
          {!!error && (
            <Text style={s.notice}>
              {voo ? "Dados salvos no aparelho. " : ""}
              {error}
            </Text>
          )}
          <View style={[u.panel, { marginTop: 16 }]}>
            <View style={s.route}>
              <View>
                <Text style={s.code}>{voo?.origem || "—"}</Text>
                <Text style={s.small}>Origem</Text>
              </View>
              <Text style={{ color: tema.azul, fontSize: 26 }}>✈</Text>
              <View style={{ alignItems: "flex-end" }}>
                <Text style={s.code}>{voo?.destino || "—"}</Text>
                <Text style={s.small}>Destino</Text>
              </View>
            </View>
            <View style={s.track}>
              <View
                style={{
                  height: 3,
                  width: `${(metrics.progresso || 0) * 100}%`,
                  backgroundColor: tema.azul,
                }}
              />
            </View>
            <Text style={s.small}>
              Progresso aproximado pela distância ao destino
              {metrics.progresso != null
                ? ` · ${Math.round(metrics.progresso * 100)}%`
                : ""}
            </Text>
            <View style={s.grid}>
              {[
                ["Restante", fmt(metrics.restante, "NM")],
                ["Tempo restante", fmt(metrics.minutos, "min")],
                [
                  "Velocidade solo",
                  source.atual ? fmt(source.posicao?.gs_kt, "kt") : "—",
                ],
                [
                  "Altitude",
                  source.atual ? fmt(source.posicao?.alt_ft, "ft") : "—",
                ],
                ["Decorrido", fmt(elapsed, "min")],
                [
                  "Chegada estimada",
                  metrics.chegada ? `${hh(metrics.chegada)} UTC` : "—",
                ],
              ].map(([label, value]) => (
                <View key={label} style={s.metric}>
                  <Text style={s.small}>{label}</Text>
                  <Text style={s.value}>{value}</Text>
                </View>
              ))}
            </View>
            <Text style={s.small}>
              Previsto {hh(voo?.horario_previsto_agendamento)} UTC · Decolagem{" "}
              {hh(voo?.perna_atual?.horario_dep)} UTC
            </Text>
            <Text style={s.small}>
              {voo?.modelo || "Aeronave não informada"} ·{" "}
              {String(voo?.status || "Sem atualização").replace(/_/g, " ")}
            </Text>
          </View>
          <View style={u.panel}>
            <Text style={s.heading}>Acompanhamento no aparelho</Text>
            <Text style={s.small}>
              O GPS acompanha enquanto esta tela está aberta. Os pontos são
              enviados à operação quando houver conexão.
            </Text>
            {!!gpsNote && <Text style={s.notice}>{gpsNote}</Text>}
            <View style={{ marginTop: 14 }}>
              <Botao
                texto={enabled ? "Pausar GPS local" : "Ativar GPS local"}
                icone={enabled ? "pause" : "navigation"}
                onPress={() => void toggleGps()}
                disabled={!voo}
                secundario
              />
            </View>
            <Text style={[s.small, { marginTop: 12 }]}>
              {pending} posições aguardando envio
              {!online ? " · conexão indisponível" : ""}
            </Text>
            <View style={{ marginTop: 14 }}>
              <Botao
                texto={busy ? "Atualizando…" : "Atualizar e sincronizar"}
                icone="refresh-cw"
                carregando={busy}
                disabled={!user}
                onPress={() => void refresh()}
              />
            </View>
            <Text style={[s.small, { marginTop: 12 }]}>
              {voo
                ? "Rota salva para consulta sem internet. Mapa básico incluído no app."
                : "Abra este voo com internet antes da viagem para salvar a rota."}
            </Text>
          </View>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}
const s = StyleSheet.create({
  source: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 8,
    marginBottom: 12,
  },
  small: { fontSize: 11, lineHeight: 18, color: tema.suave },
  notice: { fontSize: 12, lineHeight: 19, color: "#d6b58c", marginTop: 12 },
  route: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  code: { fontSize: 30, fontFamily: "Inter_700Bold", color: tema.texto },
  track: {
    height: 3,
    backgroundColor: tema.borda,
    marginTop: 18,
    marginBottom: 6,
    overflow: "hidden",
  },
  grid: { flexDirection: "row", flexWrap: "wrap", marginVertical: 15, gap: 12 },
  metric: { width: "46%", paddingVertical: 8 },
  value: {
    fontSize: 21,
    color: tema.texto,
    fontFamily: "Inter_600SemiBold",
    marginTop: 4,
  },
  heading: { color: tema.texto, fontSize: 15, fontFamily: "Inter_600SemiBold" },
});
