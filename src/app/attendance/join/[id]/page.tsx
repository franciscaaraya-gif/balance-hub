
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
import { Calendar, Loader2, MapPin, Clock, Users, Plus, CheckCircle2 } from "lucide-react";
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
  const [addingGuest, setAddingGuest] = useState(false);

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
      toast({ title: "Inscripción exitosa", description: `Te has sumado a: ${event.title}` });
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
      <div className="flex flex-col items-center justify-center min-h-screen gap-4">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
        <p className="text-muted-foreground animate-pulse font-medium">Cargando evento...</p>
      </div>
    );
  }

  if (!event) {
    return (
      <div className="flex items-center justify-center min-h-screen p-4">
        <Card className="max-w-md w-full text-center py-10">
          <CardHeader>
            <CardTitle>Evento no encontrado</CardTitle>
            <CardDescription>El link parece no ser válido.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => router.push("/dashboard")}>Volver al Dashboard</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const isJoined = event.presentIds?.includes(user?.uid || "");

  return (
    <div className="flex items-center justify-center min-h-screen bg-background p-4">
      <Card className="w-full max-w-md shadow-2xl border-none overflow-hidden">
        <div className="h-2 bg-accent" />
        <CardHeader className="text-center space-y-4">
          <div className="mx-auto bg-primary/10 p-4 rounded-full w-fit">
            <Calendar className="h-10 w-10 text-primary" />
          </div>
          <div>
            <CardTitle className="text-2xl font-headline">{event.title}</CardTitle>
            <div className="flex flex-wrap justify-center gap-3 text-xs text-muted-foreground font-medium mt-2">
              <span className="flex items-center gap-1"><MapPin className="h-3.5 w-3.5" /> {event.location}</span>
              <span className="flex items-center gap-1"><Clock className="h-3.5 w-3.5" /> {event.time}</span>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="bg-muted/30 p-4 rounded-2xl space-y-3">
             <div className="flex justify-between items-center text-sm">
               <span className="text-muted-foreground">Inscritos actuales:</span>
               <span className="font-bold">{(event.presentIds?.length || 0) + (event.externalGuests?.length || 0)}</span>
             </div>
             <div className="flex justify-between items-center text-sm">
               <span className="text-muted-foreground">Costo Total:</span>
               <span className="font-bold">${event.totalCost.toFixed(2)}</span>
             </div>
          </div>

          {!isJoined ? (
            <Button className="w-full bg-primary h-14 text-lg font-bold" onClick={handleJoin} disabled={joining}>
              {joining ? <Loader2 className="animate-spin mr-2" /> : "Confirmar mi Asistencia"}
            </Button>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center justify-center gap-2 text-emerald-600 bg-emerald-50 p-4 rounded-2xl font-bold border border-emerald-100">
                <CheckCircle2 className="h-5 w-5" /> Estás Inscrito
              </div>
              
              <div className="space-y-3 border-t pt-4">
                <Label className="text-xs font-bold uppercase text-muted-foreground tracking-widest">¿Vienes con alguien? (+1)</Label>
                <div className="flex gap-2">
                  <Input placeholder="Nombre del acompañante" value={guestName} onChange={e => setGuestName(e.target.value)} className="h-10" />
                  <Button size="icon" className="h-10 w-10 shrink-0" onClick={handleAddGuest} disabled={!guestName}>
                    <Plus className="h-5 w-5" />
                  </Button>
                </div>
                {event.externalGuests?.filter(g => g.addedBy === user?.uid).map((g, i) => (
                  <div key={i} className="text-xs font-medium bg-amber-50 text-amber-700 px-3 py-2 rounded-lg flex justify-between">
                    <span>Acompañante: {g.name}</span>
                    <span className="opacity-50">Añadido</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <Button variant="ghost" className="w-full text-muted-foreground" onClick={() => router.push("/dashboard/attendance")}>
            Ir a mis eventos
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
