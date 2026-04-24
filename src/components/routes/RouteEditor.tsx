import { useState } from 'react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  arrayMove,
} from '@dnd-kit/sortable';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Navigation, Trash2, ChevronLeft, MapPin, Search } from 'lucide-react';
import { StopSortableItem } from './StopSortableItem';
import { AddStopDialog } from './AddStopDialog';
import { DeliveryProofDialog } from './DeliveryProofDialog';
import { ContactAddressPicker, type ContactAddress } from './ContactAddressPicker';
import { useDeliveryRoutes, type DeliveryRoute, type DeliveryStop } from '@/hooks/useDeliveryRoutes';

interface Props {
  route: DeliveryRoute;
  onBack: () => void;
}

export function RouteEditor({ route, onBack }: Props) {
  const { updateRoute, deleteRoute, addStop, deleteStop, reorderStops, completeStopWithProof } =
    useDeliveryRoutes();
  const [addOpen, setAddOpen] = useState(false);
  const [proofStop, setProofStop] = useState<DeliveryStop | null>(null);
  const [name, setName] = useState(route.name);
  const [driver, setDriver] = useState(route.driver_name || '');
  const [vehicle, setVehicle] = useState(route.vehicle || '');
  const [date, setDate] = useState(route.scheduled_date || '');
  const [origin, setOrigin] = useState(route.origin_address || '');
  const [status, setStatus] = useState(route.status);

  const stops = route.stops || [];
  const completed = stops.filter((s) => s.status === 'entregue').length;
  const failed = stops.filter((s) => s.status === 'falhou').length;

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const handleDragEnd = (e: DragEndEvent) => {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const oldIdx = stops.findIndex((s) => s.id === active.id);
    const newIdx = stops.findIndex((s) => s.id === over.id);
    const newOrder = arrayMove(stops, oldIdx, newIdx).map((s) => s.id);
    reorderStops(route.id, newOrder);
  };

  const openFullRoute = () => {
    if (stops.length === 0) return;
    const addresses = stops.map((s) =>
      [s.address, s.address_number, s.neighborhood, s.city, s.state].filter(Boolean).join(', ')
    );
    const origin_q = origin
      ? encodeURIComponent(origin)
      : encodeURIComponent(addresses[0]);
    const dest = encodeURIComponent(addresses[addresses.length - 1]);
    const waypoints = origin
      ? addresses.slice(0, -1).map(encodeURIComponent).join('|')
      : addresses.slice(1, -1).map(encodeURIComponent).join('|');
    const url = `https://www.google.com/maps/dir/?api=1&origin=${origin_q}&destination=${dest}${
      waypoints ? `&waypoints=${waypoints}` : ''
    }&travelmode=driving`;
    window.open(url, '_blank');
  };

  const saveHeader = () => {
    updateRoute(route.id, {
      name,
      driver_name: driver || null,
      vehicle: vehicle || null,
      scheduled_date: date || null,
      origin_address: origin || null,
      status,
    });
  };

  const handleDelete = async () => {
    if (!confirm('Excluir esta rota?')) return;
    await deleteRoute(route.id);
    onBack();
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" onClick={onBack}>
          <ChevronLeft className="h-5 w-5" />
        </Button>
        <h2 className="text-lg font-semibold flex-1 truncate">{route.name}</h2>
        <Button variant="outline" size="sm" onClick={openFullRoute} disabled={stops.length === 0}>
          <Navigation className="h-4 w-4 mr-1" />
          Abrir rota no Maps
        </Button>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <Label>Nome da rota</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} onBlur={saveHeader} />
            </div>
            <div>
              <Label>Status</Label>
              <Select value={status} onValueChange={(v: any) => { setStatus(v); updateRoute(route.id, { status: v }); }}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="planejada">Planejada</SelectItem>
                  <SelectItem value="em_andamento">Em andamento</SelectItem>
                  <SelectItem value="concluida">Concluída</SelectItem>
                  <SelectItem value="cancelada">Cancelada</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Data</Label>
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} onBlur={saveHeader} />
            </div>
            <div>
              <Label>Motorista</Label>
              <Input value={driver} onChange={(e) => setDriver(e.target.value)} onBlur={saveHeader} />
            </div>
            <div>
              <Label>Veículo</Label>
              <Input value={vehicle} onChange={(e) => setVehicle(e.target.value)} onBlur={saveHeader} placeholder="Placa, modelo..." />
            </div>
            <div className="md:col-span-2">
              <Label>Endereço de origem</Label>
              <OriginAddressField
                value={origin}
                onChange={(v) => {
                  setOrigin(v);
                  updateRoute(route.id, { origin_address: v || null });
                }}
              />
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-0 flex items-center gap-2 flex-wrap">
          <Badge variant="outline">{stops.length} parada{stops.length === 1 ? '' : 's'}</Badge>
          <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30">
            {completed} entregues
          </Badge>
          {failed > 0 && <Badge variant="destructive">{failed} falhou</Badge>}
          <Button variant="ghost" size="sm" className="ml-auto text-destructive" onClick={handleDelete}>
            <Trash2 className="h-4 w-4 mr-1" /> Excluir rota
          </Button>
        </CardContent>
      </Card>

      <div className="flex items-center justify-between">
        <h3 className="font-semibold flex items-center gap-2">
          <MapPin className="h-4 w-4" /> Paradas
        </h3>
        <Button size="sm" onClick={() => setAddOpen(true)}>
          <Plus className="h-4 w-4 mr-1" /> Adicionar
        </Button>
      </div>

      {stops.length === 0 ? (
        <div className="text-center text-sm text-muted-foreground py-8 border rounded-lg border-dashed">
          Nenhuma parada ainda. Clique em <span className="font-medium">Adicionar</span> para começar.
        </div>
      ) : (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={stops.map((s) => s.id)} strategy={verticalListSortingStrategy}>
            <div className="space-y-2">
              {stops.map((stop, idx) => (
                <StopSortableItem
                  key={stop.id}
                  stop={stop}
                  index={idx}
                  onComplete={() => setProofStop(stop)}
                  onDelete={() => deleteStop(stop.id)}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}

      <AddStopDialog
        open={addOpen}
        onOpenChange={setAddOpen}
        onAdd={(d) => addStop(route.id, d)}
      />

      {proofStop && (
        <DeliveryProofDialog
          open={!!proofStop}
          onOpenChange={(o) => !o && setProofStop(null)}
          stop={proofStop}
          onConfirm={(payload) => completeStopWithProof(proofStop.id, payload)}
        />
      )}
    </div>
  );
}
