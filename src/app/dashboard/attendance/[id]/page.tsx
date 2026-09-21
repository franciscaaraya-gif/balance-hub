"use client";

import { useEffect, useState, use, useMemo } from "react";
import { useUser, useFirestore, useDoc, useMemoFirebase } from "@/firebase";
import { 
  addParticipantToEvent, 
  toggleAttendance, 
  getGroupMembersDetails, 
  toggleGuestPresence, 
  removeExternalGuest, 
  chargeEventToGroup, 
  addExternalGuest, 
  removeParticipantFromEvent 
} from "@/lib/firebase/store";
import { Event, UserProfile, ExternalGuest, Group } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar, MapPin, Clock, Users, QrCode, CheckCircle2, Circle, Loader2, Zap, AlertCircle, Share2, Plus, Coins, ArrowLeft, User, Trash2, XCircle, ShieldCheck } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { doc } from "firebase/firestore";
import { cn } from "@/lib/utils";

export default function EventAttendanceDetails({ params: paramsPromise }: { params: Promise<{ id: string }> }) {
  const params = use(paramsPromise);
  const { user } = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();

  const [addingNonEnrolled, setAddingNonEnrolled] = useState(false);
  const [isCharging, setIsCharging] = useState(false);
  const [showQr, setShowQr] = useState(false);
  
  // Diccionario de perfiles para evitar el bug de "desaparición" si falla un perfil
  const [profilesMap, setProfilesMap] = useState<Record<string, UserProfile>>({});
  
  const [newGuestName, setNewGuestName] = useState("");
  const [guestResponsibleUid, setGuestResponsibleUid] = useState("");

  const eventRef = useMemoFirebase(() => {
    if (!firestore || !params.id || !user?.uid) return null;
    return doc(firestore, 'events', params.id);
  }, [firestore, params.id, user?.uid]);

  const { data: event, isLoading: eventLoading, error: eventError } = useDoc<Event>(eventRef);

  // Cargar perfiles de forma robusta
  useEffect(() => {
    if (event?.participantIds?.length) {
      getGroupMembersDetails(event.participantIds).then(details => {
        const map: Record<string, UserProfile> = {};
        details.forEach(p => map[p.uid] = p);
        setProfilesMap(map);
      });
    }
  }, [event?.participantIds]);

  const handleAddQuickGuest = async () => {
    if (!newGuestName || !guestResponsibleUid || !event) return;
    try {
      await addExternalGuest(event.id, newGuestName, guestResponsibleUid);
      await toggleGuestPresence(event.id, newGuestName, guestResponsibleUid, true);
      toast({ title: "Persona añadida" });
      setNewGuestName("");
      setAddingNonEnrolled(false);
    } catch (e) {
      toast({ variant: "destructive", title: "Error" });
    }
  };

  const handleRemoveParticipant = async (uid: string) => {
    if (!event || event.isCharged) return;
    try {
      await removeParticipantFromEvent(event.id, uid);
      toast({ title: "Participante eliminado" });
    } catch (e) {
      toast({ variant: "destructive", title: "Error al eliminar" });
    }
  };

  const handleChargeToGroup = async () => {
    if (!event) return;
    setIsCharging(true);
    try {
      await chargeEventToGroup(event.id);
      toast({ title: "¡Éxito!", description: "Deudas cargadas al grupo." });
    } catch (error: any) {
      toast({ variant: "destructive", title: "Error", description: error.message });
    } finally {
      setIsCharging(false);
    }
  };

  if (eventLoading) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center gap-4">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
        <p className="text-muted-foreground font-medium animate-pulse">Cargando detalles del evento...</p>
      </div>
    );
  }

  if (eventError || !event) {
    return (
      <div className="p-8 text-center min-h-[50vh] flex flex-col items-center justify-center gap-4">
        <AlertCircle className="mx-auto h-16 w-16 opacity-20 text-destructive" />
        <div>
          <h2 className="text-2xl font-headline font-bold">Evento no encontrado</h2>
          <p className="text-muted-foreground">El evento que buscas no existe o ha sido eliminado.</p>
        </div>
        <Button variant="outline" className="rounded-2xl" onClick={() => window.history.back()}>
          <ArrowLeft className="h-4 w-4 mr-2" /> Volver
        </Button>
      </div>
    );
  }

  // CÁLCULO DE LIQUIDACIÓN: Solo cuentan los presentes reales (Array presentIds + invitados con present:true)
  const totalPresent = (event.presentIds?.length || 0) + (event.externalGuests?.filter(g => g.present).length || 0);
  const costPerPerson = totalPresent > 0 ? event.totalCost / totalPresent : 0;
  const isAdmin = event.creatorId === user?.uid;

  const checkInUrl = `${typeof window !== 'undefined' ? window.location.origin : ''}/attendance/check-in/${event.id}?token=${event.checkInToken}`;
  const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(checkInUrl)}`;

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-20 px-2 sm:px-4">
      <div className="bg-primary p-6 sm:p-8 rounded-[2rem] text-primary-foreground shadow-xl">
        <div className="flex flex-col md:flex-row justify-between gap-6 items-start md:items-center">
          <div className="space-y-2">
            <Badge className="bg-accent text-white px-3 font-bold">{event.date}</Badge>
            <h1 className="text-3xl font-headline font-bold">{event.title}</h1>
            <div className="flex gap-4 text-xs opacity-70">
              <span className="flex items-center gap-1"><MapPin className="h-3 w-3" /> {event.location}</span>
              <span className="flex items-center gap-1"><Clock className="h-3 w-3" /> {event.time}</span>
            </div>
          </div>
          <div className="bg-white/10 p-4 rounded-2xl text-center min-w-[150px]">
            <p className="text-[10px] uppercase font-bold opacity-70">Cuota p/p</p>
            <p className="text-3xl font-headline font-bold text-accent">${costPerPerson.toFixed(2)}</p>
            <p className="text-[9px] mt-1 font-bold uppercase">{totalPresent} PRESENTES PAGADORES</p>
          </div>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        <Card className="md:col-span-2 shadow-sm border-none bg-white rounded-[2rem]">
          <CardHeader className="flex flex-row items-center justify-between border-b pb-6">
            <div>
              <CardTitle className="text-lg font-headline">Asistencia</CardTitle>
              <CardDescription className="text-xs">RSVP vs Llegadas reales.</CardDescription>
            </div>
            {isAdmin && !event.isCharged && (
              <div className="flex gap-2">
                 <Button variant="outline" size="sm" className="rounded-xl h-10" onClick={() => setAddingNonEnrolled(true)}>
                   <Plus className="h-4 w-4 mr-2" /> Añadir
                 </Button>
                 <Button variant="default" size="sm" className="bg-accent rounded-xl h-10" onClick={() => setShowQr(true)}>
                   <QrCode className="h-4 w-4 mr-2" /> QR
                 </Button>
              </div>
            )}
          </CardHeader>
          <CardContent className="pt-6">
            <div className="space-y-4">
              {/* ITERAMOS SOBRE participantIds PARA GARANTIZAR QUE NADIE FALTE (Fix Punto 6) */}
              {event.participantIds.map(uid => {
                const profile = profilesMap[uid];
                const isPresent = event.presentIds?.includes(uid);
                const userGuests = event.externalGuests?.filter(g => g.addedBy === uid) || [];
                
                return (
                  <div key={uid} className="space-y-2">
                    <div className={cn(
                      "flex items-center justify-between p-4 rounded-2xl border transition-all",
                      isPresent ? "bg-emerald-50 border-emerald-100" : "bg-muted/10 border-transparent opacity-80"
                    )}>
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center font-bold text-primary">
                          {profile?.displayName?.[0] || "?"}
                        </div>
                        <div>
                          <p className="text-sm font-bold">{profile?.displayName || `Usuario ${uid.substring(0,4)}...`}</p>
                          <p className="text-[10px] text-muted-foreground uppercase font-black tracking-tighter">
                            {isPresent ? "Presente" : "Confirmado (RSVP)"}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {isAdmin && !event.isCharged && (
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-8 w-8 text-destructive/40 hover:text-destructive" 
                            onClick={() => handleRemoveParticipant(uid)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                        <Button 
                          variant={isPresent ? "default" : "outline"} 
                          size="sm" 
                          disabled={event.isCharged}
                          className={cn(
                            "rounded-full text-[10px] font-black h-9 px-4", 
                            isPresent ? "bg-emerald-500 hover:bg-emerald-600 border-none" : "border-primary/20 text-primary"
                          )}
                          onClick={() => toggleAttendance(event.id, uid, !isPresent)}
                        >
                          {isPresent ? "Presente" : "Marcar Llegada"}
                        </Button>
                      </div>
                    </div>
                    {userGuests.map((guest, idx) => (
                      <div key={idx} className={cn(
                        "flex items-center justify-between py-2 px-4 ml-10 rounded-xl border",
                        guest.present ? "bg-emerald-50/50 border-emerald-100" : "bg-muted/5 border-transparent opacity-60"
                      )}>
                        <div className="flex flex-col">
                          <span className="text-xs font-bold">{guest.name} (+1)</span>
                          <span className="text-[8px] uppercase font-black opacity-30">
                            {guest.present ? "Presente" : "RSVP"}
                          </span>
                        </div>
                        <div className="flex gap-2">
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-8 w-8" 
                            disabled={event.isCharged}
                            onClick={() => toggleGuestPresence(event.id, guest.name, guest.addedBy, !guest.present)}
                          >
                            {guest.present ? <CheckCircle2 className="h-5 w-5 text-emerald-500" /> : <Circle className="h-5 w-5 opacity-30" />}
                          </Button>
                          {!event.isCharged && (
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive/40" onClick={() => removeExternalGuest(event.id, guest)}>
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                );
              })}
              {event.participantIds.length === 0 && (
                <div className="text-center py-10 opacity-30 italic text-sm">
                  Aún no hay participantes confirmados.
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card className="border-none shadow-sm rounded-[2rem]">
            <CardHeader><CardTitle className="text-xs font-black uppercase tracking-widest text-primary"><Zap className="inline mr-2 h-4 w-4 text-accent" /> Liquidación</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="flex justify-between text-xs font-bold"><span>Total del Evento:</span><span>${event.totalCost.toFixed(2)}</span></div>
              <div className="flex justify-between text-xs font-bold text-accent"><span>Cuota p/p (solo presentes):</span><span>${costPerPerson.toFixed(2)}</span></div>
              <div className="pt-4 border-t space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-[9px] font-black uppercase text-muted-foreground">Presentes</span>
                  <span className="text-2xl font-headline font-bold text-primary">{totalPresent}</span>
                </div>
                <div className="flex justify-between items-center opacity-50">
                  <span className="text-[9px] font-black uppercase text-muted-foreground">Confirmados (no llegaron)</span>
                  <span className="text-sm font-bold">{event.participantIds.length - event.presentIds.length}</span>
                </div>
              </div>
            </CardContent>
            {isAdmin && (
              <CardFooter>
                <Button 
                  disabled={event.isCharged || isCharging || totalPresent === 0}
                  className="w-full h-12 rounded-2xl bg-primary text-[11px] font-black uppercase tracking-widest gap-2 shadow-lg" 
                  onClick={handleChargeToGroup}
                >
                  {isCharging ? <Loader2 className="animate-spin" /> : event.isCharged ? "Liquidado" : <><Coins className="h-4 w-4" /> Cargar al Grupo</>}
                </Button>
              </CardFooter>
            )}
          </Card>
          
          <div className="bg-white p-6 rounded-[2rem] shadow-sm space-y-4">
             <div className="flex items-center gap-2 text-primary font-bold"><Share2 className="h-4 w-4 text-accent" /><span className="text-xs font-black uppercase tracking-widest">Link RSVP</span></div>
             <p className="text-[10px] text-muted-foreground">Para que los amigos confirmen y sumen sus +1.</p>
             <Button variant="outline" className="w-full h-12 rounded-2xl text-[10px] font-black uppercase tracking-widest border-2 border-primary" onClick={() => { navigator.clipboard.writeText(event.shareLink); toast({ title: "Copiado" }); }}>
               Copiar Link WhatsApp
             </Button>
          </div>
        </div>
      </div>

      {/* MODAL: Check-in QR */}
      <Dialog open={showQr} onOpenChange={setShowQr}>
        <DialogContent className="max-w-md rounded-[2.5rem] p-8 text-center border-none">
          <DialogHeader><DialogTitle className="text-2xl font-headline">Check-in QR</DialogTitle></DialogHeader>
          <div className="py-6 flex flex-col items-center gap-6">
            <div className="bg-white p-4 rounded-3xl border-2 border-primary/10 shadow-xl">
              <img src={qrCodeUrl} alt="QR" className="w-64 h-64" />
            </div>
            <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground leading-relaxed">Escanea esto al llegar para marcar tu asistencia automáticamente y entrar en el cobro.</p>
          </div>
          <Button className="w-full h-12 rounded-2xl" onClick={() => setShowQr(false)}>Cerrar</Button>
        </DialogContent>
      </Dialog>

      {/* MODAL: Añadir Asistente */}
      <Dialog open={addingNonEnrolled} onOpenChange={setAddingNonEnrolled}>
        <DialogContent className="max-w-md rounded-[2.5rem] p-8 border-none">
          <DialogHeader><DialogTitle className="text-2xl font-headline">Añadir Asistente</DialogTitle></DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label className="text-[10px] font-black uppercase">Nombre</Label>
              <Input placeholder="Ej: Invitado Sorpresa" value={newGuestName} onChange={e => setNewGuestName(e.target.value)} className="h-12 rounded-2xl" />
            </div>
            <div className="space-y-2">
              <Label className="text-[10px] font-black uppercase">Responsable del Pago</Label>
              <Select value={guestResponsibleUid} onValueChange={setGuestResponsibleUid}>
                <SelectTrigger className="h-12 rounded-2xl"><SelectValue placeholder="Seleccionar" /></SelectTrigger>
                <SelectContent>
                  {/* Listamos a todos los participantes posibles responsables */}
                  {event.participantIds.map(uid => (
                    <SelectItem key={uid} value={uid}>{profilesMap[uid]?.displayName || `Usuario ${uid.substring(0,5)}`}</SelectItem>
                  ))}
                  {isAdmin && !event.participantIds.includes(user!.uid) && (
                    <SelectItem value={user!.uid}>{user?.displayName} (Admin)</SelectItem>
                  )}
                </SelectContent>
              </Select>
            </div>
          </div>
          <Button className="w-full h-14 rounded-2xl font-bold" onClick={handleAddQuickGuest} disabled={!newGuestName || !guestResponsibleUid}>Registrar Llegada</Button>
        </DialogContent>
      </Dialog>
    </div>
  );
}
