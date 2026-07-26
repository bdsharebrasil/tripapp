import { useState } from 'react';
import { format, parseISO } from 'date-fns';
import { FileText, Plus, Search, AlertCircle } from 'lucide-react';
import { useAppContext, TravelReport } from '@/context/AppContext';
import { StatusBadge } from '@/components/StatusBadge';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

export default function RelatorioViagem() {
  const { travelReports } = useAppContext();
  const [search, setSearch] = useState('');

  const filteredReports = travelReports.filter(r => 
    r.numero.toLowerCase().includes(search.toLowerCase()) || 
    r.rota.toLowerCase().includes(search.toLowerCase())
  ).sort((a, b) => parseISO(b.data).getTime() - parseISO(a.data).getTime());

  return (
    <div className="flex flex-col h-full max-w-5xl mx-auto w-full p-4 pb-24 md:p-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Relatórios de Viagem</h1>
          <p className="text-sm text-muted-foreground">Prestação de contas e despesas.</p>
        </div>
      </div>

      <div className="relative mb-6">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input 
          className="pl-9 bg-card border-border" 
          placeholder="Buscar relatório..." 
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      <div className="flex flex-col gap-3">
        {filteredReports.map(r => (
          <Card key={r.id} className={`bg-card hover-elevate cursor-pointer border-border transition-colors ${r.status === 'devolvido' ? 'border-red-500/30' : ''}`}>
            <CardContent className="p-4">
              <div className="flex justify-between items-start mb-3">
                <div className="flex flex-col">
                  <span className="font-bold text-sm">{r.numero}</span>
                  <span className="text-xs text-muted-foreground">{format(parseISO(r.dataInicio), 'dd/MM/yyyy')} - {format(parseISO(r.dataFim), 'dd/MM/yyyy')}</span>
                </div>
                <StatusBadge status={r.status} type="report" />
              </div>
              
              <div className="flex justify-between items-end mt-2">
                <div className="text-sm font-mono text-muted-foreground">
                  {r.rota} • {r.aeronave}
                </div>
                <div className="text-lg font-bold text-primary font-mono">
                  R$ {r.total.toFixed(2)}
                </div>
              </div>

              {r.status === 'devolvido' && r.motivoDevolucao && (
                <div className="mt-3 bg-red-500/10 text-red-500 p-2 rounded text-xs flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{r.motivoDevolucao}</span>
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