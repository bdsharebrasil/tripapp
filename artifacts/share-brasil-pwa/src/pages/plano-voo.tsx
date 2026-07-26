import { useState } from 'react';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { FileCheck2, Plus, Search, MapPin, Clock } from 'lucide-react';
import { useAppContext, FlightPlan } from '@/context/AppContext';
import { StatusBadge } from '@/components/StatusBadge';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

export default function PlanoVoo() {
  const { flightPlans } = useAppContext();
  const [search, setSearch] = useState('');

  const filteredPlans = flightPlans.filter(p => 
    p.partida.toLowerCase().includes(search.toLowerCase()) || 
    p.chegada.toLowerCase().includes(search.toLowerCase()) ||
    p.matricula.toLowerCase().includes(search.toLowerCase())
  ).sort((a, b) => parseISO(b.data).getTime() - parseISO(a.data).getTime());

  return (
    <div className="flex flex-col h-full max-w-5xl mx-auto w-full p-4 pb-24 md:p-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Planos de Voo</h1>
          <p className="text-sm text-muted-foreground">Gestão e aprovação de planos.</p>
        </div>
      </div>

      <div className="relative mb-6">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input 
          className="pl-9 bg-card border-border" 
          placeholder="Buscar planos..." 
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      <div className="flex flex-col gap-3">
        {filteredPlans.map(p => (
          <Card key={p.id} className="bg-card hover-elevate cursor-pointer border-border transition-colors">
            <CardContent className="p-4">
              <div className="flex justify-between items-start mb-2">
                <StatusBadge status={p.status} type="plan" />
                <span className="text-xs font-mono text-muted-foreground">
                  {format(parseISO(p.data), "dd MMM yyyy", { locale: ptBR })}
                </span>
              </div>
              
              <div className="flex items-center gap-4 py-2">
                <div className="text-xl font-bold font-mono">{p.partida}</div>
                <div className="flex-1 flex flex-col items-center">
                  <div className="w-full h-px bg-border relative">
                    <div className="absolute top-1/2 left-1/2 -translate-y-1/2 -translate-x-1/2 bg-card px-2 text-[10px] text-muted-foreground font-mono">
                      {p.estimativaVoo}
                    </div>
                  </div>
                </div>
                <div className="text-xl font-bold font-mono">{p.chegada}</div>
              </div>

              <div className="mt-3 pt-3 border-t flex justify-between text-xs text-muted-foreground">
                <span>{p.matricula}</span>
                <span>{p.horaPrevista}Z</span>
                <span>{p.combustivelPrevisto} Lbs</span>
              </div>
            </CardContent>
          </Card>
        ))}
        {filteredPlans.length === 0 && (
          <div className="py-12 text-center text-muted-foreground">
            Nenhum plano encontrado.
          </div>
        )}
      </div>

      <Button 
        className="fixed bottom-20 md:bottom-8 right-4 md:right-8 w-14 h-14 rounded-full shadow-lg hover:shadow-xl hover:scale-105 transition-all p-0"
      >
        <Plus className="w-6 h-6" />
      </Button>
    </div>
  );
}