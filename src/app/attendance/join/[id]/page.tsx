
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
import { Calendar, Loader2, MapPin, Clock, Users, Plus, CheckCircle2, UserPlus, Info } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { doc } from "firebase/firestore";

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

  const isJoined = event.presentIds?.includes(user?.uid || "");
  const myGuests = event.externalGuests?.filter(g => g.addedBy === user?.uid) || [];

  return (
    <div className="flex items-center justify-center min-h-screen bg-muted/30 p-4">
      <Card className="w-full max-w-md shadow-2xl border-none overflow-hidden bg-white">
        <div className="h-2 bg-accent" />
        <CardHeader className="text-center space-y-4 pb-8">
          <div className="mx-auto bg-primary/10 p-4 rounded-full w-fit">
            <Calendar className="h-10 w-10 text-primary" />
          </div>
          <div>
            <CardTitle className="text-3xl font-headline font-bold text-primary">{event.title}</CardTitle>
            <div className="flex flex-wrap justify-center gap-3 text-sm text-muted-foreground font-medium mt-3">
              <span className="flex items-center gap-1"><MapPin className="h-4 w-4" /> {event.location}</span>
              <span className="flex items-center gap-1"><Clock className="h-4 w-4" /> {event.time}</span>
            </div>
          </div>
        </CardHeader>
        
        <CardContent className="space-y-8">
          <div className="bg-primary/5 p-5 rounded-2xl border border-primary/10 space-y-4">
             <div className="flex justify-between items-center text-sm">
               <span className="text-muted-foreground font-medium">Asistentes actuales:</span>
               <span className="font-bold text-primary text-lg">{(event.presentIds?.length || 0) + (event.externalGuests?.length || 0)}</span>
             </div>
             <div className="flex justify-between items-center text-sm">
               <span className="text-muted-foreground font-medium">Costo Total:</span>
               <span className="font-bold text-primary text-lg">${event.totalCost.toFixed(2)}</span>
             </div>
             {isJoined && (
               <div className="pt-3 border-t border-primary/10 flex justify-between items-center">
                 <span className="text-xs font-bold text-accent uppercase tracking-wider">Tu Cuota Estimada:</span>
                 <span className="text-xl font-headline font-bold text-accent">
                   ${(event.totalCost / ((event.presentIds?.length || 0) + (event.externalGuests?.length || 0))).toFixed(2)}
                 </span>
               </div>
             )}
          </div>

          {!isJoined ? (
            <div className="space-y-4">
              <Button className="w-full bg-primary h-16 text-xl font-bold shadow-xl shadow-primary/20 hover:scale-[1.02] transition-transform" onClick={handleJoin} disabled={joining}>
                {joining ? <Loader2 className="animate-spin mr-2" /> : <><UserPlus className="mr-2 h-6 w-6" /> Confirmar Mi Asistencia</>}
              </Button>
              <p className="text-[10px] text-center text-muted-foreground uppercase font-bold tracking-widest flex items-center justify-center gap-1">
                <Info className="h-3 w-3" /> Una vez confirmada, tu asistencia será definitiva
              </p>
            </div>
          ) : (
            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div className="flex items-center justify-center gap-3 text-emerald-600 bg-emerald-50 p-5 rounded-2xl font-bold border border-emerald-100 shadow-sm">
                <CheckCircle2 className="h-6 w-6" /> 
                <span className="text-lg">¡Asistencia Confirmada!</span>
              </div>
              
              <div className="space-y-4 border-t pt-6">
                <div className="space-y-1">
                  <Label className="text-xs font-bold uppercase text-muted-foreground tracking-widest">¿Vienes con acompañantes? (+1)</Label>
                  <p className="text-[10px] text-muted-foreground mb-3">Cada acompañante divide el costo total.</p>
                </div>
                <div className="flex gap-2">
                  <Input 
                    placeholder="Nombre del acompañante" 
                    value={guestName} 
                    onChange={e => setGuestName(e.target.value)} 
                    className="h-12 rounded-xl focus-visible:ring-accent" 
                  />
                  <Button size="icon" className="h-12 w-12 shrink-0 bg-accent hover:bg-accent/90 rounded-xl" onClick={handleAddGuest} disabled={!guestName}>
                    <Plus className="h-6 w-6 text-white" />
                  </Button>
                </div>
                
                {myGuests.length > 0 && (
                  <div className="space-y-2 mt-4">
                    <Label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Tus invitados:</Label>
                    {myGuests.map((g, i) => (
                      <div key={i} className="text-sm font-bold bg-amber-50 text-amber-700 px-4 py-3 rounded-xl flex justify-between items-center border border-amber-100">
                        <div className="flex items-center gap-2">
                          <Users className="h-4 w-4 opacity-70" />
                          <span>{g.name}</span>
                        </div>
                        <Badge variant="outline" className="text-[8px] bg-white/50 border-amber-200">Asociado a ti</Badge>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          <div className="pt-4 flex flex-col gap-2">
            <Button variant="ghost" className="w-full text-muted-foreground text-xs font-medium" onClick={() => router.push("/dashboard/attendance")}>
              Ir a mis eventos
            </Button>
          </div>
        </CardContent>
        <div className="bg-muted/50 p-4 text-center border-t">
          <p className="text-[10px] text-muted-foreground uppercase tracking-widest font-bold">BalanceHub Attendance System</p>
        </div>
      </Card>
    </div>
  );
}

function Badge({ children, variant = "default", className }: { children: React.ReactNode, variant?: "default" | "outline", className?: string }) {
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold ${variant === 'outline' ? 'border border-border text-muted-foreground' : 'bg-primary text-primary-foreground'} ${className}`}>
      {children}
    </span>
  );
}
