"use client";

import { useState, useMemo } from "react";
import { useUser, useFirestore, useCollection, useMemoFirebase } from "@/firebase";
import { createGroup } from "@/lib/firebase/store";
import { Group, Debt } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { PlusCircle, Users, Wallet, ChevronRight, Loader2, PiggyBank, ReceiptText, AlertCircle, Clock, CheckCircle2 } from "lucide-react";
import Link from "next/link";
import { useToast } from "@/hooks/use-toast";
import { collection, query, where, collectionGroup } from "firebase/firestore";

export default function Dashboard() {
  const { user, isUserLoading } = useUser();
  const firestore = useFirestore();
  const [newGroupName, setNewGroupName] = useState("");
  const [newGroupType, setNewGroupType] = useState<'fixed' | 'variable'>("variable");
  const [open, setOpen] = useState(false);
  const { toast } = useToast();

  // Consulta todos los grupos donde el usuario es MIEMBRO (incluye admin)
  const myGroupsQuery = useMemoFirebase(() => {
    if (!firestore || !user?.uid) return null;
    return query(
      collection(firestore, 'groups'), 
      where('memberIds', 'array-contains', user.uid)
    );
  }, [firestore, user?.uid]);
  const { data: myGroups, isLoading: myGroupsLoading, error: groupsError } = useCollection<Group>(myGroupsQuery);

  const myDebtsQuery = useMemoFirebase(() => {
    if (!firestore || !user?.uid) return null;
    return query(
      collectionGroup(firestore, 'debts'),
      where('debtorId', '==', user.uid)
    );
  }, [firestore, user?.uid]);
  const { data: myDebts, isLoading: myDebtsLoading, error: debtsError } = useCollection<Debt>(myDebtsQuery);

  const pendingDebts = useMemo(() => {
    if (!myDebts) return [];
    return myDebts.filter(d => d.status !== 'paid');
  }, [myDebts]);

  const handleCreateGroup = async () => {
    if (!newGroupName || !user) return;
    try {
      await createGroup(newGroupName, newGroupType, user.uid);
      toast({ title: "¡Éxito!", description: "Grupo creado correctamente." });
      setNewGroupName("");
      setOpen(false);
    } catch (e) {
      toast({ variant: "destructive", title: "Error", description: "No se pudo crear el grupo." });
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending': return <Badge variant="outline" className="text-orange-600 bg-orange-50 border-orange-200 text-[10px]"><AlertCircle className="h-2.5 w-2.5 mr-1" /> Pendiente</Badge>;
      case 'under_review': return <Badge variant="outline" className="text-blue-600 bg-blue-50 border-blue-200 text-[10px] animate-pulse"><Clock className="h-2.5 w-2.5 mr-1" /> En Revisión</Badge>;
      default: return null;
    }
  };

  if (isUserLoading) return <div className="flex justify-center py-20"><Loader2 className="animate-spin text-primary" /></div>;

  return (
    <div className="space-y-10 max-w-6xl mx-auto">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-headline font-bold text-primary">¡Hola, {user?.displayName}!</h1>
          <p className="text-muted-foreground">Gestiona tus cobros y pagos desde un solo lugar.</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="bg-accent hover:bg-accent/90 gap-2 h-12 px-6 shadow-lg shadow-accent/20">
              <PlusCircle className="h-5 w-5" /> Nuevo Cobro Grupal
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Crear Grupo de Cobro</DialogTitle>
              <DialogDescription>Define el nombre de la deuda y el tipo de cobro.</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Nombre del Grupo / Deuda</Label>
                <Input 
                  placeholder="Ej: Asado Familiar, Luz Agosto" 
                  value={newGroupName} 
                  onChange={(e) => setNewGroupName(e.target.value)} 
                />
              </div>
              <div className="space-y-2">
                <Label>Tipo de Cobro</Label>
                <div className="grid grid-cols-2 gap-4">
                  <Button 
                    type="button"
                    variant={newGroupType === 'fixed' ? 'default' : 'outline'}
                    onClick={() => setNewGroupType('fixed')}
                    className="w-full h-20 flex-col gap-1"
                  >
                    <Users className="h-5 w-5" />
                    <span className="font-bold">Partes Iguales</span>
                    <span className="text-[10px] opacity-70">Mismo monto para todos</span>
                  </Button>
                  <Button 
                    type="button"
                    variant={newGroupType === 'variable' ? 'default' : 'outline'}
                    onClick={() => setNewGroupType('variable')}
                    className="w-full h-20 flex-col gap-1"
                  >
                    <Wallet className="h-5 w-5" />
                    <span className="font-bold">Variable</span>
                    <span className="text-[10px] opacity-70">Diferente por miembro</span>
                  </Button>
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
              <Button onClick={handleCreateGroup} className="bg-primary">Crear Grupo</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {(groupsError || debtsError) && (
        <div className="p-4 bg-destructive/10 text-destructive rounded-lg flex items-center gap-2">
          <AlertCircle className="h-5 w-5" />
          <span>Hubo un problema al cargar tus datos. Reintenta en unos momentos.</span>
        </div>
      )}

      <div className="grid lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-6">
          <h2 className="text-xl font-headline font-bold flex items-center gap-2">
            <ReceiptText className="h-5 w-5 text-primary" /> Mis Grupos
          </h2>
          
          {myGroupsLoading ? (
            <div className="grid gap-6 sm:grid-cols-2">
              {[1, 2].map(i => <div key={i} className="h-32 rounded-xl bg-muted animate-pulse" />)}
            </div>
          ) : myGroups?.length === 0 ? (
            <Card className="border-dashed bg-transparent py-10">
              <CardContent className="flex flex-col items-center justify-center text-center space-y-3">
                <div className="p-3 bg-muted rounded-full"><Users className="h-6 w-6 text-muted-foreground" /></div>
                <div>
                  <p className="font-medium text-muted-foreground">No tienes grupos activos</p>
                  <p className="text-xs text-muted-foreground/60">Crea uno o únete a través de un enlace.</p>
                </div>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-6 sm:grid-cols-2">
              {myGroups?.map(g => (
                <Link key={g.id} href={`/dashboard/groups/${g.id}`}>
                  <Card className="hover:shadow-md transition-all cursor-pointer border-l-4 border-l-primary group">
                    <CardHeader className="pb-4">
                      <div className="flex justify-between items-start">
                        <Badge variant={g.type === 'fixed' ? 'default' : 'secondary'} className="text-[10px]">
                          {g.type === 'fixed' ? 'IGUALES' : 'VARIABLE'}
                        </Badge>
                        {g.adminId === user?.uid && <Badge variant="outline" className="text-[8px] border-primary text-primary">Admin</Badge>}
                      </div>
                      <CardTitle className="mt-2 text-lg group-hover:text-primary transition-colors">{g.name}</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="flex justify-between items-center text-xs text-muted-foreground pt-4 border-t">
                        <span className="flex items-center gap-1 font-medium"><Users className="h-3 w-3" /> {g.memberIds?.length || 0} Miembros</span>
                        <span className="flex items-center gap-1 text-primary font-bold">Entrar <ChevronRight className="h-3 w-3" /></span>
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          )}
        </div>

        <div className="space-y-6">
          <h2 className="text-xl font-headline font-bold flex items-center gap-2">
            <Wallet className="h-5 w-5 text-accent" /> Mis Pagos Pendientes
          </h2>
          
          <Card className="border-accent/10">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Estado de Cuenta</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {myDebtsLoading ? (
                <div className="space-y-3">
                  {[1, 2, 3].map(i => <div key={i} className="h-12 bg-muted animate-pulse rounded-lg" />)}
                </div>
              ) : pendingDebts.length === 0 ? (
                <div className="py-6 text-center space-y-2">
                  <div className="inline-flex p-3 bg-emerald-50 rounded-full text-emerald-600"><CheckCircle2 className="h-6 w-6" /></div>
                  <p className="text-sm font-medium text-muted-foreground">¡Estás al día!</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {pendingDebts.map(debt => (
                    <div key={debt.id} className="flex items-center justify-between p-3 bg-muted/30 rounded-xl border group hover:bg-muted/50 transition-colors">
                      <div className="space-y-1">
                        <p className="text-xs font-bold truncate max-w-[120px]">{debt.description || "Deuda"}</p>
                        {getStatusBadge(debt.status)}
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-bold text-accent">${debt.amount.toFixed(2)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
