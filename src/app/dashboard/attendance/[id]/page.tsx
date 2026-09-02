
"use client";

import { useEffect, useState, use, useMemo } from "react";
import { useUser, useFirestore, useDoc, useMemoFirebase } from "@/firebase";
import { addParticipantToEvent, toggleAttendance, getGroupMembersDetails, getAllUsers, toggleGuestPresence, removeExternalGuest, chargeEventToGroup, addExternalGuest, removeParticipantFromEvent } from "@/lib/firebase/store";
import { Event, UserProfile, ExternalGuest, Group } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar, MapPin, Clock, DollarSign, Users, UserPlus, QrCode, CheckCircle2, Circle, Loader2, Search, Zap, PlusCircle, AlertCircle, Share2, UserMinus, Plus, ShieldCheck, Coins, ArrowRight, User, CheckCircle, Trash2, XCircle } from "lucide-react";
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
  const [addingNonEnrolled, setAddingNonEnrolled] = useState(false);
  const [isCharging, setIsCharging] = useState(false);
  const [showQr, setShowQr] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [allUsers, setAllUsers] = useState<UserProfile[]>([]);
  const [participants, setParticipants] = useState<UserProfile[]>([]);
  
  // States for "Add Person without Registering"
  const [newGuestName, setNewGuestName] = useState("");
  const [guestResponsibleUid, setGuestResponsibleUid] = useState("");

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

  const handleAddQuickGuest = async () => {
    if (!newGuestName || !guestResponsibleUid) return;
    try {
      await addExternalGuest(params.id, newGuestName, guestResponsibleUid);
      // Mark as present immediately since they just arrived
      await toggleGuestPresence(params.id, newGuestName, guestResponsibleUid, true);
      toast({ title: "Persona añadida", description: "Se ha registrado como asistente presente." });
      setNewGuestName("");
      setAddingNonEnrolled(false);
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

  const handleRemoveParticipant = async (uid: string) => {
    if (event?.isCharged) return;
    try {
      await removeParticipantFromEvent(params.id, uid);
      toast({ title: "Participante eliminado" });
    } catch (e) {
      toast({ variant: "destructive", title: "Error" });
    }
  };

  const handleTogglePresent = async (uid: string, currentPresent: boolean) => {
    if (event?.isCharged) return;
    try {
      await toggleAttendance(params.id, uid, !currentPresent);
    } catch (e) {
      toast({ variant: "destructive", title: "Error al marcar asistencia" });
    }
  };

  const handleToggleGuest = async (guest: ExternalGuest) => {
    if (event?.isCharged) return;
    try {
      await toggleGuestPresence(params.id, guest.name, guest.addedBy, !guest.present);
    } catch (e) {
      toast({ variant: "destructive", title: "Error" });
    }
  };

  const handleRemoveGuest = async (guest: ExternalGuest) => {
    if (event?.isCharged) return;
    try {
      await removeExternalGuest(params.id, guest);
      toast({ title: "Invitado eliminado" });
    } catch (e) {
      toast({ variant: "destructive", title: "Error" });
    }
  };

  const handleShare = () => {
    if (!event?.shareLink) return;
    navigator.clipboard.writeText(event.shareLink);
    toast({ title: "Link copiado", description: "Envíalo por WhatsApp para que se inscriban." });
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

  const totalPresent = (event.presentIds?.length || 0) + (event.externalGuests?.filter(g => g.present).length || 0);
  const costPerPerson = totalPresent > 0 ? event.totalCost / totalPresent : 0;
  const isAdmin = event.creatorId === user?.uid;

  const checkInUrl = `${window.location.origin}/attendance/check-in/${event.id}?token=${event.checkInToken}`;
  const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(checkInUrl)}`;

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
                <ShieldCheck className="h-3 w-3 mr-1" /> Panel Admin (En Vivo)
              </Badge>
            )}
          </div>
          <h1 className="text-3xl sm:text-4xl font-headline font-bold leading-tight">{event.title}</h1>
          <div className="flex flex-wrap gap-3 text-xs opacity-80 font-medium">
            <span className="flex items-center gap-1"><MapPin className="h-3.5 w-3.5" /> {event.location}</span>
            <span className="flex items-center gap-1"><Clock className="h-3.5 w-3.5" /> {event.time}</span>
            <span className="flex items-center gap-1"><User className="h-3.5 w-3.5" /> {event.creatorName}</span>
          </div>
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
              <CardTitle className="text-lg font-headline">Asistencia en Vivo</CardTitle>
              <CardDescription className="text-xs">Marca quién llegó realmente al lugar.</CardDescription>
            </div>
            {isAdmin && !event.isCharged && (
              <div className="flex gap-2 w-full sm:w-auto overflow-x-auto pb-1 sm:pb-0">
                 <Button variant="outline" size="sm" className="shrink-0 h-10 px-4 font-bold rounded-xl" onClick={() => setAddingNonEnrolled(true)}>
                   <PlusCircle className="h-4 w-4 mr-2" /> Añadir Sin Cta
                 </Button>
                 <Button variant="default" size="sm" className="shrink-0 bg-accent h-10 px-4 font-bold hover:bg-accent/90 rounded-xl shadow-lg shadow-accent/10" onClick={() => setShowQr(true)}>
                   <QrCode className="h-4 w-4 mr-2" /> Mostrar QR
                 </Button>
              </div>
            )}
          </CardHeader>
          <CardContent className="pt-6 px-4 sm:px-6">
            <div className="space-y-4">
              {participants.length === 0 && (
                <div className="py-20 text-center space-y-4 opacity-40">
                  <Users className="h-16 w-16 mx-auto text-muted-foreground" />
                  <div>
                    <p className="text-sm font-black uppercase tracking-widest">Sin asistentes registrados</p>
                    <p className="text-[10px] mt-1">Comparte el link para que se anoten.</p>
                  </div>
                </div>
              )}
              {participants.map(p => {
                const isPresent = event.presentIds?.includes(p.uid);
                const userGuests = event.externalGuests?.filter(g => g.addedBy === p.uid) || [];
                
                return (
                  <div key={p.uid} className="space-y-3 group">
                    <div className={cn(
                      "flex items-center justify-between py-4 px-4 rounded-3xl transition-all border",
                      isPresent ? "bg-emerald-50 border-emerald-100 shadow-sm" : "bg-muted/10 border-transparent"
                    )}>
                      <div className="flex items-center gap-3">
                        <div className={cn(
                          "h-12 w-12 rounded-full flex items-center justify-center font-bold text-sm text-white shadow-sm transition-transform",
                          isPresent ? "bg-emerald-500 scale-105" : "bg-muted-foreground/30"
                        )}>
                          {p.displayName?.[0] || p.email?.[0]}
                        </div>
                        <div className="max-w-[120px] sm:max-w-none">
                          <p className="text-sm font-bold truncate leading-none mb-1">{p.displayName}</p>
                          <p className="text-[10px] text-muted-foreground font-medium truncate">{p.email}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {!event.isCharged && (
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive/40 hover:text-destructive rounded-full" onClick={() => handleRemoveParticipant(p.uid)}>
                            <XCircle className="h-4 w-4" />
                          </Button>
                        )}
                        <Button 
                          variant={isPresent ? "default" : "outline"} 
                          size="sm" 
                          disabled={event.isCharged}
                          className={cn(
                            "rounded-full gap-2 text-[10px] font-black h-9 transition-all px-4",
                            isPresent ? "bg-emerald-500 hover:bg-emerald-600 border-none" : "text-muted-foreground border-dashed border-2"
                          )}
                          onClick={() => handleTogglePresent(p.uid, !!isPresent)}
                        >
                          {isPresent ? <><CheckCircle2 className="h-4 w-4" /> Presente</> : <><Circle className="h-4 w-4" /> Ausente</>}
                        </Button>
                      </div>
                    </div>

                    {userGuests.map((guest, idx) => (
                      <div key={`${guest.name}-${idx}`} className={cn(
                        "flex items-center justify-between py-3 px-4 ml-8 sm:ml-12 rounded-[1.5rem] border transition-all animate-in slide-in-from-left-4",
                        guest.present ? "bg-emerald-50/50 border-emerald-100/50" : "bg-amber-50/50 border-amber-100/50"
                      )}>
                        <div className="flex items-center gap-3">
                          <div className={cn(
                            "h-8 w-8 rounded-full flex items-center justify-center font-bold text-[10px] text-white shadow-sm",
                            guest.present ? "bg-emerald-500/70" : "bg-amber-500/70"
                          )}>
                            {guest.name[0]}
                          </div>
                          <div>
                            <p className="text-[11px] font-bold leading-none mb-0.5">{guest.name}</p>
                            <p className="text-[8px] text-muted-foreground font-bold uppercase tracking-tight">Cargo de {p.displayName?.split(' ')[0]}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {!event.isCharged && (
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              className="h-7 w-7 text-destructive/30 hover:bg-destructive/10 hover:text-destructive rounded-full"
                              onClick={() => handleRemoveGuest(guest)}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          )}
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            disabled={event.isCharged}
                            className={cn("h-7 w-7 rounded-full", guest.present ? "text-emerald-500" : "text-muted-foreground/30")}
                            onClick={() => handleToggleGuest(guest)}
                          >
                            {guest.present ? <CheckCircle className="h-5 w-5" /> : <Circle className="h-5 w-5" />}
                          </Button>
                        </div>
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
                <span className="text-muted-foreground">Cuota p/Cabeza:</span>
                <span className="text-accent">${costPerPerson.toFixed(2)}</span>
              </div>
              <div className="pt-4 border-t border-muted flex justify-between items-end">
                <div className="space-y-1">
                  <span className="text-[9px] font-black text-muted-foreground uppercase tracking-wider">Cabezas Presentes</span>
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
               Envía este link para RSVP. Podrán confirmar asistencia y sumar sus +1.
             </p>
             <Button variant="outline" className="w-full h-12 text-[10px] font-black uppercase tracking-widest border-2 border-primary text-primary hover:bg-primary/5 rounded-2xl" onClick={handleShare}>
               Copiar para WhatsApp
             </Button>
          </div>
        </div>
      </div>

      {/* QR DIALOG */}
      <Dialog open={showQr} onOpenChange={setShowQr}>
        <DialogContent className="max-w-md rounded-[2.5rem] border-none p-8 text-center">
          <DialogHeader className="pb-6">
            <DialogTitle className="text-2xl font-headline font-bold">Check-in QR</DialogTitle>
            <DialogDescription className="text-xs uppercase font-bold tracking-widest mt-1">
              Escanea con tu cámara al llegar
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col items-center space-y-6">
            <div className="bg-white p-6 rounded-[2rem] shadow-xl border-2 border-primary/10">
              <img src={qrCodeUrl} alt="QR Check-in" className="w-64 h-64 object-contain" />
            </div>
            <div className="space-y-2">
              <p className="text-sm font-bold text-primary">{event.title}</p>
              <p className="text-[10px] text-muted-foreground uppercase font-black tracking-widest leading-relaxed">
                Cada usuario registrado que escanee esto quedará marcado como "Presente" instantáneamente.
              </p>
            </div>
          </div>
          <DialogFooter className="pt-4">
            <Button className="w-full h-12 rounded-2xl font-bold" onClick={() => setShowQr(false)}>
              Cerrar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ADD NON-ENROLLED PERSON DIALOG */}
      <Dialog open={addingNonEnrolled} onOpenChange={setAddingNonEnrolled}>
        <DialogContent className="max-w-md rounded-[2.5rem] border-none p-8">
          <DialogHeader className="text-center pb-4">
            <DialogTitle className="text-2xl font-headline font-bold">Añadir Persona</DialogTitle>
            <DialogDescription className="text-xs">Para alguien que llegó sin inscribirse.</DialogDescription>
          </DialogHeader>
          <div className="space-y-6 py-2">
            <div className="space-y-4">
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Nombre de la persona</Label>
                <Input 
                  placeholder="Ej: Invitado Sorpresa" 
                  value={newGuestName} 
                  onChange={e => setNewGuestName(e.target.value)} 
                  className="h-12 rounded-2xl bg-muted/30 border-none"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">¿Quién paga por esta persona?</Label>
                <Select value={guestResponsibleUid} onValueChange={setGuestResponsibleUid}>
                  <SelectTrigger className="h-12 rounded-2xl border-none bg-muted/30">
                    <SelectValue placeholder="Seleccionar responsable" />
                  </SelectTrigger>
                  <SelectContent>
                    {participants.map(p => (
                      <SelectItem key={p.uid} value={p.uid}>{p.displayName} (Participante)</SelectItem>
                    ))}
                    {isAdmin && !participants.find(p => p.uid === user?.uid) && (
                      <SelectItem value={user!.uid}>{user?.displayName} (Administrador)</SelectItem>
                    )}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="pt-4 space-y-2">
              <Button 
                className="w-full h-14 rounded-2xl font-bold text-lg" 
                onClick={handleAddQuickGuest}
                disabled={!newGuestName || !guestResponsibleUid}
              >
                Registrar Llegada
              </Button>
              <Button variant="ghost" className="w-full text-xs font-bold text-muted-foreground" onClick={() => setAddingNonEnrolled(false)}>
                Cancelar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
