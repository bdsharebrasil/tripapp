export type Coord = { lat: number; lon: number };
export type Posicao = Coord & {
  registrado_em: string;
  alt_ft: number | null;
  gs_kt: number | null;
  rumo_graus: number | null;
  precisao_m?: number;
  id?: string;
  trilha_id?: string;
};
export type VooAoVivo = {
  id: string;
  numero_voo: string | null;
  matricula_registro: string | null;
  modelo: string | null;
  origem: string | null;
  destino: string | null;
  origem_coord: Coord | null;
  destino_coord: Coord | null;
  horario_previsto_agendamento: string | null;
  status: string;
  perna_atual: {
    id: string;
    horario_dep: string | null;
    horario_pouso: string | null;
    horario_corte: string | null;
  } | null;
  rastreio:
    | (Coord & {
        alt_ft: number | null;
        gs_kt: number | null;
        rumo_graus: number | null;
        visto_ha_s: number | null;
        fonte?: string;
      })
    | null;
  observado_em: string | null;
  rastreio_status: string;
  trilha: Posicao[];
};
export const coordValida = (p: Coord | null | undefined): p is Coord =>
  !!p &&
  Number.isFinite(p.lat) &&
  Number.isFinite(p.lon) &&
  Math.abs(p.lat) <= 90 &&
  Math.abs(p.lon) <= 180;
export function distanciaNm(a: Coord, b: Coord) {
  const rad = Math.PI / 180,
    dLat = (b.lat - a.lat) * rad,
    dLon = (b.lon - a.lon) * rad;
  return (
    3440.065 *
    2 *
    Math.asin(
      Math.min(
        1,
        Math.sqrt(
          Math.sin(dLat / 2) ** 2 +
            Math.cos(a.lat * rad) *
              Math.cos(b.lat * rad) *
              Math.sin(dLon / 2) ** 2,
        ),
      ),
    )
  );
}
export function idadeSegundos(ts: string | null | undefined, agora: number) {
  if (!ts) return Infinity;
  const value = Date.parse(ts),
    age = (agora - value) / 1000;
  return Number.isFinite(value) && age >= -5 ? Math.max(0, age) : Infinity;
}
export function escolherPosicao(
  voo: VooAoVivo | null,
  gps: Posicao | null,
  agora: number,
) {
  if (
    coordValida(gps) &&
    idadeSegundos(gps.registrado_em, agora) <= 30 &&
    (gps.precisao_m ?? Infinity) <= 200
  )
    return { posicao: gps, fonte: "GPS_LOCAL", atual: true } as const;
  const p = voo?.rastreio;
  if (
    coordValida(p) &&
    voo?.observado_em &&
    idadeSegundos(voo.observado_em, agora) <= 30 &&
    voo.rastreio_status === "ao_vivo"
  )
    return {
      posicao: { ...p, registrado_em: voo.observado_em },
      fonte: "ADSB",
      atual: true,
    } as const;
  const ultima =
    [
      gps,
      ...(voo?.trilha || []),
      p && voo?.observado_em ? { ...p, registrado_em: voo.observado_em } : null,
    ]
      .filter(
        (p): p is Posicao =>
          coordValida(p) && Number.isFinite(Date.parse(p.registrado_em)),
      )
      .sort(
        (a, b) => Date.parse(b.registrado_em) - Date.parse(a.registrado_em),
      )[0] || null;
  return { posicao: ultima, fonte: "SEM_SINAL", atual: false } as const;
}
export function metricasRota(
  voo: VooAoVivo | null,
  pos: Posicao | null,
  atual: boolean,
  agora: number,
) {
  const inicio = voo?.origem_coord,
    fim = voo?.destino_coord;
  if (!coordValida(inicio) || !coordValida(fim) || !coordValida(pos))
    return { restante: null, progresso: null, minutos: null, chegada: null };
  const restante = distanciaNm(pos, fim),
    total = distanciaNm(inicio, fim);
  const progresso =
    total > 0 ? Math.max(0, Math.min(1, 1 - restante / total)) : null;
  const minutos =
    atual && pos.gs_kt != null && pos.gs_kt >= 30 && pos.gs_kt <= 1200
      ? (restante / pos.gs_kt) * 60
      : null;
  return {
    restante,
    progresso,
    minutos,
    chegada:
      minutos != null ? new Date(agora + minutos * 60000).toISOString() : null,
  };
}
export function segmentosTrilha(pontos: Posicao[]) {
  const segmentos: Posicao[][] = [];
  let anterior: Posicao | undefined;
  for (const p of pontos.filter(coordValida)) {
    if (
      !anterior ||
      p.trilha_id !== anterior.trilha_id ||
      Date.parse(p.registrado_em) - Date.parse(anterior.registrado_em) > 120000
    )
      segmentos.push([]);
    segmentos[segmentos.length - 1].push(p);
    anterior = p;
  }
  return segmentos;
}
// Web Mercator, em um mundo de 256 unidades; independe de internet.
export function projetar(p: Coord) {
  const lat = (Math.max(-85, Math.min(85, p.lat)) * Math.PI) / 180;
  return {
    x: ((p.lon + 180) / 360) * 256,
    y: ((1 - Math.log(Math.tan(lat) + 1 / Math.cos(lat)) / Math.PI) / 2) * 256,
  };
}
