
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
import { Calendar, MapPin, Clock, DollarSign, Users, UserPlus, Nfc, CheckCircle2, Circle, Loader2, Search, Zap, PlusCircle, AlertCircle, Share2, UserMinus, Plus, ShieldCheck, Coins, ArrowRight, User } from "lucide-react";
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
  const [isCharging, setIsCharging] = useState(false);
  const [scanningNfc, setScanningNfc] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
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

  // Efecto para sincronizar la lista de participantes mostrada
  useEffect(() => {
    if (event?.participantIds && event.participantIds.length > 0) {
      getGroupMembersDetails(event.participantIds).then(setParticipants);
    } else {
      setParticipants([]);
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
        // Buscar un usuario que NO esté presente aún
        const eligibleUsers = users.filter(u => !event?.presentIds.includes(u.uid));
        
        if (eligibleUsers.length > 0) {
          const randomUser = eligibleUsers[Math.floor(Math.random() * eligibleUsers.length)];
          await addAndMarkPresent(params.id, randomUser.uid);
          toast({ title: `Check-in NFC: ${randomUser.displayName}`, description: "Registrado y marcado presente." });
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
    <div className="space-y-6 max-w-5xl mx-auto pb-20 px-2 sm:px-4">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 bg-primary p-6 sm:p-8 rounded-[2rem] text-primary-foreground shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 p-4 opacity-10 hidden sm:block">
          <Calendar className="h-32 w-32 rotate-12" />
        </div>
        <div className="space-y-3 relative z-10">
          <div className="flex flex-wrap gap-2 items-center">
            <Badge className="bg-accent text-white border-none px-3 font-bold uppercase tracking-widest text-[10px]">{event.date}</Badge>
            {isAdmin && (
              <Badge variant="outline" className="border-white/20 text-white bg-white/10 text-[9px]">
                <ShieldCheck className="h-3 w-3 mr-1" /> Administrador
              </Badge>
            )}
          </div>
          <h1 className="text-3xl sm:text-4xl font-headline font-bold leading-tight">{event.title}</h1>
          <div className="flex flex-wrap gap-3 text-xs opacity-80 font-medium">
            <span className="flex items-center gap-1"><MapPin className="h-3.5 w-3.5" /> {event.location}</span>
            <span className="flex items-center gap-1"><Clock className="h-3.5 w-3.5" /> {event.time}</span>
            <span className="flex items-center gap-1"><User className="h-3.5 w-3.5" /> {event.creatorName || "Org"}</span>
          </div>
          {group && (
            <Link href={`/dashboard/groups/${group.id}`} className="inline-flex items-center gap-2 text-[10px] text-white/70 hover:text-white transition-colors mt-2">
              <Zap className="h-3 w-3" /> Grupo: <span className="underline font-bold">{group.name}</span> <ArrowRight className="h-3 w-3" />
            </Link>
          )}
        </div>
        <div className="bg-white/10 backdrop-blur-md p-5 rounded-[1.5rem] text-center min-w-[180px] border border-white/20 relative z-10 mt-4 sm:mt-0">
          <p className="text-[10px] uppercase tracking-[0.2em] font-black opacity-70 mb-1">Cuota p/p</p>
          <p className="text-3xl sm:text-4xl font-headline font-bold text-accent">${costPerPerson.toFixed(2)}</p>
          <p className="text-[9px] mt-2 opacity-60 font-bold flex items-center justify-center gap-1">
            <Users className="h-3 w-3" /> {totalPresent} PRESENTES
          </p>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        <Card className="md:col-span-2 shadow-sm border-none bg-white rounded-[2rem]">
          <CardHeader className="flex flex-col sm:flex-row items-start sm:items-center justify-between space-y-4 sm:space-y-0 pb-6 border-b border-muted">
            <div className="space-y-1">
              <CardTitle className="text-lg font-headline">Asistencia</CardTitle>
              <CardDescription className="text-xs">Gestiona asistentes e invitados.</CardDescription>
            </div>
            {isAdmin && (
              <div className="flex gap-2 w-full sm:w-auto">
                 <Button variant="outline" size="sm" className="flex-1 sm:flex-none h-10 px-4 font-bold rounded-xl" onClick={() => setAddingParticipant(true)}>
                   <Search className="h-4 w-4 mr-2" /> Buscar
                 </Button>
                 <Button variant="default" size="sm" className="flex-1 sm:flex-none bg-accent h-10 px-4 font-bold hover:bg-accent/90 rounded-xl shadow-lg shadow-accent/10" onClick={simulateNfcScan} disabled={scanningNfc}>
                   {scanningNfc ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Nfc className="h-4 w-4 mr-2" />} NFC
                 </Button>
              </div>
            )}
          </CardHeader>
          <CardContent className="pt-6 px-4 sm:px-6">
            <div className="space-y-3">
              {participants.length === 0 && (
                <div className="py-10 text-center space-y-2 opacity-40">
                  <Users className="h-10 w-10 mx-auto" />
                  <p className="text-xs font-bold uppercase tracking-widest">Sin asistentes registrados</p>
                </div>
              )}
              {participants.map(p => {
                const isPresent = event.presentIds?.includes(p.uid);
                const userGuests = event.externalGuests?.filter(g => g.addedBy === p.uid) || [];
                
                return (
                  <div key={p.uid} className="space-y-2 group">
                    <div className={cn(
                      "flex items-center justify-between py-3 px-3 sm:px-4 rounded-2xl transition-all border",
                      isPresent ? "bg-emerald-50 border-emerald-100 shadow-sm" : "bg-muted/10 border-transparent"
                    )}>
                      <div className="flex items-center gap-3">
                        <div className={cn(
                          "h-10 w-10 rounded-full flex items-center justify-center font-bold text-sm text-white shadow-sm transition-transform",
                          isPresent ? "bg-emerald-500 scale-105" : "bg-muted-foreground/30"
                        )}>
                          {p.displayName?.[0] || p.email?.[0]}
                        </div>
                        <div className="max-w-[120px] sm:max-w-none">
                          <p className="text-xs sm:text-sm font-bold truncate leading-none mb-1">{p.displayName}</p>
                          <p className="text-[9px] text-muted-foreground font-medium truncate">{p.email}</p>
                        </div>
                      </div>
                      <Button 
                        variant={isPresent ? "default" : "outline"} 
                        size="sm" 
                        disabled={!isAdmin && p.uid !== user?.uid}
                        className={cn(
                          "rounded-full gap-2 text-[10px] font-black h-8 transition-all px-3",
                          isPresent ? "bg-emerald-500 hover:bg-emerald-600 border-none" : "text-muted-foreground border-dashed border-2"
                        )}
                        onClick={() => handleTogglePresent(p.uid, !!isPresent)}
                      >
                        {isPresent ? <><CheckCircle2 className="h-3 w-3" /> Presente</> : <><Circle className="h-3 w-3" /> Ausente</>}
                      </Button>
                    </div>

                    {userGuests.map((guest, idx) => (
                      <div key={`${guest.name}-${idx}`} className="flex items-center justify-between py-2.5 px-4 ml-6 sm:ml-10 rounded-2xl bg-amber-50/50 border border-amber-100/50 animate-in slide-in-from-left-4">
                        <div className="flex items-center gap-3">
                          <div className="h-7 w-7 rounded-full flex items-center justify-center font-bold text-[9px] text-white shadow-sm bg-amber-500/70">
                            {guest.name[0]}
                          </div>
                          <div>
                            <p className="text-[11px] font-bold leading-none mb-0.5">{guest.name}</p>
                            <p className="text-[8px] text-amber-700/70 font-bold uppercase tracking-tighter">Acompañante de {p.displayName?.split(' ')[0]}</p>
                          </div>
                        </div>
                        {isAdmin && (
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-7 w-7 text-amber-600/50 hover:bg-amber-100 rounded-full"
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
          <Card className="border-none shadow-sm bg-white overflow-hidden rounded-[2rem]">
            <div className="h-1.5 bg-accent w-full" />
            <CardHeader className="pb-4">
              <CardTitle className="text-xs font-black uppercase tracking-[0.2em] flex items-center gap-2 text-primary">
                <Zap className="h-4 w-4 text-accent fill-accent" /> Liquidación
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex justify-between items-center text-xs font-bold">
                <span className="text-muted-foreground">Total Evento:</span>
                <span className="text-primary">${event.totalCost.toFixed(2)}</span>
              </div>
              <div className="flex justify-between items-center text-xs font-bold">
                <span className="text-muted-foreground">Cuota p/p:</span>
                <span className="text-accent">${costPerPerson.toFixed(2)}</span>
              </div>
              <div className="pt-4 border-t border-muted flex justify-between items-end">
                <div className="space-y-1">
                  <span className="text-[9px] font-black text-muted-foreground uppercase tracking-wider">Presentes Hoy</span>
                  <p className="text-3xl font-headline font-bold text-primary leading-none">{totalPresent}</p>
                </div>
              </div>
            </CardContent>
            {isAdmin && (
              <CardFooter className="pb-8">
                <Button 
                  disabled={event.isCharged || isCharging}
                  className="w-full text-[11px] font-black uppercase tracking-widest bg-primary hover:bg-primary/90 gap-2 h-12 rounded-2xl shadow-lg shadow-primary/10" 
                  onClick={handleChargeToGroup}
                >
                  {isCharging ? <Loader2 className="animate-spin h-4 w-4" /> : event.isCharged ? <><CheckCircle2 className="h-4 w-4" /> Cobros Listos</> : <><Coins className="h-4 w-4" /> Cargar al Grupo</>}
                </Button>
              </CardFooter>
            )}
          </Card>

          <div className="bg-white p-6 rounded-[2rem] shadow-sm border border-muted space-y-4">
             <div className="flex items-center gap-3 text-primary font-bold">
               <div className="bg-primary/10 p-2.5 rounded-2xl">
                 <Share2 className="h-5 w-5 text-primary" /> 
               </div>
               <span className="text-xs font-black uppercase tracking-[0.1em]">WhatsApp Link</span>
             </div>
             <p className="text-[10px] text-muted-foreground leading-relaxed font-bold uppercase tracking-tighter">
               Comparte este link para que tus amigos confirmen asistencia y sumen sus +1.
             </p>
             <Button variant="outline" className="w-full h-12 text-[10px] font-black uppercase tracking-widest border-2 border-primary text-primary hover:bg-primary/5 rounded-2xl" onClick={handleShare}>
               Copiar para WhatsApp
             </Button>
          </div>
        </div>
      </div>

      <Dialog open={addingParticipant} onOpenChange={setAddingParticipant}>
        <DialogContent className="max-w-md rounded-[2.5rem] border-none p-6 sm:p-8">
          <DialogHeader className="text-center pb-4">
            <DialogTitle className="text-2xl font-headline font-bold">Añadir Asistente</DialogTitle>
            <DialogDescription className="text-xs">Busca usuarios registrados por nombre o email.</DialogDescription>
          </DialogHeader>
          <div className="space-y-6 py-2">
            <div className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
              <Input className="pl-12 h-14 rounded-2xl bg-muted/30 border-none focus-visible:ring-primary text-sm" placeholder="Nombre o email..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
            </div>
            <div className="max-h-72 overflow-y-auto space-y-2 pr-2 scrollbar-hide">
              {filteredUsers.length === 0 && searchTerm && (
                <p className="text-center text-[10px] font-bold text-muted-foreground uppercase py-4">No se encontraron usuarios</p>
              )}
              {filteredUsers.map(u => (
                <div key={u.uid} className="flex items-center justify-between p-3 hover:bg-muted/50 rounded-[1.5rem] transition-all border border-transparent">
                  <div className="flex items-center gap-3 overflow-hidden">
                    <div className="h-10 w-10 shrink-0 rounded-full bg-primary/10 flex items-center justify-center font-bold text-xs text-primary">{u.displayName?.[0]}</div>
                    <div className="overflow-hidden">
                      <p className="text-xs font-bold truncate">{u.displayName}</p>
                      <p className="text-[9px] text-muted-foreground truncate">{u.email}</p>
                    </div>
                  </div>
                  <Button size="icon" variant="ghost" className="h-10 w-10 p-0 rounded-full hover:bg-primary hover:text-white shrink-0" onClick={() => handleAddUser(u.uid)}>
                    <PlusCircle className="h-6 w-6" />
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
