
"use client";

import { useEffect, useState, use } from "react";
import { useRouter } from "next/navigation";
import { useUser, useFirestore, useDoc, useMemoFirebase } from "@/firebase";
import { addAndMarkPresent, addExternalGuest } from "@/lib/firebase/store";
import { Event } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Calendar, Loader2, MapPin, Clock, Users, Plus, CheckCircle2, UserPlus, Info, User, Nfc } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { doc } from "firebase/firestore";
import { Badge } from "@/components/ui/badge";

export default function JoinEvent({ params: paramsPromise }: { params: Promise<{ id: string }> }) {
  const params = use(paramsPromise);
  const { user, isUserLoading } = useUser();
  const router = useRouter();
  const { toast } = useToast();
  const firestore = useFirestore();

  const [joining, setJoining] = useState(false);
  const [scanningNfc, setScanningNfc] = useState(false);
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

  const simulateNfcJoin = () => {
    setScanningNfc(true);
    setTimeout(async () => {
      await handleJoin();
      setScanningNfc(false);
      toast({ title: "Check-in NFC Exitoso", description: "Tu asistencia ha sido registrada por proximidad." });
    }, 2000);
  };

  const handleAddGuest = async () => {
    if (!guestName || !user || !event) return;
    try {
      await addExternalGuest(params.id, guestName, user.uid);
      toast({ title: "Invitado añadido", description: `${guestName} se sumó a la cuenta.` });
      setGuestName("");
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

  const isJoined = event.presentIds?.includes(user.uid);
  const myGuests = event.externalGuests?.filter(g => g.addedBy === user.uid) || [];

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
              <User className="h-3 w-3" /> Organizado por: {event.creatorName || "Invitado"}
            </p>
            <div className="flex flex-wrap justify-center gap-2 text-xs text-muted-foreground font-medium mt-3 px-4">
              <span className="flex items-center gap-1 bg-muted px-2 py-1 rounded-full"><MapPin className="h-3 w-3" /> {event.location}</span>
              <span className="flex items-center gap-1 bg-muted px-2 py-1 rounded-full"><Clock className="h-3 w-3" /> {event.time}</span>
            </div>
          </div>
        </CardHeader>
        
        <CardContent className="space-y-6 px-6 pb-10">
          <div className="bg-primary/5 p-5 rounded-3xl border border-primary/10 space-y-3 shadow-inner">
             <div className="flex justify-between items-center text-sm">
               <span className="text-muted-foreground font-medium">Asistentes:</span>
               <span className="font-bold text-primary">{(event.presentIds?.length || 0) + (event.externalGuests?.length || 0)}</span>
             </div>
             <div className="flex justify-between items-center text-sm">
               <span className="text-muted-foreground font-medium">Costo Total:</span>
               <span className="font-bold text-primary">${event.totalCost.toFixed(2)}</span>
             </div>
             {isJoined && (
               <div className="pt-3 border-t border-primary/10 flex justify-between items-center">
                 <span className="text-[10px] font-bold text-accent uppercase tracking-wider">Tu Cuota:</span>
                 <span className="text-2xl font-headline font-bold text-accent">
                   ${(event.totalCost / Math.max(1, (event.presentIds?.length || 0) + (event.externalGuests?.length || 0))).toFixed(2)}
                 </span>
               </div>
             )}
          </div>

          {!isJoined ? (
            <div className="space-y-3">
              <Button className="w-full bg-primary h-14 text-lg font-bold shadow-xl shadow-primary/20 hover:scale-[1.02] transition-transform rounded-2xl" onClick={handleJoin} disabled={joining || scanningNfc}>
                {joining ? <Loader2 className="animate-spin mr-2" /> : <><UserPlus className="mr-2 h-5 w-5" /> Confirmar Asistencia</>}
              </Button>
              
              <div className="relative py-2">
                <div className="absolute inset-0 flex items-center"><span className="w-full border-t" /></div>
                <div className="relative flex justify-center text-[10px] uppercase"><span className="bg-white px-2 text-muted-foreground font-bold">o por cercanía</span></div>
              </div>

              <Button variant="outline" className="w-full h-14 border-dashed border-2 rounded-2xl gap-2 font-bold text-primary" onClick={simulateNfcJoin} disabled={joining || scanningNfc}>
                {scanningNfc ? <Loader2 className="h-5 w-5 animate-spin" /> : <><Nfc className="h-5 w-5" /> Tocar Terminal NFC</>}
              </Button>

              <p className="text-[9px] text-center text-muted-foreground uppercase font-bold tracking-widest leading-relaxed mt-4">
                <Info className="h-3 w-3 inline mr-1" /> Una vez confirmada, tu asistencia será definitiva para el cálculo del grupo.
              </p>
            </div>
          ) : (
            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div className="flex flex-col items-center justify-center gap-2 text-emerald-600 bg-emerald-50 p-6 rounded-[2rem] font-bold border border-emerald-100 shadow-sm">
                <CheckCircle2 className="h-8 w-8" /> 
                <span className="text-lg">¡Asistencia Confirmada!</span>
              </div>
              
              <div className="space-y-4 border-t pt-6">
                <div className="space-y-1">
                  <Label className="text-[10px] font-black uppercase text-muted-foreground tracking-[0.2em]">Acompañantes (+1)</Label>
                  <p className="text-[10px] text-muted-foreground">Cada acompañante divide el costo total.</p>
                </div>
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
                
                {myGuests.length > 0 && (
                  <div className="space-y-2 mt-4">
                    {myGuests.map((g, i) => (
                      <div key={i} className="text-sm font-bold bg-amber-50 text-amber-700 px-4 py-3 rounded-2xl flex justify-between items-center border border-amber-100 animate-in slide-in-from-right-4 duration-300">
                        <div className="flex items-center gap-2">
                          <Users className="h-4 w-4 opacity-70" />
                          <span>{g.name}</span>
                        </div>
                        <Badge variant="outline" className="text-[8px] bg-white/50 border-amber-200">Invitado por ti</Badge>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          <div className="pt-2">
            <Button variant="ghost" className="w-full text-muted-foreground text-[10px] font-black uppercase tracking-widest" onClick={() => router.push("/dashboard/attendance")}>
              Ir a mis eventos
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
