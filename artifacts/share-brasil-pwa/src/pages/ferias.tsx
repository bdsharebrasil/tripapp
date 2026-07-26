import { format, parseISO } from 'date-fns';
import { Palmtree, Plus, Calendar as CalendarIcon, CheckCircle2 } from 'lucide-react';
import { useAppContext } from '@/context/AppContext';
import { StatusBadge } from '@/components/StatusBadge';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

export default function Ferias() {
  const { vacations, profile } = useAppContext();

  const sortedVacations = [...vacations].sort((a, b) => parseISO(b.dataInicio).getTime() - parseISO(a.dataInicio).getTime());

  return (
    <div className="flex flex-col h-full max-w-5xl mx-auto w-full p-4 pb-24 md:p-8">
      <div className="flex flex-col gap-1 mb-6">
        <h1 className="text-2xl font-bold tracking-tight">Férias</h1>
        <p className="text-sm text-muted-foreground">Solicitações e saldo de dias.</p>
      </div>

      <Card className="bg-gradient-to-br from-primary/20 to-card border-primary/30 mb-6">
        <CardContent className="p-6 flex items-center justify-between">
          <div className="flex flex-col gap-1">
            <span className="text-sm uppercase tracking-wider font-bold text-muted-foreground">Saldo Disponível</span>
            <span className="text-4xl font-bold font-mono text-primary">{profile.feriasDisponivel} <span className="text-lg">dias</span></span>
          </div>
          <Palmtree className="w-12 h-12 text-primary opacity-50" />
        </CardContent>
      </Card>

      <div className="flex flex-col gap-3">
        <h2 className="text-sm font-bold uppercase tracking-wider text-muted-foreground mb-1">Histórico de Solicitações</h2>
        {sortedVacations.map(v => (
          <Card key={v.id} className="bg-card border-border">
            <CardContent className="p-4">
              <div className="flex justify-between items-start mb-3">
                <div className="flex flex-col">
                  <span className="font-bold text-base">{v.dias} dias ({v.tipo})</span>
                  <span className="text-xs text-muted-foreground">Solicitado em {format(parseISO(v.solicitadoEm), 'dd/MM/yyyy')}</span>
                </div>
                <StatusBadge status={v.status} type="vacation" />
              </div>
              
              <div className="bg-muted p-3 rounded-lg flex items-center gap-3">
                <CalendarIcon className="w-4 h-4 text-muted-foreground" />
                <div className="text-sm font-mono flex-1">
                  {format(parseISO(v.dataInicio), 'dd/MM/yyyy')} <span className="text-muted-foreground mx-1">até</span> {format(parseISO(v.dataFim), 'dd/MM/yyyy')}
                </div>
              </div>

              {v.observacoesGestor && (
                <div className="mt-3 flex items-start gap-2 text-xs text-muted-foreground">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                  <p><strong>Gestor:</strong> {v.observacoesGestor}</p>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      <Button 
        className="fixed bottom-20 md:bottom-8 right-4 md:right-8 w-14 h-14 rounded-full shadow-lg hover:shadow-xl hover:scale-105 transition-all p-0"
      >
        <Plus className="w-6 h-6" />
      </Button>
    </div>
  );
}