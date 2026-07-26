import { ReactNode } from 'react';
import { Link, useLocation } from 'wouter';
import { 
  Home, 
  Plane, 
  FileText, 
  FileCheck2, 
  Wrench, 
  Wallet, 
  Palmtree, 
  UserCircle 
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAppContext } from '@/context/AppContext';

const navItems = [
  { name: 'Dashboard', path: '/', icon: Home },
  { name: 'Diário', path: '/diario', icon: Plane },
  { name: 'Planos', path: '/plano-voo', icon: FileCheck2 },
  { name: 'Viagens', path: '/relatorio-viagem', icon: FileText },
  { name: 'Manutenção', path: '/manutencao', icon: Wrench },
  { name: 'Financeiro', path: '/financeiro', icon: Wallet },
  { name: 'Férias', path: '/ferias', icon: Palmtree },
  { name: 'Perfil', path: '/perfil', icon: UserCircle },
];

export function Layout({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  const { profile } = useAppContext();

  return (
    <div className="flex h-[100dvh] w-full bg-background overflow-hidden text-foreground">
      
      {/* Desktop Sidebar */}
      <aside className="hidden md:flex flex-col w-64 bg-card border-r border-border shrink-0">
        <div className="h-16 flex items-center px-6 border-b border-border">
          <div className="flex items-center gap-3">
            <img src="/pwa/logo.png" alt="Share Brasil" className="h-8 w-8 object-contain" />
            <span className="font-bold tracking-tight text-lg text-primary">ShareBR</span>
          </div>
        </div>
        
        <div className="flex-1 overflow-y-auto py-4">
          <nav className="space-y-1 px-3">
            {navItems.map((item) => {
              const isActive = location === item.path;
              const Icon = item.icon;
              return (
                <Link key={item.path} href={item.path} className={cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors text-sm font-medium",
                  isActive ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-muted hover:text-foreground"
                )}>
                  <Icon className={cn("h-5 w-5", isActive ? "text-primary" : "text-muted-foreground")} />
                  {item.name}
                </Link>
              );
            })}
          </nav>
        </div>
        
        <div className="p-4 border-t border-border">
          <Link href="/perfil" className="flex items-center gap-3 hover:opacity-80 transition-opacity">
            <div className="h-10 w-10 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold">
              {profile.nome.charAt(0)}
            </div>
            <div className="flex flex-col">
              <span className="text-sm font-bold truncate max-w-[140px]">{profile.nome}</span>
              <span className="text-xs text-muted-foreground truncate">{profile.cargo}</span>
            </div>
          </Link>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col h-full relative overflow-hidden pb-16 md:pb-0">
        <div className="flex-1 overflow-y-auto">
          {children}
        </div>
      </main>

      {/* Mobile Bottom Nav */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 h-16 bg-card border-t border-border flex items-center justify-around px-2 z-50">
        {navItems.slice(0, 5).map((item) => {
          const isActive = location === item.path;
          const Icon = item.icon;
          return (
            <Link key={item.path} href={item.path} className={cn(
              "flex flex-col items-center justify-center w-full h-full gap-1",
              isActive ? "text-primary" : "text-muted-foreground"
            )}>
              <Icon className={cn("h-5 w-5", isActive ? "text-primary fill-primary/20" : "")} />
              <span className="text-[10px] font-medium">{item.name}</span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}