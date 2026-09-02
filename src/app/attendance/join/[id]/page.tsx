
"use client";

import { useEffect, useState, use } from "react";
import { useRouter } from "next/navigation";
import { useUser, useFirestore, useDoc, useMemoFirebase } from "@/firebase";
import { addAndMarkPresent, addExternalGuest, removeExternalGuest, toggleAttendance, toggleGuestPresence, removeParticipantFromEvent } from "@/lib/firebase/store";
import { Event, ExternalGuest } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Calendar, Loader2, MapPin, Clock, Users, Plus, CheckCircle2, UserPlus, Info, User, QrCode, Trash2, CheckCircle, Circle, ArrowLeft, ShieldCheck } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { doc } from "firebase/firestore";
import { cn } from "@/lib/utils";

export default function JoinEvent({ params: paramsPromise }: { params: Promise<{ id: string }> }) {
  const params = use(paramsPromise);
  const { user, isUserLoading } = useUser();
  const router = useRouter();
  const { toast } = useToast();
  const firestore = useFirestore();

  const [joining, setJoining] = useState(false);
  const [guestName, setGuestName] = useState("");

  const eventRef = useMemoFirebase(() => {
    if (!firestore || !params.id) return null;
    return doc(firestore, 'events', params.id);
  }, [firestore, params.id]);

  const { data: event, isLoading: eventLoading } = useDoc<Event>(eventRef);

  useEffect(() => {
    if (!isUserLoading && !user) {
      router.push(`/login?redirect=/attendance/join/${params.id}`);
    }
  }, [user, isUserLoading, router, params.id]);

  const handleJoin = async () => {
    if (!user || !event) return;
    setJoining(true);
    try {
      await addAndMarkPresent(params.id, user.uid);
      toast({ title: "¡Listo!", description: `Has confirmado tu asistencia a: ${event.title}` });
    } catch (error) {
      toast({ variant: "destructive", title: "Error al inscribirse" });
    } finally {
      setJoining(false);
    }
  };

  const handleAddGuest = async () => {
    if (!guestName || !user || !event || event.isCharged) return;
    try {
      await addExternalGuest(params.id, guestName, user.uid);
      toast({ title: "Invitado añadido", description: `${guestName} se sumó a la cuenta.` });
      setGuestName("");
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

  const handleToggleGuest = async (guest: ExternalGuest) => {
    if (event?.isCharged) return;
    try {
      await toggleGuestPresence(params.id, guest.name, guest.addedBy, !guest.present);
    } catch (e) {
      toast({ variant: "destructive", title: "Error" });
    }
  };

  if (isUserLoading || eventLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-4 bg-background">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
        <p className="text-muted-foreground animate-pulse font-medium">Cargando evento...</p>
      </div>
    );
  }

  if (!user) return null;

  if (!event) {
    return (
      <div className="flex items-center justify-center min-h-screen p-4 bg-background">
        <Card className="max-w-md w-full text-center py-10 shadow-lg border-none">
          <CardHeader>
            <CardTitle className="text-2xl font-headline">Evento no encontrado</CardTitle>
            <CardDescription>El enlace parece no ser válido o el evento fue eliminado.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => router.push("/dashboard")} className="w-full">Volver al Dashboard</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const isEnrolled = event.participantIds?.includes(user.uid);
  const isPresent = event.presentIds?.includes(user.uid);
  const myGuests = event.externalGuests?.filter(g => g.addedBy === user.uid) || [];
  const totalPresent = (event.presentIds?.length || 0) + (event.externalGuests?.filter(g => g.present).length || 0);
  const myPresentHeads = (isPresent ? 1 : 0) + myGuests.filter(g => g.present).length;
  
  const costPerHead = totalPresent > 0 ? event.totalCost / totalPresent : 0;
  const myTotalDebt = costPerHead * myPresentHeads;

  return (
    <div className="flex items-center justify-center min-h-screen bg-muted/30 p-2 sm:p-4">
      <Card className="w-full max-w-md shadow-2xl border-none overflow-hidden bg-white rounded-[2rem]">
        <div className="h-2 bg-accent" />
        <CardHeader className="text-center space-y-3 pb-6 pt-8">
          <div className="mx-auto bg-primary/10 p-4 rounded-full w-fit">
            <Calendar className="h-8 w-8 text-primary" />
          </div>
          <div>
            <CardTitle className="text-2xl sm:text-3xl font-headline font-bold text-primary px-2 leading-tight">{event.title}</CardTitle>
            <p className="text-[10px] text-muted-foreground font-bold flex items-center justify-center gap-1 mt-2">
              <User className="h-3 w-3" /> Organizado por: {event.creatorName}
            </p>
            <div className="flex flex-wrap justify-center gap-2 text-xs text-muted-foreground font-medium mt-3 px-4">
              <span className="flex items-center gap-1 bg-muted px-2 py-1 rounded-full"><MapPin className="h-3 w-3" /> {event.location}</span>
              <span className="flex items-center gap-1 bg-muted px-2 py-1 rounded-full"><Clock className="h-3 w-3" /> {event.time}</span>
            </div>
          </div>
        </CardHeader>
        
        <CardContent className="space-y-6 px-6 pb-10">
          {event.isCharged && (
            <div className="bg-emerald-50 text-emerald-700 p-4 rounded-2xl flex items-center gap-3 border border-emerald-100 mb-2">
              <CheckCircle2 className="h-5 w-5 shrink-0" />
              <p className="text-[11px] font-bold uppercase leading-tight">Este evento ya ha sido liquidado. Los datos son de solo lectura.</p>
            </div>
          )}

          <div className="bg-primary/5 p-5 rounded-3xl border border-primary/10 space-y-3 shadow-inner">
             <div className="flex justify-between items-center text-sm">
               <span className="text-muted-foreground font-medium">Asistentes Hoy:</span>
               <span className="font-bold text-primary">{totalPresent}</span>
             </div>
             {isEnrolled && (
               <div className="pt-3 border-t border-primary/10 space-y-2">
                 <div className="flex justify-between items-center text-[10px] font-bold text-accent uppercase tracking-wider">
                   <span>Tu Cuota ({myPresentHeads} pers.):</span>
                   <span className="text-2xl font-headline font-bold text-accent">
                     ${myTotalDebt.toFixed(2)}
                   </span>
                 </div>
               </div>
             )}
          </div>

          {!isEnrolled ? (
            <div className="space-y-3">
              <Button className="w-full bg-primary h-14 text-lg font-bold shadow-xl shadow-primary/20 hover:scale-[1.02] transition-transform rounded-2xl" onClick={handleJoin} disabled={joining}>
                {joining ? <Loader2 className="animate-spin mr-2" /> : <><UserPlus className="mr-2 h-5 w-5" /> Confirmar Asistencia</>}
              </Button>
              <p className="text-[9px] text-center text-muted-foreground uppercase font-bold tracking-widest leading-relaxed mt-4">
                <Info className="h-3 w-3 inline mr-1" /> Al inscribirte, podrás sumar invitados y ver tu cuota en tiempo real.
              </p>
            </div>
          ) : (
            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div className={cn(
                "flex flex-col items-center justify-center gap-2 p-6 rounded-[2rem] font-bold border shadow-sm text-center transition-colors",
                isPresent ? "text-emerald-600 bg-emerald-50 border-emerald-100" : "text-amber-600 bg-amber-50 border-amber-100"
              )}>
                {isPresent ? <CheckCircle2 className="h-8 w-8" /> : <Circle className="h-8 w-8" />}
                <span className="text-lg leading-tight">{isPresent ? "Estás Presente" : "Inscrito (Ausente)"}</span>
                {!isPresent && !event.isCharged && (
                  <p className="text-[10px] font-medium opacity-80 mt-1">Escanea el QR del organizador al llegar.</p>
                )}
              </div>
              
              <div className="space-y-4 border-t pt-6">
                <div className="flex justify-between items-end">
                  <div className="space-y-1">
                    <Label className="text-[10px] font-black uppercase text-muted-foreground tracking-[0.2em]">Tus Invitados (+1)</Label>
                    <p className="text-[10px] text-muted-foreground">Agrégalos aquí. Marcalos al llegar.</p>
                  </div>
                  {!event.isCharged && (
                    <Button variant="ghost" size="sm" className="h-7 text-[9px] font-black uppercase text-destructive" onClick={() => removeParticipantFromEvent(event.id, user.uid)}>
                      Darse de baja
                    </Button>
                  )}
                </div>

                {!event.isCharged && (
                  <div className="flex gap-2">
                    <Input 
                      placeholder="Nombre del acompañante" 
                      value={guestName} 
                      onChange={e => setGuestName(e.target.value)} 
                      className="h-12 rounded-2xl focus-visible:ring-accent bg-muted/50 border-none" 
                    />
                    <Button size="icon" className="h-12 w-12 shrink-0 bg-accent hover:bg-accent/90 rounded-2xl shadow-lg shadow-accent/20" onClick={handleAddGuest} disabled={!guestName}>
                      <Plus className="h-6 w-6 text-white" />
                    </Button>
                  </div>
                )}
                
                <div className="space-y-2 mt-4">
                  {myGuests.map((g, i) => (
                    <div key={i} className={cn(
                      "text-sm font-bold px-4 py-3 rounded-2xl flex justify-between items-center border transition-all",
                      g.present ? "bg-emerald-50 text-emerald-700 border-emerald-100" : "bg-muted/50 text-muted-foreground border-transparent"
                    )}>
                      <div className="flex items-center gap-3">
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className={cn("h-6 w-6 rounded-full", g.present ? "text-emerald-500" : "text-muted-foreground/30")}
                          onClick={() => handleToggleGuest(g)}
                          disabled={event.isCharged}
                        >
                          {g.present ? <CheckCircle className="h-5 w-5" /> : <Circle className="h-5 w-5" />}
                        </Button>
                        <span>{g.name}</span>
                      </div>
                      {!event.isCharged && (
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="h-8 w-8 text-muted-foreground/50 hover:bg-destructive/10 hover:text-destructive rounded-full"
                          onClick={() => handleRemoveGuest(g)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  ))}
                  {myGuests.length === 0 && (
                    <p className="text-center text-[10px] text-muted-foreground font-bold uppercase py-4 border-2 border-dashed rounded-[2rem] opacity-30">No has traído acompañantes</p>
                  )}
                </div>
              </div>
            </div>
          )}

          <div className="pt-2">
            <Button variant="ghost" className="w-full text-muted-foreground text-[10px] font-black uppercase tracking-widest gap-2" onClick={() => router.push("/dashboard/attendance")}>
              <ArrowLeft className="h-3 w-3" /> Mis eventos
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
