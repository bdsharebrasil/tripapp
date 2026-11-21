# Trip Share Expo — auditoria de integração (21/11/2026)

## Referência visual
- Início: único lugar onde pode existir fotografia de aeronave ao fundo.
- Agenda, detalhes, briefing, hospedagem e despesas: superfícies sólidas azul-marinho, sem imagem de avião.
- Navegação principal: Início, Agenda, Despesas, Perfil; Diário e Plano ICAO permanecem acessíveis por rotas internas, sem duplicação no menu inferior.

## Rotas verificadas no Worker
| Funcionalidade | Rota | Situação nesta branch |
| --- | --- | --- |
| Voos atribuídos | GET /api/colaborador/meus-voos | Conectado na Agenda |
| Voo, jornadas e hospedagens | GET /api/colaborador/meus-voos/:id | Conectado na Agenda |
| AC / DEP / POU / COR | PATCH /api/interno/jornadas/:jornadaId/pernas/:pernaId | Conectado na Agenda, sujeito à autorização do Worker |
| Listagem dos relatórios de viagem | GET /api/financeiro/relatorios-despesa-viagem/minhas | Já conectado no módulo Despesas |
| Voos disponíveis para relatório | GET /api/financeiro/relatorios-despesa-viagem/meus-voos | Já conectado |
| Criar relatório por voo | POST /api/financeiro/relatorios-despesa-viagem/iniciar-do-voo | Já conectado |
| Gravar despesas | PUT /api/financeiro/relatorios-despesa-viagem/:id/despesas-tripulante | Já conectado |
| Anexos | POST /api/financeiro/relatorios-despesa-viagem/:id/anexos-tripulante | Já conectado |
| Finalizar relatório | POST /api/financeiro/relatorios-despesa-viagem/:id/finalizar | Já conectado |

## Lacunas ainda não resolvidas
1. **Checklist pré-voo:** a Agenda exibe a ação, mas ainda não possui formulário nem fluxo de leitura/gravação. Não é correto declarar o checklist como concluído sem consultar e gravar no Worker.
2. **Briefing:** a Agenda mostra observações operacionais da solicitação e tripulação. O briefing formal, anexos e PDF ainda não foram conectados.
3. **Hospedagem:** consulta real, porém os campos retornados precisam de apresentação específica e validação com registros de produção.
4. **Home:** removidos os números de demonstração; contagem mensal de voos atribuídos vem de `/api/colaborador/meus-voos`. Horas ainda indisponíveis são exibidas como `—`, não como valores inventados.
5. **Diário, perfil, férias, plano ICAO, financeiro e manutenção:** o contexto agora inicia sem dados fictícios. Operações legadas que dependiam de gravação local são bloqueadas com erro explícito até serem migradas para endpoints reais. Essas telas ainda precisam de revisão de UX, tratamento de erros e contratos.
6. **Testes:** não houve execução local de Expo, teste de compilação nem teste autenticado contra produção. Verificar permissões de tripulante para PATCH de horários e fluxo de despesas.
7. **Segurança:** nunca gravar dados de voo, manutenção, checklist ou despesas somente em AsyncStorage como fonte definitiva; o Worker/D1 é a fonte de verdade.

## Publicação
O PR é uma **primeira etapa funcional**, não a conclusão da refatoração de todo o monorepo. Validar em Expo Go (iOS e Android), confirmar chamadas e erros 401/403, e seguir com a integração do checklist/briefing e migração do contexto de demonstração.

## Atualização autorizada: exclusão de demonstração
- Excluídos todos os arrays `DEMO_*` do contexto Expo.
- Desativada leitura/gravação dos registros locais `@sharebrasil:*` como fonte operacional. Não foi executada limpeza física dos dados locais antigos do aparelho.
- Identidade básica obtida da sessão Supabase, sem usar nome/CANAC de usuário de teste. Metadados ausentes aparecem vazios até existir consulta de perfil validada.
- Métodos antigos de gravação no contexto agora falham explicitamente; **não há falso sucesso de salvamento**.
- Não foram apagados registros reais do D1 nem modificados dados do Worker.

## Etapa 2 — Preparação e checklist
- Nova tela Expo `app/preparacao-voo.tsx`, acessível a partir do detalhe da Agenda.
- Consulta `GET /api/interno/agendamento/:id/preparacao`, usa seções/itens devolvidos pelo Worker e exibe estados/observações de aeronave e tripulação.
- Grava com versão otimista via `POST /api/interno/agendamento/:id/preparacao` e conclui via `POST /api/interno/agendamento/:id/preparacao/concluir`. Não marca itens pendentes como resolvidos automaticamente.
- Preserva trechos, escalas e dados dos serviços no payload para não apagar a preparação existente; reserva de hotel e abastecimento financeiro continuam em fluxos próprios.
- **Autorização de escrita corrigida no backend (PR separado):** início/encerramento de jornada, nova perna e PATCH dos horários agora verificam piloto/copiloto efetivamente vinculado ao número de voo, ou equipe de Operações/CTM/gestores autorizados. O antigo `requireShareInternal` continua validando a sessão, e o novo helper acrescenta vínculo/perfil. A correção só estará ativa após deploy do Worker.
- **Briefing PDF integrado:** Agenda e Checklist consultam a versão atual, baixam o PDF com Bearer da sessão usando `expo-file-system` (SDK 57), verificam a assinatura `%PDF-` e oferecem abertura/compartilhamento nativo com `expo-sharing`. O arquivo temporário é apagado após a interação. O endpoint PDF no Worker foi restringido à tripulação vinculada ou à equipe operacional (PR do backend). Não há URL pública nem token em query string.
- Ainda sem execução de compilação, Expo Go ou teste autenticado de produção.

## Ordem de publicação da correção de autorização e PDF
1. Fazer merge e publicar o PR `backend-share` de autorização da tripulação e PDF restrito (nenhuma migração D1 necessária).
2. Fazer merge do PR #3 do `tripapp` (inclui `expo-file-system@~57.0.7`, `expo-sharing@~57.0.26` e lockfile atualizado), instalar dependências com `pnpm install --frozen-lockfile`.
3. Executar `pnpm --filter @workspace/share-brasil typecheck` e `node --test artifacts/share-brasil/tests/briefing-pdf.test.mjs`.
4. Em Expo Go autenticar como piloto PIC/SIC do voo, salvar horários, abrir PDF da versão mais recente; autenticar com usuário não escalado e verificar HTTP 403 na mutação/PDF. Confirmar visualização e opções de compartilhamento no iPhone e Android.
5. O PDF é privado. Ao compartilhar com outro aplicativo, o usuário controla a cópia; o compartilhamento não transforma o endpoint em público.
