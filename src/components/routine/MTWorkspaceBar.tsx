import { Link } from 'react-router-dom';
import {
  LayoutDashboard, Users, Sparkles, Wallet, Factory, Package,
  Zap, Calendar, ListChecks, Truck, Video, Target, Trophy,
  MessageCircle, ClipboardList,
} from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useActiveMT } from '@/hooks/useActiveMT';
import { cn } from '@/lib/utils';

export const MODULE_CATALOG: Record<string, { label: string; path: string; icon: any; hint?: string }> = {
  dashboard:     { label: 'Dashboard',    path: '/dashboard',       icon: LayoutDashboard },
  crm:           { label: 'CRM',          path: '/contatos',        icon: Users },
  atendimento:   { label: 'Atendimento',  path: '/contatos/inbox',  icon: MessageCircle },
  digital:       { label: 'Digital',      path: '/digital',         icon: Video },
  financeiro:    { label: 'Financeiro',   path: '/financeiro',      icon: Wallet },
  operacoes:     { label: 'Operações',    path: '/operacoes',       icon: Factory },
  producao:      { label: 'Produção',     path: '/operacoes?tab=producao', icon: Package },
  foco:          { label: 'Foco',         path: '/foco',            icon: Zap },
  rotina:        { label: 'Rotina',       path: '/rotina',          icon: Calendar },
  tarefas:       { label: 'Tarefas',      path: '/contatos/tarefas',icon: ListChecks },
  rotas:         { label: 'Rotas',        path: '/rotas',           icon: Truck },
  reunioes:      { label: 'Reuniões',     path: '/reunioes',        icon: ClipboardList },
  planejamento:  { label: 'Planejamento', path: '/planejamento',    icon: Sparkles },
  metas:         { label: 'Metas',        path: '/metas',           icon: Trophy },
  calendario:    { label: 'Calendário',   path: '/calendario',      icon: Calendar },
  minha_area:    { label: 'Minha Área',   path: '/minha-area',      icon: Target },
};

const AREA_DEFAULTS: Record<string, string[]> = {
  gestao:      ['dashboard', 'metas', 'financeiro', 'reunioes'],
  comercial:   ['crm', 'atendimento', 'digital', 'financeiro'],
  operacional: ['operacoes', 'producao', 'rotas', 'foco'],
};

interface Props { className?: string; compact?: boolean; }

export function MTWorkspaceBar({ className, compact = false }: Props) {
  const { mt, loading } = useActiveMT();

  if (loading || !mt) return null;

  const keys = (mt.priority_modules && mt.priority_modules.length > 0)
    ? mt.priority_modules
    : (AREA_DEFAULTS[mt.area] || ['dashboard', 'foco', 'rotina', 'crm']);

  const modules = keys.map(k => ({ key: k, ...MODULE_CATALOG[k] })).filter(m => !!m.label);
  if (modules.length === 0) return null;

  return (
    <Card className={cn('p-3 border-l-4', className)} style={{ borderLeftColor: mt.color || '#3B82F6' }}>
      <div className="flex items-center gap-2 mb-2">
        <div
          className="h-8 w-8 rounded-md flex items-center justify-center text-base shrink-0"
          style={{ backgroundColor: (mt.color || '#3B82F6') + '20', color: mt.color || '#3B82F6' }}
        >
          {mt.icon || '📋'}
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-xs text-muted-foreground">Área de Trabalho ativa</div>
          <div className="text-sm font-semibold truncate">
            {mt.name}
            {mt.target_role && <span className="text-muted-foreground font-normal"> · {mt.target_role}</span>}
          </div>
        </div>
        <Badge variant="secondary" className="text-[10px]">{mt.area}</Badge>
      </div>

      <div className={cn('grid gap-2', compact ? 'grid-cols-4 sm:grid-cols-6' : 'grid-cols-3 sm:grid-cols-4 md:grid-cols-6')}>
        {modules.map(m => {
          const Icon = m.icon;
          return (
            <Link
              key={m.key}
              to={m.path}
              className="group flex flex-col items-center justify-center gap-1 p-2 rounded-md border bg-card hover:bg-accent hover:border-primary/40 transition-colors text-center"
            >
              <Icon className="h-5 w-5 text-primary" />
              <span className="text-[11px] font-medium leading-tight line-clamp-2">{m.label}</span>
            </Link>
          );
        })}
      </div>
    </Card>
  );
}
