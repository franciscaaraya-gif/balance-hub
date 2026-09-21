"use client";

import { useEffect, useState, use } from "react";
import { useRouter } from "next/navigation";
import { useUser, useFirestore, useDoc, useMemoFirebase } from "@/firebase";
import { addParticipantToEvent, addExternalGuest } from "@/lib/firebase/store";
import { Event } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Calendar, Loader2, MapPin, Clock, User, Send, ArrowLeft, CheckCircle2, Plus, Trash2, Users } from "lucide-react";
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
  const [guests, setGuests] = useState<string[]>([]);

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

  const addGuest = () => {
    if (guestName.trim()) {
      setGuests([...guests, guestName.trim()]);
      setGuestName("");
    }
  };

  const removeGuest = (index: number) => {
    setGuests(guests.filter((_, i) => i !== index));
  };

  const handleJoin = async () => {
    if (!user || !event) return;
    setJoining(true);
    try {
      // 1. Unirse al evento y al grupo
      await addParticipantToEvent(event.id, user.uid);
      
      // 2. Registrar invitados asociados
      for (const name of guests) {
        await addExternalGuest(event.id, name, user.uid);
      }

      toast({ 
        title: "RSVP Confirmado", 
        description: `Te has anotado con ${guests.length} acompañantes. Eres miembro oficial del grupo.` 
      });
    } catch (error: any) {
      console.error('Error al inscribirse:', error);
      toast({ 
        variant: "destructive", 
        title: "Error al inscribirse", 
        description: error.message || "Ocurrió un error inesperado al procesar tu RSVP." 
      });
    } finally {
      setJoining(false);
    }
  };

  if (isUserLoading || eventLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-4 bg-background">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
        <p className="text-muted-foreground animate-pulse font-medium">Cargando detalles del evento...</p>
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
            <CardDescription>El enlace parece inválido o fue dado de baja.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => router.push("/dashboard")} className="w-full">Ir al Dashboard</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const isEnrolled = event.participantIds?.includes(user.uid) || false;

  return (
    <div className="flex items-center justify-center min-h-screen bg-muted/30 p-4">
      <Card className="w-full max-w-md shadow-2xl border-none overflow-hidden bg-white rounded-[2rem]">
        <div className="h-2 bg-accent" />
        <CardHeader className="text-center space-y-3 pb-6 pt-8">
          <div className="mx-auto bg-primary/10 p-4 rounded-full w-fit">
            <Calendar className="h-8 w-8 text-primary" />
          </div>
          <div>
            <CardTitle className="text-2xl sm:text-3xl font-headline font-bold text-primary px-2 leading-tight">{event.title}</CardTitle>
            <p className="text-[10px] text-muted-foreground font-bold flex items-center justify-center gap-1 mt-2">
              <User className="h-3 w-3" /> Organizado por: {event.creatorName || "Administrador"}
            </p>
            <div className="flex flex-wrap justify-center gap-2 text-xs text-muted-foreground font-medium mt-3 px-4">
              <span className="flex items-center gap-1 bg-muted px-2 py-1 rounded-full"><MapPin className="h-3.5 w-3.5" /> {event.location || "Presencial"}</span>
              <span className="flex items-center gap-1 bg-muted px-2 py-1 rounded-full"><Clock className="h-3.5 w-3.5" /> {event.time}</span>
            </div>
          </div>
        </CardHeader>
        
        <CardContent className="space-y-6 px-6 pb-10">
          <div className="bg-muted/40 p-4 rounded-xl text-center text-xs text-muted-foreground">
            Concepto del Costo: <span className="font-bold text-primary">{event.costConcept || "Gasto general"}</span>
          </div>

          {!isEnrolled ? (
            <div className="space-y-6">
              {/* Sección de Acompañantes (+1) */}
              <div className="space-y-3">
                <Label className="text-[10px] uppercase font-black tracking-widest text-muted-foreground flex items-center gap-2">
                  <Plus className="h-3 w-3" /> ¿Traes acompañantes? (+1)
                </Label>
                <div className="flex gap-2">
                  <Input 
                    placeholder="Nombre del invitado" 
                    value={guestName}
                    onChange={(e) => setGuestName(e.target.value)}
                    className="h-11 rounded-xl"
                  />
                  <Button 
                    type="button" 
                    variant="outline" 
                    onClick={addGuest}
                    className="h-11 w-11 p-0 rounded-xl"
                  >
                    <Plus className="h-5 w-5" />
                  </Button>
                </div>
                
                {guests.length > 0 && (
                  <div className="space-y-2 pt-2">
                    {guests.map((name, idx) => (
                      <div key={idx} className="flex items-center justify-between p-3 bg-muted/30 rounded-xl">
                        <span className="text-xs font-bold">{name}</span>
                        <Button variant="ghost" size="icon" onClick={() => removeGuest(idx)} className="h-7 w-7 text-destructive">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="space-y-4">
                <div className="bg-primary/5 p-5 rounded-2xl border border-primary/10 text-center">
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Al confirmar quedarás agendado en el evento e ingresarás automáticamente como miembro con acceso total al grupo de pagos.
                  </p>
                </div>
                <Button className="w-full bg-accent hover:bg-accent/90 h-14 text-lg font-bold rounded-2xl shadow-lg text-white" onClick={handleJoin} disabled={joining}>
                  {joining ? <Loader2 className="animate-spin mr-2" /> : <><Send className="mr-2 h-5 w-5" /> Confirmar Asistencia (RSVP)</>}
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-4 text-center">
              <div className="flex flex-col items-center justify-center gap-2 p-6 rounded-2xl bg-emerald-50 text-emerald-700 border border-emerald-100 font-bold">
                <CheckCircle2 className="h-8 w-8 text-emerald-500" />
                <span className="text-base">¡Ya estás confirmado para esta fecha!</span>
                <p className="text-[10px] text-emerald-600/80 font-medium font-body pt-1 leading-relaxed">
                  {event.isCharged ? "Este evento ya ha sido liquidado." : "Escanea el código QR del administrador al llegar para registrar tu presencia física."}
                </p>
              </div>
            </div>
          )}

          <div className="pt-2">
            <Button variant="ghost" className="w-full text-muted-foreground text-[10px] font-black uppercase tracking-widest gap-2" onClick={() => router.push("/dashboard/attendance")}>
              <ArrowLeft className="h-3 w-3" /> Ver mis eventos
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
