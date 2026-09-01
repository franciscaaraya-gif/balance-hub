
"use client";

import { useEffect, useState, use, useMemo } from "react";
import { useUser, useFirestore, useDoc, useMemoFirebase } from "@/firebase";
import { addParticipantToEvent, toggleAttendance, getGroupMembersDetails, getAllUsers, addAndMarkPresent, addExternalGuest, removeExternalGuest, chargeEventToGroup } from "@/lib/firebase/store";
import { Event, UserProfile, ExternalGuest, Group } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Calendar, MapPin, Clock, DollarSign, Users, UserPlus, Nfc, CheckCircle2, Circle, Loader2, Search, Zap, PlusCircle, AlertCircle, Share2, UserMinus, Plus, ShieldCheck, Coins, ArrowRight } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { doc } from "firebase/firestore";
import { cn } from "@/lib/utils";
import Link from "next/link";

export default function EventAttendanceDetails({ params: paramsPromise }: { params: Promise<{ id: string }> }) {
  const params = use(paramsPromise);
  const { user } = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();

  const [addingParticipant, setAddingParticipant] = useState(false);
  const [addingGuest, setAddingGuest] = useState(false);
  const [scanningNfc, setScanningNfc] = useState(false);
  const [isCharging, setIsCharging] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [guestName, setGuestName] = useState("");
  const [allUsers, setAllUsers] = useState<UserProfile[]>([]);
  const [participants, setParticipants] = useState<UserProfile[]>([]);

  const eventRef = useMemoFirebase(() => {
    if (!firestore || !params.id) return null;
    return doc(firestore, 'events', params.id);
  }, [firestore, params.id]);

  const { data: event, isLoading: eventLoading, error: eventError } = useDoc<Event>(eventRef);

  const groupRef = useMemoFirebase(() => {
    if (!firestore || !event?.groupId) return null;
    return doc(firestore, 'groups', event.groupId);
  }, [firestore, event?.groupId]);
  const { data: group } = useDoc<Group>(groupRef);

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

  const handleChargeToGroup = async () => {
    setIsCharging(true);
    try {
      await chargeEventToGroup(params.id);
      toast({ title: "¡Éxito!", description: "Deudas cargadas al grupo." });
    } catch (error: any) {
      toast({ variant: "destructive", title: "Error", description: error.message });
    } finally {
      setIsCharging(false);
    }
  };

  const handleAddGuest = async () => {
    if (!guestName || !user) return;
    try {
      await addExternalGuest(params.id, guestName, user.uid);
      toast({ title: "Invitado añadido", description: `${guestName} se sumó a la cuenta.` });
      setGuestName("");
      setAddingGuest(false);
    } catch (e) {
      toast({ variant: "destructive", title: "Error al añadir invitado" });
    }
  };

  const handleRemoveGuest = async (guest: ExternalGuest) => {
    try {
      await removeExternalGuest(params.id, guest);
      toast({ title: "Invitado eliminado" });
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

  const handleShare = () => {
    if (!event?.shareLink) return;
    navigator.clipboard.writeText(event.shareLink);
    toast({ title: "Link copiado", description: "Envíalo por WhatsApp para que se inscriban." });
  };

  const simulateNfcScan = () => {
    setScanningNfc(true);
    setTimeout(async () => {
      try {
        const users = await getAllUsers();
        const eligibleUsers = users.filter(u => !event?.presentIds.includes(u.uid));
        
        if (eligibleUsers.length > 0) {
          const randomUser = eligibleUsers[Math.floor(Math.random() * eligibleUsers.length)];
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

  const totalPresent = (event.presentIds?.length || 0) + (event.externalGuests?.length || 0);
  const costPerPerson = totalPresent > 0 ? event.totalCost / totalPresent : 0;
  const isAdmin = event.creatorId === user?.uid;

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-20">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 bg-primary p-8 rounded-3xl text-primary-foreground shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 p-4 opacity-10">
          <Calendar className="h-32 w-32 rotate-12" />
        </div>
        <div className="space-y-2 relative z-10">
          <div className="flex gap-2 items-center">
            <Badge className="bg-accent text-white border-none px-3 font-bold uppercase tracking-widest">{event.date}</Badge>
            {isAdmin && (
              <Badge variant="outline" className="border-white/20 text-white bg-white/10 text-[10px]">
                <ShieldCheck className="h-3 w-3 mr-1" /> Administrador
              </Badge>
            )}
          </div>
          <h1 className="text-4xl font-headline font-bold">{event.title}</h1>
          <div className="flex flex-wrap gap-4 text-sm opacity-80 font-medium">
            <span className="flex items-center gap-1"><MapPin className="h-4 w-4" /> {event.location}</span>
            <span className="flex items-center gap-1"><Clock className="h-4 w-4" /> {event.time}</span>
          </div>
          {group && (
            <Link href={`/dashboard/groups/${group.id}`} className="inline-flex items-center gap-2 text-xs text-white/70 hover:text-white transition-colors mt-2">
              <Zap className="h-3 w-3" /> Asociado a Grupo: <span className="underline font-bold">{group.name}</span> <ArrowRight className="h-3 w-3" />
            </Link>
          )}
        </div>
        <div className="bg-white/10 backdrop-blur-md p-6 rounded-2xl text-center min-w-[220px] border border-white/20 relative z-10">
          <p className="text-xs uppercase tracking-widest font-bold opacity-70 mb-1">Cuota por Persona</p>
          <p className="text-4xl font-headline font-bold text-accent">${costPerPerson.toFixed(2)}</p>
          <p className="text-[10px] mt-2 opacity-60 font-medium flex items-center justify-center gap-1">
            <Users className="h-3 w-3" /> {totalPresent} PRESENTES (TOTAL)
          </p>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        <Card className="md:col-span-2 shadow-sm border-none bg-white">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-7 border-b border-muted">
            <div>
              <CardTitle className="text-xl font-headline">Gestión de Asistencia</CardTitle>
              <CardDescription>Lista completa de participantes e invitados (+1).</CardDescription>
            </div>
            {isAdmin && (
              <div className="flex gap-2">
                 <Button variant="outline" size="sm" className="h-9 px-4 font-bold border-muted-foreground/20" onClick={() => setAddingParticipant(true)}>
                   <Search className="h-4 w-4 mr-2" /> Buscar
                 </Button>
                 <Button variant="default" size="sm" className="bg-accent h-9 px-4 font-bold hover:bg-accent/90" onClick={simulateNfcScan} disabled={scanningNfc}>
                   {scanningNfc ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Nfc className="h-4 w-4 mr-2" />} NFC
                 </Button>
              </div>
            )}
          </CardHeader>
          <CardContent className="pt-6">
            <div className="space-y-4">
              {participants.map(p => {
                const isPresent = event.presentIds?.includes(p.uid);
                const userGuests = event.externalGuests?.filter(g => g.addedBy === p.uid) || [];
                
                return (
                  <div key={p.uid} className="space-y-2">
                    <div className={cn(
                      "flex items-center justify-between py-3 px-4 rounded-2xl transition-all border",
                      isPresent ? "bg-emerald-50 border-emerald-100" : "bg-muted/20 border-transparent hover:bg-muted/30"
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
                        disabled={!isAdmin && p.uid !== user?.uid}
                        className={cn(
                          "rounded-full gap-2 text-xs font-bold h-8 transition-all",
                          isPresent ? "bg-emerald-500 hover:bg-emerald-600 border-none px-4" : "text-muted-foreground border-dashed"
                        )}
                        onClick={() => handleTogglePresent(p.uid, !!isPresent)}
                      >
                        {isPresent ? <><CheckCircle2 className="h-3.5 w-3.5" /> Presente</> : <><Circle className="h-3.5 w-3.5" /> Ausente</>}
                      </Button>
                    </div>

                    {userGuests.map((guest, idx) => (
                      <div key={`${guest.name}-${idx}`} className="flex items-center justify-between py-2 px-4 ml-8 rounded-xl bg-amber-50/50 border border-amber-100/50">
                        <div className="flex items-center gap-3">
                          <div className="h-8 w-8 rounded-full flex items-center justify-center font-bold text-xs text-white shadow-sm bg-amber-500/70">
                            {guest.name[0]}
                          </div>
                          <div>
                            <p className="text-xs font-bold leading-none mb-1">{guest.name}</p>
                            <p className="text-[9px] text-amber-700/70 font-medium italic">Acompañante de {p.displayName}</p>
                          </div>
                        </div>
                        {isAdmin && (
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-7 w-7 text-amber-600/50 hover:bg-amber-100"
                            onClick={() => handleRemoveGuest(guest)}
                          >
                            <UserMinus className="h-3.5 w-3.5" />
                          </Button>
                        )}
                      </div>
                    ))}
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card className="border-none shadow-sm bg-white overflow-hidden">
            <div className="h-1 bg-accent w-full" />
            <CardHeader className="pb-4">
              <CardTitle className="text-sm font-bold flex items-center gap-2 text-primary">
                <Zap className="h-4 w-4 text-accent fill-accent" /> Resumen de Cobro
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex justify-between items-center text-xs font-medium">
                <span className="text-muted-foreground">Costo Total:</span>
                <span className="font-bold text-primary">${event.totalCost.toFixed(2)}</span>
              </div>
              <div className="flex justify-between items-center text-xs font-medium">
                <span className="text-muted-foreground">Cuota x Persona:</span>
                <span className="font-bold text-primary">${costPerPerson.toFixed(2)}</span>
              </div>
              <div className="pt-4 border-t border-muted flex justify-between items-end">
                <div className="space-y-1">
                  <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Presentes Hoy</span>
                  <p className="text-2xl font-headline font-bold text-primary">{totalPresent}</p>
                </div>
              </div>
            </CardContent>
            {isAdmin && (
              <CardFooter>
                <Button 
                  disabled={event.isCharged || isCharging}
                  className="w-full text-xs font-bold bg-primary hover:bg-primary/90 gap-2" 
                  onClick={handleChargeToGroup}
                >
                  {isCharging ? <Loader2 className="animate-spin h-3.5 w-3.5" /> : event.isCharged ? <><CheckCircle2 className="h-3.5 w-3.5" /> Deudas Cargadas</> : <><Coins className="h-3.5 w-3.5" /> Cargar al Grupo de Cobro</>}
                </Button>
              </CardFooter>
            )}
          </Card>

          <div className="bg-white p-6 rounded-3xl shadow-sm border border-muted space-y-4">
             <div className="flex items-center gap-3 text-primary font-bold">
               <div className="bg-primary/10 p-2 rounded-xl">
                 <Share2 className="h-5 w-5 text-primary" /> 
               </div>
               <span className="text-sm font-headline uppercase tracking-wide">Link de Asistencia</span>
             </div>
             <p className="text-xs text-muted-foreground leading-relaxed font-medium">
               Cualquier persona con este enlace puede confirmar su asistencia y añadir acompañantes (+1).
             </p>
             <Button variant="outline" className="w-full h-10 text-xs font-bold border-primary text-primary hover:bg-primary/5" onClick={handleShare}>
               Copiar Link para WhatsApp
             </Button>
          </div>
        </div>
      </div>

      <Dialog open={addingParticipant} onOpenChange={setAddingParticipant}>
        <DialogContent className="max-w-md rounded-3xl border-none">
          <DialogHeader className="text-center pb-4">
            <DialogTitle className="text-2xl font-headline">Añadir Asistente</DialogTitle>
            <DialogDescription>Busca usuarios registrados por nombre o email.</DialogDescription>
          </DialogHeader>
          <div className="space-y-5 py-2">
            <div className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
              <Input className="pl-12 h-12 rounded-2xl bg-muted/30 border-none focus-visible:ring-primary" placeholder="Nombre o email..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
            </div>
            <div className="max-h-72 overflow-y-auto space-y-2 pr-2">
              {filteredUsers.map(u => (
                <div key={u.uid} className="flex items-center justify-between p-3 hover:bg-muted/50 rounded-2xl transition-all border border-transparent">
                  <div className="flex items-center gap-3">
                    <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center font-bold text-xs text-primary">{u.displayName?.[0]}</div>
                    <div>
                      <p className="text-xs font-bold">{u.displayName}</p>
                      <p className="text-[10px] text-muted-foreground">{u.email}</p>
                    </div>
                  </div>
                  <Button size="sm" variant="ghost" className="h-8 w-8 p-0 rounded-full hover:bg-primary hover:text-white" onClick={() => handleAddUser(u.uid)}>
                    <PlusCircle className="h-5 w-5" />
                  </Button>
                </div>
              ))}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
