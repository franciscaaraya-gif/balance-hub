
"use client";

import { useState } from "react";
import { useUser, useFirestore, useCollection, useMemoFirebase } from "@/firebase";
import { createEvent, chargeEventToGroup } from "@/lib/firebase/store";
import { Event, Group } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PlusCircle, Calendar, MapPin, Clock, DollarSign, Loader2, ChevronRight, Users, AlertCircle, Coins, CheckCircle2, User } from "lucide-react";
import Link from "next/link";
import { useToast } from "@/hooks/use-toast";
import { collection, query, where } from "firebase/firestore";

export default function AttendanceDashboard() {
  const { user, isUserLoading } = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();
  
  const [open, setOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isCharging, setIsCharging] = useState<string | null>(null);
  
  const [formData, setFormData] = useState({
    title: "",
    date: "",
    time: "",
    location: "",
    totalCost: "",
    groupId: ""
  });

  const groupsQuery = useMemoFirebase(() => {
    if (!firestore || !user?.uid) return null;
    return query(collection(firestore, 'groups'), where('memberIds', 'array-contains', user.uid));
  }, [firestore, user?.uid]);
  const { data: groups } = useCollection<Group>(groupsQuery);

  const eventsQuery = useMemoFirebase(() => {
    if (!firestore || !user?.uid) return null;
    return query(
      collection(firestore, 'events'), 
      where('participantIds', 'array-contains', user.uid)
    );
  }, [firestore, user?.uid]);

  const { data: events, isLoading: eventsLoading, error: eventsError } = useCollection<Event>(eventsQuery);

  const handleCreate = async () => {
    if (!formData.title || !formData.date || !formData.totalCost || !formData.groupId || !user) {
      toast({ variant: "destructive", title: "Faltan datos", description: "El motivo, la fecha, el costo y el grupo son obligatorios." });
      return;
    }

    setIsSubmitting(true);
    try {
      await createEvent({
        title: formData.title,
        date: formData.date,
        time: formData.time,
        location: formData.location,
        totalCost: parseFloat(formData.totalCost),
        groupId: formData.groupId,
        creatorId: user.uid,
        creatorName: user.displayName || 'Organizador'
      });
      toast({ title: "Evento creado", description: "Ahora puedes marcar la asistencia." });
      setOpen(false);
      setFormData({ title: "", date: "", time: "", location: "", totalCost: "", groupId: "" });
    } catch (e) {
      toast({ variant: "destructive", title: "Error", description: "No se pudo crear el evento." });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleChargeToGroup = async (e: React.MouseEvent, eventId: string) => {
    e.preventDefault();
    e.stopPropagation();
    setIsCharging(eventId);
    try {
      await chargeEventToGroup(eventId);
      toast({ title: "¡Cobros Generados!", description: "Las deudas se han cargado al grupo correspondiente." });
    } catch (error: any) {
      toast({ variant: "destructive", title: "Error al cobrar", description: error.message });
    } finally {
      setIsCharging(null);
    }
  };

  if (isUserLoading) return <div className="flex justify-center py-20"><Loader2 className="animate-spin text-primary" /></div>;

  return (
    <div className="space-y-10 max-w-6xl mx-auto">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-headline font-bold text-primary">Asistencia y Eventos</h1>
          <p className="text-muted-foreground">Registra quién asistió y divide los costos fácilmente.</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="bg-accent hover:bg-accent/90 gap-2 h-12 px-6 shadow-lg shadow-accent/20">
              <PlusCircle className="h-5 w-5" /> Abrir Nueva Fecha
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Nuevo Evento / Reunión</DialogTitle>
              <DialogDescription>Completa los detalles para calcular la asistencia.</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Grupo de Cobro Asociado</Label>
                <Select onValueChange={(val) => setFormData({...formData, groupId: val})} value={formData.groupId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecciona un grupo" />
                  </SelectTrigger>
                  <SelectContent>
                    {groups?.map(g => (
                      <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-[10px] text-muted-foreground">Las deudas se cargarán automáticamente a este grupo.</p>
              </div>
              <div className="space-y-2">
                <Label>Motivo / Evento</Label>
                <Input placeholder="Ej: Padel con amigos, Asado" value={formData.title} onChange={e => setFormData({...formData, title: e.target.value})} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Fecha</Label>
                  <Input type="date" value={formData.date} onChange={e => setFormData({...formData, date: e.target.value})} />
                </div>
                <div className="space-y-2">
                  <Label>Hora</Label>
                  <Input type="time" value={formData.time} onChange={e => setFormData({...formData, time: e.target.value})} />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Lugar</Label>
                <div className="relative">
                  <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input className="pl-9" placeholder="Ej: Club de Tenis" value={formData.location} onChange={e => setFormData({...formData, location: e.target.value})} />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Costo Total del Evento ($)</Label>
                <div className="relative">
                  <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input type="number" className="pl-9 font-bold" placeholder="0.00" value={formData.totalCost} onChange={e => setFormData({...formData, totalCost: e.target.value})} />
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
              <Button onClick={handleCreate} disabled={isSubmitting}>
                {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : "Crear Evento"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {eventsError && (
        <div className="bg-destructive/10 text-destructive p-4 rounded-xl flex items-center gap-2 text-sm">
          <AlertCircle className="h-4 w-4" />
          Error al cargar eventos. Verifica la conexión.
        </div>
      )}

      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {eventsLoading ? (
          [1, 2, 3].map(i => <div key={i} className="h-40 rounded-xl bg-muted animate-pulse" />)
        ) : !events || events.length === 0 ? (
          <Card className="col-span-full border-dashed py-20 text-center flex flex-col items-center justify-center space-y-4">
             <Calendar className="h-12 w-12 text-muted-foreground opacity-20" />
             <p className="text-muted-foreground font-medium">Aún no has registrado eventos de asistencia.</p>
          </Card>
        ) : (
          events.map(event => {
            const isAdmin = event.creatorId === user?.uid;
            return (
              <Link key={event.id} href={`/dashboard/attendance/${event.id}`}>
                <Card className="hover:shadow-lg transition-all border-l-4 border-l-accent group relative overflow-hidden">
                  {event.isCharged && (
                    <div className="absolute top-0 right-0 p-1 bg-emerald-500 text-white rounded-bl-lg shadow-sm">
                      <CheckCircle2 className="h-4 w-4" />
                    </div>
                  )}
                  <CardHeader className="pb-3">
                    <div className="flex justify-between items-start">
                      <div className="space-y-1">
                        <CardTitle className="text-lg font-headline group-hover:text-accent transition-colors">{event.title}</CardTitle>
                        <p className="text-[10px] text-muted-foreground font-bold flex items-center gap-1">
                          <User className="h-2.5 w-2.5" /> Organizado por: {event.creatorName || "Invitado"}
                        </p>
                      </div>
                      <Badge variant="outline" className="text-[10px]">{event.date}</Badge>
                    </div>
                    <CardDescription className="flex items-center gap-1 mt-2"><MapPin className="h-3 w-3" /> {event.location || "Sin ubicación"}</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex justify-between items-center py-3 border-t">
                      <div className="text-xs text-muted-foreground font-bold flex items-center gap-1">
                        <Users className="h-3 w-3" /> {event.presentIds?.length || 0} presentes
                      </div>
                      <div className="text-sm font-bold text-primary">
                        Total: ${event.totalCost.toFixed(2)}
                      </div>
                    </div>
                    
                    {isAdmin && (
                      <Button 
                        disabled={event.isCharged || isCharging === event.id}
                        variant={event.isCharged ? "outline" : "default"}
                        className="w-full h-9 text-xs font-bold gap-2 shadow-inner"
                        onClick={(e) => handleChargeToGroup(e, event.id)}
                      >
                        {isCharging === event.id ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : event.isCharged ? (
                          <><CheckCircle2 className="h-3.5 w-3.5" /> Cobros Realizados</>
                        ) : (
                          <><Coins className="h-3.5 w-3.5" /> Cargar Deudas al Grupo</>
                        )}
                      </Button>
                    )}

                    <div className="flex items-center justify-end text-xs font-bold text-accent pt-2">
                      Ver Asistencia <ChevronRight className="h-3 w-3 ml-1" />
                    </div>
                  </CardContent>
                </Card>
              </Link>
            )
          })
        )}
      </div>
    </div>
  );
}

function Badge({ children, variant = "default", className }: { children: React.ReactNode, variant?: "default" | "outline", className?: string }) {
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${variant === 'outline' ? 'border border-border' : 'bg-primary text-primary-foreground'} ${className}`}>
      {children}
    </span>
  );
}
