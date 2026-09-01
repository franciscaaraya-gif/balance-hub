
"use client";

import { useEffect, useState, use, useMemo } from "react";
import { useUser, useFirestore, useDoc, useMemoFirebase } from "@/firebase";
import { addParticipantToEvent, toggleAttendance, getGroupMembersDetails, getAllUsers } from "@/lib/firebase/store";
import { Event, UserProfile } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Calendar, MapPin, Clock, DollarSign, Users, UserPlus, Nfc, CheckCircle2, Circle, Loader2, Search, Zap, PlusCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { doc } from "firebase/firestore";
import { cn } from "@/lib/utils";

export default function EventAttendanceDetails({ params: paramsPromise }: { params: Promise<{ id: string }> }) {
  const params = use(paramsPromise);
  const { user } = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();

  const [addingParticipant, setAddingParticipant] = useState(false);
  const [scanningNfc, setScanningNfc] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [allUsers, setAllUsers] = useState<UserProfile[]>([]);
  const [participants, setParticipants] = useState<UserProfile[]>([]);

  const eventRef = useMemoFirebase(() => {
    if (!firestore || !params.id) return null;
    return doc(firestore, 'events', params.id);
  }, [firestore, params.id]);

  const { data: event, isLoading: eventLoading } = useDoc<Event>(eventRef);

  useEffect(() => {
    if (event?.participantIds) {
      getGroupMembersDetails(event.participantIds).then(setParticipants);
    }
  }, [event?.participantIds]);

  useEffect(() => {
    if (addingParticipant) {
      getAllUsers().then(setAllUsers);
    }
  }, [addingParticipant]);

  const filteredUsers = useMemo(() => {
    if (!allUsers) return [];
    return allUsers.filter(u => 
      !event?.participantIds.includes(u.uid) && 
      (u.displayName?.toLowerCase().includes(searchTerm.toLowerCase()) || 
       u.email?.toLowerCase().includes(searchTerm.toLowerCase()))
    );
  }, [allUsers, event?.participantIds, searchTerm]);

  const handleAddUser = async (uid: string) => {
    try {
      await addParticipantToEvent(params.id, uid);
      toast({ title: "Participante añadido" });
    } catch (e) {
      toast({ variant: "destructive", title: "Error" });
    }
  };

  const handleTogglePresent = async (uid: string, currentPresent: boolean) => {
    try {
      await toggleAttendance(params.id, uid, !currentPresent);
    } catch (e) {
      toast({ variant: "destructive", title: "Error al marcar asistencia" });
    }
  };

  const simulateNfcScan = () => {
    setScanningNfc(true);
    // Simulamos un retraso de escaneo
    setTimeout(() => {
      // Tomamos un usuario al azar de los que no están presentes para simular la detección
      const absentOnes = participants.filter(p => !event?.presentIds.includes(p.uid));
      if (absentOnes.length > 0) {
        const randomUser = absentOnes[Math.floor(Math.random() * absentOnes.length)];
        handleTogglePresent(randomUser.uid, false);
        toast({ title: `NFC Detectado: ${randomUser.displayName}`, description: "Asistencia marcada." });
      } else {
        toast({ variant: "destructive", title: "No se detectó nuevo usuario", description: "Todos los participantes ya están marcados." });
      }
      setScanningNfc(false);
    }, 2000);
  };

  if (eventLoading) return <div className="h-full flex items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  if (!event) return <div className="p-8 text-center">Evento no encontrado.</div>;

  const costPerPerson = event.presentIds?.length > 0 ? event.totalCost / event.presentIds.length : 0;

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 bg-primary p-8 rounded-3xl text-primary-foreground shadow-xl">
        <div className="space-y-2">
          <Badge className="bg-accent text-white border-none px-3">{event.date}</Badge>
          <h1 className="text-4xl font-headline font-bold">{event.title}</h1>
          <div className="flex flex-wrap gap-4 text-sm opacity-80">
            <span className="flex items-center gap-1"><MapPin className="h-4 w-4" /> {event.location}</span>
            <span className="flex items-center gap-1"><Clock className="h-4 w-4" /> {event.time}</span>
          </div>
        </div>
        <div className="bg-white/10 backdrop-blur-md p-6 rounded-2xl text-center min-w-[200px] border border-white/20">
          <p className="text-xs uppercase tracking-widest font-bold opacity-70 mb-1">Costo por persona</p>
          <p className="text-4xl font-headline font-bold text-accent">${costPerPerson.toFixed(2)}</p>
          <p className="text-[10px] mt-2 opacity-50">Basado en {event.presentIds?.length || 0} presentes</p>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        <Card className="md:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-xl font-headline">Lista de Asistencia</CardTitle>
              <CardDescription>Marca a los presentes o usa NFC para registrar.</CardDescription>
            </div>
            <div className="flex gap-2">
               <Button variant="outline" size="sm" onClick={() => setAddingParticipant(true)}>
                 <UserPlus className="h-4 w-4 mr-2" /> Añadir
               </Button>
               <Button variant="default" size="sm" className="bg-accent" onClick={simulateNfcScan} disabled={scanningNfc}>
                 {scanningNfc ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Nfc className="h-4 w-4 mr-2" />} NFC
               </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="divide-y">
              {participants.map(p => {
                const isPresent = event.presentIds?.includes(p.uid);
                return (
                  <div key={p.uid} className={cn(
                    "flex items-center justify-between py-4 transition-colors px-2 rounded-xl",
                    isPresent ? "bg-emerald-50/50" : "hover:bg-muted/30"
                  )}>
                    <div className="flex items-center gap-3">
                      <div className={cn(
                        "h-10 w-10 rounded-full flex items-center justify-center font-bold text-white shadow-sm",
                        isPresent ? "bg-emerald-500" : "bg-muted-foreground/30"
                      )}>
                        {p.displayName?.[0]}
                      </div>
                      <div>
                        <p className="text-sm font-bold">{p.displayName}</p>
                        <p className="text-[10px] text-muted-foreground">{p.email}</p>
                      </div>
                    </div>
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      className={cn(
                        "rounded-full gap-2",
                        isPresent ? "text-emerald-600 hover:text-emerald-700 bg-emerald-100" : "text-muted-foreground"
                      )}
                      onClick={() => handleTogglePresent(p.uid, !!isPresent)}
                    >
                      {isPresent ? <><CheckCircle2 className="h-4 w-4" /> Presente</> : <><Circle className="h-4 w-4" /> Ausente</>}
                    </Button>
                  </div>
                );
              })}
              {participants.length === 0 && (
                <div className="py-10 text-center text-muted-foreground italic">No hay participantes aún. Añade algunos arriba.</div>
              )}
            </div>
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card className="border-primary/20 bg-primary/5">
            <CardHeader>
              <CardTitle className="text-sm font-bold flex items-center gap-2">
                <Zap className="h-4 w-4 text-accent" /> Resumen Financiero
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex justify-between items-center text-xs">
                <span className="text-muted-foreground">Costo Total:</span>
                <span className="font-bold">${event.totalCost.toFixed(2)}</span>
              </div>
              <div className="flex justify-between items-center text-xs">
                <span className="text-muted-foreground">Asistentes:</span>
                <span className="font-bold">{event.presentIds?.length || 0}</span>
              </div>
              <div className="pt-3 border-t flex justify-between items-center">
                <span className="text-sm font-bold">Cuota:</span>
                <span className="text-lg font-bold text-primary">${costPerPerson.toFixed(2)}</span>
              </div>
            </CardContent>
            <CardFooter>
              <Button className="w-full text-xs" variant="outline" onClick={() => toast({ title: "Próximamente", description: "Esta función generará deudas automáticamente en los grupos." })}>
                Generar Cobros Automáticos
              </Button>
            </CardFooter>
          </Card>

          <div className="bg-accent/10 p-6 rounded-3xl border border-accent/20 space-y-3">
             <div className="flex items-center gap-2 text-accent font-bold">
               <Nfc className="h-5 w-5" /> 
               <span className="text-sm font-headline">Tecnología NFC</span>
             </div>
             <p className="text-[10px] text-accent/80 leading-relaxed font-medium">
               Acerca los teléfonos para registrar la asistencia al instante. Esta función divide el costo total dinámicamente según quiénes hayan hecho "Check-in".
             </p>
          </div>
        </div>
      </div>

      {/* MODAL: Añadir Participante */}
      <Dialog open={addingParticipant} onOpenChange={setAddingParticipant}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Añadir Integrante</DialogTitle>
            <DialogDescription>Busca personas para invitarlas a este evento.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input className="pl-9" placeholder="Nombre o email..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
            </div>
            <div className="max-h-60 overflow-y-auto space-y-2 pr-2">
              {filteredUsers.map(u => (
                <div key={u.uid} className="flex items-center justify-between p-2 hover:bg-muted rounded-lg transition-colors">
                  <div className="flex items-center gap-2">
                    <div className="h-7 w-7 rounded-full bg-primary/10 flex items-center justify-center font-bold text-[10px]">{u.displayName?.[0]}</div>
                    <div>
                      <p className="text-xs font-bold">{u.displayName}</p>
                      <p className="text-[8px] text-muted-foreground">{u.email}</p>
                    </div>
                  </div>
                  <Button size="sm" variant="ghost" onClick={() => handleAddUser(u.uid)}>
                    <PlusCircle className="h-4 w-4" />
                  </Button>
                </div>
              ))}
              {filteredUsers.length === 0 && <p className="text-center text-xs text-muted-foreground py-4">No se encontraron más usuarios.</p>}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* MODAL: Escaneo NFC (Simulación) */}
      <Dialog open={scanningNfc} onOpenChange={setScanningNfc}>
        <DialogContent className="max-w-xs text-center py-10">
          <div className="flex flex-col items-center gap-6">
            <div className={cn(
              "p-8 rounded-full bg-accent/10 border-4 border-accent border-dashed animate-[spin_4s_linear_infinite]",
              scanningNfc && "opacity-100"
            )}>
              <Nfc className="h-16 w-16 text-accent" />
            </div>
            <div className="space-y-2">
              <h3 className="font-headline font-bold text-xl">Escaneando NFC...</h3>
              <p className="text-xs text-muted-foreground">Acerca el dispositivo del usuario al sensor de tu teléfono.</p>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
