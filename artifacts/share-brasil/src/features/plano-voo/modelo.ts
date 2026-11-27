import { useColors } from "@/hooks/useColors";
import { apiFetch } from "@/src/lib/api";

export type Cores = ReturnType<typeof useColors>;
export type RegraVoo = "I" | "V" | "Y" | "Z";
export type TipoVoo = "S" | "N" | "G" | "M" | "X";
export type Esteira = "L" | "M" | "H" | "J";
export type StatusPlano =
  | "rascunho"
  | "preparado"
  | "enviado"
  | "aprovado"
  | "cancelado";

export type FormularioIcao = {
  identificacao: string;
  regraVoo: RegraVoo;
  tipoVoo: TipoVoo;
  numeroAeronaves: string;
  tipoAeronave: string;
  esteira: Esteira;
  equipamento: string;
  adep: string;
  eobt: string;
  velocidade: string;
  nivel: string;
  rota: string;
  ades: string;
  eet: string;
  alternado1: string;
  alternado2: string;
  outrasInformacoes: string;
  autonomia: string;
  pessoasABordo: string;
  radioEmergencia: string;
  sobrevivencia: string;
  coletes: string;
  botes: string;
  corAeronave: string;
  observacoes: string;
  piloto: string;
};

export type NovoPlano = {
  numeroVoo: string;
  solicitacaoId: string;
  partida: string;
  chegada: string;
  trecho: string;
  data: string;
  aeronave: string;
  aeronaveId: string;
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
  fpl: FormularioIcao;
  status: StatusPlano;
};
export type PlanoVoo = NovoPlano & { id: string };

export type PlanoRegistro = {
  id: string;
  numero_voo: string;
  adep: string;
  ades: string;
  data_voo: string;
  eobt: string;
  created_at: string;
  payload: {
    form?: Partial<NovoPlano> & Partial<FormularioIcao> & { dataVoo?: string };
    contexto?: {
      solicitacao_id?: string | number;
      solicitacao?: {
        id?: string | number;
        numero_voo?: string | null;
        aeronave_id?: string | null;
        matricula_registro?: string | null;
        modelo?: string | null;
        piloto_nome?: string | null;
        copiloto_nome?: string | null;
      } | null;
      aeronave?: {
        matricula_registro?: string | null;
        modelo?: string | null;
      } | null;
    } | null;
  } | null;
};

export type FormularioPlano = Omit<
  NovoPlano,
  | "numeroVoo"
  | "solicitacaoId"
  | "combustivelPrevisto"
  | "passageiros"
  | "peso"
  | "fpl"
  | "status"
> & {
  combustivelPrevisto: string;
  passageiros: string;
  peso: string;
};

export type Clima = {
  loc?: string;
  metar?: string;
  taf?: string;
  source?: string;
  error?: string;
};
export type Ponto = { icao: string; name: string; lat: number; lon: number };
export type PlanoRota = {
  flightplan?: {
    adep?: string;
    ades?: string;
    route?: string;
    route_source?: string;
    distance_nm?: number;
    estimated_time?: string;
    flight_minutes?: number;
    cruise_speed?: number;
  };
  performance?: {
    modelo?: string;
    tipo_aeronave?: string;
    velocidade_cruzeiro_kt?: number;
    equipamentos_icao?: string;
    vigilancia_icao?: string;
    pbn_icao?: string;
  } | null;
  fuel?: {
    total_required?: number;
    trip_liters?: number;
    reserve_liters?: number;
    taxi_liters?: number;
    reserve_min?: number;
  };
  departure?: Ponto;
  destination?: Ponto;
  alternates?: { icao: string; name: string; distance_km: number }[];
  notam_alerts?: {
    icao?: string;
    number?: string;
    message?: string;
    start?: string;
    end?: string;
  }[];
  error?: string;
};

const numeroResposta = (valor: unknown): number | undefined => {
  if (typeof valor === "number")
    return Number.isFinite(valor) && valor > 0 ? valor : undefined;
  if (typeof valor !== "string") return undefined;
  const numero = Number(
    valor
      .trim()
      .replace(",", ".")
      .match(/\d+(?:\.\d+)?/)?.[0],
  );
  return Number.isFinite(numero) && numero > 0 ? numero : undefined;
};

function minutosDaResposta(valor: unknown): number | undefined {
  if (typeof valor === "number")
    return valor > 0 ? Math.round(valor) : undefined;
  if (typeof valor !== "string" || !valor.trim()) return undefined;
  const texto = valor.trim();
  const relogio = texto.match(/^(\d{1,3}):([0-5]\d)$/);
  if (relogio) return Number(relogio[1]) * 60 + Number(relogio[2]);
  const horasMinutos = texto.match(
    /(?:(\d+(?:[.,]\d+)?)\s*h)?\s*(?:(\d+)\s*m(?:in)?)?/i,
  );
  if (horasMinutos && (horasMinutos[1] || horasMinutos[2]))
    return Math.round(
      Number((horasMinutos[1] || "0").replace(",", ".")) * 60 +
        Number(horasMinutos[2] || 0),
    );
  const minutos = numeroResposta(texto);
  return minutos ? Math.round(minutos) : undefined;
}

export function formatarTempoVoo(minutos?: number | null): string {
  if (!minutos || !Number.isFinite(minutos) || minutos <= 0) return "—";
  const horas = Math.floor(minutos / 60);
  const resto = Math.round(minutos % 60);
  return horas
    ? `${horas}h ${String(resto).padStart(2, "0")}min`
    : `${resto} min`;
}

