import { apiFetch, type ApiBinary } from "./api";
/** Download com Bearer, sem colocar credenciais na URL. */
export async function abrirDocumentoWeb(
  path: string,
  nome: string,
  mime: string,
) {
  const { bytes } = await apiFetch<ApiBinary>(path, {
    responseType: "binary",
    headers: { Accept: mime },
  });
  const ascii = String.fromCharCode(...bytes.slice(0, 12));
  const valido =
    mime === "application/pdf"
      ? ascii.startsWith("%PDF-")
      : mime === "image/png"
        ? bytes.slice(0, 4).join(",") === "137,80,78,71"
        : mime === "image/jpeg"
          ? bytes[0] === 255 && bytes[1] === 216
          : ascii.startsWith("RIFF") && ascii.slice(8, 12) === "WEBP";
  if (!valido) throw new Error("O servidor não retornou um documento válido.");
  const blob = new Blob([new Uint8Array(bytes).buffer], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  const ext =
    mime === "application/pdf"
      ? "pdf"
      : mime === "image/png"
        ? "png"
        : mime === "image/webp"
          ? "webp"
          : "jpg";
  a.download = `${nome.replace(/[^a-zA-Z0-9._-]/g, "-").slice(0, 80) || "documento"}.${ext}`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}
