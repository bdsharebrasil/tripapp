import { Platform } from "react-native";
/** Multipart web usa Blob; React Native aceita o descritor URI. */
export async function anexarArquivo(
  form: FormData,
  campo: string,
  uri: string,
  nome: string,
  mime: string,
) {
  if (Platform.OS === "web") {
    if (!/^(blob:|data:)/.test(uri)) throw new Error("Arquivo local inválido.");
    const res = await fetch(uri);
    if (!res.ok) throw new Error("Não foi possível ler o arquivo selecionado.");
    form.append(
      campo,
      new Blob([await res.arrayBuffer()], { type: mime }),
      nome,
    );
  } else form.append(campo, { uri, name: nome, type: mime } as any);
}