const distanciaEntrePontosNm = (a: Ponto, b: Ponto) => {
  const rad = (graus: number) => (graus * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLon = rad(b.lon - a.lon);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLon / 2) ** 2;
  return Math.round(2 * 3440.065 * Math.asin(Math.sqrt(Math.min(1, h))));
};

function pontoRota(valor: unknown, icaoFallback: string): Ponto | undefined {
  const registro = objeto(valor);
  if (!registro) return undefined;
  const lat = numeroCoordenada(registro.lat ?? registro.latitude);
  const lon = numeroCoordenada(
    registro.lon ?? registro.lng ?? registro.longitude,
  );
  if (lat == null || lon == null) return undefined;
  return {
    icao: String(
      registro.icao ?? registro.ident ?? registro.code ?? icaoFallback,
    ),
    name: String(
      registro.name ?? registro.nome ?? registro.label ?? icaoFallback,
    ),
    lat,
    lon,
  };
}

export function normalizarRespostaRota(
  resposta: unknown,
  adep: string,
  ades: string,
  velocidadeFallbackKt?: number,
): PlanoRota {
  const fila: Record<string, unknown>[] = [];
  const vistos = new Set<object>();
  const adicionar = (valor: unknown) => {
    if (Array.isArray(valor)) {
      valor.forEach(adicionar);
      return;
    }
    const registro = objeto(valor);
    if (!registro || vistos.has(registro)) return;
    vistos.add(registro);
    fila.push(registro);
    Object.values(registro).forEach((filho) => {
      if (objeto(filho) || Array.isArray(filho)) adicionar(filho);
    });
  };
  adicionar(resposta);
  const origemRaw = fila.find(
    (r) => r.departure || r.origin || r.origem || r.departure_airport,
  );
  const destinoRaw = fila.find(
    (r) => r.destination || r.destino || r.arrival || r.arrival_airport,
  );
  const departure = pontoRota(
    origemRaw?.departure ??
      origemRaw?.origin ??
      origemRaw?.origem ??
      origemRaw?.departure_airport,
    adep,
  );
  const destination = pontoRota(
    destinoRaw?.destination ??
      destinoRaw?.destino ??
      destinoRaw?.arrival ??
      destinoRaw?.arrival_airport,
    ades,
  );
  const planoRaw =
    (fila.find((r) => objeto(r.flightplan))?.flightplan as
      | Record<string, unknown>
      | undefined) ??
    fila.find(
      (r) =>
        r.route != null ||
        r.distance_nm != null ||
        r.distanceNM != null ||
        r.estimated_time != null ||
        r.flight_minutes != null,
    );
  const performanceRaw =
    (fila.find((r) => objeto(r.performance))?.performance as
      | Record<string, unknown>
      | undefined) ??
    fila.find(
      (r) => r.velocidade_cruzeiro_kt != null || r.cruise_speed != null,
    );
  const errorRaw = fila.find((r) => r.error != null)?.error;
  const flightplan: PlanoRota["flightplan"] = planoRaw
    ? {
        adep: String(planoRaw.adep ?? planoRaw.departure ?? adep),
        ades: String(planoRaw.ades ?? planoRaw.destination ?? ades),
        route:
          String(
            planoRaw.route ?? planoRaw.route_string ?? planoRaw.rota ?? "",
          ) || undefined,
        route_source:
          String(planoRaw.route_source ?? planoRaw.source ?? "") || undefined,
        distance_nm: numeroResposta(
          planoRaw.distance_nm ??
            planoRaw.distanceNM ??
            planoRaw.total_distance_nm ??
            planoRaw.distance ??
            planoRaw.distancia_nm,
        ),
        estimated_time:
          typeof (
            planoRaw.estimated_time ??
            planoRaw.estimatedTime ??
            planoRaw.ete ??
            planoRaw.flight_time
          ) === "string"
            ? String(
                planoRaw.estimated_time ??
                  planoRaw.estimatedTime ??
                  planoRaw.ete ??
                  planoRaw.flight_time,
              )
            : undefined,
        flight_minutes: numeroResposta(
          planoRaw.flight_minutes ??
            planoRaw.flightMinutes ??
            planoRaw.duration_minutes ??
            planoRaw.ete_minutes,
        ),
        cruise_speed: numeroResposta(
          planoRaw.cruise_speed ??
            planoRaw.cruise_speed_kt ??
            planoRaw.velocidade_cruzeiro_kt,
        ),
      }
    : {};
  const performance: PlanoRota["performance"] = performanceRaw
    ? {
        modelo:
          String(performanceRaw.modelo ?? performanceRaw.model ?? "") ||
          undefined,
        tipo_aeronave:
          String(
            performanceRaw.tipo_aeronave ?? performanceRaw.aircraft_type ?? "",
          ) || undefined,
        velocidade_cruzeiro_kt: numeroResposta(
          performanceRaw.velocidade_cruzeiro_kt ??
            performanceRaw.cruise_speed_kt ??
            performanceRaw.cruise_speed,
        ),
        equipamentos_icao:
          String(performanceRaw.equipamentos_icao ?? "") || undefined,
        vigilancia_icao:
          String(performanceRaw.vigilancia_icao ?? "") || undefined,
        pbn_icao: String(performanceRaw.pbn_icao ?? "") || undefined,
      }
    : null;
  const velocidade =
    flightplan.cruise_speed ??
    performance?.velocidade_cruzeiro_kt ??
    velocidadeFallbackKt;
  const distanceNm =
    flightplan.distance_nm ??
    (departure && destination
      ? distanciaEntrePontosNm(departure, destination)
      : undefined);
  const flightMinutes =
    flightplan.flight_minutes ??
    minutosDaResposta(flightplan.estimated_time) ??
    (distanceNm && velocidade
      ? Math.round((distanceNm / velocidade) * 60)
      : undefined);
  if (distanceNm != null) flightplan.distance_nm = distanceNm;
  if (flightMinutes != null) {
    flightplan.flight_minutes = flightMinutes;
    if (!flightplan.estimated_time)
      flightplan.estimated_time = formatarTempoVoo(flightMinutes);
  }
  const fuelRaw = fila.find((r) => objeto(r.fuel))?.fuel as
    | Record<string, unknown>
    | undefined;
  return {
    flightplan,
    performance,
    fuel: fuelRaw
      ? {
          total_required: numeroResposta(
            fuelRaw.total_required ??
              fuelRaw.totalRequired ??
              fuelRaw.total_liters,
          ),
          trip_liters: numeroResposta(
            fuelRaw.trip_liters ?? fuelRaw.tripLiters,
          ),
          reserve_liters: numeroResposta(
            fuelRaw.reserve_liters ?? fuelRaw.reserveLiters,
          ),
          taxi_liters: numeroResposta(
            fuelRaw.taxi_liters ?? fuelRaw.taxiLiters,
          ),
          reserve_min: numeroResposta(
            fuelRaw.reserve_min ?? fuelRaw.reserveMinutes,
          ),
        }
      : undefined,
    departure,
    destination,
    alternates: fila.flatMap((r) => {
      const lista = r.alternates ?? r.alternados;
      const itens = Array.isArray(lista) ? lista : [];
      return itens.flatMap((item) => {
        const registro = objeto(item);
        const icao = String(registro?.icao ?? registro?.ident ?? "");
        if (!registro || !icao) return [];
        return [
          {
            icao,
            name: String(registro.name ?? registro.nome ?? icao),
            distance_km:
              numeroResposta(registro.distance_km ?? registro.distanceKm) ?? 0,
          },
        ];
      });
    }),
    notam_alerts: fila.flatMap((r) => {
      const lista = r.notam_alerts ?? r.notams;
      const itens = Array.isArray(lista) ? lista : [];
      return itens.flatMap((item) => {
        const registro = objeto(item);
        return registro
          ? [
              {
                icao: String(registro.icao ?? "") || undefined,
                number:
                  String(registro.number ?? registro.numero ?? "") || undefined,
                message:
                  String(registro.message ?? registro.mensagem ?? "") ||
                  undefined,
                start:
                  String(registro.start ?? registro.inicio ?? "") || undefined,
                end: String(registro.end ?? registro.fim ?? "") || undefined,
              },
            ]
          : [];
      });
    }),
    error: errorRaw == null ? undefined : String(errorRaw),
  };
}

