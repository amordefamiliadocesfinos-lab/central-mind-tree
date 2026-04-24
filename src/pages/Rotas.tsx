import { useMemo, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, MapPin, Truck, Calendar, Search, Navigation } from 'lucide-react';
import { useDeliveryRoutes, type DeliveryRoute } from '@/hooks/useDeliveryRoutes';
import { RouteEditor } from '@/components/routes/RouteEditor';
import { formatDisplayDate } from '@/lib/dateUtils';

export default function Rotas() {
  const { routes, loading, createRoute } = useDeliveryRoutes();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [tab, setTab] = useState<'todas' | 'avulsa' | 'fixa'>('todas');

  const [newName, setNewName] = useState('');
  const [newType, setNewType] = useState<'avulsa' | 'fixa'>('avulsa');
  const [newDate, setNewDate] = useState(new Date().toISOString().slice(0, 10));

  const filtered = useMemo(() => {
    return routes.filter((r) => {
      if (tab !== 'todas' && r.route_type !== tab) return false;
      if (search && !r.name.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    });
  }, [routes, tab, search]);

  const selected = routes.find((r) => r.id === selectedId) || null;

  const handleCreate = async () => {
    if (!newName.trim()) return;
    const r = await createRoute({
      name: newName,
      route_type: newType,
      scheduled_date: newType === 'avulsa' ? newDate : null,
    });
    setNewName('');
    setCreateOpen(false);
    if (r) setSelectedId(r.id);
  };

  if (selected) {
    return (
      <div className="container mx-auto p-3 md:p-6 pb-24 max-w-3xl">
        <RouteEditor route={selected} onBack={() => setSelectedId(null)} />
      </div>
    );
  }

  return (
    <div className="container mx-auto p-3 md:p-6 pb-24 max-w-5xl">
      <div className="flex items-center justify-between mb-4 gap-2 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Truck className="h-6 w-6" /> Rotas de entrega
          </h1>
          <p className="text-sm text-muted-foreground">
            Planeje rotas, navegue pelo Google Maps e registre entregas com foto e assinatura.
          </p>
        </div>
        <Button onClick={() => setCreateOpen(true)}>
          <Plus className="h-4 w-4 mr-1" /> Nova rota
        </Button>
      </div>

      <div className="flex items-center gap-2 mb-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar rota..."
            className="pl-9"
          />
        </div>
      </div>

      <Tabs value={tab} onValueChange={(v) => setTab(v as any)}>
        <TabsList className="grid grid-cols-3 max-w-md">
          <TabsTrigger value="todas">Todas</TabsTrigger>
          <TabsTrigger value="avulsa">Do dia</TabsTrigger>
          <TabsTrigger value="fixa">Fixas</TabsTrigger>
        </TabsList>

        <TabsContent value={tab} className="mt-4">
          {loading ? (
            <div className="text-center text-muted-foreground py-8">Carregando...</div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-12 border border-dashed rounded-lg">
              <Truck className="h-10 w-10 mx-auto text-muted-foreground mb-2" />
              <p className="text-muted-foreground">Nenhuma rota cadastrada</p>
              <Button className="mt-3" onClick={() => setCreateOpen(true)}>
                <Plus className="h-4 w-4 mr-1" /> Criar primeira rota
              </Button>
            </div>
          ) : (
            <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
              {filtered.map((r) => (
                <RouteCard key={r.id} route={r} onOpen={() => setSelectedId(r.id)} />
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nova rota</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Nome *</Label>
              <Input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="Ex: Entregas Centro - 24/04"
                autoFocus
              />
            </div>
            <div>
              <Label>Tipo</Label>
              <Select value={newType} onValueChange={(v) => setNewType(v as any)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="avulsa">Rota do dia</SelectItem>
                  <SelectItem value="fixa">Rota fixa (recorrente)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {newType === 'avulsa' && (
              <div>
                <Label>Data</Label>
                <Input type="date" value={newDate} onChange={(e) => setNewDate(e.target.value)} />
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setCreateOpen(false)}>Cancelar</Button>
            <Button onClick={handleCreate} disabled={!newName.trim()}>Criar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function RouteCard({ route, onOpen }: { route: DeliveryRoute; onOpen: () => void }) {
  const stops = route.stops || [];
  const completed = stops.filter((s) => s.status === 'entregue').length;
  const pending = stops.filter((s) => s.status === 'pendente').length;
  const progress = stops.length > 0 ? Math.round((completed / stops.length) * 100) : 0;

  const statusColor =
    route.status === 'concluida'
      ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30'
      : route.status === 'em_andamento'
      ? 'bg-blue-500/15 text-blue-700 dark:text-blue-300 border-blue-500/30'
      : route.status === 'cancelada'
      ? 'bg-destructive/15 text-destructive border-destructive/30'
      : 'bg-muted text-muted-foreground';

  const openInMaps = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (stops.length === 0) return;
    const addresses = stops.map((s) =>
      [s.address, s.address_number, s.neighborhood, s.city, s.state].filter(Boolean).join(', ')
    );
    const origin_q = route.origin_address
      ? encodeURIComponent(route.origin_address)
      : encodeURIComponent(addresses[0]);
    const dest = encodeURIComponent(addresses[addresses.length - 1]);
    const waypoints = route.origin_address
      ? addresses.slice(0, -1).map(encodeURIComponent).join('|')
      : addresses.slice(1, -1).map(encodeURIComponent).join('|');
    const url = `https://www.google.com/maps/dir/?api=1&origin=${origin_q}&destination=${dest}${
      waypoints ? `&waypoints=${waypoints}` : ''
    }&travelmode=driving`;
    window.open(url, '_blank');
  };

  return (
    <Card
      className="cursor-pointer hover:shadow-md transition-shadow"
      onClick={onOpen}
    >
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-2 mb-2">
          <h3 className="font-semibold truncate flex-1">{route.name}</h3>
          <Badge variant="outline" className={statusColor}>
            {route.status === 'em_andamento' ? 'Em andamento' :
             route.status === 'concluida' ? 'Concluída' :
             route.status === 'cancelada' ? 'Cancelada' : 'Planejada'}
          </Badge>
        </div>

        <div className="text-xs text-muted-foreground space-y-1">
          {route.scheduled_date && (
            <div className="flex items-center gap-1">
              <Calendar className="h-3 w-3" />
              {formatDisplayDate(route.scheduled_date)}
            </div>
          )}
          {route.driver_name && (
            <div className="flex items-center gap-1">
              <Truck className="h-3 w-3" />
              {route.driver_name} {route.vehicle && `· ${route.vehicle}`}
            </div>
          )}
          <div className="flex items-center gap-1">
            <MapPin className="h-3 w-3" />
            {stops.length} parada{stops.length === 1 ? '' : 's'} · {pending} pendente{pending === 1 ? '' : 's'}
          </div>
        </div>

        {stops.length > 0 && (
          <>
            <div className="mt-3 h-1.5 rounded-full bg-muted overflow-hidden">
              <div
                className="h-full bg-emerald-500 transition-all"
                style={{ width: `${progress}%` }}
              />
            </div>
            <div className="flex items-center justify-between mt-1">
              <span className="text-[10px] text-muted-foreground">{progress}% concluído</span>
              <Button
                size="sm"
                variant="ghost"
                className="h-7 text-xs"
                onClick={openInMaps}
              >
                <Navigation className="h-3 w-3 mr-1" /> Maps
              </Button>
            </div>
          </>
        )}

        <Badge variant="secondary" className="mt-2 text-[10px]">
          {route.route_type === 'fixa' ? 'Fixa' : 'Do dia'}
        </Badge>
      </CardContent>
    </Card>
  );
}
