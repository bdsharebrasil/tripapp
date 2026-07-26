import { useState } from 'react';
import { format, parseISO } from 'date-fns';
import { Plane, Plus, Search, Calendar, Clock, ChevronRight } from 'lucide-react';
import { useAppContext, FlightEntry } from '@/context/AppContext';
import { StatusBadge } from '@/components/StatusBadge';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";

export default function Diario() {
  const { flights, saveFlight, deleteFlight } = useAppContext();
  const [search, setSearch] = useState('');
  const [selectedFlight, setSelectedFlight] = useState<FlightEntry | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);

  const filteredFlights = flights.filter(f => 
    f.partida.toLowerCase().includes(search.toLowerCase()) || 
    f.chegada.toLowerCase().includes(search.toLowerCase()) ||
    f.matricula.toLowerCase().includes(search.toLowerCase())
  ).sort((a, b) => parseISO(b.data).getTime() - parseISO(a.data).getTime());

  const horasTotais = filteredFlights.reduce((acc, f) => acc + f.tempoVoo, 0);

  const openNewModal = () => {
    const newFlight: FlightEntry = {
      id: Math.random().toString(36).substring(2, 9),
      data: format(new Date(), 'yyyy-MM-dd'),
      aeronave: 'LR20',
      matricula: 'PT-WSR',
      partida: '', chegada: '', trecho: '',
      horaDecolagem: '', horaPouso: '',
      tempoVoo: 0, horasDiurnas: 0, horasNoturnas: 0, pousos: 1,
      naturezaVoo: 'EX - Executivo', picCanac: '', sicCanac: '',
      cliente: 'Share Brasil', observacoes: '',
      confirmado: true, assinado: false,
      combustivelInicio: 0, combustivelFim: 0
    };
    setSelectedFlight(newFlight);
    setIsEditing(true);
    setIsModalOpen(true);
  };

  const handleSave = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (selectedFlight) {
      saveFlight(selectedFlight);
      setIsModalOpen(false);
    }
  };

  const handleSign = () => {
    if (selectedFlight) {
      saveFlight({ ...selectedFlight, assinado: true });
      setIsModalOpen(false);
    }
  };

  return (
    <div className="flex flex-col h-full max-w-5xl mx-auto w-full p-4 pb-24 md:p-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Diário de Bordo</h1>
          <p className="text-sm text-muted-foreground">Registre e assine seus voos.</p>
        </div>
        <div className="flex gap-4 items-center bg-card p-3 rounded-xl border">
          <div className="flex flex-col">
            <span className="text-[10px] uppercase text-muted-foreground font-bold">Total Listado</span>
            <span className="text-xl font-bold font-mono text-primary">{horasTotais.toFixed(1)}h</span>
          </div>
          <div className="w-px h-8 bg-border"></div>
          <div className="flex flex-col">
            <span className="text-[10px] uppercase text-muted-foreground font-bold">Voos</span>
            <span className="text-xl font-bold font-mono">{filteredFlights.length}</span>
          </div>
        </div>
      </div>

      <div className="relative mb-6">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input 
          className="pl-9 bg-card border-border" 
          placeholder="Buscar ICAO ou matrícula..." 
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      <div className="flex flex-col gap-3">
        {filteredFlights.map(f => (
          <Card 
            key={f.id} 
            className="bg-card hover-elevate cursor-pointer border-border transition-colors group"
            onClick={() => { setSelectedFlight(f); setIsEditing(false); setIsModalOpen(true); }}
          >
            <CardContent className="p-4 flex flex-col gap-3">
              <div className="flex justify-between items-start">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-lg font-bold">{f.partida}</span>
                  <Plane className="w-4 h-4 text-muted-foreground" />
                  <span className="font-mono text-lg font-bold">{f.chegada}</span>
                </div>
                <StatusBadge status={f.assinado ? 'Assinado' : 'Pendente'} type="flight" />
              </div>
              
              <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
                <div className="flex items-center gap-1">
                  <Calendar className="w-3 h-3" />
                  <span className="font-mono">{format(parseISO(f.data), 'dd/MM/yyyy')}</span>
                </div>
                <div className="flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  <span className="font-mono">{f.horaDecolagem} - {f.horaPouso}</span>
                </div>
                <div className="font-mono bg-secondary/20 text-secondary px-2 py-0.5 rounded-sm">
                  {f.tempoVoo.toFixed(1)}h
                </div>
                <div className="font-mono bg-muted px-2 py-0.5 rounded-sm text-foreground">
                  {f.matricula}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
        {filteredFlights.length === 0 && (
          <div className="py-12 text-center text-muted-foreground">
            Nenhum voo encontrado.
          </div>
        )}
      </div>

      <Button 
        className="fixed bottom-20 md:bottom-8 right-4 md:right-8 w-14 h-14 rounded-full shadow-lg hover:shadow-xl hover:scale-105 transition-all p-0"
        onClick={openNewModal}
      >
        <Plus className="w-6 h-6" />
      </Button>

      {isModalOpen && selectedFlight && (
        <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
          <DialogContent className="max-w-md max-h-[90dvh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{isEditing ? 'Novo Voo' : 'Detalhes do Voo'}</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSave} className="flex flex-col gap-4 py-4">
              
              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-1.5">
                  <Label>Data</Label>
                  <Input type="date" value={selectedFlight.data} onChange={e => setSelectedFlight({...selectedFlight, data: e.target.value})} disabled={!isEditing} />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label>Matrícula</Label>
                  <Input value={selectedFlight.matricula} onChange={e => setSelectedFlight({...selectedFlight, matricula: e.target.value})} disabled={!isEditing} />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-1.5">
                  <Label>Origem (ICAO)</Label>
                  <Input className="font-mono uppercase" value={selectedFlight.partida} onChange={e => setSelectedFlight({...selectedFlight, partida: e.target.value.toUpperCase()})} disabled={!isEditing} required />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label>Destino (ICAO)</Label>
                  <Input className="font-mono uppercase" value={selectedFlight.chegada} onChange={e => setSelectedFlight({...selectedFlight, chegada: e.target.value.toUpperCase()})} disabled={!isEditing} required />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div className="flex flex-col gap-1.5">
                  <Label>Decolagem</Label>
                  <Input type="time" value={selectedFlight.horaDecolagem} onChange={e => setSelectedFlight({...selectedFlight, horaDecolagem: e.target.value})} disabled={!isEditing} required />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label>Pouso</Label>
                  <Input type="time" value={selectedFlight.horaPouso} onChange={e => setSelectedFlight({...selectedFlight, horaPouso: e.target.value})} disabled={!isEditing} required />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label>Tempo (h)</Label>
                  <Input type="number" step="0.1" value={selectedFlight.tempoVoo} onChange={e => setSelectedFlight({...selectedFlight, tempoVoo: parseFloat(e.target.value)})} disabled={!isEditing} required />
                </div>
              </div>

              {!isEditing && (
                <div className="bg-muted p-3 rounded-md text-sm mt-2">
                  <p><strong>Observações:</strong> {selectedFlight.observacoes || 'Nenhuma observação.'}</p>
                </div>
              )}

              <DialogFooter className="mt-4 gap-2 flex-col sm:flex-row">
                {isEditing ? (
                  <>
                    <Button type="button" variant="outline" onClick={() => setIsModalOpen(false)}>Cancelar</Button>
                    <Button type="submit">Salvar Voo</Button>
                  </>
                ) : (
                  <>
                    <Button type="button" variant="destructive" onClick={() => { deleteFlight(selectedFlight.id); setIsModalOpen(false); }}>Excluir</Button>
                    <Button type="button" variant="outline" onClick={() => setIsEditing(true)}>Editar</Button>
                    {!selectedFlight.assinado && (
                      <Button type="button" onClick={handleSign}>Assinar Voo</Button>
                    )}
                  </>
                )}
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}