export type AerodromoRotaer = {
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
  raw_data?: Record<string, unknown>;
};

const objeto = (valor: unknown): Record<string, unknown> | null =>
  valor && typeof valor === "object" && !Array.isArray(valor)
    ? (valor as Record<string, unknown>)
    : null;

function numeroCoordenada(valor: unknown): number | null {
  if (typeof valor === "number")
    return Number.isFinite(valor) && Math.abs(valor) <= 180 ? valor : null;
  if (typeof valor !== "string") return null;
  const texto = valor.trim().replace(",", ".");
  const decimal = texto.match(/^(-?\d{1,3}(?:\.\d+)?)\s*[NSEW]?$/i);
  if (decimal) {
    const numero = Number(decimal[1]);
    return Number.isFinite(numero) && Math.abs(numero) <= 180 ? numero : null;
  }
  const dms = texto.match(
    /^(\d{1,3})[^\d]+(\d{1,2})(?:[^\d]+(\d{1,2}(?:\.\d+)?))?[^NSEW]*([NSEW])?$/i,
  );
  if (!dms) return null;
  const graus = Number(dms[1]);
  const minutos = Number(dms[2]);
  const segundos = Number(dms[3] || 0);
  if (minutos >= 60 || segundos >= 60) return null;
  const direcao = dms[4]?.toUpperCase();
  const sinal = direcao === "S" || direcao === "W" ? -1 : 1;
  const resultado = sinal * (graus + minutos / 60 + segundos / 3600);
  return Math.abs(resultado) <= 180 ? resultado : null;
}

