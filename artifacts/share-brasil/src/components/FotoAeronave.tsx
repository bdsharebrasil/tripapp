import React, { useEffect, useState } from "react";
import { Image, type ImageStyle } from "react-native";
import { getToken } from "@/src/lib/session";
import {
  imagemAeronaveExigeAutenticacao,
  normalizarUrlImagemAeronave,
} from "@/src/lib/aeronave-imagem";

type Props = {
  uri?: string | null;
  style: ImageStyle;
  accessibilityLabel?: string;
};

type CredencialDaImagem = {
  uri: string;
  token: string | null;
} | null;

export function FotoAeronave({
  uri,
  style,
  accessibilityLabel = "Foto da aeronave",
}: Props) {
  const imagem = normalizarUrlImagemAeronave(uri);
  const exigeAutenticacao = imagemAeronaveExigeAutenticacao(imagem);
  const [credencial, setCredencial] = useState<CredencialDaImagem>(null);
  const [falhou, setFalhou] = useState(false);

  useEffect(() => {
    setFalhou(false);
  }, [imagem]);

  useEffect(() => {
    if (!imagem || !exigeAutenticacao) return;

    let ativo = true;
    void getToken()
      .then((token) => {
        if (ativo) setCredencial({ uri: imagem, token });
      })
      .catch(() => {
        if (ativo) setCredencial({ uri: imagem, token: null });
      });

    return () => {
      ativo = false;
    };
  }, [imagem, exigeAutenticacao]);

  if (!imagem || falhou) return null;
  if (exigeAutenticacao && credencial?.uri !== imagem) return null;

  const token = credencial?.uri === imagem ? credencial.token : null;
  return (
    <Image
      source={{
        uri: imagem,
        ...(exigeAutenticacao && token
          ? { headers: { Authorization: `Bearer ${token}` } }
          : {}),
      }}
      resizeMode="cover"
      accessibilityLabel={accessibilityLabel}
      accessibilityIgnoresInvertColors
      onError={() => setFalhou(true)}
      style={style}
    />
  );
}
