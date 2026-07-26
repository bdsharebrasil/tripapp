import { useState } from 'react';
import { format, parseISO, subMonths } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Wallet, Search, TrendingUp, DollarSign } from 'lucide-react';
import { useAppContext } from '@/context/AppContext';
import { StatusBadge } from '@/components/StatusBadge';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

export default function Financeiro() {
  const { financial } = useAppContext();
  const [search, setSearch] = useState('');

  const filtered = financial.filter(f => 
    f.descricao.toLowerCase().includes(search.toLowerCase())
  ).sort((a, b) => parseISO(b.data).getTime() - parseISO(a.data).getTime());

  const totalRecebido = financial.filter(f => f.status === 'pago').reduce((acc, f) => acc + f.valor, 0);
  const totalPendente = financial.filter(f => f.status === 'pendente').reduce((acc, f) => acc + f.valor, 0);

  return (
    <div className="flex flex-col h-full max-w-5xl mx-auto w-full p-4 pb-24 md:p-8">
      <div className="flex flex-col gap-1 mb-6">
        <h1 className="text-2xl font-bold tracking-tight">Financeiro</h1>
        <p className="text-sm text-muted-foreground">Acompanhamento de salários e ressarcimentos.</p>
      </div>

      <div className="grid grid-cols-2 gap-3 mb-6">
        <Card className="bg-card">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-muted-foreground mb-2">
              <TrendingUp className="w-4 h-4 text-emerald-500" />
              <span className="text-xs font-bold uppercase tracking-wider">Recebido</span>
            </div>
            <div className="text-xl md:text-2xl font-bold text-emerald-500 font-mono">
              R$ {totalRecebido.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </div>
          </CardContent>
        </Card>
        <Card className="bg-card">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-muted-foreground mb-2">
              <DollarSign className="w-4 h-4 text-amber-500" />
              <span className="text-xs font-bold uppercase tracking-wider">A Receber</span>
            </div>
            <div className="text-xl md:text-2xl font-bold text-amber-500 font-mono">
              R$ {totalPendente.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="relative mb-6">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input 
          className="pl-9 bg-card border-border" 
          placeholder="Buscar lançamentos..." 
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      <Tabs defaultValue="todos" className="w-full">
        <TabsList className="w-full grid grid-cols-4 bg-muted">
          <TabsTrigger value="todos" className="text-[10px] md:text-xs">Todos</TabsTrigger>
          <TabsTrigger value="salario" className="text-[10px] md:text-xs">Salários</TabsTrigger>
          <TabsTrigger value="ressarcimento" className="text-[10px] md:text-xs">Reembolso</TabsTrigger>
          <TabsTrigger value="pendente" className="text-[10px] md:text-xs">Pendentes</TabsTrigger>
        </TabsList>
        
        <div className="mt-4 flex flex-col gap-3">
          {filtered.map(f => (
            <Card key={f.id} className="bg-card border-border">
              <CardContent className="p-4 flex justify-between items-center">
                <div className="flex flex-col gap-1">
                  <span className="font-bold text-sm">{f.descricao}</span>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span>{format(parseISO(f.data), 'dd MMM yyyy', { locale: ptBR })}</span>
                    {f.referencia && (
                      <>
                        <span>•</span>
                        <span>{f.referencia}</span>
                      </>
                    )}
                  </div>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <span className="font-bold font-mono text-base">R$ {f.valor.toFixed(2)}</span>
                  <StatusBadge status={f.status} type="financial" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </Tabs>
    </div>
  );
}