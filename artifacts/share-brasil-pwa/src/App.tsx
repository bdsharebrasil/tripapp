import { useEffect } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import { Route, Switch, Router as WouterRouter } from 'wouter';
import { AppProvider } from '@/context/AppContext';
import { Layout } from '@/components/Layout';

// Pages
import Home from '@/pages/home';
import Diario from '@/pages/diario';
import PlanoVoo from '@/pages/plano-voo';
import RelatorioViagem from '@/pages/relatorio-viagem';
import Manutencao from '@/pages/manutencao';
import Financeiro from '@/pages/financeiro';
import Ferias from '@/pages/ferias';
import Perfil from '@/pages/perfil';
import NotFound from '@/pages/not-found';

const queryClient = new QueryClient();

function Router() {
  return (
    <Layout>
      <Switch>
        <Route path="/" component={Home} />
        <Route path="/diario" component={Diario} />
        <Route path="/plano-voo" component={PlanoVoo} />
        <Route path="/relatorio-viagem" component={RelatorioViagem} />
        <Route path="/manutencao" component={Manutencao} />
        <Route path="/financeiro" component={Financeiro} />
        <Route path="/ferias" component={Ferias} />
        <Route path="/perfil" component={Perfil} />
        <Route component={NotFound} />
      </Switch>
    </Layout>
  );
}

function App() {
  // Force dark mode
  useEffect(() => {
    document.documentElement.classList.add('dark');
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <AppProvider>
        <TooltipProvider>
          <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}>
            <Router />
          </WouterRouter>
          <Toaster />
        </TooltipProvider>
      </AppProvider>
    </QueryClientProvider>
  );
}

export default App;