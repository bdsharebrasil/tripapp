import test from "node:test";
import assert from "node:assert/strict";
import {
  escolherPosicao,
  metricasRota,
  idadeSegundos,
  projetar,
  segmentosTrilha,
} from "../src/lib/acompanhamento.ts";
const now = Date.parse("2026-11-22T12:00:00Z");
const gps = {
  lat: 0,
  lon: 0,
  registrado_em: new Date(now).toISOString(),
  precisao_m: 15,
  gs_kt: 120,
  alt_ft: 2000,
  rumo_graus: 90,
};
const voo = {
  origem_coord: { lat: 0, lon: 0 },
  destino_coord: { lat: 0, lon: 1 },
  trilha: [],
  rastreio: { ...gps, visto_ha_s: 5 },
  observado_em: new Date(now - 5000).toISOString(),
  rastreio_status: "ao_vivo",
};
test("GPS local preciso tem prioridade; ADS-B atual é alternativa; nenhum dado antigo fica ao vivo", () => {
  assert.equal(escolherPosicao(voo, gps, now).fonte, "GPS_LOCAL");
  assert.equal(
    escolherPosicao(voo, { ...gps, precisao_m: 500 }, now).fonte,
    "ADSB",
  );
  assert.equal(escolherPosicao(voo, null, now + 60000).atual, false);
  assert.equal(escolherPosicao(voo, null, now + 60000).fonte, "SEM_SINAL");
  assert.equal(
    escolherPosicao({ ...voo, rastreio_status: "sem_sinal" }, null, now).atual,
    false,
  );
  assert.equal(idadeSegundos(null, now), Infinity);
  assert.equal(idadeSegundos("invalid", now), Infinity);
  assert.equal(
    idadeSegundos(new Date(now + 60000).toISOString(), now),
    Infinity,
  );
});
test("ETA é estimativa por distância NM e velocidade kt; não estima parado, sem sinal ou sem rota", () => {
  const m = metricasRota(voo, gps, true, now);
  assert.ok(Math.abs(m.restante - 60.04) < 0.1);
  assert.ok(Math.abs(m.minutos - 30) < 0.1);
  assert.equal(m.progresso, 0);
  assert.equal(metricasRota(voo, gps, false, now).chegada, null);
  assert.equal(
    metricasRota(voo, { ...gps, gs_kt: 0 }, true, now).minutos,
    null,
  );
  assert.equal(metricasRota(null, gps, true, now).restante, null);
  assert.equal(metricasRota(voo, { ...gps, lon: 1 }, true, now).progresso, 1);
});
test("mapa funciona sem rede e trilha não liga segmentos após perda prolongada ou troca de perna", () => {
  assert.deepEqual(projetar({ lat: 0, lon: 0 }), { x: 128, y: 128 });
  assert.ok(Number.isFinite(projetar({ lat: 90, lon: 180 }).y));
  assert.equal(
    segmentosTrilha([
      gps,
      { ...gps, registrado_em: new Date(now + 180000).toISOString() },
      { ...gps, trilha_id: "outra" },
    ]).length,
    3,
  );
});