/** Aceita a resposta direta do ROTAER e envelopes comuns (data/result/airport/rotaer). */
export function normalizarRespostaRotaer(
  resposta: unknown,
  icaoEsperado = "",
): AerodromoRotaer | undefined {
  const fila: Record<string, unknown>[] = [];
  const visitados = new Set<object>();
  const adicionar = (valor: unknown) => {
    if (Array.isArray(valor)) {
      valor.forEach(adicionar);
      return;
    }
    const registro = objeto(valor);
    if (!registro || visitados.has(registro)) return;
    visitados.add(registro);
    fila.push(registro);
    for (const [chave, filho] of Object.entries(registro)) {
      if (
        /^(airport|aerodrome|aeroporto|rotaer|data|result|results|payload|record)$/i.test(
          chave,
        )
      )
        adicionar(filho);
    }
  };
  adicionar(resposta);

  const pontuar = (item: Record<string, unknown>) => {
    let pontos = 0;
    if (item.icao || item.icaoCode || item.AeroCode || item.loc) pontos += 4;
    if (item.name || item.nome || item.aero) pontos += 3;
    if (item.coordinates || item.coordenadas || item.lat || item.latitude)
      pontos += 4;
    if (item.runways || item.pistas || item.services || item.operational)
      pontos += 2;
    if (item.raw_data || item.rawData) pontos += 1;
    return pontos;
  };
  const aeroporto = fila.sort((a, b) => pontuar(b) - pontuar(a))[0];
  if (!aeroporto || pontuar(aeroporto) === 0) return undefined;

  const coordenadas = objeto(aeroporto.coordinates ?? aeroporto.coordenadas);
  const lat = numeroCoordenada(
    coordenadas?.lat ??
      coordenadas?.latitude ??
      aeroporto.lat ??
      aeroporto.latitude,
  );
  const lng = numeroCoordenada(
    coordenadas?.lng ??
      coordenadas?.lon ??
      coordenadas?.longitude ??
      aeroporto.lng ??
      aeroporto.lon ??
      aeroporto.longitude,
  );
  const listas = (...valores: unknown[]) => {
    const valor = valores.find((item) => item != null);
    if (Array.isArray(valor))
      return valor.filter((item) => objeto(item)) as Record<string, unknown>[];
    const registro = objeto(valor);
    if (!registro) return [];
    for (const [chave, filho] of Object.entries(registro)) {
      if (
        /^(runway|pista|frequency|frequencia|freq|service|servico|item)$/i.test(
          chave,
        )
      )
        return Array.isArray(filho)
          ? (filho.filter((item) => objeto(item)) as Record<string, unknown>[])
          : objeto(filho)
            ? [objeto(filho)!]
            : [];
    }
    return [registro];
  };
  const raw =
    objeto(aeroporto.raw_data ?? aeroporto.rawData ?? aeroporto.raw) ??
    aeroporto;
  const coordinates = lat != null && lng != null ? { lat, lng } : null;
  const servicos = listas(aeroporto.services ?? aeroporto.servicos);
  const frequenciasDeServico = servicos.flatMap((servico) => {
    const tipoServico = String(
      servico["@_type"] ?? servico.type ?? "",
    ).toUpperCase();
    if (tipoServico !== "COM" && tipoServico !== "COMUNICATION") return [];
    const freqs = objeto(servico.freqs ?? servico.frequencies);
    const valores = freqs?.freq ?? freqs?.frequency;
    const lista = Array.isArray(valores)
      ? valores
      : valores == null
        ? []
        : [valores];
    return lista
      .map((valor) => {
        const registro = objeto(valor);
        const frequencia = registro?.["#text"] ?? registro?.value ?? valor;
        return frequencia == null || frequencia === ""
          ? null
          : {
              type: String(servico.type ?? servico.name ?? "COM"),
              frequency: String(frequencia),
              name: String(servico.callsign ?? servico.name ?? "") || undefined,
            };
      })
      .filter((item): item is NonNullable<typeof item> => item != null);
  });
  const frequencias = listas(aeroporto.frequencies, aeroporto.frequencias);
  return {
    ...(aeroporto as AerodromoRotaer),
    icao: String(
      aeroporto.icao ??
        aeroporto.icaoCode ??
        aeroporto.AeroCode ??
        aeroporto.loc ??
        icaoEsperado,
    ).toUpperCase(),
    name: String(aeroporto.name ?? aeroporto.nome ?? aeroporto.aero ?? ""),
    city: String(aeroporto.city ?? aeroporto.cidade ?? "") || null,
    state:
      String(aeroporto.state ?? aeroporto.uf ?? aeroporto.estado ?? "") || null,
    elevation: (aeroporto.elevation ??
      aeroporto.altitude ??
      aeroporto.altFt ??
      null) as string | number | null,
    coordinates,
    runways: listas(aeroporto.runways, aeroporto.pistas),
    frequencies: frequencias.length ? frequencias : frequenciasDeServico,
    restrictions: Array.isArray(aeroporto.restrictions)
      ? aeroporto.restrictions
      : Array.isArray(aeroporto.restricoes)
        ? aeroporto.restricoes
        : [],
    operational:
      objeto(aeroporto.operational ?? aeroporto.operacional) ?? undefined,
    contact: objeto(aeroporto.contact ?? aeroporto.contato) ?? undefined,
    raw_data: raw,
  };
}

export async function buscarAerodromoRotaer(icao: string) {
  const resposta = await apiFetch<unknown>(
    `/api/rotaer/${encodeURIComponent(icao)}`,
  );
  return normalizarRespostaRotaer(resposta, icao);
}

export type AeronaveSolicitacao = {
  id: string;
  registration?: string;
  matricula?: string;
  matricula_registro?: string;
  model?: string;
  modelo?: string;
  manufacturer?: string;
  fabricante?: string;
  tipo_aeronave?: string;
  fuel_consumption?: number;
  consumo_combustivel?: number;
  consumo_hora_litros?: number;
  velocidade_cruzeiro?: number | string;
  performance_velocidade_cruzeiro_kt?: number | string;
  performance_categoria?: string;
  performance_teto_servico_ft?: number | string;
  performance_taxa_subida_fpm?: number | string;
  performance_taxa_descida_fpm?: number | string;
  performance?: {
    velocidade_cruzeiro_kt?: number | string | null;
    categoria?: string | null;
    teto_servico_ft?: number | string | null;
    taxa_subida_fpm?: number | string | null;
    taxa_descida_fpm?: number | string | null;
  } | null;
  designador_icao?: string;
  esteira_turbulencia?: string;
  equipamentos_icao?: string;
  vigilancia_icao?: string;
  pbn_icao?: string;
  autonomia_padrao_minutos?: number | string;
  cor_marcas?: string;
};

