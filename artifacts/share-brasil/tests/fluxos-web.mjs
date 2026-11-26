import { JSDOM, VirtualConsole } from "jsdom";
import assert from "node:assert/strict";
import { webcrypto } from "node:crypto";
import { criarServidorQA } from "./fixtures-web.mjs";

const { server, url } = await criarServidorQA();
const errors = [];
const virtualConsole = new VirtualConsole();
virtualConsole.on("jsdomError", (error) => errors.push(error));

const waitFor = async (condition, label, document) => {
  for (let attempt = 0; attempt < 150; attempt += 1) {
    if (condition()) return;
    await new Promise((resolveWait) => setTimeout(resolveWait, 100));
  }
  throw new Error(
    `Tempo excedido: ${label}\n${document.body.textContent.slice(0, 3000)}`,
  );
};

let dom;
try {
  dom = await JSDOM.fromURL(url, {
    resources: "usable",
    runScripts: "dangerously",
    pretendToBeVisual: true,
    virtualConsole,
    beforeParse(window) {
      window.fetch = (input, init) =>
        fetch(
          new URL(
            typeof input === "string" ? input : input.url,
            window.location.href,
          ),
          init,
        );
      for (const key of [
        "TextEncoder",
        "TextDecoder",
        "Request",
        "Response",
        "Headers",
        "AbortController",
        "Blob",
      ]) {
        window[key] = globalThis[key];
      }
      Object.defineProperty(window, "crypto", { value: webcrypto });
      window.matchMedia = () => ({
        matches: false,
        addListener() {},
        removeListener() {},
        addEventListener() {},
        removeEventListener() {},
      });
      window.ResizeObserver = class {
        observe() {}
        unobserve() {}
        disconnect() {}
      };
      window.scrollTo = () => {};
      window.HTMLElement.prototype.scrollTo = () => {};
      window.alert = () => {};
      window.confirm = () => true;
      window.URL.createObjectURL = () => "blob:qa";
      window.URL.revokeObjectURL = () => {};
      window.FontFace = class {
        async load() {
          return this;
        }
      };
      window.document.fonts = {
        add() {},
        delete() {},
        load: async () => [{}],
        ready: Promise.resolve(),
      };
    },
  });

  const document = dom.window.document;
  const text = () => document.body.textContent;
  await waitFor(
    () =>
      text().includes("PRÓXIMO VOO") &&
      text().includes("QA-TESTE · Cheyenne II"),
    "dashboard Expo autenticado",
    document,
  );
  await waitFor(() => text().includes("DATA DO VOO"), "data do voo", document);

  assert.match(
    text(),
    /DATA DO VOO\d{2} (JAN|FEV|MAR|ABR|MAI|JUN|JUL|AGO|SET|OUT|NOV|DEZ) \d{4}/,
  );
  assert.ok(text().includes("SBCY") && text().includes("SBBR"));
  assert.ok(text().includes("SOL-QAVOO"));
  assert.ok(text().includes("PAX4"));
  assert.ok(!text().includes("METAR"));
  const respostas = [...dom.window.qaResponses];
  for (const path of [
    "/api/colaborador/perfil",
    "/api/colaborador/meus-voos",
    "/api/financeiro/relatorios-despesa-viagem/minhas",
  ]) {
    assert.ok(
      respostas.some((resposta) => resposta.path === path && resposta.status === 200),
      `mock não respondeu HTTP 200 para ${path}: ${JSON.stringify(respostas)}`,
    );
  }
  assert.ok(
    !text().includes("Alguns dados não puderam ser atualizados"),
    `dashboard exibiu erro parcial; respostas: ${JSON.stringify(respostas)}`,
  );
  assert.equal(
    errors.length,
    0,
    errors.map((error) => error.message).join("\n"),
  );
  console.log(
    "PASS: dashboard Expo renderiza data, rota, solicitação e pax sem METAR.",
  );
} finally {
  dom?.window.close();
  server.close();
}
