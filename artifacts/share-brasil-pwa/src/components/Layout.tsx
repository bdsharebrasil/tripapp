import { ReactNode } from 'react';
import { Link, useLocation } from 'wouter';
import {
  Home,
  BookOpen,
  Navigation,
  DollarSign,
  UserCircle,
  FileText,
  Wrench,
  Palmtree,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAppContext } from '@/context/AppContext';

// Bottom 5 tabs — same order as Expo app
const bottomTabs = [
  { name: 'Início',     path: '/',               icon: Home },
  { name: 'Diário',    path: '/diario',          icon: BookOpen },
  { name: 'Plano',     path: '/plano-voo',       icon: Navigation },
  { name: 'Financeiro',path: '/financeiro',      icon: DollarSign },
  { name: 'Perfil',    path: '/perfil',          icon: UserCircle },
];

// Full sidebar nav (desktop)
const allNavItems = [
  { name: 'Início',       path: '/',                   icon: Home },
  { name: 'Diário',       path: '/diario',             icon: BookOpen },
  { name: 'Plano de Voo', path: '/plano-voo',          icon: Navigation },
  { name: 'Rel. Viagem',  path: '/relatorio-viagem',   icon: FileText },
  { name: 'Manutenção',   path: '/manutencao',         icon: Wrench },
  { name: 'Financeiro',   path: '/financeiro',         icon: DollarSign },
  { name: 'Férias',       path: '/ferias',             icon: Palmtree },
  { name: 'Perfil',       path: '/perfil',             icon: UserCircle },
];

export function Layout({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  const { profile } = useAppContext();

  return (
    <div className="flex h-[100dvh] w-full bg-background overflow-hidden text-foreground">

      {/* ── Desktop Sidebar ── */}
      <aside className="hidden md:flex flex-col w-64 bg-card/80 backdrop-blur-xl border-r border-white/10 shrink-0">
        <div className="h-16 flex items-center px-6 border-b border-white/10">
          <div className="flex items-center gap-3">
            <img src="/pwa/logo.png" alt="Share Brasil" className="h-8 w-8 object-contain" />
            <span className="font-bold tracking-tight text-lg text-foreground">Share Brasil</span>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto py-4">
          <nav className="space-y-0.5 px-3">
            {allNavItems.map((item) => {
              const isActive = location === item.path;
              const Icon = item.icon;
              return (
                <Link
                  key={item.path}
                  href={item.path}
                  className={cn(
                    'flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all text-sm font-medium',
                    isActive
                      ? 'bg-primary/15 text-primary'
                      : 'text-muted-foreground hover:bg-white/5 hover:text-foreground'
                  )}
                >
                  <Icon className={cn('h-5 w-5 shrink-0', isActive ? 'text-primary' : '')} />
                  {item.name}
                </Link>
              );
            })}
          </nav>
        </div>

        <div className="p-4 border-t border-white/10">
          <Link href="/perfil" className="flex items-center gap-3 hover:opacity-80 transition-opacity">
            <div className="h-10 w-10 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold text-sm">
              {profile.nome.charAt(0)}
            </div>
            <div className="flex flex-col min-w-0">
              <span className="text-sm font-bold truncate">{profile.nome}</span>
              <span className="text-xs text-muted-foreground truncate">{profile.cargo}</span>
            </div>
          </Link>
        </div>
      </aside>

      {/* ── Main content ── */}
      <main className="flex-1 flex flex-col h-full relative overflow-hidden">
        {/* page content scrolls, bottom nav floats above */}
        <div className="flex-1 overflow-y-auto pb-[80px] md:pb-0">
          {children}
        </div>
      </main>

      {/* ── Mobile Glass Bottom Nav ── */}
      <nav
        data-testid="bottom-nav"
        className={cn(
          'md:hidden fixed bottom-0 left-0 right-0 z-50',
          'h-[72px]',
          // glass effect
          'bg-background/75 backdrop-blur-2xl',
          // top border + rounded corners — native iOS / Android feel
          'border-t border-white/10 rounded-t-[28px]',
          // shadow to lift it above content
          'shadow-[0_-8px_32px_rgba(0,0,0,0.35)]',
          // flex layout
          'flex items-center justify-around px-2'
        )}
      >
        {bottomTabs.map((item) => {
          const isActive = location === item.path;
          const Icon = item.icon;
          return (
            <Link
              key={item.path}
              href={item.path}
              data-testid={`nav-${item.path.replace('/', '') || 'home'}`}
              className="flex flex-col items-center justify-center w-full h-full gap-1 relative"
            >
              {/* active indicator dot */}
              {isActive && (
                <span className="absolute top-1.5 w-1 h-1 rounded-full bg-primary" />
              )}
              <Icon
                className={cn(
                  'h-[22px] w-[22px] transition-colors',
                  isActive ? 'text-primary' : 'text-muted-foreground'
                )}
              />
              <span
                className={cn(
                  'text-[10px] font-semibold tracking-wide transition-colors',
                  isActive ? 'text-primary' : 'text-muted-foreground'
                )}
              >
                {item.name}
              </span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
