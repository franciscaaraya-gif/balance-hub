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
import { PlusCircle, Users, Wallet, ChevronRight, Loader2, DollarSign, PiggyBank, ReceiptText, AlertCircle, Clock, CheckCircle2 } from "lucide-react";
import Link from "next/link";
import { useToast } from "@/hooks/use-toast";
import { collection, query, where, collectionGroup } from "firebase/firestore";
import { Progress } from "@/components/ui/progress";

// Sub-componente para calcular y mostrar estadísticas de cada grupo en su tarjeta
function GroupCardStats({ groupId }: { groupId: string }) {
  const firestore = useFirestore();
  const debtsQuery = useMemoFirebase(() => {
    if (!firestore || !groupId) return null;
    return collection(firestore, 'groups', groupId, 'debts');
  }, [firestore, groupId]);
  
  const { data: debts } = useCollection<Debt>(debtsQuery);

  const stats = useMemo(() => {
    if (!debts) return { total: 0, paid: 0 };
    return debts.reduce((acc, debt) => {
      acc.total += debt.amount;
      if (debt.status === 'paid') acc.paid += debt.amount;
      return acc;
    }, { total: 0, paid: 0 });
  }, [debts]);

  const progress = stats.total > 0 ? (stats.paid / stats.total) * 100 : 0;

  return (
    <div className="space-y-3 mt-4">
      <div className="flex justify-between items-end">
        <div className="space-y-1">
          <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">Recaudado</p>
          <p className="text-sm font-bold text-emerald-600 flex items-center gap-1">
            ${stats.paid.toFixed(2)}
          </p>
        </div>
        <div className="text-right space-y-1">
          <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">Objetivo</p>
          <p className="text-sm font-bold text-primary">
            ${stats.total.toFixed(2)}
          </p>
        </div>
      </div>
      <Progress value={progress} className="h-1.5 bg-muted" />
    </div>
  );
}

