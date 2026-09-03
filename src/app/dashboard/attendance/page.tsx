
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
import { PlusCircle, Calendar, MapPin, Clock, DollarSign, Loader2, ChevronRight, Users, CheckCircle2, Coins, User } from "lucide-react";
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
  
  const [formData, setFormData] = useState({ title: "", date: "", time: "", location: "", totalCost: "", groupId: "" });

  const groupsQuery = useMemoFirebase(() => {
    if (!firestore || !user?.uid) return null;
    return query(collection(firestore, 'groups'), where('memberIds', 'array-contains', user.uid));
  }, [firestore, user?.uid]);
  const { data: groups } = useCollection<Group>(groupsQuery);

  const eventsQuery = useMemoFirebase(() => {
    if (!firestore || !user?.uid) return null;
    return query(collection(firestore, 'events'), where('participantIds', 'array-contains', user.uid));
  }, [firestore, user?.uid]);
  const { data: events, isLoading: eventsLoading } = useCollection<Event>(eventsQuery);

  const handleCreate = async () => {
    if (!formData.title || !formData.date || !formData.totalCost || !formData.groupId || !user) {
      toast({ variant: "destructive", title: "Faltan datos", description: "Por favor completa todos los campos obligatorios." });
      return;
    }
    setIsSubmitting(true);
    try {
      // Llamada no bloqueante según guías
      createEvent({
        title: formData.title,
        date: formData.date,
        time: formData.time,
        location: formData.location,
        totalCost: parseFloat(formData.totalCost),
        groupId: formData.groupId,
        creatorId: user.uid,
        creatorName: user.displayName || 'Organizador'
      });
      
      toast({ title: "Evento creado", description: "Tu evento se está sincronizando con el servidor." });
      setOpen(false);
      setFormData({ title: "", date: "", time: "", location: "", totalCost: "", groupId: "" });
    } catch (e: any) {
      console.error("Error al crear evento:", e);
      toast({ 
        variant: "destructive", 
        title: "Error al crear evento", 
        description: e.message || "Ocurrió un error inesperado al intentar guardar el evento." 
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCharge = async (e: React.MouseEvent, id: string) => {
    e.preventDefault();
    setIsCharging(id);
    try {
      await chargeEventToGroup(id);
      toast({ title: "Cobros liquidados" });
    } catch (err: any) {
      toast({ variant: "destructive", title: "Error", description: err.message });
    } finally {
      setIsCharging(null);
    }
  };

  if (isUserLoading) return <div className="flex justify-center py-20"><Loader2 className="animate-spin text-primary" /></div>;

  return (
    <div className="space-y-10 max-w-6xl mx-auto">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-headline font-bold text-primary">Asistencia</h1>
          <p className="text-muted-foreground">Gestiona tus eventos y costos compartidos.</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="bg-accent h-12 px-6 rounded-2xl shadow-lg shadow-accent/20">
              <PlusCircle className="h-5 w-5 mr-2" /> Nueva Fecha
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md rounded-[2.5rem] border-none p-8">
            <DialogHeader><DialogTitle>Nuevo Evento</DialogTitle></DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-1">
                <Label>Grupo</Label>
                <Select onValueChange={(val) => setFormData({...formData, groupId: val})} value={formData.groupId}>
                  <SelectTrigger className="rounded-xl"><SelectValue placeholder="Selecciona un grupo" /></SelectTrigger>
                  <SelectContent>{groups?.map(g => <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1"><Label>Motivo</Label><Input placeholder="Ej: Padel" value={formData.title} onChange={e => setFormData({...formData, title: e.target.value})} className="rounded-xl" /></div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1"><Label>Fecha</Label><Input type="date" value={formData.date} onChange={e => setFormData({...formData, date: e.target.value})} className="rounded-xl" /></div>
                <div className="space-y-1"><Label>Hora</Label><Input type="time" value={formData.time} onChange={e => setFormData({...formData, time: e.target.value})} className="rounded-xl" /></div>
              </div>
              <div className="space-y-1"><Label>Costo Total ($)</Label><Input type="number" placeholder="0.00" value={formData.totalCost} onChange={e => setFormData({...formData, totalCost: e.target.value})} className="rounded-xl font-bold" /></div>
            </div>
            <DialogFooter className="gap-2">
              <Button variant="ghost" onClick={() => setOpen(false)}>Cancelar</Button>
              <Button onClick={handleCreate} disabled={isSubmitting} className="rounded-xl px-8">
                {isSubmitting ? <Loader2 className="animate-spin" /> : "Crear"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {eventsLoading ? (
          [1, 2, 3].map(i => <div key={i} className="h-40 rounded-[2rem] bg-muted animate-pulse" />)
        ) : events?.length === 0 ? (
          <Card className="col-span-full border-dashed py-20 flex flex-col items-center justify-center opacity-30 rounded-[2.5rem]">
             <Calendar className="h-12 w-12 mb-4" /><p className="font-bold text-xs uppercase tracking-widest">Sin eventos registrados</p>
          </Card>
        ) : (
          events?.map(event => (
            <Link key={event.id} href={`/dashboard/attendance/${event.id}`}>
              <Card className="hover:shadow-lg transition-all border-l-4 border-l-accent rounded-[2rem] group relative overflow-hidden bg-white">
                {event.isCharged && <div className="absolute top-0 right-0 p-1 bg-emerald-500 text-white rounded-bl-lg"><CheckCircle2 className="h-4 w-4" /></div>}
                <CardHeader className="pb-3">
                  <div className="flex justify-between items-start">
                    <div className="space-y-1">
                      <CardTitle className="text-lg font-headline group-hover:text-accent transition-colors">{event.title}</CardTitle>
                      <p className="text-[10px] text-muted-foreground font-bold flex items-center gap-1"><User className="h-2.5 w-2.5" /> {event.creatorName}</p>
                    </div>
                    <Badge variant="outline" className="text-[9px] rounded-lg">{event.date}</Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex justify-between items-center py-3 border-t text-[10px] font-bold">
                    <span className="flex items-center gap-1"><Users className="h-3.5 w-3.5" /> {event.presentIds?.length || 0} PRESENTES</span>
                    <span className="text-primary">${event.totalCost.toFixed(2)}</span>
                  </div>
                  {event.creatorId === user?.uid && !event.isCharged && (
                    <Button 
                      disabled={isCharging === event.id}
                      className="w-full h-9 rounded-xl text-[10px] font-black uppercase tracking-widest bg-primary gap-2"
                      onClick={(e) => handleCharge(e, event.id)}
                    >
                      {isCharging === event.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <><Coins className="h-3.5 w-3.5" /> Liquidar Cobros</>}
                    </Button>
                  )}
                  <div className="flex items-center justify-end text-[10px] font-black text-accent uppercase tracking-widest pt-1">
                    Ver Detalles <ChevronRight className="h-3 w-3 ml-1" />
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

function Badge({ children, variant = "default", className }: { children: React.ReactNode, variant?: "default" | "outline", className?: string }) {
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${variant === 'outline' ? 'border border-border text-muted-foreground' : 'bg-primary text-primary-foreground'} ${className}`}>
      {children}
    </span>
  );
}
