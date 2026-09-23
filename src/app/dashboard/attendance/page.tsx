"use client";

import { useState, useEffect, Suspense } from "react";
import { useUser, useFirestore, useCollection, useMemoFirebase } from "@/firebase";
import { createEvent, getGroupMembersDetails } from "@/lib/firebase/store";
import { Event, Group, UserProfile } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { 
  PlusCircle, Calendar, Users, ChevronRight, 
  Loader2, User, Clock, MapPin, Archive
} from "lucide-react";
import Link from "next/link";
import { useToast } from "@/hooks/use-toast";
import { collection, query, where, orderBy } from "firebase/firestore";
import { Carousel, CarouselContent, CarouselItem, CarouselNext, CarouselPrevious } from "@/components/ui/carousel";
import { useSearchParams } from "next/navigation";

function AttendanceContent() {
  const { user, isUserLoading } = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();
  const searchParams = useSearchParams();
  
  const [open, setOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [groupMembers, setGroupMembers] = useState<UserProfile[]>([]);
  
  const [formData, setFormData] = useState({ 
    title: "", 
    date: "", 
    time: "12:00", 
    location: "", 
    totalCost: "", 
    costConcept: "", 
    groupId: "",
    creditorId: ""
  });

  const [selectedHour, setSelectedHour] = useState("12");
  const [selectedMinute, setSelectedMinute] = useState("00");

  useEffect(() => {
    if (user?.uid && !formData.creditorId) {
      setFormData(prev => ({ ...prev, creditorId: user.uid }));
    }
  }, [user, formData.creditorId]);

  useEffect(() => {
    const isDup = searchParams.get('dup') === 'true';
    if (isDup) {
      const time = searchParams.get('time') || "12:00";
      const [h, m] = time.split(':');
      
      setFormData({
        title: searchParams.get('title') || "",
        date: "",
        time: time,
        location: searchParams.get('location') || "",
        totalCost: searchParams.get('cost') || "",
        costConcept: searchParams.get('concept') || "",
        groupId: searchParams.get('groupId') || "",
        creditorId: user?.uid || ""
      });
      setSelectedHour(h || "12");
      setSelectedMinute(m || "00");
      setOpen(true);
    }
  }, [searchParams, user]);

  useEffect(() => {
    setFormData(prev => ({ ...prev, time: `${selectedHour}:${selectedMinute}` }));
  }, [selectedHour, selectedMinute]);

  const groupsQuery = useMemoFirebase(() => {
    if (!firestore || !user?.uid) return null;
    return query(collection(firestore, 'groups'), where('memberIds', 'array-contains', user.uid));
  }, [firestore, user?.uid]);
  const { data: groups } = useCollection<Group>(groupsQuery);

  useEffect(() => {
    if (formData.groupId && groups) {
      const group = groups.find(g => g.id === formData.groupId);
      if (group?.memberIds) {
        getGroupMembersDetails(group.memberIds).then(setGroupMembers);
      }
    } else {
      setGroupMembers([]);
    }
  }, [formData.groupId, groups]);

  const groupIds = groups?.map(g => g.id) || [];
  const groupIdsKey = groupIds.join(',');

  const eventsQuery = useMemoFirebase(() => {
    if (!firestore || !user?.uid || groupIds.length === 0) return null;
    return query(
      collection(firestore, 'events'), 
      where('groupId', 'in', groupIds),
      orderBy('createdAt', 'desc')
    );
  }, [firestore, user?.uid, groupIdsKey]);
  const { data: events } = useCollection<Event>(eventsQuery);

  const activeEvents = events?.filter(e => !e.isCharged) || [];

  const handleCreate = async () => {
    if (!formData.title || !formData.date || !formData.totalCost || !formData.costConcept || !formData.groupId || !formData.creditorId || !user) {
      toast({ variant: "destructive", title: "Faltan datos", description: "Por favor completa todos los campos obligatorios." });
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
        costConcept: formData.costConcept,
        chargeAbsentees: true,
        groupId: formData.groupId,
        creditorId: formData.creditorId,
        creatorId: user.uid,
        creatorName: user.displayName || 'Organizador'
      });
      
      toast({ title: "Evento creado", description: "Tu evento se ha registrado correctamente." });
      setOpen(false);
      setFormData({ 
        title: "", 
        date: "", 
        time: "12:00", 
        location: "", 
        totalCost: "", 
        costConcept: "", 
        groupId: "",
        creditorId: user.uid
      });
    } catch (e: any) {
      toast({ 
        variant: "destructive", 
        title: "Error al crear evento", 
        description: e.message || "Ocurrió un error al intentar guardar." 
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isUserLoading) return <div className="flex justify-center py-20"><Loader2 className="animate-spin text-primary" /></div>;

  const hours = Array.from({ length: 24 }, (_, i) => i.toString().padStart(2, '0'));
  const minutes = ["00", "15", "30", "45"];

  return (
    <div className="space-y-6 sm:space-y-10 max-w-6xl mx-auto pb-10 px-2 sm:px-4">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="px-1">
          <h1 className="text-2xl sm:text-3xl font-headline font-bold text-primary">Asistencia y Eventos</h1>
          <p className="text-sm text-muted-foreground">Organiza tus fechas y controla la llegada. Todos los anotados entran en la división.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" asChild className="h-12 rounded-2xl font-bold gap-2">
            <Link href="/dashboard/attendance/archived">
              <Archive className="h-5 w-5" /> Archivados
            </Link>
          </Button>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button className="bg-accent h-12 flex-1 md:flex-none px-6 rounded-2xl shadow-lg shadow-accent/20 font-bold text-white">
                <PlusCircle className="h-5 w-5 mr-2" /> Nueva Fecha
              </Button>
            </DialogTrigger>
            <DialogContent className="w-[95vw] sm:max-w-md rounded-[2rem] border-none p-6 sm:p-8 mx-auto overflow-y-auto max-h-[90vh]">
              <DialogHeader><DialogTitle className="text-xl sm:text-2xl font-headline">Nuevo Evento</DialogTitle></DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-1.5">
                  <Label className="text-[10px] uppercase font-black tracking-widest text-muted-foreground px-1">Grupo de pago</Label>
                  <Select onValueChange={(val) => setFormData({...formData, groupId: val})} value={formData.groupId}>
                    <SelectTrigger className="rounded-xl h-11 text-xs"><SelectValue placeholder="Selecciona un grupo" /></SelectTrigger>
                    <SelectContent>{groups?.map(g => <SelectItem key={g.id} value={g.id} className="text-xs">{g.name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-[10px] uppercase font-black tracking-widest text-muted-foreground px-1">¿Quién pagó el evento? (Acreedor)</Label>
                  <Select onValueChange={(val) => setFormData({...formData, creditorId: val})} value={formData.creditorId}>
                    <SelectTrigger className="rounded-xl h-11 text-xs">
                      <SelectValue placeholder="Selecciona el acreedor" />
                    </SelectTrigger>
                    <SelectContent>
                      {groupMembers.length > 0 ? (
                        groupMembers.map(m => (
                          <SelectItem key={m.uid} value={m.uid} className="text-xs">
                            {m.displayName} {m.uid === user?.uid ? "(Tú)" : ""}
                          </SelectItem>
                        ))
                      ) : (
                        <SelectItem value={user?.uid || ""} disabled className="text-xs">
                          {user?.displayName || "Cargando miembros..."} (Tú)
                        </SelectItem>
                      )}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-[10px] uppercase font-black tracking-widest text-muted-foreground px-1">Título</Label>
                  <Input placeholder="Ej: Padel de los Miércoles" value={formData.title} onChange={e => setFormData({...formData, title: e.target.value})} className="rounded-xl h-11 text-sm" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-[10px] uppercase font-black tracking-widest text-muted-foreground px-1">Concepto del Costo</Label>
                  <Input placeholder="Ej: Arriendo Cancha 2 + Luces" value={formData.costConcept} onChange={e => setFormData({...formData, costConcept: e.target.value})} className="rounded-xl h-11 text-sm" />
                </div>
                <div className="grid grid-cols-2 gap-3 sm:gap-4">
                  <div className="space-y-1.5">
                    <Label className="text-[10px] uppercase font-black tracking-widest text-muted-foreground px-1">Fecha</Label>
                    <Input type="date" value={formData.date} onChange={e => setFormData({...formData, date: e.target.value})} className="rounded-xl h-11 text-xs" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-[10px] uppercase font-black tracking-widest text-muted-foreground px-1">Hora</Label>
                    <div className="flex gap-2">
                      <Select value={selectedHour} onValueChange={setSelectedHour}>
                        <SelectTrigger className="rounded-xl h-11 text-xs flex-1">
                          <SelectValue placeholder="HH" />
                        </SelectTrigger>
                        <SelectContent>
                          {hours.map(h => <SelectItem key={h} value={h} className="text-xs">{h}</SelectItem>)}
                        </SelectContent>
                      </Select>
                      <Select value={selectedMinute} onValueChange={setSelectedMinute}>
                        <SelectTrigger className="rounded-xl h-11 text-xs flex-1">
                          <SelectValue placeholder="MM" />
                        </SelectTrigger>
                        <SelectContent>
                          {minutes.map(m => <SelectItem key={m} value={m} className="text-xs">{m}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-[10px] uppercase font-black tracking-widest text-muted-foreground px-1">Monto Total ($)</Label>
                  <Input type="number" placeholder="0.00" value={formData.totalCost} onChange={e => setFormData({...formData, totalCost: e.target.value})} className="rounded-xl font-bold h-11 text-sm" />
                </div>
                
                <div className="bg-primary/5 p-4 rounded-xl mt-2 border border-primary/10">
                  <p className="text-[10px] text-muted-foreground leading-relaxed font-medium">
                    Info: En Zygos, todos los participantes que no sean eliminados de la lista antes del cobro pagarán su parte por igual.
                  </p>
                </div>
              </div>
              <DialogFooter className="flex-col sm:flex-row gap-2">
                <Button variant="ghost" className="rounded-xl h-11" onClick={() => setOpen(false)}>Cancelar</Button>
                <Button onClick={handleCreate} disabled={isSubmitting} className="rounded-xl px-8 h-11 font-bold shadow-md">
                  {isSubmitting ? <Loader2 className="animate-spin" /> : "Crear Evento"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="px-1 relative">
        <h2 className="text-[10px] uppercase font-black tracking-widest text-muted-foreground mb-4 border-l-2 border-accent pl-2">Eventos Activos</h2>
        {eventsLoading ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[1, 2, 3, 4].map(i => <div key={i} className="h-48 rounded-[2rem] bg-muted animate-pulse" />)}
          </div>
        ) : activeEvents.length === 0 ? (
          <div className="py-20 flex flex-col items-center justify-center border-2 border-dashed rounded-[2.5rem] opacity-30 bg-muted/20">
             <Calendar className="h-12 w-12 mb-4 text-primary" />
             <p className="font-bold text-[10px] uppercase tracking-widest">Sin eventos activos</p>
          </div>
        ) : activeEvents.length <= 4 ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {activeEvents.map(event => <EventCard key={event.id} event={event} />)}
          </div>
        ) : (
          <Carousel opts={{ align: "start" }} className="w-full">
            <CarouselContent className="-ml-4">
              {activeEvents.map((event) => (
                <CarouselItem key={event.id} className="pl-4 sm:basis-1/2 lg:basis-1/4">
                  <EventCard event={event} />
                </CarouselItem>
              ))}
            </CarouselContent>
            <div className="hidden sm:block">
              <CarouselPrevious className="-left-6 rounded-xl h-10 w-10 border-2" />
              <CarouselNext className="-right-6 rounded-xl h-10 w-10 border-2" />
            </div>
          </Carousel>
        )}
      </div>
    </div>
  );
}

function EventCard({ event }: { event: Event }) {
  return (
    <Link href={`/dashboard/attendance/${event.id}`}>
      <Card className="hover:shadow-lg transition-all border-l-4 border-l-accent rounded-[2rem] group relative overflow-hidden bg-white shadow-sm h-full flex flex-col">
        <CardHeader className="pb-3 px-5">
          <div className="flex justify-between items-start gap-2">
            <div className="min-w-0">
              <CardTitle className="text-base font-headline group-hover:text-accent transition-colors truncate">{event.title}</CardTitle>
              <div className="flex items-center gap-1.5 mt-1">
                <User className="h-3 w-3 text-muted-foreground shrink-0" />
                <span className="text-[10px] text-muted-foreground font-bold uppercase truncate">{event.creatorName}</span>
              </div>
            </div>
            <Badge variant="outline" className="text-[9px] font-black shrink-0 px-2 rounded-lg">{event.date.split('-').reverse().slice(0,2).join('/')}</Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4 px-5 pb-5 flex-1 flex flex-col justify-between">
          <div className="flex flex-col gap-2 text-[10px] text-muted-foreground font-medium">
            <span className="flex items-center gap-1"><Clock className="h-3 w-3" /> {event.time}</span>
            <span className="flex items-center gap-1"><MapPin className="h-3 w-3" /> {event.location || "Presencial"}</span>
          </div>
          
          <div className="pt-4 border-t space-y-2 mt-auto">
            <div className="flex justify-between items-center text-[10px] font-black uppercase tracking-widest">
              <span className="flex items-center gap-1.5 text-muted-foreground"><Users className="h-3.5 w-3.5" /> {event.participantIds?.length || 0} ANOTADOS</span>
              <span className="text-primary font-headline text-sm">${event.totalCost.toFixed(0)}</span>
            </div>
            
            <div className="flex items-center justify-end text-[10px] font-black text-accent uppercase tracking-widest pt-1 opacity-0 group-hover:opacity-100 transition-opacity">
              Gestionar <ChevronRight className="h-3 w-3 ml-1" />
            </div>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}

export default function AttendanceDashboard() {
  return (
    <Suspense fallback={<div className="flex justify-center py-20"><Loader2 className="animate-spin text-primary" /></div>}>
      <AttendanceContent />
    </Suspense>
  );
}
