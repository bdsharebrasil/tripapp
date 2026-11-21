import React, { useEffect, useState } from "react";
import { Image, Text, View } from "react-native";
import { fromByteArray } from "base64-js";
import { apiUrl } from "../lib/api";
import { getToken } from "../lib/session";
import { tema } from "./ui";

/** A foto é carregada com autorização antes de renderizar, inclusive no navegador. */
export function Avatar({
  nome,
  disponivel,
  versao = 0,
  tamanho = 58,
}: {
  nome: string;
  disponivel?: boolean;
  versao?: number;
  tamanho?: number;
}) {
  const [uri, setUri] = useState<string | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    setUri(null);
    if (disponivel)
      void (async () => {
        const token = await getToken();
        if (!token) return;
        const res = await fetch(
          apiUrl("/api/colaborador/foto") + `?v=${versao}`,
          {
            headers: { Authorization: `Bearer ${token}` },
            signal: controller.signal,
          },
        );
        const mime = res.headers.get("content-type")?.split(";")[0] || "";
        if (
          !res.ok ||
          !["image/png", "image/jpeg", "image/webp", "image/gif"].includes(mime)
        )
          return;
        const bytes = new Uint8Array(await res.arrayBuffer());
        if (!controller.signal.aborted && bytes.length <= 10 * 1024 * 1024)
          setUri(`data:${mime};base64,${fromByteArray(bytes)}`);
      })().catch(() => undefined);
    return () => controller.abort();
  }, [disponivel, versao, nome]);
  const style = {
    width: tamanho,
    height: tamanho,
    borderRadius: tamanho * 0.34,
  };
  return (
    <View
      accessibilityLabel={`Foto de ${nome || "tripulante"}`}
      style={[
        style,
        {
          backgroundColor: tema.elevado,
          borderWidth: 1,
          borderColor: tema.borda,
          alignItems: "center",
          justifyContent: "center",
          overflow: "hidden",
        },
      ]}
    >
      {uri ? (
        <Image source={{ uri }} style={style} onError={() => setUri(null)} />
      ) : (
        <Text
          style={{
            fontSize: tamanho * 0.32,
            fontFamily: "Inter_700Bold",
            color: tema.azul,
          }}
        >
          {nome
            .split(" ")
            .filter(Boolean)
            .slice(0, 2)
            .map((n) => n[0])
            .join("")
            .toUpperCase() || "TS"}
        </Text>
      )}
    </View>
  );
}