export default function Dashboard() {
  const { user, isUserLoading } = useUser();
  const firestore = useFirestore();
  const [newGroupName, setNewGroupName] = useState("");
  const [newGroupType, setNewGroupType] = useState<'fixed' | 'variable'>("variable");
  const [newGroupAmount, setNewGroupAmount] = useState("");
  const [open, setOpen] = useState(false);
  const { toast } = useToast();

  // Grupos donde el usuario es administrador
  const adminGroupsQuery = useMemoFirebase(() => {
    if (!firestore || !user?.uid) return null;
    return query(
      collection(firestore, 'groups'), 
      where('adminId', '==', user.uid)
    );
  }, [firestore, user?.uid]);
  const { data: adminGroups, isLoading: adminGroupsLoading } = useCollection<Group>(adminGroupsQuery);

  // Deudas personales del usuario (en todos los grupos)
  const myDebtsQuery = useMemoFirebase(() => {
    if (!firestore || !user?.uid) return null;
    // Usamos collectionGroup para encontrar deudas del usuario en CUALQUIER grupo
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

  const handleCreateGroup = () => {
    if (!newGroupName || !user) return;
    const amount = newGroupType === 'fixed' ? parseFloat(newGroupAmount) : undefined;
    
    if (newGroupType === 'fixed' && (isNaN(amount!) || amount! <= 0)) {
      toast({ variant: "destructive", title: "Monto inválido", description: "Por favor ingresa un monto válido." });
      return;
    }

    createGroup(newGroupName, newGroupType, user.uid, amount);
    toast({ title: "¡Éxito!", description: "Grupo creado correctamente." });
    setNewGroupName("");
    setNewGroupAmount("");
    setOpen(false);
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
      {/* Header Seccion */}
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
              <DialogDescription>Define el nombre de la deuda y cómo se cobrará a los miembros.</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Nombre de la Deuda</Label>
                <Input placeholder="Ej: Pago de Luz Junio" value={newGroupName} onChange={(e) => setNewGroupName(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Tipo de Cobro</Label>
                <div className="grid grid-cols-2 gap-4">
                  <Button 
                    type="button"
                    variant={newGroupType === 'variable' ? 'default' : 'outline'}
                    onClick={() => setNewGroupType('variable')}
                    className="w-full"
                  >
                    Monto Variable
                  </Button>
                  <Button 
                    type="button"
                    variant={newGroupType === 'fixed' ? 'default' : 'outline'}
                    onClick={() => setNewGroupType('fixed')}
                    className="w-full"
                  >
                    Monto Fijo
                  </Button>
                </div>
              </div>
              {newGroupType === 'fixed' && (
                <div className="space-y-2">
                  <Label>Monto por Persona ($)</Label>
                  <div className="relative">
                    <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input type="number" className="pl-9" placeholder="0.00" value={newGroupAmount} onChange={(e) => setNewGroupAmount(e.target.value)} />
                  </div>
                </div>
              )}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
              <Button onClick={handleCreateGroup} className="bg-primary">Crear Grupo</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid lg:grid-cols-3 gap-8">
        {/* Lado Izquierdo: Administracion */}
        <div className="lg:col-span-2 space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-headline font-bold flex items-center gap-2">
              <ReceiptText className="h-5 w-5 text-primary" /> Grupos que Administro
            </h2>
          </div>
          
          {adminGroupsLoading ? (
            <div className="grid gap-6 sm:grid-cols-2">
              {[1, 2].map(i => <div key={i} className="h-40 rounded-xl bg-muted animate-pulse" />)}
            </div>
          ) : adminGroups?.length === 0 ? (
            <Card className="border-dashed bg-transparent py-10">
              <CardContent className="flex flex-col items-center justify-center text-center space-y-3">
                <div className="p-3 bg-muted rounded-full"><Users className="h-6 w-6 text-muted-foreground" /></div>
                <div>
                  <p className="font-medium text-muted-foreground">No tienes grupos activos</p>
                  <p className="text-xs text-muted-foreground/60">Crea uno para empezar a cobrar deudas.</p>
                </div>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-6 sm:grid-cols-2">
              {adminGroups?.map(g => (
                <Link key={g.id} href={`/dashboard/groups/${g.id}`}>
                  <Card className="hover:shadow-md transition-all cursor-pointer border-l-4 border-l-primary group">
                    <CardHeader className="pb-2">
                      <div className="flex justify-between items-start">
                        <Badge variant={g.type === 'fixed' ? 'default' : 'secondary'} className="text-[10px]">
                          {g.type === 'fixed' ? 'FIJO' : 'VARIABLE'}
                        </Badge>
                        {g.fixedAmount && <span className="text-xs font-bold text-primary">${g.fixedAmount}</span>}
                      </div>
                      <CardTitle className="mt-2 text-lg group-hover:text-primary transition-colors">{g.name}</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <GroupCardStats groupId={g.id} />
                      <div className="flex justify-between items-center text-xs text-muted-foreground mt-4 pt-4 border-t">
                        <span className="flex items-center gap-1 font-medium"><Users className="h-3 w-3" /> {g.memberIds?.length || 0} Miembros</span>
                        <span className="flex items-center gap-1 text-primary font-bold">Gestionar <ChevronRight className="h-3 w-3" /></span>
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* Lado Derecho: Deudas Pendientes */}
        <div className="space-y-6">
          <h2 className="text-xl font-headline font-bold flex items-center gap-2">
            <Wallet className="h-5 w-5 text-accent" /> Mis Pagos Pendientes
          </h2>
          
          <Card className="border-accent/10">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Estado de Cuenta</CardTitle>
              <CardDescription>Resumen de lo que debes pagar.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {myDebtsLoading ? (
                <div className="space-y-3">
                  {[1, 2, 3].map(i => <div key={i} className="h-12 bg-muted animate-pulse rounded-lg" />)}
                </div>
              ) : debtsError ? (
                <div className="py-6 text-center text-xs text-muted-foreground">
                  No se pudieron cargar tus deudas. Reintenta más tarde.
                </div>
              ) : pendingDebts.length === 0 ? (
                <div className="py-6 text-center space-y-2">
                  <div className="inline-flex p-3 bg-emerald-50 rounded-full text-emerald-600"><CheckCircle2 className="h-6 w-6" /></div>
                  <p className="text-sm font-medium text-muted-foreground">¡Estás al día!</p>
                  <p className="text-[10px] text-muted-foreground/60">No tienes deudas pendientes.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {pendingDebts.map(debt => (
                    <div key={debt.id} className="flex items-center justify-between p-3 bg-muted/30 rounded-xl border group hover:bg-muted/50 transition-colors">
                      <div className="space-y-1">
                        <p className="text-xs font-bold truncate max-w-[120px]">{debt.description || "Deuda sin descripción"}</p>
                        {getStatusBadge(debt.status)}
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-bold text-accent">${debt.amount.toFixed(2)}</p>
                        <p className="text-[9px] text-muted-foreground uppercase">Ver detalles</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Banner Informativo */}
          <Card className="bg-primary text-primary-foreground border-none shadow-none">
            <CardContent className="pt-6">
              <div className="flex flex-col items-center text-center space-y-3">
                <PiggyBank className="h-10 w-10 text-accent" />
                <h3 className="font-headline font-bold">Gestión Centralizada</h3>
                <p className="text-xs text-primary-foreground/70">Aquí ves todo lo que te han cobrado en cualquier grupo de BalanceHub.</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}