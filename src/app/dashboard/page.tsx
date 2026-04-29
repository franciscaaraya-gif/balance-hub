
"use client";

import { useState, useMemo, useEffect } from "react";
import { useUser, useFirestore, useCollection, useMemoFirebase } from "@/firebase";
import { createGroup } from "@/lib/firebase/store";
import { Group, Debt } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PlusCircle, Users, Wallet, UserCircle, Briefcase, ChevronRight, Loader2, DollarSign, PiggyBank, ReceiptText } from "lucide-react";
import Link from "next/link";
import { useToast } from "@/hooks/use-toast";
import { collection, query, where } from "firebase/firestore";
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
          <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">Total Recaudado</p>
          <p className="text-sm font-bold text-emerald-600 flex items-center gap-1">
            <PiggyBank className="h-3 w-3" /> ${stats.paid.toFixed(2)}
          </p>
        </div>
        <div className="text-right space-y-1">
          <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">Objetivo Total</p>
          <p className="text-sm font-bold text-primary flex items-center gap-1 justify-end">
            ${stats.total.toFixed(2)} <ReceiptText className="h-3 w-3" />
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
  const [isAdminView, setIsAdminView] = useState(true);
  const [newGroupName, setNewGroupName] = useState("");
  const [newGroupType, setNewGroupType] = useState<'fixed' | 'variable'>("variable");
  const [newGroupAmount, setNewGroupAmount] = useState("");
  const [open, setOpen] = useState(false);
  const { toast } = useToast();

  const groupsQuery = useMemoFirebase(() => {
    if (!firestore || !user?.uid) return null;
    return query(
      collection(firestore, 'groups'), 
      where('memberIds', 'array-contains', user.uid)
    );
  }, [firestore, user?.uid]);
  const { data: allGroups, isLoading: groupsLoading } = useCollection<Group>(groupsQuery);

  const adminGroups = useMemo(() => {
    if (!allGroups || !user) return [];
    return allGroups.filter(g => g.adminId === user.uid);
  }, [allGroups, user]);

  const handleCreateGroup = () => {
    if (!newGroupName || !user) return;
    const amount = newGroupType === 'fixed' ? parseFloat(newGroupAmount) : undefined;
    
    if (newGroupType === 'fixed' && (isNaN(amount!) || amount! <= 0)) {
      toast({ variant: "destructive", title: "Monto inválido", description: "Por favor ingresa un monto válido para el grupo fijo." });
      return;
    }

    createGroup(newGroupName, newGroupType, user.uid, amount);
    toast({ title: "¡Éxito!", description: "Grupo creado correctamente." });
    setNewGroupName("");
    setNewGroupAmount("");
    setOpen(false);
  };

  const isGlobalLoading = isUserLoading || groupsLoading;

  return (
    <div className="space-y-8 max-w-6xl mx-auto">
      <div className="flex flex-col sm:flex-row items-center justify-between gap-6 bg-white p-6 rounded-2xl shadow-sm border">
        <div className="flex items-center gap-4">
          <div className={`p-2 rounded-lg ${isAdminView ? 'bg-primary text-white' : 'bg-secondary text-white'}`}>
            {isAdminView ? <Briefcase className="h-6 w-6" /> : <UserCircle className="h-6 w-6" />}
          </div>
          <div>
            <h1 className="text-2xl font-headline font-bold text-primary">
              {isAdminView ? "Panel de Administrador" : "Mis Deudas"}
            </h1>
            <p className="text-muted-foreground text-sm">Gestiona tus finanzas grupales</p>
          </div>
        </div>
        <div className="flex items-center gap-3 bg-muted/50 p-2 rounded-full px-4 border">
          <span className="text-sm font-medium">Usuario</span>
          <Switch checked={isAdminView} onCheckedChange={setIsAdminView} />
          <span className="text-sm font-medium">Admin</span>
        </div>
      </div>

      {isAdminView ? (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-headline font-semibold flex items-center gap-2"><Users className="h-5 w-5" /> Tus Grupos</h2>
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild><Button className="bg-accent gap-2"><PlusCircle className="h-4 w-4" /> Crear Cobro</Button></DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>Nuevo Grupo de Cobro</DialogTitle><DialogDescription>Crea un grupo para gestionar una deuda específica.</DialogDescription></DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label>Nombre de la Deuda</Label>
                    <Input placeholder="Ej: Pago de Agua Mayo" value={newGroupName} onChange={(e) => setNewGroupName(e.target.value)} />
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
                        Variable
                      </Button>
                      <Button 
                        type="button"
                        variant={newGroupType === 'fixed' ? 'default' : 'outline'}
                        onClick={() => setNewGroupType('fixed')}
                        className="w-full"
                      >
                        Fijo
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
          {isGlobalLoading ? (
            <div className="flex justify-center py-20"><Loader2 className="animate-spin text-primary" /></div>
          ) : (
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {adminGroups.length === 0 ? (
                <div className="col-span-full py-20 text-center border-dashed border-2 rounded-xl">
                  <p className="text-muted-foreground">No eres administrador de ningún grupo.</p>
                </div>
              ) : (
                adminGroups.map(g => (
                  <Link key={g.id} href={`/dashboard/groups/${g.id}`}>
                    <Card className="hover:shadow-md transition-all cursor-pointer overflow-hidden border-l-4 border-l-primary group">
                      <CardHeader className="pb-2">
                        <div className="flex justify-between items-start">
                          <Badge variant={g.type === 'fixed' ? 'default' : 'secondary'} className="text-[10px]">
                            {g.type === 'fixed' ? 'MONTO FIJO' : 'VARIABLE'}
                          </Badge>
                          {g.fixedAmount && <span className="text-xs font-bold text-primary">${g.fixedAmount}</span>}
                        </div>
                        <CardTitle className="mt-2 text-lg group-hover:text-primary transition-colors">{g.name}</CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-1">
                        <GroupCardStats groupId={g.id} />
                        <div className="flex justify-between items-center text-xs text-muted-foreground mt-4 pt-4 border-t">
                          <span className="flex items-center gap-1 font-medium"><Users className="h-3 w-3" /> {g.memberIds.length} Miembros</span>
                          <span className="flex items-center gap-1 text-primary font-bold">Gestionar <ChevronRight className="h-3 w-3" /></span>
                        </div>
                      </CardContent>
                    </Card>
                  </Link>
                ))
              )}
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-6">
          <h2 className="text-xl font-headline font-semibold flex items-center gap-2"><Wallet className="h-5 w-5" /> Deudas Pendientes</h2>
          <Card className="p-20 text-center border-dashed border-2 bg-transparent">
            <CardTitle className="text-muted-foreground font-headline">Selecciona un grupo para ver tus deudas detalladas</CardTitle>
            <p className="mt-4 text-sm text-muted-foreground">Aquí aparecerán los cobros que tienes pendientes de pago en tus grupos.</p>
          </Card>
        </div>
      )}
    </div>
  );
}
