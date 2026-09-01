
"use client";

import { useEffect, useState, use, useMemo } from "react";
import { useUser, useFirestore, useDoc, useMemoFirebase } from "@/firebase";
import { addParticipantToEvent, toggleAttendance, getGroupMembersDetails, getAllUsers, addAndMarkPresent } from "@/lib/firebase/store";
import { Event, UserProfile } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Calendar, MapPin, Clock, DollarSign, Users, UserPlus, Nfc, CheckCircle2, Circle, Loader2, Search, Zap, PlusCircle, AlertCircle } from "lucide-react";
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

  const { data: event, isLoading: eventLoading, error: eventError } = useDoc<Event>(eventRef);

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
      toast({ title: "Participante añadido", description: "Ahora puedes marcar su asistencia." });
      setSearchTerm("");
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
    setTimeout(async () => {
      try {
        // En una app real, esto detectaría un ID vía hardware. 
        // Aquí buscamos a alguien que NO esté presente, incluso si no está en la lista previa.
        const users = await getAllUsers();
        const eligibleUsers = users.filter(u => !event?.presentIds.includes(u.uid));
        
        if (eligibleUsers.length > 0) {
          const randomUser = eligibleUsers[Math.floor(Math.random() * eligibleUsers.length)];
          
          // Si el usuario no estaba inscrito, lo inscribimos y marcamos presente
          if (!event?.participantIds.includes(randomUser.uid)) {
            await addAndMarkPresent(params.id, randomUser.uid);
            toast({ title: `Nuevo Asistente (NFC): ${randomUser.displayName}`, description: "Registrado y marcado presente." });
          } else {
            await handleTogglePresent(randomUser.uid, false);
            toast({ title: `Check-in NFC: ${randomUser.displayName}`, description: "Asistencia confirmada." });
          }
        } else {
          toast({ variant: "destructive", title: "No se detectó nuevo usuario", description: "Todos ya están registrados." });
        }
      } catch (err) {
        toast({ variant: "destructive", title: "Error en NFC" });
      } finally {
        setScanningNfc(false);
      }
    }, 2000);
  };

  if (eventLoading) return <div className="h-full flex items-center justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  
  if (eventError || !event) return (
    <div className="p-8 text-center space-y-4">
      <AlertCircle className="h-12 w-12 text-destructive mx-auto opacity-50" />
      <h2 className="text-xl font-headline font-bold">Evento no encontrado</h2>
      <p className="text-muted-foreground">La fecha que buscas no existe o no tienes acceso.</p>
      <Button variant="outline" onClick={() => window.history.back()}>Volver</Button>
    </div>
  );

  const costPerPerson = (event.presentIds?.length || 0) > 0 ? event.totalCost / event.presentIds.length : 0;

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-20">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 bg-primary p-8 rounded-3xl text-primary-foreground shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 p-4 opacity-10">
          <Calendar className="h-32 w-32 rotate-12" />
        </div>
        <div className="space-y-2 relative z-10">
          <Badge className="bg-accent text-white border-none px-3 font-bold uppercase tracking-widest">{event.date}</Badge>
          <h1 className="text-4xl font-headline font-bold">{event.title}</h1>
          <div className="flex flex-wrap gap-4 text-sm opacity-80 font-medium">
            <span className="flex items-center gap-1"><MapPin className="h-4 w-4" /> {event.location}</span>
            <span className="flex items-center gap-1"><Clock className="h-4 w-4" /> {event.time}</span>
          </div>
        </div>
        <div className="bg-white/10 backdrop-blur-md p-6 rounded-2xl text-center min-w-[220px] border border-white/20 relative z-10">
          <p className="text-xs uppercase tracking-widest font-bold opacity-70 mb-1">Cuota por Persona</p>
          <p className="text-4xl font-headline font-bold text-accent">${costPerPerson.toFixed(2)}</p>
          <p className="text-[10px] mt-2 opacity-60 font-medium flex items-center justify-center gap-1">
            <Users className="h-3 w-3" /> {event.presentIds?.length || 0} PRESENTES
          </p>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        <Card className="md:col-span-2 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-7">
            <div>
              <CardTitle className="text-xl font-headline">Registro de Asistencia</CardTitle>
              <CardDescription>Confirma quiénes asistieron efectivamente.</CardDescription>
            </div>
            <div className="flex gap-2">
               <Button variant="outline" size="sm" className="h-9 px-4 font-bold" onClick={() => setAddingParticipant(true)}>
                 <UserPlus className="h-4 w-4 mr-2" /> Añadir
               </Button>
               <Button variant="default" size="sm" className="bg-accent h-9 px-4 font-bold" onClick={simulateNfcScan} disabled={scanningNfc}>
                 {scanningNfc ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Nfc className="h-4 w-4 mr-2" />} NFC
               </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-1">
              {participants.map(p => {
                const isPresent = event.presentIds?.includes(p.uid);
                return (
                  <div key={p.uid} className={cn(
                    "flex items-center justify-between py-3 px-4 rounded-2xl transition-all border border-transparent",
                    isPresent ? "bg-emerald-50 border-emerald-100" : "hover:bg-muted/50"
                  )}>
                    <div className="flex items-center gap-4">
                      <div className={cn(
                        "h-11 w-11 rounded-full flex items-center justify-center font-bold text-lg text-white shadow-sm transition-transform",
                        isPresent ? "bg-emerald-500 scale-105" : "bg-muted-foreground/30"
                      )}>
                        {p.displayName?.[0]}
                      </div>
                      <div>
                        <p className="text-sm font-bold leading-none mb-1">{p.displayName}</p>
                        <p className="text-[10px] text-muted-foreground font-medium">{p.email}</p>
                      </div>
                    </div>
                    <Button 
                      variant={isPresent ? "default" : "outline"} 
                      size="sm" 
                      className={cn(
                        "rounded-full gap-2 text-xs font-bold h-8 transition-all",
                        isPresent ? "bg-emerald-500 hover:bg-emerald-600 border-none px-4" : "text-muted-foreground border-dashed"
                      )}
                      onClick={() => handleTogglePresent(p.uid, !!isPresent)}
                    >
                      {isPresent ? <><CheckCircle2 className="h-3.5 w-3.5" /> Presente</> : <><Circle className="h-3.5 w-3.5" /> Ausente</>}
                    </Button>
                  </div>
                );
              })}
              {participants.length === 0 && (
                <div className="py-20 text-center space-y-3">
                  <div className="bg-muted w-16 h-16 rounded-full flex items-center justify-center mx-auto opacity-50">
                    <Users className="h-8 w-8 text-muted-foreground" />
                  </div>
                  <p className="text-muted-foreground font-medium italic">No hay personas inscritas. Usa "Añadir" o "NFC" para registrar.</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card className="border-primary/20 bg-primary/5 shadow-none overflow-hidden">
            <div className="h-1 bg-accent w-full" />
            <CardHeader className="pb-4">
              <CardTitle className="text-sm font-bold flex items-center gap-2 text-primary">
                <Zap className="h-4 w-4 text-accent fill-accent" /> Desglose de Costos
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex justify-between items-center text-xs font-medium">
                <span className="text-muted-foreground">Inversión Total:</span>
                <span className="font-bold text-primary">${event.totalCost.toFixed(2)}</span>
              </div>
              <div className="flex justify-between items-center text-xs font-medium">
                <span className="text-muted-foreground">Gente en el lugar:</span>
                <span className="font-bold text-primary">{event.presentIds?.length || 0}</span>
              </div>
              <div className="pt-4 border-t border-primary/10 flex justify-between items-end">
                <div className="space-y-1">
                  <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Deuda por Persona</span>
                  <p className="text-2xl font-headline font-bold text-primary">${costPerPerson.toFixed(2)}</p>
                </div>
              </div>
            </CardContent>
            <CardFooter>
              <Button className="w-full text-xs font-bold bg-primary hover:bg-primary/90" onClick={() => toast({ title: "Próximamente", description: "Esta función generará cobros automáticos en tus grupos." })}>
                Cargar Deudas al Grupo
              </Button>
            </CardFooter>
          </Card>

          <div className="bg-accent/10 p-6 rounded-3xl border border-accent/20 space-y-4 shadow-sm">
             <div className="flex items-center gap-3 text-accent font-bold">
               <div className="bg-accent/20 p-2 rounded-xl">
                 <Nfc className="h-5 w-5" /> 
               </div>
               <span className="text-sm font-headline uppercase tracking-wide">Check-in Inteligente</span>
             </div>
             <p className="text-xs text-accent/80 leading-relaxed font-medium">
               Usa el NFC para registrar personas al instante aunque no estén en la lista. El sistema agregará al usuario y recalculará los costos al momento.
             </p>
          </div>
        </div>
      </div>

      {/* MODAL: Añadir Participante */}
      <Dialog open={addingParticipant} onOpenChange={setAddingParticipant}>
        <DialogContent className="max-w-md rounded-3xl">
          <DialogHeader className="text-center pb-4">
            <DialogTitle className="text-2xl font-headline">Inscribir Integrante</DialogTitle>
            <DialogDescription>Busca personas registradas en BalanceHub para invitarlas.</DialogDescription>
          </DialogHeader>
          <div className="space-y-5 py-2">
            <div className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
              <Input className="pl-12 h-12 rounded-2xl bg-muted/30 border-none focus-visible:ring-primary" placeholder="Buscar por nombre o email..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
            </div>
            <div className="max-h-72 overflow-y-auto space-y-2 pr-2 scrollbar-hide">
              {filteredUsers.map(u => (
                <div key={u.uid} className="flex items-center justify-between p-3 hover:bg-muted/50 rounded-2xl transition-all group">
                  <div className="flex items-center gap-3">
                    <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center font-bold text-xs text-primary">{u.displayName?.[0]}</div>
                    <div>
                      <p className="text-xs font-bold leading-tight">{u.displayName}</p>
                      <p className="text-[10px] text-muted-foreground">{u.email}</p>
                    </div>
                  </div>
                  <Button size="sm" variant="ghost" className="h-8 w-8 p-0 rounded-full hover:bg-primary hover:text-white transition-colors" onClick={() => handleAddUser(u.uid)}>
                    <PlusCircle className="h-5 w-5" />
                  </Button>
                </div>
              ))}
              {searchTerm && filteredUsers.length === 0 && <p className="text-center text-xs text-muted-foreground py-10 font-medium">No se encontraron más usuarios registrados.</p>}
              {!searchTerm && <p className="text-center text-[10px] text-muted-foreground pt-4 uppercase tracking-widest font-bold">Escribe para buscar usuarios</p>}
            </div>
          </div>
          <DialogFooter className="sm:justify-center">
            <Button variant="ghost" className="text-muted-foreground font-bold" onClick={() => setAddingParticipant(false)}>Cerrar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* MODAL: Escaneo NFC (Simulación) */}
      <Dialog open={scanningNfc} onOpenChange={setScanningNfc}>
        <DialogContent className="max-w-xs text-center py-12 rounded-3xl border-none shadow-2xl">
          <div className="flex flex-col items-center gap-8">
            <div className={cn(
              "p-10 rounded-full bg-accent/10 border-4 border-accent border-dashed relative",
              scanningNfc && "animate-[spin_6s_linear_infinite]"
            )}>
              <Nfc className="h-20 w-20 text-accent" />
              <div className="absolute inset-0 bg-accent/5 rounded-full animate-ping" />
            </div>
            <div className="space-y-3">
              <h3 className="font-headline font-bold text-2xl text-primary">Detectando NFC</h3>
              <p className="text-sm text-muted-foreground font-medium">Acerca el dispositivo del invitado al sensor para el Check-in.</p>
            </div>
            <Loader2 className="h-6 w-6 animate-spin text-accent" />
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
