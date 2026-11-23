import React, { useEffect, useMemo, useRef, useState } from "react";
import { PanResponder, Pressable, StyleSheet, Text, View } from "react-native";
import Svg, { Circle, G, Path, Text as SvgText } from "react-native-svg";
import terra from "../lib/terra.json";
import {
  coordValida,
  projetar,
  segmentosTrilha,
  type Coord,
  type Posicao,
} from "../lib/acompanhamento";
import { tema } from "./ui";
const mundo = terra
  .map(
    (r) =>
      r
        .map((p, i) => {
          const q = projetar({ lat: p[1], lon: p[0] });
          return `${i ? "L" : "M"}${q.x.toFixed(3)},${q.y.toFixed(3)}`;
        })
        .join("") + "Z",
  )
  .join("");
export function MapaVoo({
  origem,
  destino,
  posicao,
  trilha,
  origemNome,
  destinoNome,
  atual,
}: {
  origem: Coord | null;
  destino: Coord | null;
  posicao: Posicao | null;
  trilha: Posicao[];
  origemNome: string;
  destinoNome: string;
  atual: boolean;
}) {
  const [width, setWidth] = useState(360),
    [zoom, setZoom] = useState(5),
    [center, setCenter] = useState({ x: 128, y: 150 }),
    [follow, setFollow] = useState(true);
  const ref = useRef({ center, zoom });
  ref.current = { center, zoom };
  const [drag, setDrag] = useState({ x: 0, y: 0 });
  const altura = 345;
  useEffect(() => {
    const pts = [origem, destino].filter(coordValida).map(projetar);
    if (!pts.length) return;
    setCenter({
      x: pts.reduce((n, p) => n + p.x, 0) / pts.length,
      y: pts.reduce((n, p) => n + p.y, 0) / pts.length,
    });
    const span = Math.max(
      Math.abs((pts[1]?.x ?? pts[0].x) - pts[0].x),
      Math.abs((pts[1]?.y ?? pts[0].y) - pts[0].y),
      1,
    );
    setZoom(Math.max(1, Math.min(9, Math.floor(Math.log2(240 / span)))));
  }, [origem?.lat, origem?.lon, destino?.lat, destino?.lon]);
  useEffect(() => {
    if (follow && coordValida(posicao)) setCenter(projetar(posicao));
  }, [follow, posicao?.lat, posicao?.lon]);
  const pan = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_, g) =>
          Math.abs(g.dx) + Math.abs(g.dy) > 6,
        onPanResponderMove: (_, g) => setDrag({ x: g.dx, y: g.dy }),
        onPanResponderRelease: (_, g) => {
          const a = ref.current;
          setCenter({
            x: a.center.x - g.dx / 2 ** a.zoom,
            y: Math.max(0, Math.min(256, a.center.y - g.dy / 2 ** a.zoom)),
          });
          setDrag({ x: 0, y: 0 });
          setFollow(false);
        },
        onPanResponderTerminate: () => setDrag({ x: 0, y: 0 }),
      }),
    [],
  );
  const scale = 2 ** zoom,
    offset = {
      x: width / 2 - center.x * scale + drag.x,
      y: altura / 2 - center.y * scale + drag.y,
    };
  const xy = (c: Coord) => {
    const p = projetar(c);
    return { x: p.x * scale + offset.x, y: p.y * scale + offset.y };
  };
  const path = (pts: Coord[]) =>
    pts
      .map((p, i) => {
        const q = xy(p);
        return `${i ? "L" : "M"}${q.x},${q.y}`;
      })
      .join(" ");
  return (
    <View style={s.map} onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
      <View {...pan.panHandlers}>
        <Svg width={width} height={altura} viewBox={`0 0 ${width} ${altura}`}>
          <G transform={`translate(${offset.x},${offset.y}) scale(${scale})`}>
            <Path
              d={mundo}
              fill="#171d24"
              stroke="#303b46"
              strokeWidth={0.6 / scale}
            />
          </G>
          {coordValida(origem) && coordValida(destino) && (
            <Path
              d={path([origem, destino])}
              stroke="#728292"
              strokeWidth={1.5}
              strokeDasharray="4 6"
              fill="none"
            />
          )}
          {segmentosTrilha(trilha)
            .filter((s) => s.length > 1)
            .map((segment, i) => (
              <Path
                key={i}
                d={path(segment)}
                stroke={tema.azul}
                strokeWidth={3}
                fill="none"
              />
            ))}
          {[
            { p: origem, n: origemNome },
            { p: destino, n: destinoNome },
          ].map(({ p, n }, i) => {
            if (!coordValida(p)) return null;
            const q = xy(p);
            return (
              <G key={i}>
                <Circle cx={q.x} cy={q.y} r={4} fill="#e2e8ee" />
                <SvgText x={q.x + 9} y={q.y - 9} fill="#c7d2dc" fontSize={12}>
                  {n}
                </SvgText>
              </G>
            );
          })}
          {coordValida(posicao) &&
            (() => {
              const p = xy(posicao);
              return (
                <G
                  transform={`translate(${p.x},${p.y}) rotate(${posicao.rumo_graus ?? 0})`}
                >
                  <Circle r={25} fill={atual ? "#2948C222" : "#66666622"} />
                  <Path
                    d="M0 -16 L3 -4 L15 4 L15 7 L3 4 L3 12 L7 15 L7 17 L0 15 L-7 17 L-7 15 L-3 12 L-3 4 L-15 7 L-15 4 L-3 -4 Z"
                    fill={atual ? "#d6e1eb" : "#7e8791"}
                  />
                </G>
              );
            })()}
        </Svg>
      </View>
      <View style={s.controls}>
        {[
          {
            label: "Aproximar mapa",
            text: "+",
            fn: () => setZoom((z) => Math.min(10, z + 1)),
          },
          {
            label: "Afastar mapa",
            text: "−",
            fn: () => setZoom((z) => Math.max(1, z - 1)),
          },
          {
            label: "Centralizar aeronave",
            text: "◎",
            fn: () => {
              setFollow(true);
              if (coordValida(posicao)) setCenter(projetar(posicao));
            },
          },
        ].map((b) => (
          <Pressable
            key={b.label}
            accessibilityRole="button"
            accessibilityLabel={b.label}
            onPress={b.fn}
            style={s.button}
          >
            <Text style={s.buttonText}>{b.text}</Text>
          </Pressable>
        ))}
      </View>
      <Text style={s.credit}>
        Natural Earth · domínio público · mapa básico offline
      </Text>
    </View>
  );
}
const s = StyleSheet.create({
  map: {
    backgroundColor: "#090c10",
    borderRadius: 24,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: tema.borda,
  },
  controls: { position: "absolute", right: 12, bottom: 40, gap: 6 },
  button: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: tema.elevado,
    alignItems: "center",
    justifyContent: "center",
  },
  buttonText: { color: tema.texto, fontSize: 24 },
  credit: {
    position: "absolute",
    bottom: 9,
    left: 10,
    right: 10,
    color: tema.suave,
    fontSize: 9,
  },
});
