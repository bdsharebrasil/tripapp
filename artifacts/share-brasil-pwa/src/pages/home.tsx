import { cn } from '@/lib/utils';
import { Link, useLocation } from 'wouter';
import { format, parseISO, isSameMonth } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  Plane,
  FileText,
  Wrench,
  DollarSign,
  Palmtree,
  Navigation,
  BookOpen,
  AlertTriangle,
  ChevronRight,
  CheckCircle,
  Clock,
  Send,
} from 'lucide-react';
import { useAppContext } from '@/context/AppContext';

export default function Home() {
  const [, setLocation] = useLocation();
  const { profile, flights, flightPlans, travelReports, maintenance, financial } = useAppContext();

  const now = new Date();
  const currentMonthFlights = flights.filter(f => isSameMonth(parseISO(f.data), now));
  const horasMes = currentMonthFlights.reduce((acc, f) => acc + f.tempoVoo, 0);
  const voosMes = currentMonthFlights.length;

  const proximoVoo = flightPlans
    .filter(p => p.status === 'aprovado' && parseISO(p.data) >= now)
    .sort((a, b) => parseISO(a.data).getTime() - parseISO(b.data).getTime())[0];

  const reportsDevolvidos = travelReports.filter(r => r.status === 'devolvido');
  const relatoriosPendentes = travelReports.filter(r => r.status === 'enviado');
  const manutencaoAberta = maintenance.filter(m => m.status === 'aberto' || m.status === 'em_andamento');
  const financeiroPendente = financial.filter(f => f.status === 'pendente');
  const hasPendencias = reportsDevolvidos.length > 0 || relatoriosPendentes.length > 0 || manutencaoAberta.length > 0 || financeiroPendente.length > 0;

  return (
    <div className="flex flex-col min-h-full bg-background">

      {/* ── Full-bleed navy gradient header (like Expo) ── */}
      <div
        className="relative w-full overflow-hidden px-5 pt-12 pb-6"
        style={{ background: 'linear-gradient(160deg, #1B3A6B 0%, #0F2247 100%)' }}
      >
        {/* logo watermark */}
        <img
          src="/pwa/logo.png"
          alt=""
          aria-hidden
          className="absolute right-4 top-4 h-14 w-14 object-contain opacity-15 pointer-events-none"
        />

        <div className="relative z-10">
          <p className="text-white/60 text-sm font-medium mb-0.5">Bem-vindo,</p>
          <h1 className="text-2xl font-bold text-white leading-tight" data-testid="text-pilot-name">
            {profile.nome.split(' ')[0]} {profile.nome.split(' ')[1]}
          </h1>
          <p className="text-white/55 text-xs mt-1">
            {profile.cargo} · CANAC {profile.canac}
          </p>
        </div>

        {/* stats row — frosted glass cards */}
        <div className="relative z-10 grid grid-cols-3 gap-2 mt-5">
          {[
            { label: 'Horas/Mês', value: `${horasMes.toFixed(1)}h` },
            { label: 'Voos/Mês',  value: String(voosMes) },
            { label: 'Hrs Totais', value: String(profile.horasAcumuladas) },
          ].map((s) => (
            <div
              key={s.label}
              className="rounded-2xl px-3 py-3 text-center"
              style={{ background: 'rgba(255,255,255,0.10)' }}
            >
              <p className="text-white font-bold text-xl leading-none">{s.value}</p>
              <p className="text-white/55 text-[10px] mt-1 leading-none">{s.label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* ── Scrollable content ── */}
      <div className="flex flex-col gap-5 px-4 py-5 max-w-2xl mx-auto w-full">

        {/* Próximo Voo */}
        <Section title="Próximo Voo" linkLabel="Ver todos" linkTo="/plano-voo">
          {proximoVoo ? (
            <button
              onClick={() => setLocation('/plano-voo')}
              data-testid="card-next-flight"
              className="w-full text-left rounded-2xl overflow-hidden"
              style={{ background: 'linear-gradient(135deg, #1B3A6B 0%, #0F2247 100%)' }}
            >
              <div className="p-4">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-white/50">
                    {format(parseISO(proximoVoo.data), "dd MMM yyyy", { locale: ptBR })}
                  </span>
                  <span className="rounded-full px-2 py-0.5 text-[10px] font-bold" style={{ background: '#D4A832', color: '#1A1A2E' }}>
                    Aprovado
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex-1">
                    <p className="text-[26px] font-bold text-white leading-none">{proximoVoo.partida}</p>
                    <p className="text-white/45 text-xs mt-1">{proximoVoo.horaPrevista}</p>
                  </div>
                  <div className="flex flex-col items-center gap-1">
                    <div className="w-1 h-1 rounded-full bg-white/30" />
                    <Send className="h-4 w-4 text-[#D4A832]" />
                    <div className="w-1 h-1 rounded-full bg-white/30" />
                  </div>
                  <div className="flex-1 text-right">
                    <p className="text-[26px] font-bold text-white leading-none">{proximoVoo.chegada}</p>
                    <p className="text-white/45 text-xs mt-1">{proximoVoo.estimativaVoo}</p>
                  </div>
                </div>
                <div className="mt-3 pt-3 border-t border-white/10 flex items-center justify-between">
                  <span className="text-white/55 text-xs">{proximoVoo.matricula}</span>
                  <span className="text-white/55 text-xs">{proximoVoo.passageiros} pax</span>
                </div>
              </div>
            </button>
          ) : (
            <div className="rounded-2xl border border-dashed border-border p-6 text-center text-muted-foreground text-sm">
              Nenhum voo aprovado programado.
            </div>
          )}
        </Section>

        {/* Pendências */}
        {hasPendencias && (
          <Section title="Pendências">
            <div className="flex flex-col gap-2">
              {reportsDevolvidos.map(r => (
                <AlertRow
                  key={r.id}
                  color="#EF4444"
                  icon={AlertTriangle}
                  title="Relatório devolvido"
                  desc={r.motivoDevolucao || `${r.numero} precisa de correção`}
                  onClick={() => setLocation('/relatorio-viagem')}
                />
              ))}
              {relatoriosPendentes.length > 0 && (
                <AlertRow
                  color="#D4A832"
                  icon={FileText}
                  title="Relatórios pendentes"
                  desc={`${relatoriosPendentes.length} relatório(s) aguardando aprovação`}
                  onClick={() => setLocation('/relatorio-viagem')}
                />
              )}
              {manutencaoAberta.length > 0 && (
                <AlertRow
                  color="#4A6741"
                  icon={Wrench}
                  title="Manutenção aberta"
                  desc={`${manutencaoAberta.length} ocorrência(s) em aberto`}
                  onClick={() => setLocation('/manutencao')}
                />
              )}
              {financeiroPendente.length > 0 && (
                <AlertRow
                  color="#1B3A6B"
                  icon={DollarSign}
                  title="Pagamentos pendentes"
                  desc={`${financeiroPendente.reduce((a, f) => a + f.valor, 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} a receber`}
                  onClick={() => setLocation('/financeiro')}
                />
              )}
            </div>
          </Section>
        )}

        {/* Ações Rápidas */}
        <Section title="Ações Rápidas">
          <div className="grid grid-cols-3 gap-3">
            {[
              { icon: BookOpen, label: 'Novo Lançamento', path: '/diario',            bg: '#EFF6FF', color: '#1B3A6B' },
              { icon: Navigation,label: 'Plano de Voo',   path: '/plano-voo',         bg: '#F0FDF4', color: '#4A6741' },
              { icon: FileText,  label: 'Rel. Viagem',    path: '/relatorio-viagem',  bg: '#FFFBEB', color: '#D4A832' },
              { icon: Wrench,    label: 'Manutenção',     path: '/manutencao',        bg: '#F0FDF4', color: '#4A6741' },
              { icon: Palmtree,  label: 'Férias',         path: '/ferias',            bg: '#FEF9C3', color: '#D97706' },
              { icon: DollarSign,label: 'Financeiro',     path: '/financeiro',        bg: '#EFF6FF', color: '#1B3A6B' },
            ].map(({ icon: Icon, label, path, bg, color }) => (
              <button
                key={path}
                onClick={() => setLocation(path)}
                data-testid={`action-${path.replace('/', '')}`}
                className="flex flex-col items-center gap-2 rounded-2xl p-3 bg-card border border-border active:scale-95 transition-transform"
              >
                <div className="w-11 h-11 rounded-2xl flex items-center justify-center" style={{ backgroundColor: bg }}>
                  <Icon className="w-5 h-5" style={{ color }} />
                </div>
                <span className="text-[11px] font-semibold text-foreground text-center leading-tight">{label}</span>
              </button>
            ))}
          </div>
        </Section>

        {/* Últimos Voos */}
        <Section title="Últimos Voos" linkLabel="Ver todos" linkTo="/diario">
          <div className="flex flex-col gap-2">
            {flights.slice(0, 3).map(f => (
              <button
                key={f.id}
                onClick={() => setLocation('/diario')}
                data-testid={`flight-row-${f.id}`}
                className="w-full flex items-center gap-3 rounded-2xl bg-card border border-border p-3 active:scale-[0.98] transition-transform text-left"
              >
                <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                  <Plane className="w-4 h-4 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-foreground">
                    {f.partida} <span className="text-muted-foreground font-normal">→</span> {f.chegada}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {format(parseISO(f.data), 'dd MMM', { locale: ptBR })} · {f.matricula} · {f.tempoVoo.toFixed(2)}h
                  </p>
                </div>
                {f.assinado
                  ? <CheckCircle className="w-4 h-4 text-green-500 shrink-0" />
                  : <Clock className="w-4 h-4 text-[#D4A832] shrink-0" />}
              </button>
            ))}
          </div>
        </Section>

      </div>
    </div>
  );
}

/* ── helpers ── */

function Section({
  title,
  linkLabel,
  linkTo,
  children,
}: {
  title: string;
  linkLabel?: string;
  linkTo?: string;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h2 className="text-[15px] font-bold text-foreground">{title}</h2>
        {linkLabel && linkTo && (
          <Link href={linkTo} className="text-xs text-primary font-semibold flex items-center gap-0.5">
            {linkLabel} <ChevronRight className="w-3.5 h-3.5" />
          </Link>
        )}
      </div>
      {children}
    </div>
  );
}

function AlertRow({
  color,
  icon: Icon,
  title,
  desc,
  onClick,
}: {
  color: string;
  icon: React.ElementType;
  title: string;
  desc: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-3 rounded-2xl bg-card border border-border p-3 active:scale-[0.98] transition-transform text-left"
      style={{ borderLeftColor: color, borderLeftWidth: 4 }}
    >
      <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: `${color}18` }}>
        <Icon className="w-4 h-4" style={{ color }} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-foreground leading-tight">{title}</p>
        <p className="text-xs text-muted-foreground mt-0.5 leading-tight">{desc}</p>
      </div>
      <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
    </button>
  );
}

// needed for Section
import { ReactNode } from 'react';
