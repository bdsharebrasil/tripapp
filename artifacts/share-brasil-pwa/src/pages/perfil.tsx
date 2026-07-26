import { UserCircle, Mail, Phone, HeartPulse, GraduationCap, Edit3, ShieldAlert } from 'lucide-react';
import { useAppContext } from '@/context/AppContext';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

export default function Perfil() {
  const { profile } = useAppContext();

  return (
    <div className="flex flex-col h-full max-w-3xl mx-auto w-full p-4 pb-24 md:p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Perfil do Piloto</h1>
          <p className="text-sm text-muted-foreground">Seus dados e licenças.</p>
        </div>
        <Button variant="outline" size="sm" className="gap-2">
          <Edit3 className="w-4 h-4" />
          <span className="hidden md:inline">Editar</span>
        </Button>
      </div>

      <div className="flex flex-col md:flex-row gap-6 mb-6">
        {/* Avatar/Header Card */}
        <Card className="bg-card border-border overflow-hidden md:w-1/3">
          <div className="h-24 bg-gradient-to-r from-secondary to-primary relative"></div>
          <CardContent className="p-6 pt-0 flex flex-col items-center text-center">
            <div className="w-24 h-24 rounded-full bg-background border-4 border-background flex items-center justify-center -mt-12 mb-3 shadow-sm text-4xl text-primary font-bold">
              {profile.nome.charAt(0)}
            </div>
            <h2 className="text-xl font-bold tracking-tight">{profile.nome}</h2>
            <p className="text-primary font-medium">{profile.cargo}</p>
            <div className="w-full h-px bg-border my-4"></div>
            <div className="flex flex-col gap-2 w-full text-sm">
              <div className="flex items-center gap-3 text-muted-foreground">
                <Mail className="w-4 h-4" />
                <span className="truncate">{profile.email}</span>
              </div>
              <div className="flex items-center gap-3 text-muted-foreground">
                <Phone className="w-4 h-4" />
                <span>{profile.telefone}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Info Grid */}
        <div className="flex-1 flex flex-col gap-4">
          <Card className="bg-card border-border">
            <CardContent className="p-0">
              <div className="p-4 border-b border-border flex items-center gap-2">
                <ShieldAlert className="w-5 h-5 text-muted-foreground" />
                <h3 className="font-bold">Dados ANAC</h3>
              </div>
              <div className="p-4 grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-1">
                  <span className="text-xs uppercase tracking-wider text-muted-foreground font-bold">Código CANAC</span>
                  <span className="font-mono text-lg">{profile.canac}</span>
                </div>
                <div className="flex flex-col gap-1">
                  <span className="text-xs uppercase tracking-wider text-muted-foreground font-bold">CMA</span>
                  <span className="font-mono text-lg">{profile.cma}</span>
                </div>
                <div className="flex flex-col gap-1">
                  <span className="text-xs uppercase tracking-wider text-muted-foreground font-bold">Validade CMA</span>
                  <span className="font-mono text-lg text-emerald-500">{profile.cmaValidade}</span>
                </div>
                <div className="flex flex-col gap-1">
                  <span className="text-xs uppercase tracking-wider text-muted-foreground font-bold">Classe CMA</span>
                  <span className="font-mono text-lg">{profile.cmaClasse}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-card border-border">
            <CardContent className="p-0">
              <div className="p-4 border-b border-border flex items-center gap-2">
                <GraduationCap className="w-5 h-5 text-muted-foreground" />
                <h3 className="font-bold">Habilitações</h3>
              </div>
              <div className="p-4 flex flex-wrap gap-2">
                {profile.habilitacoes.map(h => (
                  <span key={h} className="bg-secondary/20 text-secondary border border-secondary/30 px-3 py-1 rounded-md font-mono font-bold">
                    {h}
                  </span>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card className="bg-card border-border">
            <CardContent className="p-0">
              <div className="p-4 border-b border-border flex items-center gap-2">
                <HeartPulse className="w-5 h-5 text-muted-foreground" />
                <h3 className="font-bold">Informações Médicas</h3>
              </div>
              <div className="p-4">
                <div className="flex flex-col gap-1">
                  <span className="text-xs uppercase tracking-wider text-muted-foreground font-bold">Tipo Sanguíneo</span>
                  <span className="font-mono text-lg text-red-500">{profile.tipoSanguineo}</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}