export type VooSolicitacao = {
  solicitacao_id?: string | number;
  id?: string | number;
  numero_voo: string;
  origem?: string;
  destino?: string;
  data_agendada?: string;
  data_fim?: string;
  horario_previsto_agendamento?: string | null;
  numero_passageiros?: number | null;
  passageiros?: string[];
  status?: string | null;
  aeronave_id?: string | null;
  matricula_registro?: string | null;
  modelo?: string | null;
  tipo_aeronave?: string | null;
  piloto_id?: string | null;
  copiloto_id?: string | null;
  piloto_nome?: string | null;
  copiloto_nome?: string | null;
  matricula?: string;
};
export type PessoaTripulacao = {
  id: string;
  nome_completo?: string;
  nome?: string;
};

export const ICAO = /^[A-Z]{4}$/;
export const CONDICOES = ["VMC", "IMC", "IFR", "VFR"];
export const STATUS_CONFIG: Record<
  StatusPlano,
  { label: string; color: string }
> = {
  rascunho: { label: "Rascunho", color: "#94A3B8" },
  preparado: { label: "Pronto para envio manual", color: "#38BDF8" },
  enviado: { label: "Situação informada como enviado", color: "#F59E0B" },
  aprovado: { label: "Situação informada como aprovado", color: "#22C55E" },
  cancelado: { label: "Cancelado", color: "#EF4444" },
};

