import { cn } from '@/lib/utils';
import { Link, useLocation } from 'wouter';
import { format, parseISO, isSameMonth } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { 
  Plane, 
  FileText, 
  Wrench, 
  Wallet, 
  Palmtree, 
  Clock, 
  Calendar as CalendarIcon,
  AlertTriangle,
  ChevronRight,
  Plus
} from 'lucide-react';
import { useAppContext, FlightPlan, TravelReport, MaintenanceReport, FinancialEntry } from '@/context/AppContext';
import { StatusBadge } from '@/components/StatusBadge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default function Home() {
  const [, setLocation] = useLocation();
  const { profile, flights, flightPlans, travelReports, maintenance, financial } = useAppContext();

  // Stats logic
  const now = new Date();
  const currentMonthFlights = flights.filter(f => isSameMonth(parseISO(f.data), now));
  const horasMes = currentMonthFlights.reduce((acc, f) => acc + f.tempoVoo, 0);
  const voosMes = currentMonthFlights.length;

  // Próximo Voo (next approved plan)
  const proximoVoo = flightPlans
    .filter(p => p.status === 'aprovado' && parseISO(p.data) >= now)
    .sort((a, b) => parseISO(a.data).getTime() - parseISO(b.data).getTime())[0];

  // Pendências
  const reportsDevolvidos = travelReports.filter(r => r.status === 'devolvido');
  const relatoriosPendentes = travelReports.filter(r => r.status === 'rascunho' || r.status === 'enviado');
  const manutencaoAberta = maintenance.filter(m => m.status === 'aberto' || m.status === 'em_andamento');
  const financeiroPendente = financial.filter(f => f.status === 'pendente');

  return (
    <div className="flex flex-col gap-6 p-4 md:p-8 max-w-5xl mx-auto w-full">
      {/* Header */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-secondary to-background border border-border p-6 shadow-md">
        <div className="absolute top-0 right-0 p-4 opacity-10">
          <img src="/pwa/logo.png" alt="" className="w-32 h-32 object-contain" />
        </div>
        <div className="relative z-10 flex justify-between items-start">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-white mb-1" data-testid="text-pilot-name">
              {profile.nome}
            </h1>
            <p className="text-primary font-medium text-sm md:text-base">
              {profile.cargo} • CANAC {profile.canac}
            </p>
          </div>
        </div>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-3 gap-3 md:gap-4">
        <Card className="bg-card">
          <CardContent className="p-4 flex flex-col items-center justify-center text-center">
            <Clock className="w-5 h-5 text-primary mb-2" />
            <span className="text-2xl font-bold font-mono">{horasMes.toFixed(1)}h</span>
            <span className="text-[10px] text-muted-foreground uppercase tracking-wider mt-1">Horas/Mês</span>
          </CardContent>
        </Card>
        <Card className="bg-card">
          <CardContent className="p-4 flex flex-col items-center justify-center text-center">
            <Plane className="w-5 h-5 text-primary mb-2" />
            <span className="text-2xl font-bold font-mono">{voosMes}</span>
            <span className="text-[10px] text-muted-foreground uppercase tracking-wider mt-1">Voos/Mês</span>
          </CardContent>
        </Card>
        <Card className="bg-card">
          <CardContent className="p-4 flex flex-col items-center justify-center text-center">
            <CalendarIcon className="w-5 h-5 text-primary mb-2" />
            <span className="text-2xl font-bold font-mono">{profile.horasAcumuladas}</span>
            <span className="text-[10px] text-muted-foreground uppercase tracking-wider mt-1">Horas Totais</span>
          </CardContent>
        </Card>
      </div>

      {/* Próximo Voo */}
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Próximo Voo</h2>
          <Link href="/plano-voo" className="text-xs text-primary font-medium flex items-center">
            Ver Todos <ChevronRight className="w-3 h-3 ml-1" />
          </Link>
        </div>
        
        {proximoVoo ? (
          <Card className="bg-card border-primary/20 shadow-sm relative overflow-hidden" onClick={() => setLocation('/plano-voo')} data-testid="card-next-flight">
            <div className="absolute left-0 top-0 bottom-0 w-1 bg-primary"></div>
            <CardContent className="p-4">
              <div className="flex justify-between items-start mb-3">
                <StatusBadge status={proximoVoo.status} type="plan" />
                <span className="text-xs font-mono text-muted-foreground">
                  {format(parseISO(proximoVoo.data), "dd MMM yyyy", { locale: ptBR })}
                </span>
              </div>
              <div className="flex items-center gap-4 mb-3">
                <div className="flex-1">
                  <div className="text-2xl font-bold tracking-tight">{proximoVoo.partida}</div>
                  <div className="text-xs text-muted-foreground">{proximoVoo.horaPrevista}</div>
                </div>
                <div className="flex flex-col items-center px-2">
                  <Plane className="w-5 h-5 text-primary rotate-90" />
                  <div className="w-16 h-px bg-border my-2 relative">
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2 text-[10px] text-muted-foreground bg-card px-1 font-mono">
                      {proximoVoo.estimativaVoo}
                    </div>
                  </div>
                </div>
                <div className="flex-1 text-right">
                  <div className="text-2xl font-bold tracking-tight">{proximoVoo.chegada}</div>
                </div>
              </div>
              <div className="flex items-center justify-between text-xs bg-muted/50 p-2 rounded-md">
                <span className="font-mono text-muted-foreground">{proximoVoo.aeronave} / {proximoVoo.matricula}</span>
                <span className="font-medium text-foreground">Pax: {proximoVoo.passageiros}</span>
              </div>
            </CardContent>
          </Card>
        ) : (
          <Card className="bg-card border-dashed">
            <CardContent className="p-6 text-center text-muted-foreground text-sm">
              Nenhum voo aprovado programado.
            </CardContent>
          </Card>
        )}
      </div>

      {/* Ações Rápidas */}
      <div className="flex flex-col gap-3">
        <h2 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Ações Rápidas</h2>
        <div className="grid grid-cols-3 gap-3 md:grid-cols-6">
          <ActionBtn icon={Plus} label="Novo Voo" onClick={() => setLocation('/diario')} active />
          <ActionBtn icon={Plane} label="Planos" onClick={() => setLocation('/plano-voo')} />
          <ActionBtn icon={FileText} label="Viagens" onClick={() => setLocation('/relatorio-viagem')} />
          <ActionBtn icon={Wrench} label="Manutenção" onClick={() => setLocation('/manutencao')} />
          <ActionBtn icon={Palmtree} label="Férias" onClick={() => setLocation('/ferias')} />
          <ActionBtn icon={Wallet} label="Financeiro" onClick={() => setLocation('/financeiro')} />
        </div>
      </div>

      {/* Pendências */}
      {(reportsDevolvidos.length > 0 || relatoriosPendentes.length > 0 || manutencaoAberta.length > 0 || financeiroPendente.length > 0) && (
        <div className="flex flex-col gap-3">
          <h2 className="text-sm font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-orange-500" /> Pendências
          </h2>
          <div className="flex flex-col gap-2">
            {reportsDevolvidos.map(r => (
              <AlertCard key={r.id} type="destructive" title={`Relatório Devolvido: ${r.numero}`} desc={r.motivoDevolucao || "Ajuste necessário"} onClick={() => setLocation('/relatorio-viagem')} />
            ))}
            {manutencaoAberta.length > 0 && (
              <AlertCard type="warning" title={`${manutencaoAberta.length} reportes de manutenção em aberto`} desc="Verifique o status das aeronaves." onClick={() => setLocation('/manutencao')} />
            )}
            {relatoriosPendentes.length > 0 && (
              <AlertCard type="info" title={`${relatoriosPendentes.length} relatórios de viagem pendentes`} desc="Finalize seus relatórios de despesas." onClick={() => setLocation('/relatorio-viagem')} />
            )}
            {financeiroPendente.length > 0 && (
              <AlertCard type="default" title={`${financeiroPendente.length} lançamentos financeiros pendentes`} desc="Aguardando pagamento." onClick={() => setLocation('/financeiro')} />
            )}
          </div>
        </div>
      )}

      {/* Últimos Voos */}
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Últimos Voos</h2>
          <Link href="/diario" className="text-xs text-primary font-medium flex items-center">
            Diário <ChevronRight className="w-3 h-3 ml-1" />
          </Link>
        </div>
        <div className="flex flex-col gap-2">
          {flights.slice(0, 3).map(f => (
            <Card key={f.id} className="bg-card hover-elevate cursor-pointer transition-colors" onClick={() => setLocation('/diario')}>
              <div className="p-3 px-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-secondary/30 flex items-center justify-center text-secondary">
                    <Plane className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="font-bold text-sm">{f.partida} <span className="text-muted-foreground font-normal mx-1">→</span> {f.chegada}</div>
                    <div className="text-xs text-muted-foreground font-mono">{format(parseISO(f.data), "dd/MM/yyyy")} • {f.matricula}</div>
                  </div>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <span className="text-sm font-bold font-mono">{f.tempoVoo.toFixed(1)}h</span>
                  <StatusBadge status={f.assinado ? "Assinado" : "Pendente"} type="flight" className="text-[9px] px-1.5 py-0" />
                </div>
              </div>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}

function ActionBtn({ icon: Icon, label, onClick, active }: { icon: any, label: string, onClick: () => void, active?: boolean }) {
  return (
    <button 
      onClick={onClick}
      className={cn(
        "flex flex-col items-center justify-center gap-2 p-3 rounded-xl transition-all active:scale-95",
        active ? "bg-primary text-primary-foreground shadow-md shadow-primary/20" : "bg-card border border-border text-foreground hover:border-primary/50"
      )}
    >
      <Icon className="w-5 h-5" />
      <span className="text-[10px] font-bold uppercase tracking-wide">{label}</span>
    </button>
  );
}

function AlertCard({ type, title, desc, onClick }: { type: 'destructive'|'warning'|'info'|'default', title: string, desc: string, onClick: () => void }) {
  const styles = {
    destructive: "border-red-500/30 bg-red-500/10 text-red-500",
    warning: "border-orange-500/30 bg-orange-500/10 text-orange-500",
    info: "border-amber-500/30 bg-amber-500/10 text-amber-500",
    default: "border-border bg-card text-foreground"
  };

  return (
    <div onClick={onClick} className={cn("border p-3 rounded-lg flex items-center justify-between cursor-pointer active:scale-[0.98] transition-transform", styles[type])}>
      <div className="flex flex-col">
        <span className="text-sm font-bold">{title}</span>
        <span className="text-xs opacity-80">{desc}</span>
      </div>
      <ChevronRight className="w-4 h-4 opacity-50" />
    </div>
  );
}