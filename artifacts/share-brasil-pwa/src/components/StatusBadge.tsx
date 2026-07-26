import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

interface StatusBadgeProps {
  status: string;
  type?: 'flight' | 'plan' | 'report' | 'maintenance' | 'vacation' | 'financial';
  className?: string;
}

export function StatusBadge({ status, type, className }: StatusBadgeProps) {
  const getBadgeStyle = () => {
    const s = status.toLowerCase();
    
    // Financial & Vacation
    if (s === 'pago' || s === 'aprovada' || s === 'aprovado' || s === 'resolvido') 
      return 'bg-emerald-500/15 text-emerald-500 hover:bg-emerald-500/25 border-emerald-500/30';
    if (s === 'pendente' || s === 'solicitada' || s === 'em_andamento' || s === 'enviado') 
      return 'bg-amber-500/15 text-amber-500 hover:bg-amber-500/25 border-amber-500/30';
    if (s === 'devolvido' || s === 'recusada' || s === 'cancelado' || s === 'cancelada') 
      return 'bg-red-500/15 text-red-500 hover:bg-red-500/25 border-red-500/30';
    
    // Maintenance priorities
    if (s === 'baixa') return 'bg-emerald-500/15 text-emerald-500 hover:bg-emerald-500/25 border-emerald-500/30';
    if (s === 'media') return 'bg-amber-500/15 text-amber-500 hover:bg-amber-500/25 border-amber-500/30';
    if (s === 'alta') return 'bg-orange-500/15 text-orange-500 hover:bg-orange-500/25 border-orange-500/30';
    if (s === 'critica') return 'bg-red-500/15 text-red-500 hover:bg-red-500/25 border-red-500/30';
    
    // Default / Rascunho / Aberto
    return 'bg-slate-500/15 text-slate-400 hover:bg-slate-500/25 border-slate-500/30';
  };

  const formatStatus = () => {
    const s = status.toLowerCase();
    const map: Record<string, string> = {
      'em_andamento': 'Em Andamento',
      'resolvido': 'Resolvido',
      'rascunho': 'Rascunho',
      'enviado': 'Enviado',
      'aprovado': 'Aprovado',
      'cancelado': 'Cancelado',
      'devolvido': 'Devolvido',
      'solicitada': 'Solicitada',
      'aprovada': 'Aprovada',
      'recusada': 'Recusada',
      'cancelada': 'Cancelada',
      'pago': 'Pago',
      'pendente': 'Pendente',
      'baixa': 'Baixa',
      'media': 'Média',
      'alta': 'Alta',
      'critica': 'Crítica',
      'aberto': 'Aberto'
    };
    return map[s] || status;
  };

  return (
    <Badge variant="outline" className={cn("uppercase tracking-wider text-[10px] font-semibold", getBadgeStyle(), className)}>
      {formatStatus()}
    </Badge>
  );
}