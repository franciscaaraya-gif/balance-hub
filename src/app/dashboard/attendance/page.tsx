"use client";

import { useState } from "react";
import { useUser, useFirestore, useCollection, useMemoFirebase } from "@/firebase";
import { createEvent, chargeEventToGroup } from "@/lib/firebase/store";
import { Event, Group } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PlusCircle, Calendar, Users, ChevronRight, Loader2, Coins, User, Clock, MapPin } from "lucide-react";
import Link from "next/link";
import { useToast } from "@/hooks/use-toast";
import { collection, query, where, orderBy } from "firebase/firestore";

export default function AttendanceDashboard() {
  const { user, isUserLoading } = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();
  
  const [open, setOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const [formData, setFormData] = useState({ 
    title: "", 
    date: "", 
    time: "", 
    location: "", 
    totalCost: "", 
    costConcept: "", 
    groupId: "",
    chargeAbsentees: false 
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
      where('participantIds', 'array-contains', user.uid),
      orderBy('createdAt', 'desc')
    );
  }, [firestore, user?.uid]);
  const { data: events, isLoading: eventsLoading } = useCollection<Event>(eventsQuery);

  const handleCreate = async () => {
    if (!formData.title || !formData.date || !formData.totalCost || !formData.costConcept || !formData.groupId || !user) {
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
        chargeAbsentees: formData.chargeAbsentees,
        groupId: formData.groupId,
        creatorId: user.uid,
        creatorName: user.displayName || 'Organizador'
      });
      
      toast({ title: "Evento creado", description: "Tu evento se ha registrado correctamente." });
      setOpen(false);
      setFormData({ 
        title: "", 
        date: "", 
        time: "", 
        location: "", 
        totalCost: "", 
        costConcept: "", 
        groupId: "", 
        chargeAbsentees: false 
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

  return (
    <div className="space-y-6 sm:space-y-10 max-w-6xl mx-auto pb-10">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="px-1">
          <h1 className="text-2xl sm:text-3xl font-headline font-bold text-primary">Asistencia y Eventos</h1>
          <p className="text-sm text-muted-foreground">Organiza tus partidos, controla la llegada y divide el arriendo.</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="bg-accent h-12 w-full md:w-auto px-6 rounded-2xl shadow-lg shadow-accent/20 font-bold">
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
                  <Input type="time" value={formData.time} onChange={e => setFormData({...formData, time: e.target.value})} className="rounded-xl h-11 text-xs" />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label className="text-[10px] uppercase font-black tracking-widest text-muted-foreground px-1">Monto Total ($)</Label>
                <Input type="number" placeholder="0.00" value={formData.totalCost} onChange={e => setFormData({...formData, totalCost: e.target.value})} className="rounded-xl font-bold h-11 text-sm" />
              </div>
              
              <div className="flex items-center justify-between p-4 bg-muted/40 rounded-xl mt-2 border border-muted">
                <div className="space-y-0.5">
                  <Label className="text-xs font-bold">Cobrar a Ausentes</Label>
                  <p className="text-[10px] text-muted-foreground">Si se apaga, solo pagan los que asistan.</p>
                </div>
                <Switch checked={formData.chargeAbsentees} onCheckedChange={(val) => setFormData({...formData, chargeAbsentees: val})} />
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

      <div className="grid gap-4 sm:gap-6 sm:grid-cols-2 lg:grid-cols-3 px-1">
        {eventsLoading ? (
          [1, 2, 3].map(i => <div key={i} className="h-40 rounded-[2rem] bg-muted animate-pulse" />)
        ) : events?.length === 0 ? (
          <div className="col-span-full py-20 flex flex-col items-center justify-center border-2 border-dashed rounded-[2.5rem] opacity-30 bg-muted/20">
             <Calendar className="h-12 w-12 mb-4 text-primary" />
             <p className="font-bold text-[10px] uppercase tracking-widest">Sin eventos registrados</p>
          </div>
        ) : (
          events?.map(event => (
            <Link key={event.id} href={`/dashboard/attendance/${event.id}`}>
              <Card className="hover:shadow-lg transition-all border-l-4 border-l-accent rounded-[2rem] group relative overflow-hidden bg-white shadow-sm">
                {event.isCharged && <div className="absolute top-0 right-0 p-1 bg-emerald-500 text-white rounded-bl-lg text-[9px] font-bold px-2 uppercase tracking-tighter">Liquidado</div>}
                <CardHeader className="pb-3 px-5">
                  <div className="flex justify-between items-start gap-2">
                    <div className="min-w-0">
                      <CardTitle className="text-base sm:text-lg font-headline group-hover:text-accent transition-colors truncate">{event.title}</CardTitle>
                      <div className="flex items-center gap-1.5 mt-1">
                        <User className="h-3 w-3 text-muted-foreground shrink-0" />
                        <span className="text-[10px] text-muted-foreground font-bold uppercase truncate">{event.creatorName}</span>
                      </div>
                    </div>
                    <Badge variant="outline" className="text-[9px] font-black shrink-0 px-2 rounded-lg">{event.date.split('-').reverse().slice(0,2).join('/')}</Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4 px-5 pb-5">
                  <div className="flex gap-3 text-[10px] text-muted-foreground font-medium">
                    <span className="flex items-center gap-1"><Clock className="h-3 w-3" /> {event.time}</span>
                    <span className="flex items-center gap-1"><MapPin className="h-3 w-3" /> {event.location || "Presencial"}</span>
                  </div>
                  
                  <div className="flex justify-between items-center pt-4 border-t text-[10px] font-black uppercase tracking-widest">
                    <span className="flex items-center gap-1.5 text-muted-foreground"><Users className="h-3.5 w-3.5" /> {event.presentIds?.length || 0} PRESENTES</span>
                    <span className="text-primary font-headline text-sm">${event.totalCost.toFixed(0)}</span>
                  </div>
                  
                  <div className="flex items-center justify-end text-[10px] font-black text-accent uppercase tracking-widest pt-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    Gestionar <ChevronRight className="h-3 w-3 ml-1" />
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))
        )}
      </div>
    </div>
  );
}
