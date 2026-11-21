import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { resolve, extname } from "node:path";
import { fileURLToPath } from "node:url";
export async function criarServidorQA() {
  const base = fileURLToPath(
    new URL("../../share-brasil-pwa/dist", import.meta.url),
  );
  const sessionKey = "tripshare.auth.session.v1";
  const now = Math.floor(Date.now() / 1000);
  const user = {
    id: "qa-tripulante",
    email: "login-interno@share-brasil.com",
    aud: "authenticated",
    role: "authenticated",
    user_metadata: { nome: "Metadados antigos" },
    app_metadata: { provider: "email" },
    identities: [],
    created_at: new Date().toISOString(),
  };
  const jwt = [
    Buffer.from("{}").toString("base64url"),
    Buffer.from(JSON.stringify({ sub: user.id, exp: now + 3600 })).toString(
      "base64url",
    ),
    "qa",
  ].join(".");
  const session = {
    access_token: jwt,
    refresh_token: "qa-refresh",
    expires_in: 3600,
    expires_at: now + 3600,
    token_type: "bearer",
    user,
  };
  const script = `<script>
(()=>{
const session=${JSON.stringify(session)};
if(!sessionStorage.getItem('qa-seeded')){localStorage.setItem(${JSON.stringify(sessionKey)},JSON.stringify(session));sessionStorage.setItem('qa-seeded','1')}
const today=new Date().toLocaleDateString('en-CA');
const flight={id:'qa-voo',solicitacao_id:'qa-voo',numero_voo:'QA-001/26',origem:'SBCY',destino:'SBBR',data_agendada:today,horario_previsto_agendamento:'12:00',matricula_registro:'QA-TESTE',matricula:'QA-TESTE',status:'APROVADA',aeronave_id:'qa-aviao',cliente_id:'qa-cliente'};
let reports=[],saved=[];let failPayments=false;window.qaRequests=[];
const realFetch=window.fetch.bind(window);
window.fetch=async(input,init={})=>{
const url=new URL(typeof input==='string'?input:input.url,location.origin),path=url.pathname,method=init.method||'GET';
if(url.hostname!=='api.share-brasil.com')return realFetch(input,init);
window.qaRequests.push({path,method,body:typeof init.body==='string'?JSON.parse(init.body):null});
const json=(x,status=200)=>new Response(JSON.stringify(x),{status,headers:{'content-type':'application/json'}});
if(path==='/api/trip/auth/login'||path==='/api/trip/auth/refresh')return json({...session,user:{id:session.user.id}});
if(path==='/api/trip/auth/logout')return json({sucesso:true});
if(path==='/api/colaborador/perfil')return json({perfil:{id:session.user.id,nome_completo:'Piloto de Teste',nome_exibicao:'Piloto de Teste',email:'piloto.teste@exemplo.com',canac:'QA123',departamento:'Tripulação',foto_url:'/api/colaborador/foto'},tripulante:{canac:'QA123',tipo_licenca:'PLA'},metricas:{horas_totais:42,voos_escalados:1},habilitacoes:[{id:'h1',tipo_habilitacao:'MLTE',data_validade:'2027-12-01'},{id:'h2',tipo_habilitacao:'IFRA',data_validade:'2027-11-01'}],cma:{id:'c1',classe:'1',validade:'2027-06-30'},resumo_ferias:{dias_direito:30,dias_utilizados:10,dias_disponiveis:20}});
if(path==='/api/colaborador/foto')return realFetch('/icon.png');
if(path==='/api/colaborador/documentos')return json([]);
if(path==='/api/colaborador/folha-pagamento')return failPayments?json({error:'Folha temporariamente indisponível'},503):json({pagamentos:[{id:'qa-folha',competencia_ano:2026,competencia_mes:11,rotulo:'Pagamento de teste',valor_centavos:123456,status:'PENDENTE'}]});
if(path==='/api/colaborador/meus-voos'||path.endsWith('/meus-voos'))return json({voos:[flight]});
if(path==='/api/colaborador/meus-voos/qa-voo')return json({voo:{...flight,cliente_razao_social:'Cliente de teste'},jornadas:[],hospedagens:[]});
if(path.endsWith('/minhas'))return json({relatorios:reports});
if(path.endsWith('/iniciar-do-voo')){const report={id:'qa-relatorio',numero_relatorio:'REL-QA-001/26',numero_voo:flight.numero_voo,status:'rascunho',aeronave_id:'qa-aviao',cliente_id:'qa-cliente',rota:'SBCY → SBBR',data_inicio:today,data_fim:today,tripulante_pos:1,despesas:[],total_valor:0};reports=[report];return json({relatorio:report},201)}
if(path.endsWith('/despesas-tripulante')){saved=JSON.parse(init.body).despesas;reports[0].despesas=saved;reports[0].total_valor=saved.reduce((n,x)=>n+x.valor,0);return json({ok:true})}
if(path.endsWith('/anexos-tripulante')&&method==='POST'){reports[0].anexos=[{id:'qa-anexo',indice_despesa:0,nome_arquivo:'comprovante.png',tipo_arquivo:'image/png'}];return json({ok:true},201)}
if(path.endsWith('/arquivo'))return realFetch('/icon.png');
if(path.endsWith('/finalizar')){reports[0].status='finalizado';reports[0].pdf_path='qa.pdf';return json({ok:true})}
if(path.endsWith('/pdf'))return new Response('%PDF-1.4\\n1 0 obj<</Type/Catalog>>endobj\\n%%EOF',{headers:{'content-type':'application/pdf'}});
if(path.includes('notificacoes'))return json({data:[],notificacoes:[]});
return json({error:'Rota não prevista no teste: '+path},404);
};
})();
</script>`;
  const server = createServer(async (req, res) => {
    try {
      let path = decodeURIComponent(
        new URL(req.url, "http://localhost").pathname,
      );
      let filename = resolve(base, "." + path);
      if (!filename.startsWith(base + "/")) filename = base + "/index.html";
      let bytes;
      try {
        bytes = await readFile(filename);
      } catch {
        filename = base + "/index.html";
        bytes = await readFile(filename);
      }
      const ext = extname(filename);
      const types = {
        ".html": "text/html",
        ".js": "text/javascript",
        ".png": "image/png",
        ".ttf": "font/ttf",
        ".ico": "image/x-icon",
        ".json": "application/json",
      };
      if (ext === ".html")
        bytes = Buffer.from(
          bytes.toString().replace("<head>", "<head>" + script),
        );
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
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  return { server, url: `http://127.0.0.1:${server.address().port}` };
}
