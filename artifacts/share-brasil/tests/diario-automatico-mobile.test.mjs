import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
const root = new URL('../', import.meta.url)
const [agenda, diario, router, history] = await Promise.all([
  readFile(new URL('app/(tabs)/agenda.tsx', root), 'utf8'),
  readFile(new URL('app/diario-bordo.tsx', root), 'utf8'),
  readFile(new URL('app/_layout.tsx', root), 'utf8'),
  readFile(new URL('app/relatorio-voo.tsx', root), 'utf8'),
])

test('salvar horário em Meus Voos informa resultado da sincronização e permite abrir Diário', () => {
  assert.match(agenda, /diario_bordo\?:/)
  assert.match(agenda, /diario\?\.status === "rascunho"/)
  assert.match(agenda, /"Horários e Diário atualizados"/)
  assert.match(agenda, /"\/diario-bordo"/)
  assert.match(agenda, /"DIÁRIO EM RASCUNHO"/)
  assert.match(agenda, /!leg\.diario_confirmado && !leg\.diario_assinado_pic/)
})

test('Diário trabalha por perna e com dados operacionais vindos do Worker', () => {
  assert.match(diario, /\/api\/colaborador\/diario-bordo/)
  assert.match(diario, /apiFetch<FlightDetail>/)
  assert.match(diario, /numero_perna/)
  assert.match(diario, /horario_ac/)
  assert.match(diario, /horario_dep/)
  assert.match(diario, /horario_pouso/)
  assert.match(diario, /horario_corte/)
  assert.match(diario, /data_registro/)
  assert.match(diario, /matricula_registro/)
  assert.match(diario, /cliente_razao_social/)
  assert.match(diario, /Sincronizar rascunhos existentes/)
  assert.doesNotMatch(diario, /AsyncStorage|DEMO_|addFlight\(/)
})

test('complementação e assinatura são comandos distintos autenticados', () => {
  assert.match(diario, /method:"PATCH"/)
  assert.match(diario, /method:"POST",body:JSON\.stringify\(\{confirmar_assinatura:true\}\)/)
  assert.match(diario, /response\?\.pode_assinar/)
  assert.match(diario, /"Salve primeiro"/)
  assert.match(diario, /"Assinatura eletrônica do comandante"/)
  assert.match(diario, /"ASSINADO"/)
  assert.match(router, /name="diario-bordo"/)
  assert.match(history, /"\/diario-bordo"/)
})