export const hoje = () => new Date().toISOString().split("T")[0];
export function formatarHoraUtc(valor?: string | null) {
  const horaSemSeparador = valor?.trim().match(/^(\d{2})(\d{2})Z?$/i);
  if (horaSemSeparador) {
    const horas = Number(horaSemSeparador[1]);
    const minutos = Number(horaSemSeparador[2]);
    return horas <= 23 && minutos <= 59
      ? `${horaSemSeparador[1]}:${horaSemSeparador[2]}`
      : "";
  }

  const correspondencia = valor?.match(
    /(?:^|[T\s])(\d{2}):(\d{2})(?::\d{2}(?:\.\d+)?)?(Z|([+-])(\d{2}):?(\d{2}))?$/i,
  );
  if (!correspondencia) return "";

  const horas = Number(correspondencia[1]);
  const minutos = Number(correspondencia[2]);
  if (horas > 23 || minutos > 59) return "";

  let totalMinutos = horas * 60 + minutos;
  if (correspondencia[4]) {
    const sinal = correspondencia[4] === "+" ? 1 : -1;
    const horaOffset = Number(correspondencia[5]);
    const minutoOffset = Number(correspondencia[6]);
    if (horaOffset > 23 || minutoOffset > 59) return "";
    totalMinutos -= sinal * (horaOffset * 60 + minutoOffset);
  }
  totalMinutos = (totalMinutos + 1440) % 1440;

  return `${String(Math.floor(totalMinutos / 60)).padStart(2, "0")}:${String(
    totalMinutos % 60,
  ).padStart(2, "0")}`;
}
export const criarFormulario = (): FormularioPlano => ({
  partida: "",
  chegada: "",
  trecho: "",
  data: hoje(),
  aeronave: "",
  aeronaveId: "",
  matricula: "",
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

export const criarFormularioIcao = (): FormularioIcao => ({
  identificacao: "",
  regraVoo: "V",
  tipoVoo: "G",
  numeroAeronaves: "1",
  tipoAeronave: "",
  esteira: "L",
  equipamento: "",
  adep: "",
  eobt: "",
  velocidade: "",
  nivel: "",
  rota: "",
  ades: "",
  eet: "",
  alternado1: "",
  alternado2: "",
  outrasInformacoes: "",
  autonomia: "",
  pessoasABordo: "",
  radioEmergencia: "",
  sobrevivencia: "",
  coletes: "",
  botes: "",
  corAeronave: "",
  observacoes: "",
  piloto: "",
});

const textoAeronave = (aeronave: AeronaveSolicitacao) =>
  [aeronave.modelo, aeronave.tipo_aeronave].filter(Boolean).join(" ");

/** Item 9 usa o designador cadastrado; o modelo completo fica preservado em TYP/ no Item 18. */
export function modeloParaFormulario(aeronave: AeronaveSolicitacao) {
  return String(
    aeronave.designador_icao || aeronave.modelo || aeronave.model || "",
  ).trim();
}

/** Usa a esteira cadastrada; se estiver vazia, estima L para pistão/turboélice e M para jato. */
export function esteiraDaAeronave(aeronave: AeronaveSolicitacao): Esteira {
  const cadastrada = String(aeronave.esteira_turbulencia || "")
    .trim()
    .toUpperCase();
  if (["L", "M", "H", "J"].includes(cadastrada)) return cadastrada as Esteira;
  return /jato|jet|turbojet|turbofan/i.test(textoAeronave(aeronave))
    ? "M"
    : "L";
}

function numeroPositivo(valor: unknown): number | null {
  const match = String(valor ?? "")
    .replace(",", ".")
    .match(/\d+(?:\.\d+)?/);
  const numero = match ? Number(match[0]) : NaN;
  return Number.isFinite(numero) && numero > 0 ? numero : null;
}

export function velocidadeCruzeiroDaAeronave(aeronave: AeronaveSolicitacao) {
  return (
    numeroPositivo(aeronave.performance?.velocidade_cruzeiro_kt) ??
    numeroPositivo(aeronave.performance_velocidade_cruzeiro_kt) ??
    numeroPositivo(aeronave.velocidade_cruzeiro)
  );
}

export function velocidadeIcao(valor: number | null) {
  return valor == null ? "" : `N${String(Math.round(valor)).padStart(4, "0")}`;
}

export function autonomiaIcao(valor: number | string | null | undefined) {
  const minutos = numeroPositivo(valor);
  if (minutos == null || minutos > 5999) return "";
  const total = Math.floor(minutos);
  return `${String(Math.floor(total / 60)).padStart(2, "0")}${String(total % 60).padStart(2, "0")}`;
}

function atualizarInformacaoIcao(atual: string, tag: string, valor: string) {
  const demais = atual
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .filter((parte) => !new RegExp(`^${tag}/`, "i").test(parte));
  return [...demais, ...(valor ? [`${tag}/${valor}`] : [])]
    .join(" ")
    .toUpperCase();
}

/** Transfere para o FPL os dados de aeronave disponíveis no cadastro, preservando campos sem valor. */
export function preencherDadosAeronaveIcao(
  aeronave: AeronaveSolicitacao,
  atual: FormularioIcao,
  matricula?: string,
): FormularioIcao {
  const modelo = String(aeronave.modelo || aeronave.model || "").trim();
  const registro = String(
    matricula ||
      aeronave.matricula_registro ||
      aeronave.registration ||
      aeronave.matricula ||
      "",
  )
    .replace(/-/g, "")
    .toUpperCase();
  const equipamento = String(aeronave.equipamentos_icao || "")
    .trim()
    .toUpperCase();
  const vigilancia = String(aeronave.vigilancia_icao || "")
    .trim()
    .toUpperCase();
  const equipamentoComVigilancia =
    equipamento || vigilancia
      ? `${equipamento || "N"}/${vigilancia || "N"}`
      : "";
  let outrasInformacoes = atualizarInformacaoIcao(
    atual.outrasInformacoes,
    "REG",
    registro,
  );
  outrasInformacoes = atualizarInformacaoIcao(outrasInformacoes, "TYP", modelo);
  outrasInformacoes = atualizarInformacaoIcao(
    outrasInformacoes,
    "PBN",
    String(aeronave.pbn_icao || "").trim(),
  );
  return {
    ...atual,
    identificacao: registro.replace(/[^A-Z0-9]/g, "").slice(0, 7),
    tipoAeronave: modeloParaFormulario(aeronave).toUpperCase(),
    esteira: esteiraDaAeronave(aeronave),
    equipamento: equipamentoComVigilancia,
    velocidade: velocidadeIcao(velocidadeCruzeiroDaAeronave(aeronave)),
    autonomia: autonomiaIcao(aeronave.autonomia_padrao_minutos),
    corAeronave: String(aeronave.cor_marcas || "")
      .trim()
      .toUpperCase(),
    outrasInformacoes,
  };
}

export function normalizarAeronaveSolicitacao(
  row: Record<string, any>,
): AeronaveSolicitacao {
  const performance = row.performance ?? row.performance_aeronave ?? null;
  const consumo =
    row.consumo_combustivel ?? row.consumo_hora_litros ?? row.fuel_consumption;
  return {
    ...row,
    id: String(row.id ?? ""),
    registration:
      row.registration || row.matricula_registro || row.matricula || "",
    matricula:
      row.matricula || row.matricula_registro || row.registration || "",
    matricula_registro:
      row.matricula_registro || row.registration || row.matricula || "",
    model: row.model || row.modelo || "",
    modelo: row.modelo || row.model || "",
    manufacturer: row.manufacturer || row.fabricante || "",
    fabricante: row.fabricante || row.manufacturer || "",
    tipo_aeronave: row.tipo_aeronave || "",
    fuel_consumption: numeroPositivo(consumo) ?? undefined,
    consumo_combustivel: numeroPositivo(consumo) ?? undefined,
    performance,
    performance_velocidade_cruzeiro_kt:
      row.performance_velocidade_cruzeiro_kt ??
      performance?.velocidade_cruzeiro_kt,
    performance_categoria: row.performance_categoria ?? performance?.categoria,
    performance_teto_servico_ft:
      row.performance_teto_servico_ft ?? performance?.teto_servico_ft,
    performance_taxa_subida_fpm:
      row.performance_taxa_subida_fpm ?? performance?.taxa_subida_fpm,
    performance_taxa_descida_fpm:
      row.performance_taxa_descida_fpm ?? performance?.taxa_descida_fpm,
    designador_icao: row.designador_icao || "",
    esteira_turbulencia: row.esteira_turbulencia || "",
    equipamentos_icao: row.equipamentos_icao || "",
    vigilancia_icao: row.vigilancia_icao || "",
    pbn_icao: row.pbn_icao || "",
    autonomia_padrao_minutos: row.autonomia_padrao_minutos ?? "",
    cor_marcas: row.cor_marcas || "",
  };
}

export async function buscarClima(icao: string): Promise<Clima> {
  const resposta = await apiFetch<unknown>(
    `/api/v1/weather/${encodeURIComponent(icao)}`,
  );
  let atual: unknown = resposta;
  for (let nivel = 0; nivel < 5; nivel += 1) {
    const registro = objeto(atual);
    if (!registro) break;
    const metar = registro.metar ?? registro.METAR;
    const taf = registro.taf ?? registro.TAF;
    if (metar != null || taf != null) {
      return {
        loc: String(registro.loc ?? registro.icao ?? icao),
        metar: metar == null ? undefined : String(metar),
        taf: taf == null ? undefined : String(taf),
        source: registro.source == null ? undefined : String(registro.source),
        error: registro.error == null ? undefined : String(registro.error),
      };
    }
    atual =
      registro.weather ?? registro.data ?? registro.result ?? registro.report;
  }
  return {
    loc: icao,
    error: "Resposta meteorológica sem METAR/TAF reconhecível.",
  };
}

export const buscarRota = async (
  adep: string,
  ades: string,
  aeronaveId?: string,
  velocidadeFallbackKt?: number,
) => {
  const params = new URLSearchParams({ adep, ades });
  if (aeronaveId) params.set("aeronave_id", aeronaveId);
  const resposta = await apiFetch<unknown>(
    `/api/v1/flightplan?${params.toString()}`,
  );
  return normalizarRespostaRota(resposta, adep, ades, velocidadeFallbackKt);
};

export function validarFpl(fpl: FormularioIcao): string[] {
  const erros: string[] = [];
  const adep = fpl.adep.trim().toUpperCase();
  const ades = fpl.ades.trim().toUpperCase();
  const identificacao = fpl.identificacao.trim().toUpperCase();
  if (!/^[A-Z0-9]{2,7}$/.test(identificacao))
    erros.push("Item 7: identificação com 2 a 7 caracteres alfanuméricos.");
  if (!ICAO.test(adep)) erros.push("Item 13: informe um ADEP ICAO válido.");
  if (!ICAO.test(ades)) erros.push("Item 16: informe um ADES ICAO válido.");
  if (adep && ades && adep === ades)
    erros.push("A origem e o destino devem ser diferentes.");
  if (!/^\d{4}$/.test(fpl.eobt.replace(/:/g, "")))
    erros.push("Item 13: EOBT obrigatório no formato UTC HHMM.");
  if (
    !/^[A-Z0-9][A-Z0-9 /-]{0,19}$/.test(fpl.tipoAeronave.trim().toUpperCase())
  )
    erros.push("Item 9: informe o modelo da aeronave.");
  if (!fpl.equipamento.trim())
    erros.push("Item 10: informe o equipamento a bordo.");
  if (!/^[NKM]\d{4}$/.test(fpl.velocidade.trim().toUpperCase()))
    erros.push("Item 15: velocidade no formato ICAO, por exemplo N0150.");
  if (!/^(F|A|S|M)\d{3}$|^VFR$/i.test(fpl.nivel.trim()))
    erros.push(
      "Item 15: informe o nível no formato ICAO, por exemplo A045 ou VFR.",
    );
  if (!fpl.rota.trim()) erros.push("Item 15: informe a rota.");
  if (!/^\d{4}$/.test(fpl.eet.trim()))
    erros.push("Item 16: informe a EET em HHMM.");
  for (const [label, value] of [
    ["Alternado 1", fpl.alternado1],
    ["Alternado 2", fpl.alternado2],
  ]) {
    if (value.trim() && !ICAO.test(value.trim().toUpperCase()))
      erros.push(`${label}: use um código ICAO de quatro letras.`);
  }
  if (!/^\d{1,2}$/.test(fpl.pessoasABordo.trim()))
    erros.push("Item 19: informe o total de pessoas a bordo.");
  if (!fpl.autonomia.trim()) erros.push("Item 19: informe a autonomia.");
  if (!fpl.piloto.trim()) erros.push("Item 19: informe o piloto em comando.");
  if (!fpl.corAeronave.trim())
    erros.push("Item 19: informe a cor/marcas da aeronave.");
  return erros;
}

function juntar(...partes: string[]) {
  return partes
    .map((parte) => parte.trim())
    .filter(Boolean)
    .join(" ");
}

/** Gera texto para conferência e compartilhamento manual; não transmite ao SIGMA. */
export function gerarMensagemIcao(fpl: FormularioIcao): string {
  const eobt = fpl.eobt.replace(/:/g, "").trim();
  const alternados = [fpl.alternado1, fpl.alternado2]
    .map((item) => item.trim().toUpperCase())
    .filter(Boolean)
    .join(" ");
  const outros = fpl.outrasInformacoes.trim().toUpperCase() || "0";
  const item19 = [
    fpl.autonomia.trim() && `E/${fpl.autonomia.trim().replace(":", "")}`,
    fpl.pessoasABordo.trim() && `P/${fpl.pessoasABordo.trim()}`,
    fpl.radioEmergencia.trim() && `R/${fpl.radioEmergencia.trim()}`,
    fpl.sobrevivencia.trim() && `S/${fpl.sobrevivencia.trim()}`,
    fpl.coletes.trim() && `J/${fpl.coletes.trim()}`,
    fpl.botes.trim() && `D/${fpl.botes.trim()}`,
    fpl.corAeronave.trim() && `A/${fpl.corAeronave.trim()}`,
    fpl.piloto.trim() && `C/${fpl.piloto.trim()}`,
  ].filter(Boolean);
  const main = [
    `(FPL-${fpl.identificacao.trim().toUpperCase()}`,
    `${fpl.regraVoo}${fpl.tipoVoo}`,
    `${fpl.numeroAeronaves.trim() || "1"}${fpl.tipoAeronave.trim().toUpperCase()}${fpl.esteira}`,
    fpl.equipamento.trim().toUpperCase(),
    `${fpl.adep.trim().toUpperCase()}${eobt}`,
    juntar(
      fpl.velocidade.trim().toUpperCase(),
      fpl.nivel.trim().toUpperCase(),
      fpl.rota.trim().toUpperCase(),
    ),
    juntar(fpl.ades.trim().toUpperCase(), fpl.eet.trim(), alternados),
    `-${outros})`,
  ].join("-");
  if (!item19.length && !fpl.observacoes.trim()) return main;
  const suplementar = [
    item19.length ? `ITEM 19 (SUPLEMENTAR): ${item19.join(" ")}` : "",
    fpl.observacoes.trim()
      ? `OBSERVAÇÕES PARA REVISÃO: ${fpl.observacoes.trim()}`
      : "",
  ]
    .filter(Boolean)
    .join("\n");
  return `${main}\n\n${suplementar}\n\nO item 19 é informação suplementar. Revise o preenchimento e transmita somente pelo canal oficial autorizado.`;
}

export const mensagemErro = (e: unknown) =>
  e instanceof Error ? e.message : "Tente novamente.";

export function corMetar(metar?: string) {
  if (!metar) return "#6B7280";
  const u = metar.toUpperCase();
  if (u.includes("TS") || u.includes("FG") || u.includes("//"))
    return "#DC2626";
  if (u.includes("OVC") || u.includes("BKN0") || u.includes("SCT0"))
    return "#D97706";
  return "#16A34A";
}

export function formatarData(dateStr: string) {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export function paraPlano(r: PlanoRegistro): PlanoVoo {
  const f: Partial<NovoPlano> = r.payload?.form ?? {};
  const legado = r.payload?.form ?? {};
  const contexto = r.payload?.contexto;
  const solicitacao = contexto?.solicitacao;
  const matricula =
    f.matricula ||
    contexto?.aeronave?.matricula_registro ||
    solicitacao?.matricula_registro ||
    "";
  const camposIcao = Object.keys(
    criarFormularioIcao(),
  ) as (keyof FormularioIcao)[];
  const fplLegado = Object.fromEntries(
    camposIcao
      .filter((campo) => campo !== "identificacao" || !solicitacao)
      .filter((campo) => typeof legado[campo] === "string")
      .map((campo) => [campo, legado[campo]]),
  ) as Partial<FormularioIcao>;
  const identificacaoMatricula = matricula
    .replace(/[^A-Z0-9]/gi, "")
    .toUpperCase();
  const identificacaoLegada = String(legado.identificacao ?? "")
    .trim()
    .toUpperCase();
  const numeroVooLegado =
    !solicitacao &&
    identificacaoLegada ===
      String(r.numero_voo ?? "")
        .trim()
        .toUpperCase() &&
    /^[A-Z0-9]{2,7}$/.test(identificacaoLegada)
      ? ""
      : (r.numero_voo ?? "");
  const partida = r.adep || f.partida || "";
  const chegada = r.ades || f.chegada || "";
  return {
    id: r.id,
    numeroVoo:
      f.numeroVoo ??
      (solicitacao ? (solicitacao.numero_voo ?? "") : numeroVooLegado),
    solicitacaoId:
      f.solicitacaoId ??
      String(contexto?.solicitacao_id ?? solicitacao?.id ?? ""),
    partida,
    chegada,
    trecho: f.trecho ?? legado.rota ?? `${partida}-${chegada}`,
    data: r.data_voo || f.data || legado.dataVoo || hoje(),
    aeronave:
      f.aeronave ?? contexto?.aeronave?.modelo ?? solicitacao?.modelo ?? "",
    aeronaveId: f.aeronaveId ?? solicitacao?.aeronave_id ?? "",
    matricula,
    horaPrevista: formatarHoraUtc(
      f.horaPrevista ?? legado.eobt ?? r.eobt ?? "",
    ),
    estimativaVoo: f.estimativaVoo ?? "",
    combustivelPrevisto: f.combustivelPrevisto ?? 0,
    alternates: f.alternates ?? "",
    passageiros: f.passageiros ?? 0,
    peso: f.peso ?? 0,
    piloto: f.piloto ?? solicitacao?.piloto_nome ?? "",
    copiloto: f.copiloto ?? solicitacao?.copiloto_nome ?? "",
    observacoes: f.observacoes ?? "",
    condicoes: f.condicoes ?? "VMC",
    fpl: {
      ...criarFormularioIcao(),
      ...fplLegado,
      ...f.fpl,
      identificacao:
        f.fpl?.identificacao ||
        fplLegado.identificacao ||
        (/^[A-Z0-9]{2,7}$/.test(identificacaoMatricula)
          ? identificacaoMatricula
          : ""),
    },
    status: f.status ?? "rascunho",
  };
}

export function paraRegistro(p: NovoPlano) {
  return {
    numero_voo: p.numeroVoo.trim() || null,
    adep: p.partida,
    ades: p.chegada,
    data_voo: p.data,
    eobt: p.horaPrevista,
    aircraft_id: p.aeronaveId || undefined,
    form: p,
    contexto: p.solicitacaoId ? { solicitacao_id: p.solicitacaoId } : null,
    rota: p.fpl.rota || p.trecho || null,
    segmentos: [],
    distancia_total_nm: null,
    salvo_em: new Date().toISOString(),
  };
}
