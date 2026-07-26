import { useState } from 'react';
import { format, parseISO } from 'date-fns';
import { Wrench, Plus, Search } from 'lucide-react';
import { useAppContext } from '@/context/AppContext';
import { StatusBadge } from '@/components/StatusBadge';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

export default function Manutencao() {
  const { maintenance } = useAppContext();
  const [search, setSearch] = useState('');

  const filtered = maintenance.filter(m => 
    m.matricula.toLowerCase().includes(search.toLowerCase()) || 
    m.descricao.toLowerCase().includes(search.toLowerCase())
  ).sort((a, b) => parseISO(b.data).getTime() - parseISO(a.data).getTime());

  return (
    <div className="flex flex-col h-full max-w-5xl mx-auto w-full p-4 pb-24 md:p-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Manutenção</h1>
          <p className="text-sm text-muted-foreground">Reportes e acompanhamento de aeronaves.</p>
        </div>
      </div>

      <div className="relative mb-6">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input 
          className="pl-9 bg-card border-border" 
          placeholder="Buscar reporte ou aeronave..." 
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      <div className="flex flex-col gap-3">
        {filtered.map(m => (
          <Card key={m.id} className="bg-card hover-elevate cursor-pointer border-border transition-colors">
            <CardContent className="p-4">
              <div className="flex justify-between items-start mb-3">
                <div className="flex items-center gap-2">
                  <span className="font-bold font-mono">{m.matricula}</span>
                  <span className="text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground">{m.tipo}</span>
                </div>
                <StatusBadge status={m.status} type="maintenance" />
              </div>
              
              <p className="text-sm mb-3 text-foreground/90">{m.descricao}</p>
              
              <div className="flex justify-between items-center mt-2 border-t pt-2">
                <div className="text-xs text-muted-foreground">
                  Reportado: {format(parseISO(m.data), 'dd/MM/yyyy')} • {m.local}
                </div>
                <StatusBadge status={m.prioridade} className="bg-transparent border-none px-0" />
              </div>
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