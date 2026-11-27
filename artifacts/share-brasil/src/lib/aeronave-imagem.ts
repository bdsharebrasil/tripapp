import { API_URL } from "./api";

type CampoImagem = string | null | undefined;

export type FonteImagemAeronave = {
  url_imagem?: CampoImagem;
  image_url?: CampoImagem;
  foto_url?: CampoImagem;
  imagem_url?: CampoImagem;
  aeronave_url_imagem?: CampoImagem;
  foto_aeronave?: CampoImagem;
  aeronave_foto_url?: CampoImagem;
  imagem_aeronave?: CampoImagem;
  aeronave?: {
    url_imagem?: CampoImagem;
    image_url?: CampoImagem;
    foto_url?: CampoImagem;
    imagem_url?: CampoImagem;
  } | null;
} | null | undefined;

export function obterImagemAeronave(
  voo?: FonteImagemAeronave,
): string | null {
  const candidatas = [
    voo?.url_imagem,
    voo?.aeronave_url_imagem,
    voo?.foto_aeronave,
    voo?.aeronave_foto_url,
    voo?.imagem_aeronave,
    voo?.aeronave?.url_imagem,
    voo?.aeronave?.image_url,
    voo?.aeronave?.foto_url,
    voo?.aeronave?.imagem_url,
    voo?.image_url,
    voo?.foto_url,
    voo?.imagem_url,
  ];

  return (
    candidatas.find(
      (valor): valor is string =>
        typeof valor === "string" && valor.trim().length > 0,
    )?.trim() ?? null
  );
}

export function normalizarUrlImagemAeronave(
  imagem?: string | null,
): string | null {
  const valor = imagem?.trim();
  if (!valor) return null;

  if (/^(https?:\/\/|data:|content:\/\/|file:\/\/)/i.test(valor)) {
    return valor;
  }

  try {
    return new URL(valor, `${API_URL}/`).toString();
  } catch {
    return null;
  }
}

export function imagemAeronaveExigeAutenticacao(
  imagemNormalizada: string | null,
): boolean {
  if (!imagemNormalizada) return false;

  try {
    return new URL(imagemNormalizada).origin === new URL(API_URL).origin;
  } catch {
    return false;
  }
}
