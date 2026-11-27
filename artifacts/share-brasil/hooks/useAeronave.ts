
import { useMemo, useCallback } from "react";
import {
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";

import { apiFetch, ApiError } from "@/src/lib/api";

// ======================================================
// TIPAGENS
// ======================================================

export type TipoAeronave =
  | "PISTAO"
  | "TURBOELICE"
  | "JATO";

export interface PerformanceAeronave {
  id: string;
  categoria: string;
  modelo: string;

  teto_servico_ft: number;
  nivel_cruzeiro_min_ft: number;
  nivel_cruzeiro_max_ft: number;

  aprovado_rvsm: number;

  velocidade_cruzeiro_kt: number | null;
  taxa_subida_fpm: number | null;
  taxa_descida_fpm: number | null;

  criado_em: string;
  atualizado_em: string;
}

export interface Aeronave {
  id: string;

  matricula_registro: string;
  fabricante: string;
  modelo: string;
  numero_serie: string;
  nome_proprietario: string;

  status: string;

  consumo_combustivel: number | null;

  ano: string | null;
  base: string | null;
  preco_hora: string | null;
  url_imagem: string | null;
  image_url?: string | null;
  foto_url?: string | null;
  imagem_url?: string | null;
  velocidade_cruzeiro: string | null;

  tipo_aeronave: TipoAeronave | null;
  numero_motores: number | null;

  // PERFORMANCE
  performance_aeronave_id: string | null;

  // FINANCEIRO
  custo_hora_complementar_centavos?: number | null;
  taxas_trecho_centavos?: number | null;
  custo_dia_pernoite_centavos?: number | null;

  // PLANO DE VOO ICAO
  designador_icao: string | null;
  esteira_turbulencia: string | null;
  equipamentos_icao: string | null;
  vigilancia_icao: string | null;
  pbn_icao: string | null;
  autonomia_padrao_minutos: number | null;
  cor_marcas: string | null;

  // LOCALIZAÇÃO
  base_lat: number | null;
  base_lon: number | null;

  // RELACIONAMENTO
  performance?: PerformanceAeronave | null;
}

export interface UseAeronaveOptions {
  id?: string | null;
  matricula?: string | null;
  somenteAtivas?: boolean;
  tipo?: TipoAeronave;
  habilitado?: boolean;
}

type RespostaAeronaves =
  | Aeronave[]
  | { aeronaves: Aeronave[] }
  | { data: Aeronave[] };

// ======================================================
// CONFIGURAÇÕES
// ======================================================

const ENDPOINT = "/api/interno/aeronaves";

const TEMPO_ATUALIZACAO = 5 * 60 * 1000;
const TEMPO_CACHE = 30 * 60 * 1000;

const LISTA_VAZIA: Aeronave[] = [];

export const aeronaveKeys = {
  todas: ["aeronaves"] as const,

  lista: () =>
    [...aeronaveKeys.todas, "lista"] as const,
};

// ======================================================
// FUNÇÕES AUXILIARES
// ======================================================

export function normalizarMatricula(
  valor: string | null | undefined
): string {
  return (valor ?? "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");
}

export function aeronaveEstaAtiva(
  aeronave: Aeronave
): boolean {
  return (
    aeronave.status?.trim().toUpperCase() === "ATIVA"
  );
}

export function nomeCompletoAeronave(
  aeronave: Aeronave
): string {
  return [
    aeronave.fabricante,
    aeronave.modelo,
  ]
    .filter(Boolean)
    .join(" ")
    .trim();
}

function normalizarAeronave(
  aeronave: Aeronave
): Aeronave {
  const urlImagem =
    aeronave.url_imagem ||
    aeronave.image_url ||
    aeronave.foto_url ||
    aeronave.imagem_url ||
    null;
  return {
    ...aeronave,
    url_imagem: urlImagem,
    performance: aeronave.performance ?? null,
  };
}

// ======================================================
// SERVIÇO DE AERONAVES
// ======================================================

export async function listarAeronaves(
  signal?: AbortSignal
): Promise<Aeronave[]> {
  const resposta = await apiFetch<RespostaAeronaves>(
    ENDPOINT,
    {
      method: "GET",
      signal,
    }
  );

  if (Array.isArray(resposta)) {
    return resposta.map(normalizarAeronave);
  }

  if (
    resposta &&
    typeof resposta === "object" &&
    "aeronaves" in resposta &&
    Array.isArray(resposta.aeronaves)
  ) {
    return resposta.aeronaves.map(normalizarAeronave);
  }

  if (
    resposta &&
    typeof resposta === "object" &&
    "data" in resposta &&
    Array.isArray(resposta.data)
  ) {
    return resposta.data.map(normalizarAeronave);
  }

  throw new Error(
    "O servidor retornou uma lista de aeronaves inválida."
  );
}

// ======================================================
// HOOK PRINCIPAL
// ======================================================

export function useAeronave(
  options: UseAeronaveOptions = {}
) {
  const {
    id,
    matricula,
    somenteAtivas = false,
    tipo,
    habilitado = true,
  } = options;

  const queryClient = useQueryClient();

  // ====================================================
  // CONSULTA AO BACKEND
  // ====================================================

  const query = useQuery<Aeronave[], Error>({
    queryKey: aeronaveKeys.lista(),

    queryFn: ({ signal }) =>
      listarAeronaves(signal),

    enabled: habilitado,

    staleTime: TEMPO_ATUALIZACAO,
    gcTime: TEMPO_CACHE,

    refetchOnMount: true,
    refetchOnReconnect: true,

    retry: (tentativas, erro) => {
      if (
        erro instanceof ApiError &&
        [401, 403, 404].includes(erro.status)
      ) {
        return false;
      }

      return tentativas < 1;
    },
  });

  // ====================================================
  // LISTAGEM COMPLETA
  // ====================================================

  const todasAeronaves = useMemo<Aeronave[]>(() => {
    if (!query.data) {
      return LISTA_VAZIA;
    }

    return [...query.data].sort((a, b) =>
      a.matricula_registro.localeCompare(
        b.matricula_registro,
        "pt-BR"
      )
    );
  }, [query.data]);

  // ====================================================
  // AERONAVES ATIVAS
  // ====================================================

  const aeronavesAtivas = useMemo<Aeronave[]>(() => {
    return todasAeronaves.filter(aeronaveEstaAtiva);
  }, [todasAeronaves]);

  // ====================================================
  // AERONAVES FILTRADAS
  // ====================================================

  const aeronaves = useMemo<Aeronave[]>(() => {
    const lista = somenteAtivas
      ? aeronavesAtivas
      : todasAeronaves;

    if (tipo) {
      return lista.filter(
        (item) => item.tipo_aeronave === tipo
      );
    }

    return lista;
  }, [
    somenteAtivas,
    tipo,
    aeronavesAtivas,
    todasAeronaves,
  ]);

  // ====================================================
  // AERONAVE SELECIONADA
  // ====================================================

  const aeronave = useMemo<Aeronave | null>(() => {
    if (id) {
      const porId =
        todasAeronaves.find(
          (item) => item.id === id
        ) ?? null;
      if (porId) return porId;
    }

    if (matricula) {
      const matriculaNormalizada =
        normalizarMatricula(matricula);

      return (
        todasAeronaves.find(
          (item) =>
            normalizarMatricula(
              item.matricula_registro
            ) === matriculaNormalizada
        ) ?? null
      );
    }

    return null;
  }, [id, matricula, todasAeronaves]);

  // ====================================================
  // PERFORMANCE DA AERONAVE
  // ====================================================

  const performance = useMemo<
    PerformanceAeronave | null
  >(() => {
    return aeronave?.performance ?? null;
  }, [aeronave]);

  // ====================================================
  // IMAGEM DA AERONAVE
  // ====================================================

  const imagem = useMemo<string | null>(() => {
    const url = aeronave?.url_imagem?.trim();

    if (!url) {
      return null;
    }

    return url;
  }, [aeronave?.url_imagem]);

  // ====================================================
  // VELOCIDADE DE CRUZEIRO
  // ====================================================

  const velocidadeCruzeiroKt = useMemo<
    number | null
  >(() => {
    // Prioriza a tabela performance_aeronave
    const velocidadePerformance =
      performance?.velocidade_cruzeiro_kt;

    if (
      typeof velocidadePerformance === "number" &&
      Number.isFinite(velocidadePerformance) &&
      velocidadePerformance > 0
    ) {
      return velocidadePerformance;
    }

    // Alternativa: cadastro da aeronave
    const valor =
      aeronave?.velocidade_cruzeiro?.trim();

    if (!valor) {
      return null;
    }

    // Aceita valores numéricos ou explicitamente em kt.
    const resultado = valor.match(
      /^(\d+(?:[.,]\d+)?)\s*(?:KT|KTS|KNOTS)?$/i
    );

    if (!resultado) {
      return null;
    }

    const velocidade = Number(
      resultado[1].replace(",", ".")
    );

    return Number.isFinite(velocidade) &&
      velocidade > 0
      ? velocidade
      : null;
  }, [performance, aeronave]);

  // ====================================================
  // DADOS ICAO
  // ====================================================

  const dadosIcao = useMemo(() => {
    if (!aeronave) {
      return null;
    }

    return {
      identificacao: normalizarMatricula(
        aeronave.matricula_registro
      ),

      designador_icao:
        aeronave.designador_icao ?? null,

      esteira_turbulencia:
        aeronave.esteira_turbulencia ?? null,

      equipamentos_icao:
        aeronave.equipamentos_icao ?? null,

      vigilancia_icao:
        aeronave.vigilancia_icao ?? null,

      pbn_icao:
        aeronave.pbn_icao ?? null,

      autonomia_padrao_minutos:
        aeronave.autonomia_padrao_minutos ?? null,

      cor_marcas:
        aeronave.cor_marcas ?? null,

      numero_motores:
        aeronave.numero_motores ?? null,

      velocidade_cruzeiro_kt:
        velocidadeCruzeiroKt,

      teto_servico_ft:
        performance?.teto_servico_ft ?? null,

      nivel_cruzeiro_min_ft:
        performance?.nivel_cruzeiro_min_ft ?? null,

      nivel_cruzeiro_max_ft:
        performance?.nivel_cruzeiro_max_ft ?? null,

      taxa_subida_fpm:
        performance?.taxa_subida_fpm ?? null,

      taxa_descida_fpm:
        performance?.taxa_descida_fpm ?? null,

      aprovado_rvsm:
        performance?.aprovado_rvsm == null
          ? null
          : performance.aprovado_rvsm === 1,
    };
  }, [aeronave, performance, velocidadeCruzeiroKt]);

  // ====================================================
  // BUSCAR POR ID
  // ====================================================

  const buscarPorId = useCallback(
    (aeronaveId: string): Aeronave | null => {
      return (
        todasAeronaves.find(
          (item) => item.id === aeronaveId
        ) ?? null
      );
    },
    [todasAeronaves]
  );

  // ====================================================
  // BUSCAR POR MATRÍCULA
  // ====================================================

  const buscarPorMatricula = useCallback(
    (valor: string): Aeronave | null => {
      const normalizada =
        normalizarMatricula(valor);

      return (
        todasAeronaves.find(
          (item) =>
            normalizarMatricula(
              item.matricula_registro
            ) === normalizada
        ) ?? null
      );
    },
    [todasAeronaves]
  );

  // ====================================================
  // BUSCAR POR TEXTO
  // ====================================================

  const pesquisar = useCallback(
    (texto: string): Aeronave[] => {
      const termo = texto.trim().toUpperCase();

      if (!termo) {
        return aeronaves;
      }

      const matriculaPesquisada =
        normalizarMatricula(termo);

      return aeronaves.filter((item) => {
        const matriculaItem =
          normalizarMatricula(
            item.matricula_registro
          );

        const nome = nomeCompletoAeronave(
          item
        ).toUpperCase();

        return (
          (
            matriculaPesquisada.length > 0 &&
            matriculaItem.includes(
              matriculaPesquisada
            )
          ) ||
          nome.includes(termo) ||
          (
            item.numero_serie ?? ""
          ).toUpperCase().includes(termo) ||
          (
            item.designador_icao ?? ""
          ).toUpperCase().includes(termo)
        );
      });
    },
    [aeronaves]
  );

  // ====================================================
  // ATUALIZAÇÃO E CACHE
  // ====================================================

  const atualizar = useCallback(
    async (): Promise<void> => {
      await queryClient.invalidateQueries({
        queryKey: aeronaveKeys.todas,
      });
    },
    [queryClient]
  );

  const recarregar = useCallback(
    async (): Promise<Aeronave[]> => {
      const resultado = await query.refetch({
        throwOnError: true,
      });

      return resultado.data ?? LISTA_VAZIA;
    },
    [query.refetch]
  );

  const limparCache = useCallback(
    async (): Promise<void> => {
      await queryClient.resetQueries({
        queryKey: aeronaveKeys.todas,
      });
    },
    [queryClient]
  );

  // ====================================================
  // TOTAIS POR TIPO
  // ====================================================

  const totaisPorTipo = useMemo(() => {
    return {
      pistao: aeronavesAtivas.filter(
        (item) => item.tipo_aeronave === "PISTAO"
      ).length,

      turboelice: aeronavesAtivas.filter(
        (item) => item.tipo_aeronave === "TURBOELICE"
      ).length,

      jato: aeronavesAtivas.filter(
        (item) => item.tipo_aeronave === "JATO"
      ).length,
    };
  }, [aeronavesAtivas]);

  // ====================================================
  // RETORNO DO HOOK
  // ====================================================

  return {
    // DADOS
    aeronave,
    aeronaves,
    aeronavesAtivas,
    todasAeronaves,
    performance,
    dadosIcao,

    // IDENTIFICAÇÃO
    id: aeronave?.id ?? null,
    matricula: aeronave?.matricula_registro ?? null,
    fabricante: aeronave?.fabricante ?? null,
    modelo: aeronave?.modelo ?? null,

    nomeCompleto: aeronave
      ? nomeCompletoAeronave(aeronave)
      : null,

    tipoAeronave:
      aeronave?.tipo_aeronave ?? null,

    numeroMotores:
      aeronave?.numero_motores ?? null,

    // IMAGEM
    imagem,

    urlImagem: imagem,

    // PERFORMANCE
    velocidadeCruzeiroKt,

    consumoCombustivel:
      aeronave?.consumo_combustivel ?? null,

    tetoServicoFt:
      performance?.teto_servico_ft ?? null,

    nivelCruzeiroMinFt:
      performance?.nivel_cruzeiro_min_ft ?? null,

    nivelCruzeiroMaxFt:
      performance?.nivel_cruzeiro_max_ft ?? null,

    taxaSubidaFpm:
      performance?.taxa_subida_fpm ?? null,

    taxaDescidaFpm:
      performance?.taxa_descida_fpm ?? null,

    aprovadoRvsm:
      performance?.aprovado_rvsm == null
        ? null
        : performance.aprovado_rvsm === 1,

    // LOCALIZAÇÃO
    base: aeronave?.base ?? null,
    baseLat: aeronave?.base_lat ?? null,
    baseLon: aeronave?.base_lon ?? null,

    // SITUAÇÃO
    ativa: aeronave
      ? aeronaveEstaAtiva(aeronave)
      : false,

    // TOTAIS
    total: todasAeronaves.length,
    totalAtivas: aeronavesAtivas.length,

    totalInativas:
      todasAeronaves.length - aeronavesAtivas.length,

    totaisPorTipo,

    // ESTADOS
    carregando: query.isLoading,
    atualizando: query.isFetching,
    possuiErro: query.isError,
    sucesso: query.isSuccess,

    erro: query.error,

    mensagemErro:
      query.error?.message ?? null,

    ultimaAtualizacao:
      query.dataUpdatedAt || null,

    // MÉTODOS
    buscarPorId,
    buscarPorMatricula,
    pesquisar,
    atualizar,
    recarregar,
    limparCache,
  };
}

export default useAeronave;
