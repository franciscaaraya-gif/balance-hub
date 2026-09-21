"use client";

import { useEffect, useState, use } from "react";
import { useUser, useFirestore, useDoc, useMemoFirebase } from "@/firebase";
import { 
  toggleAttendance, 
  getGroupMembersDetails, 
  toggleGuestPresence, 
  removeExternalGuest, 
  chargeEventToGroup, 
  addExternalGuest, 
  removeParticipantFromEvent,
  updateEventSettings
} from "@/lib/firebase/store";
import { Event, UserProfile, ExternalGuest } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar, MapPin, Clock, QrCode, CheckCircle2, Circle, Loader2, Zap, AlertCircle, Share2, Coins, ArrowLeft, User, Trash2, XCircle, Plus, Users } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { doc } from "firebase/firestore";
import { cn } from "@/lib/utils";

export default function EventAttendanceDetails({ params: paramsPromise }: { params: Promise<{ id: string }> }) {
  const params = use(paramsPromise);
  const { user } = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();

  const [isCharging, setIsCharging] = useState(false);
  const [showQr, setShowQr] = useState(false);
  const [newGuestName, setNewGuestName] = useState("");
  const [selectedResponsibleId, setSelectedResponsibleId] = useState<string>("");
  const [profilesMap, setProfilesMap] = useState<Record<string, UserProfile>>({});

  const eventRef = useMemoFirebase(() => {
    if (!firestore || !params.id || !user?.uid) return null;
    return doc(firestore, 'events', params.id);
  }, [firestore, params.id, user?.uid]);

  const { data: event, isLoading: eventLoading, error: eventError } = useDoc<Event>(eventRef);

  useEffect(() => {
    if (user?.uid && !selectedResponsibleId) {
      setSelectedResponsibleId(user.uid);
    }
  }, [user, selectedResponsibleId]);

  useEffect(() => {
    const uids = new Set<string>();
    if (event?.participantIds) {
      event.participantIds.forEach(id => uids.add(id));
    }
    if (event?.externalGuests) {
      event.externalGuests.forEach(g => uids.add(g.addedBy));
    }

    if (uids.size > 0) {
      getGroupMembersDetails(Array.from(uids)).then(details => {
        const map: Record<string, UserProfile> = {};
        details.forEach(p => {
          if (p.uid) map[p.uid] = p;
        });
        setProfilesMap(map);
      }).catch(err => {
        console.error("Error cargando perfiles de asistencia:", err);
      });
    }
  }, [event?.participantIds, event?.externalGuests]);

  if (eventLoading) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center gap-4">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
        <p className="text-muted-foreground font-medium animate-pulse">Cargando panel de asistencia...</p>
      </div>
    );
  }

  if (eventError || !event) {
    return (
      <div className="p-8 text-center min-h-[50vh] flex flex-col items-center justify-center gap-4">
        <AlertCircle className="mx-auto h-16 w-16 opacity-20 text-destructive" />
        <div>
          <h2 className="text-2xl font-headline font-bold">Evento no encontrado</h2>
        </div>
        <Button variant="outline" className="rounded-2xl" onClick={() => window.history.back()}>
          <ArrowLeft className="h-4 w-4 mr-2" /> Volver
        </Button>
      </div>
    );
  }

  const absentIds = event.participantIds.filter(id => !event.presentIds.includes(id));
  const totalPresentParticipants = event.presentIds?.length || 0;
  const totalPresentGuests = event.externalGuests?.filter(g => g.present).length || 0;
  const totalAbsents = absentIds.length;

  const totalHeads = totalPresentParticipants + totalPresentGuests + (event.chargeAbsentees ? totalAbsents : 0);
  const costPerPerson = totalHeads > 0 ? event.totalCost / totalHeads : 0;
  
  const isAdmin = event.creatorId === user?.uid;

  const handleToggleChargeAbsentees = async (checked: boolean) => {
    try {
      await updateEventSettings(event.id, checked);
      toast({ title: "Configuración actualizada", description: checked ? "Se cobrará a los ausentes." : "Costo exclusivo para los presentes." });
    } catch (e) {
      toast({ variant: "destructive", title: "Error al actualizar" });
    }
  };

  const handleRemoveUser = async (uid: string) => {
    if (event.isCharged) return;
    try {
      await removeParticipantFromEvent(event.id, uid);
      toast({ title: "Participante eliminado del evento" });
    } catch (e) {
      toast({ variant: "destructive", title: "Error al eliminar" });
    }
  };

  const handleAddGuest = async () => {
    if (!newGuestName.trim() || !user) return;
    const responsibleId = selectedResponsibleId || user.uid;
    try {
      await addExternalGuest(event.id, newGuestName.trim(), responsibleId);
      setNewGuestName("");
      toast({ title: "Invitado agregado" });
    } catch (e) {
      toast({ variant: "destructive", title: "Error al agregar invitado" });
    }
  };

  const handleChargeToGroup = async () => {
    setIsCharging(true);
    try {
      await chargeEventToGroup(event.id);
      toast({ title: "¡Liquidación Exitosa!", description: "Las deudas se han cargado transparentemente al grupo." });
    } catch (error: any) {
      toast({ variant: "destructive", title: "Error al liquidar", description: error.message });
    } finally {
      setIsCharging(false);
    }
  };

  const checkInUrl = `${typeof window !== 'undefined' ? window.location.origin : ''}/attendance/check-in/${event.id}?token=${event.checkInToken}`;
  const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(checkInUrl)}`;

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-20 px-2 sm:px-4">
      <div className="bg-primary p-6 sm:p-8 rounded-[2rem] text-primary-foreground shadow-xl">
        <div className="flex flex-col md:flex-row justify-between gap-6 items-start md:items-center">
          <div className="space-y-2">
            <Badge className="bg-accent text-white px-3 font-bold">{event.date}</Badge>
            <h1 className="text-3xl font-headline font-bold">{event.title}</h1>
            <p className="text-sm opacity-80 font-medium">Concepto del Costo: <span className="underline font-bold">{event.costConcept || "No especificado"}</span></p>
            <div className="flex gap-4 text-xs opacity-60 pt-2">
              <span className="flex items-center gap-1"><MapPin className="h-3 w-3" /> {event.location || "Presencial"}</span>
              <span className="flex items-center gap-1"><Clock className="h-3 w-3" /> {event.time}</span>
            </div>
          </div>
          <div className="bg-white/10 p-5 rounded-2xl text-center min-w-[160px]">
            <p className="text-[10px] uppercase font-black opacity-70 tracking-widest">Cuota p/p</p>
            <p className="text-4xl font-headline font-bold text-accent">${costPerPerson.toFixed(2)}</p>
            <p className="text-[9px] mt-1 font-bold uppercase tracking-tight text-white/90">Dividido en {totalHeads} Cabezas</p>
          </div>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        <Card className="md:col-span-2 shadow-sm border-none bg-white rounded-[2rem]">
          <CardHeader className="flex flex-row items-center justify-between border-b pb-6">
            <div>
              <CardTitle className="text-lg font-headline">Lista de Control</CardTitle>
              <CardDescription className="text-xs">Participantes registrados e invitados especiales.</CardDescription>
            </div>
            {isAdmin && !event.isCharged && (
              <Button variant="outline" size="sm" className="rounded-xl h-10 border-2" onClick={() => setShowQr(true)}>
                <QrCode className="h-4 w-4 mr-2" /> Mostrar QR
              </Button>
            )}
          </CardHeader>
          <CardContent className="pt-6">
            <div className="space-y-8">
              <div className="space-y-4">
                <h3 className="text-[10px] font-black uppercase tracking-widest text-muted-foreground border-l-2 border-accent pl-2">Usuarios Registrados</h3>
                {event.participantIds.map(uid => {
                  const profile = profilesMap[uid];
                  const isPresent = event.presentIds?.includes(uid);
                  
                  let statusLabel = "Confirmado (RSVP)";
                  let badgeStyle = "bg-muted/60 text-muted-foreground";
                  
                  if (isPresent) {
                    statusLabel = "Presente";
                    badgeStyle = "bg-emerald-500 text-white";
                  } else if (event.isCharged) {
                    statusLabel = "Ausente";
                    badgeStyle = "bg-destructive/10 text-destructive border border-destructive/20";
                  }

                  return (
                    <div key={uid} className={cn(
                      "flex items-center justify-between p-4 rounded-2xl border transition-all",
                      isPresent ? "bg-emerald-50/60 border-emerald-100" : "bg-muted/10 border-transparent"
                    )}>
                      <div className="flex items-center gap-3">
                        <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center font-bold text-primary text-sm">
                          {profile?.displayName?.[0] || "U"}
                        </div>
                        <div>
                          <p className="text-sm font-bold">{profile?.displayName || `Usuario (${uid.substring(0, 5)})`}</p>
                          <span className={cn("text-[9px] px-2 py-0.5 rounded-full font-bold uppercase tracking-tighter inline-block mt-0.5", badgeStyle)}>
                            {statusLabel}
                          </span>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-2">
                        {isAdmin && !event.isCharged && (
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-8 w-8 text-destructive hover:bg-destructive/10 rounded-xl"
                            onClick={() => handleRemoveUser(uid)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                        
                        {!event.isCharged && (
                          <Button 
                            variant={isPresent ? "default" : "outline"} 
                            size="sm"
                            className={cn(
                              "rounded-xl text-[10px] font-black h-9 px-3", 
                              isPresent ? "bg-emerald-500 hover:bg-emerald-600 border-none" : "border-primary/20 text-primary"
                            )}
                            onClick={() => toggleAttendance(event.id, uid, !isPresent)}
                          >
                            {isPresent ? "Quitar Asistencia" : "Marcar Llegada"}
                          </Button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="space-y-4">
                <h3 className="text-[10px] font-black uppercase tracking-widest text-muted-foreground border-l-2 border-secondary pl-2">Invitados (+1)</h3>
                
                {isAdmin && !event.isCharged && (
                  <div className="flex flex-col sm:flex-row gap-2 p-3 bg-muted/20 rounded-2xl space-y-2 sm:space-y-0">
                    <div className="flex-1">
                      <Label className="text-[9px] uppercase font-black mb-1 block px-1">Nombre del Invitado</Label>
                      <Input 
                        placeholder="Nombre del invitado" 
                        value={newGuestName}
                        onChange={(e) => setNewGuestName(e.target.value)}
                        className="h-10 rounded-xl bg-white text-xs"
                      />
                    </div>
                    <div className="w-full sm:w-48">
                      <Label className="text-[9px] uppercase font-black mb-1 block px-1">Responsable del Pago</Label>
                      <Select value={selectedResponsibleId} onValueChange={setSelectedResponsibleId}>
                        <SelectTrigger className="h-10 rounded-xl bg-white text-xs">
                          <SelectValue placeholder="Seleccionar responsable" />
                        </SelectTrigger>
                        <SelectContent>
                          {event.participantIds.map(uid => {
                            const p = profilesMap[uid];
                            return (
                              <SelectItem key={uid} value={uid} className="text-xs">
                                {p?.displayName || `Usuario (${uid.substring(0, 5)})`}
                              </SelectItem>
                            );
                          })}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="flex items-end">
                      <Button size="sm" onClick={handleAddGuest} className="rounded-xl h-10 w-full sm:w-auto px-4">
                        <Plus className="h-4 w-4 mr-1" /> Agregar
                      </Button>
                    </div>
                  </div>
                )}

                {event.externalGuests?.map((guest, idx) => (
                  <div key={`${guest.name}-${idx}`} className={cn(
                    "flex items-center justify-between p-4 rounded-2xl border transition-all",
                    guest.present ? "bg-secondary/10 border-secondary/20" : "bg-muted/10 border-transparent"
                  )}>
                    <div className="flex items-center gap-3">
                      <div className="h-9 w-9 rounded-full bg-secondary/10 flex items-center justify-center font-bold text-secondary text-sm">
                        {guest.name[0]}
                      </div>
                      <div>
                        <p className="text-sm font-bold">{guest.name}</p>
                        <p className="text-[8px] text-muted-foreground uppercase font-black">
                          Traído por: {profilesMap[guest.addedBy]?.displayName || `Usuario (${guest.addedBy.substring(0, 5)})`}
                        </p>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-2">
                      {isAdmin && !event.isCharged && (
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="h-8 w-8 text-destructive hover:bg-destructive/10 rounded-xl"
                          onClick={() => removeExternalGuest(event.id, guest)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                      
                      {!event.isCharged && (
                        <Button 
                          variant={guest.present ? "secondary" : "outline"} 
                          size="sm"
                          className={cn(
                            "rounded-xl text-[10px] font-black h-9 px-3", 
                            guest.present ? "bg-secondary text-white hover:bg-secondary/90 border-none" : "border-secondary/20 text-secondary"
                          )}
                          onClick={() => toggleGuestPresence(event.id, guest.name, guest.addedBy, !guest.present)}
                        >
                          {guest.present ? "Quitar Asistencia" : "Marcar Llegada"}
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
                {(!event.externalGuests || event.externalGuests.length === 0) && (
                  <div className="text-center py-4 opacity-30 italic text-[10px]">No hay invitados externos.</div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card className="border-none shadow-sm rounded-[2rem] overflow-hidden bg-white">
            <CardHeader className="border-b bg-muted/10">
              <CardTitle className="text-xs font-black uppercase tracking-widest text-primary flex items-center gap-2">
                <Zap className="h-4 w-4 text-accent" /> Regla de Cobro
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-4 space-y-4">
              <div className="flex items-center justify-between p-3 bg-primary/5 rounded-2xl">
                <div className="space-y-0.5 pr-2">
                  <span className="text-xs font-bold block">Cobrar a Ausentes</span>
                  <p className="text-[9px] text-muted-foreground">Si faltan, ¿pagan igual la cuota del arriendo?</p>
                </div>
                <Switch 
                  disabled={event.isCharged}
                  checked={event.chargeAbsentees} 
                  onCheckedChange={handleToggleChargeAbsentees} 
                />
              </div>

              <div className="pt-2 border-t space-y-2 text-xs">
                <div className="flex justify-between">
                  <span className="text-muted-foreground font-medium">Presentes:</span>
                  <span className="font-bold text-primary">{totalPresentParticipants}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground font-medium">Invitados Presentes:</span>
                  <span className="font-bold text-secondary">{totalPresentGuests}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground font-medium">Ausentes:</span>
                  <span className="font-bold text-orange-600">{totalAbsents}</span>
                </div>
                <div className="flex justify-between border-t pt-2 font-bold">
                  <span>Costo Total:</span>
                  <span className="text-primary font-headline">${event.totalCost.toFixed(2)}</span>
                </div>
              </div>
            </CardContent>
            {isAdmin && (
              <CardFooter className="bg-muted/5 pt-4">
                <Button 
                  disabled={event.isCharged || isCharging || totalHeads === 0}
                  className="w-full h-12 rounded-2xl bg-accent hover:bg-accent/90 text-[11px] font-black uppercase tracking-widest gap-2 shadow-lg text-white" 
                  onClick={handleChargeToGroup}
                >
                  {isCharging ? <Loader2 className="animate-spin" /> : event.isCharged ? "Evento Ya Liquidado" : <><Coins className="h-4 w-4" /> Finalizar y Cobrar</>}
                </Button>
              </CardFooter>
            )}
          </Card>
          
          <div className="bg-white p-6 rounded-[2rem] shadow-sm space-y-3 border">
             <div className="flex items-center gap-2 text-primary font-bold">
               <Share2 className="h-4 w-4 text-accent" />
               <span className="text-xs font-black uppercase tracking-widest">Enlace RSVP WhatsApp</span>
             </div>
             <p className="text-[10px] text-muted-foreground leading-relaxed">Comparte este link. Al anotarse quedarán unidos automáticamente como miembros oficiales del grupo.</p>
             <Button 
               variant="outline" 
               className="w-full h-11 rounded-xl text-[10px] font-black uppercase tracking-widest border-2" 
               onClick={() => { navigator.clipboard.writeText(event.shareLink); toast({ title: "Link copiado", description: "Listo para pegar en tu grupo de WhatsApp." }); }}
             >
               Copiar Enlace de Invitación
             </Button>
          </div>
        </div>
      </div>

      <Dialog open={showQr} onOpenChange={setShowQr}>
        <DialogContent className="max-w-md rounded-[2.5rem] p-8 text-center border-none">
          <DialogHeader><DialogTitle className="text-2xl font-headline">Check-in QR en Vivo</DialogTitle></DialogHeader>
          <div className="py-4 flex flex-col items-center gap-4">
            <div className="bg-white p-4 rounded-3xl border-2 border-primary/10 shadow-xl">
              <img src={qrCodeUrl} alt="QR de asistencia" className="w-60 h-60" />
            </div>
            <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground max-w-xs leading-relaxed">
              Los integrantes pueden escanear esto al llegar para registrar su presencia y entrar en la cuota automáticamente.
            </p>
          </div>
          <Button className="w-full h-12 rounded-2xl" onClick={() => setShowQr(false)}>Cerrar</Button>
        </DialogContent>
      </Dialog>
    </div>
  );
}
