# Rotas do Trip Share

Todas as chamadas abaixo usam `apiFetch` no domínio `EXPO_PUBLIC_API_URL`. D1 e R2 são acessados somente pelo Worker.

| Módulo | Método | Rota Worker |
| --- | --- | --- |
| Login | POST | `/api/trip/auth/login` |
| Renovação | POST | `/api/trip/auth/refresh` |
| Logout | POST | `/api/trip/auth/logout` |
| Perfil | GET, PATCH | `/api/colaborador/perfil` |
| Avatar | GET, POST | `/api/colaborador/foto` |
| Documentos | GET, POST | `/api/colaborador/documentos` |
| Documento | DELETE | `/api/colaborador/documentos/:id` |
| Arquivo de documento | GET | `/api/colaborador/documentos/:id/arquivo` |
| Pagamentos | GET | `/api/colaborador/folha-pagamento` |
| Holerite/comprovante | GET | `/api/colaborador/folha-pagamento/anexos?key=...` |
| Agenda/histórico | GET | `/api/colaborador/meus-voos` |
| Detalhe do voo | GET | `/api/colaborador/meus-voos/:id` |
| Horários | PATCH | `/api/interno/jornadas/:jornada/pernas/:perna` |
| Preparação/checklist | GET, POST | `/api/interno/agendamento/:id/preparacao` |
| Conclusão do checklist | POST | `/api/interno/agendamento/:id/preparacao/concluir` |
| Briefing PDF | GET | `/api/interno/agendamento/:id/preparacao/pdf?versao=...` |
| Diário | GET | `/api/colaborador/diario-bordo/voos/:id` |
| Sincronização do diário | POST | `/api/colaborador/diario-bordo/voos/:id/sincronizar` |
| Complemento do diário | PATCH | `/api/colaborador/diario-bordo/pernas/:id` |
| Assinatura do diário | POST | `/api/colaborador/diario-bordo/pernas/:id/assinar` |
| Voos para despesas | GET | `/api/financeiro/relatorios-despesa-viagem/meus-voos` |
| Meus relatórios | GET | `/api/financeiro/relatorios-despesa-viagem/minhas` |
| Iniciar relatório | POST | `/api/financeiro/relatorios-despesa-viagem/iniciar-do-voo` |
| Despesas | PUT | `/api/financeiro/relatorios-despesa-viagem/:id/despesas-tripulante` |
| Comprovante | POST | `/api/financeiro/relatorios-despesa-viagem/:id/anexos-tripulante` |
| Excluir comprovante | DELETE | `/api/financeiro/relatorios-despesa-viagem/:id/anexos-tripulante/:anexo` |
| Abrir comprovante | GET | `/api/financeiro/relatorios-despesa-viagem/:id/anexos-tripulante/:anexo/arquivo` |
| Finalizar relatório | POST | `/api/financeiro/relatorios-despesa-viagem/:id/finalizar` |
| PDF do relatório | GET | `/api/financeiro/relatorios-despesa-viagem/:id/pdf` |
| Férias | GET, POST | `/api/colaborador/ferias` |
| Ocorrências e aeronaves CTM | GET, POST | `/api/ctm/relatorios-manutencao` |
| Planos ICAO | GET, POST | `/api/interno/planos-voo` |
| Excluir plano | DELETE | `/api/interno/planos-voo/:id` |
| Meteorologia | GET | `/api/v1/weather/:icao` |
| Sugestão de rota | GET | `/api/v1/flightplan?adep=...&ades=...` |
| Notificações | GET | `/api/sharebrasil/notificacoes?origem=geral` |
| Marcar aviso lido | PATCH | `/api/sharebrasil/notificacoes/:id/lida?origem=geral` |

O endpoint de saúde do servidor de exemplo não era usado pelo aplicativo e foi eliminado junto com esse servidor. Os antigos pacotes de cliente gerado também não eram importados por nenhuma tela. Não há servidor local de dados nem banco paralelo.
