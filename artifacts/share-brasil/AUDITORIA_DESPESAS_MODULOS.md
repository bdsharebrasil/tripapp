# Integração real Trip Share — Despesas, Perfil e histórico

Atualizado em 21/11/2026. A fonte de verdade é o Cloudflare Worker e o D1; nenhum lançamento operacional é registrado somente no aplicativo.

## Despesas de viagem (implementado nesta branch)

- **Criar relatório**: `POST /api/financeiro/relatorios-despesa-viagem/iniciar-do-voo`, a partir de um voo atribuído retornado por `GET .../meus-voos`. A criação é idempotente pela lógica atual do Worker, e o relatório criado é aberto automaticamente.
- **Criar e editar despesas**: formulário por item, categoria, data, valor, pagador (Tripulante 1/2, Cliente, Share Brasil), descrição; grava `PUT .../:id/despesas-tripulante`. Anexos só podem ser associados após confirmação do salvamento para preservar o índice de despesa.
- **Comprovantes**: câmera, galeria e PDF/imagem do seletor de arquivos. Upload privado `POST .../:id/anexos-tripulante`, exclusão autenticada e visualização `GET .../:id/anexos-tripulante/:anexoId/arquivo`. Limite 25 MB (Worker); formatos PDF, JPEG, PNG, WEBP.
- **Histórico real**: `GET .../minhas` retorna status, valores, reembolso, histórico de ajustes, arquivos anexos. Exibe rascunhos e históricos; status finalizado/aprovado são somente leitura.
- **Finalizar**: `POST .../:id/finalizar` sujeito à autorização por vínculo de tripulante no Worker. Também disponibiliza PDF final `GET .../:id/pdf` somente quando existente, com acesso restrito.
- Nenhuma conta ou pagamento é criado diretamente no app. O Worker permanece responsável pelo financeiro.

## Demais módulos

| Módulo | Integração real | Operações habilitadas nesta branch |
| --- | --- | --- |
| Início | GET /api/colaborador/meus-voos, /api/colaborador/perfil, GET .../minhas, manutenção, planos ICAO | Nome, horas totais, voos no mês e reembolsos pendentes; horas **do mês** permanecem indisponíveis sem cálculo próprio validado |
| Perfil / Dados | GET/PATCH /api/colaborador/perfil | Consulta e atualização autorizada de nome de exibição, telefone; foto em POST /api/colaborador/foto |
| Salário | GET /api/colaborador/folha-pagamento | Lista de pagamentos, valores e comprovantes/holerites privados. Não permite edição de folha |
| Documentos | GET/POST/DELETE /api/colaborador/documentos | Consulta, upload PDF/imagem, visualização autenticada e exclusão por proprietário |
| Férias | GET/POST /api/colaborador/ferias | Histórico e criação de pedido. **Não mostra cancelamento/folga fictícios**: não foi localizado endpoint do colaborador para esses comandos |
| Voos / relatório de voo | GET /api/colaborador/meus-voos e /:id | Jornadas e horários reais, sem simular diário |
| Diário | Consulta operacional compartilhada com histórico de voos | Leitura real. **Escrita de Diário de Bordo ainda pendente**: exige mês aberto, aeronave, tripulação, horas, assinatura e validações do backend. O formulário local foi desativado |
| Plano ICAO | GET/POST/DELETE /api/interno/planos-voo (já existente) | Mantido, não alterado nesta etapa |
| Manutenção | GET/POST /api/ctm/relatorios-manutencao (já existente) | Mantido, não alterado nesta etapa |
| Notificações | GET/PATCH /api/sharebrasil/notificacoes (já existente) | Mantido, não alterado nesta etapa |

## Segurança dos arquivos

- Downloads privados usam Bearer da sessão Supabase, nunca token na URL.
- Somente caminhos esperados de relatório, documentos do colaborador e folha são aceitos pelo leitor; assinatura PDF/imagem verificada.
- Arquivos são entregues ao compartilhamento nativo e a cópia do cache é removida após a interação.
- O compartilhamento para outro aplicativo é uma ação explícita do usuário; o Worker não gera link público.

## Ordem de implantação

1. **backend-share**: publicar correção de autorização de finalizar/PDF e URL dos anexos para tripulação.
2. **tripapp**: instalar `expo-document-picker@~57.0.3` e dependências pelo lockfile, executar typecheck, testes e revisão no Expo Go.
3. Testar como PIC/SIC do voo, incluindo arquivo JPG, PNG, PDF, documento salarial e relatório de outro tripulante (deve receber 403).
4. Verificar a devolução de relatório para ajuste, histórico de reembolso, concorrência ao editar e status de finalização no Worker.
5. Nenhuma migração D1 necessária nesta etapa; banco de produção não foi alterado diretamente.

## Pendências deliberadamente não concluídas

- **Escrita no Diário de Bordo**: necessita de fluxo próprio para selecionar livro/mês, aeronave, perna, tempos e assinaturas, respeitando o esquema e as regras já vigentes; não substituir por POST incompleto.
- **Cancelamento de férias e criação de folgas**: rotas de colaborador não existem no Worker; não simular sucesso no cliente.
- **Horas mensais**: não apresentar valor estimado ou fictício na home.
- **Validação de produção**: este PR não executou o Expo Go em aparelho real, nem testes autenticados contra o Worker de produção. Testes de contrato adicionados não substituem esses testes.
