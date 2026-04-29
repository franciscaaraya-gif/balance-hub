"use client";

import { useEffect, useState, use } from "react";
import { useRouter } from "next/navigation";
import { useUser } from "@/firebase";
import { joinGroupByInvite, getGroupByToken } from "@/lib/firebase/store";
import { Group } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Wallet, Loader2, Users, AlertTriangle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";

export default function JoinGroup({ params: paramsPromise }: { params: Promise<{ token: string }> }) {
  const params = use(paramsPromise);
  const { user, isUserLoading: authLoading } = useUser();
  const router = useRouter();
  const { toast } = useToast();
  
  const [group, setGroup] = useState<Group | null>(null);
  const [loading, setLoading] = useState(true);
  const [joining, setJoining] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!authLoading && !user) {
      toast({ title: "Autenticación Requerida", description: "Por favor, inicia sesión para unirte al grupo." });
      router.push(`/login?redirect=/join/${params.token}`);
      return;
    }

    const fetchGroup = async () => {
      try {
        const groupData = await getGroupByToken(params.token);
        if (groupData) {
          setGroup(groupData);
        } else {
          setError("El enlace de invitación no es válido o el grupo ya no existe.");
        }
      } catch (err) {
        setError("Hubo un problema al cargar los detalles de la invitación.");
      } finally {
        setLoading(false);
      }
    };

    if (user) {
      fetchGroup();
    }
  }, [user, authLoading, router, params.token, toast]);

  const handleJoin = async () => {
    if (!user || !group) return;
    setJoining(true);
    try {
      const groupId = await joinGroupByInvite(user.uid, params.token);
      toast({ title: "¡Te has unido!", description: `Ahora eres miembro de ${group.name}.` });
      router.push(`/dashboard/groups/${groupId}`);
    } catch (error: any) {
      toast({ variant: "destructive", title: "Fallo al unirse", description: error.message });
      router.push("/dashboard");
    } finally {
      setJoining(false);
    }
  };

  if (authLoading || loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-4">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
        <p className="text-muted-foreground animate-pulse font-medium">Validando invitación...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background p-4">
        <Card className="w-full max-w-md shadow-xl border-none text-center">
          <CardHeader>
            <div className="flex justify-center mb-4">
              <div className="bg-destructive/10 p-3 rounded-full text-destructive">
                <AlertTriangle className="h-8 w-8" />
              </div>
            </div>
            <CardTitle className="text-2xl font-headline">Invitación no válida</CardTitle>
            <CardDescription>{error}</CardDescription>
          </CardHeader>
          <CardContent>
            <Button variant="outline" className="w-full" onClick={() => router.push("/dashboard")}>
              Ir al Panel Principal
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center min-h-screen bg-background p-4">
      <Card className="w-full max-w-md shadow-2xl border-none overflow-hidden">
        <div className="h-2 bg-accent" />
        <CardHeader className="space-y-4 text-center pb-8">
          <div className="flex justify-center">
            <div className="bg-primary/10 p-4 rounded-2xl text-primary">
              <Users className="h-10 w-10" />
            </div>
          </div>
          <div className="space-y-1">
            <CardTitle className="text-3xl font-headline tracking-tight">¡Invitación Recibida!</CardTitle>
            <CardDescription className="text-base">Has sido invitado a participar en un grupo de cobro.</CardDescription>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="bg-muted/30 p-6 rounded-2xl border border-border/50 space-y-4">
            <div className="space-y-1">
              <Label className="text-xs uppercase tracking-widest text-muted-foreground font-bold">Nombre del Grupo</Label>
              <p className="text-xl font-bold text-primary">{group?.name}</p>
            </div>
            <div className="flex items-center justify-between pt-2 border-t border-border/50">
              <div className="space-y-1">
                <Label className="text-xs uppercase tracking-widest text-muted-foreground font-bold">Tipo de Grupo</Label>
                <div className="flex gap-2">
                  <Badge variant="secondary" className="capitalize">
                    {group?.type === 'variable' ? 'Gastos Variables' : 'Objetivo Fijo'}
                  </Badge>
                </div>
              </div>
              <div className="text-right space-y-1">
                <Label className="text-xs uppercase tracking-widest text-muted-foreground font-bold">Miembros</Label>
                <p className="text-sm font-medium">{group?.memberIds.length} registrados</p>
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-3">
            <Button 
              className="w-full bg-accent hover:bg-accent/90 py-7 text-lg font-bold shadow-lg shadow-accent/20" 
              onClick={handleJoin}
              disabled={joining || !user}
            >
              {joining ? (
                <><Loader2 className="h-5 w-5 mr-2 animate-spin" /> Uniendo...</>
              ) : (
                "Aceptar Invitación y Unirme"
              )}
            </Button>
            <Button variant="ghost" className="text-muted-foreground" onClick={() => router.push("/dashboard")}>
              Tal vez más tarde
            </Button>
          </div>
        </CardContent>
        <div className="bg-muted/20 p-4 text-center">
          <p className="text-[10px] text-muted-foreground uppercase tracking-widest font-medium">
            BalanceHub • Gestión Transparente de Deudas
          </p>
        </div>
      </Card>
    </div>
  );
}

import { Label } from "@/components/ui/label";