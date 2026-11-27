export type TipoAeronave = "PISTAO" | "TURBOELICE" | "JATO";

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
  velocidade_cruzeiro: string | null;

  tipo_aeronave: TipoAeronave | null;
  numero_motores: number | null;

  performance_aeronave_id: string | null;

  // Informações financeiras
  custo_hora_complementar_centavos: number | null;
  taxas_trecho_centavos: number | null;
  custo_dia_pernoite_centavos: number | null;

  // Informações ICAO
  designador_icao: string | null;
  esteira_turbulencia: string | null;
  equipamentos_icao: string | null;
  vigilancia_icao: string | null;
  pbn_icao: string | null;
  autonomia_padrao_minutos: number | null;
  cor_marcas: string | null;

  // Localização da base
  base_lat: number | null;
  base_lon: number | null;

  // Relacionamento
  performance?: PerformanceAeronave | null;
}