import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { resolve, extname } from "node:path";
import { fileURLToPath } from "node:url";

export async function criarServidorQA() {
  const base = fileURLToPath(new URL("../dist", import.meta.url));
  const sessionKey = "tripshare.auth.session.v1";
  const now = Math.floor(Date.now() / 1000);
  const user = {
    id: "qa-tripulante",
    email: "piloto.teste@exemplo.com",
    aud: "authenticated",
    role: "authenticated",
    created_at: new Date().toISOString(),
  };
  const accessToken = [
    Buffer.from("{}").toString("base64url"),
    Buffer.from(JSON.stringify({ sub: user.id, exp: now + 3600 })).toString(
      "base64url",
    ),
    "qa",
  ].join(".");
  const session = {
    access_token: accessToken,
    refresh_token: "qa-refresh",
    expires_in: 3600,
    expires_at: now + 3600,
    token_type: "bearer",
    user,
  };
  const script = `<script>
    (() => {
      const session = ${JSON.stringify(session)};
      const user = session.user;
      const sessionKey = ${JSON.stringify(sessionKey)};
      if (!sessionStorage.getItem("qa-seeded")) {
        localStorage.setItem(sessionKey, JSON.stringify(session));
        sessionStorage.setItem("qa-seeded", "1");
      }
      const today = new Date().toLocaleDateString("en-CA");
      const flight = {
        id: "qa-voo",
        numero_voo: "QA-001/26",
        origem: "SBCY",
        destino: "SBBR",
        data_agendada: today,
        horario_previsto_agendamento: "12:00",
        matricula_registro: "QA-TESTE",
        modelo: "Cheyenne II",
        numero_passageiros: 4,
        status: "APROVADA"
      };
      const realFetch = window.fetch.bind(window);
      window.qaResponses = [];
      window.fetch = async (input, init = {}) => {
        const url = new URL(
          typeof input === "string" ? input : input.url,
          location.origin,
        );
        if (url.hostname !== "api.share-brasil.com") return realFetch(input, init);
        const json = (value, status = 200) => {
          window.qaResponses.push({ path: url.pathname, status });
          return new Response(JSON.stringify(value), {
            status,
            headers: { "content-type": "application/json" },
          });
        };
        if (url.pathname === "/api/trip/auth/login" || url.pathname === "/api/trip/auth/refresh") {
          return json({ ...session, user: { id: user.id } });
        }
        if (url.pathname === "/api/trip/auth/logout") return json({ sucesso: true });
        if (url.pathname === "/api/colaborador/perfil") {
          return json({
            perfil: {
              id: user.id,
              nome_completo: "Piloto de Teste",
              nome_exibicao: "Piloto de Teste",
              email: user.email,
              canac: "QA123",
              departamento: "Tripulação"
            },
            tripulante: { canac: "QA123", tipo_licenca: "PLA" },
            metricas: { horas_totais: 42, voos_escalados: 1 }
          });
        }
        if (url.pathname === "/api/colaborador/meus-voos") {
          return json({ voos: [flight] });
        }
        if (url.pathname === "/api/financeiro/relatorios-despesa-viagem/minhas") {
          return json({ relatorios: [] });
        }
        return json({ error: "Rota não prevista no teste: " + url.pathname }, 404);
      };
    })();
  </script>`;

  const server = createServer(async (req, res) => {
    try {
      const path = decodeURIComponent(
        new URL(req.url, "http://localhost").pathname,
      );
      let filename = resolve(base, `.${path}`);
      if (!filename.startsWith(`${base}/`))
        filename = resolve(base, "index.html");
      let bytes;
      try {
        bytes = await readFile(filename);
      } catch {
        filename = resolve(base, "index.html");
        bytes = await readFile(filename);
      }
      const ext = extname(filename);
      const types = {
        ".html": "text/html; charset=utf-8",
        ".js": "text/javascript",
        ".json": "application/json",
        ".png": "image/png",
        ".jpg": "image/jpeg",
        ".svg": "image/svg+xml",
        ".ttf": "font/ttf",
        ".woff": "font/woff",
        ".woff2": "font/woff2",
        ".ico": "image/x-icon",
      };
      if (ext === ".html") {
        bytes = Buffer.from(
          bytes.toString().replace("<head>", `<head>${script}`),
        );
      }
      res.writeHead(200, {
        "content-type": types[ext] || "application/octet-stream",
        "cache-control": "no-store",
      });
      res.end(bytes);
    } catch {
      res.writeHead(500);
      res.end("erro");
    }
  });
  await new Promise((resolveListen) =>
    server.listen(0, "127.0.0.1", resolveListen),
  );
  return { server, url: `http://127.0.0.1:${server.address().port}` };
}
