"use client";

import { useState, useMemo, useEffect } from "react";
import { useUser, useFirestore, useCollection, useMemoFirebase } from "@/firebase";
import { createGroup, updateDebtStatusInGroup, getUserProfile } from "@/lib/firebase/store";
import { Group, Debt, UserProfile } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PlusCircle, Users, Wallet, UserCircle, Briefcase, ChevronRight, CheckCircle2, Clock, Loader2 } from "lucide-react";
import Link from "next/link";
import { useToast } from "@/hooks/use-toast";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { collection, query, where, collectionGroup } from "firebase/firestore";

type GroupedDebt = {
  adminName: string;
  adminId: string;
  totalAmount: number;
  debts: (Debt & { groupName: string })[];
};

export default function Dashboard() {
  const { user } = useUser();
  const firestore = useFirestore();
  const [isAdminView, setIsAdminView] = useState(true);
  const [newGroupName, setNewGroupName] = useState("");
  const [newGroupType, setNewGroupType] = useState<'fixed' | 'variable'>("variable");
  const [open, setOpen] = useState(false);
  const { toast } = useToast();

  // Grupos donde soy miembro (Admin o Usuario)
  const groupsQuery = useMemoFirebase(() => {
    if (!firestore || !user) return null;
    return query(
      collection(firestore, 'groups'), 
      where('memberIds', 'array-contains', user.uid)
    );
  }, [firestore, user]);
  const { data: allGroups, isLoading: groupsLoading } = useCollection<Group>(groupsQuery);

  // Mis deudas (Vista Usuario)
  const debtsQuery = useMemoFirebase(() => {
    if (!firestore || !user) return null;
    // IMPORTANTE: El filtro debe coincidir exactamente con lo que permiten las reglas de seguridad
    return query(
      collectionGroup(firestore, 'debts'), 
      where('debtorId', '==', user.uid)
    );
  }, [firestore, user]);
  const { data: myDebts, isLoading: debtsLoading } = useCollection<Debt>(debtsQuery);

  const adminGroups = useMemo(() => {
    if (!allGroups || !user) return [];
    return allGroups.filter(g => g.adminId === user.uid);
  }, [allGroups, user]);

  const [groupedDebts, setGroupedDebts] = useState<GroupedDebt[]>([]);

  useEffect(() => {
    const resolveGroupedDebts = async () => {
      if (!myDebts || !allGroups || myDebts.length === 0) {
        setGroupedDebts([]);
        return;
      }

      const groupsMap: Record<string, GroupedDebt> = {};
      const adminsCache: Record<string, string> = {};

      for (const debt of myDebts) {
        if (debt.status === 'paid') continue;

        const group = allGroups.find(g => g.id === debt.groupId);
        if (!group) continue;

        let adminName = adminsCache[group.adminId];
        if (!adminName) {
          try {
            const profile = await getUserProfile(group.adminId);
            adminName = profile?.displayName || "Administrador";
            adminsCache[group.adminId] = adminName;
          } catch (e) {
            adminName = "Administrador";
          }
        }

        if (!groupsMap[group.adminId]) {
          groupsMap[group.adminId] = {
            adminName,
            adminId: group.adminId,
            totalAmount: 0,
            debts: []
          };
        }

        groupsMap[group.adminId].totalAmount += debt.amount;
        groupsMap[group.adminId].debts.push({
          ...debt,
          groupName: group.name
        });
      }
      setGroupedDebts(Object.values(groupsMap));
    };

    resolveGroupedDebts();
  }, [myDebts, allGroups]);

  const handleCreateGroup = () => {
    if (!newGroupName || !user) return;
    createGroup(newGroupName, newGroupType, user.uid);
    toast({ title: "¡Éxito!", description: `El grupo "${newGroupName}" ha sido creado.` });
    setNewGroupName("");
    setOpen(false);
  };

  const handleSettleTotal = (adminDebts: (Debt & { groupName: string })[]) => {
    const pendingDebts = adminDebts.filter(d => d.status === 'pending');
    if (pendingDebts.length === 0) {
      toast({ title: "Sin cambios", description: "Estas deudas ya están en revisión." });
      return;
    }

    pendingDebts.forEach(debt => {
      updateDebtStatusInGroup(debt.groupId, debt.id, 'under_review');
    });
    
    toast({ title: "Solicitud enviada", description: "El administrador revisará tus pagos pronto." });
  };

  const loading = groupsLoading || debtsLoading;

  return (
    <div className="space-y-8 max-w-6xl mx-auto">
      <div className="flex flex-col sm:flex-row items-center justify-between gap-6 bg-white p-6 rounded-2xl shadow-sm border border-primary/5">
        <div className="flex items-center gap-4">
          <div className={`p-2 rounded-lg transition-colors ${isAdminView ? 'bg-primary text-white' : 'bg-secondary text-white'}`}>
            {isAdminView ? <Briefcase className="h-6 w-6" /> : <UserCircle className="h-6 w-6" />}
          </div>
          <div>
            <h1 className="text-2xl font-headline font-bold text-primary">
              {isAdminView ? "Panel de Administrador" : "Mis Deudas"}
            </h1>
            <p className="text-muted-foreground text-sm">
              {isAdminView ? "Gestiona tus grupos y cobros" : "Revisa lo que debes a otros administradores"}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 bg-muted/50 p-2 rounded-full px-4 border">
          <Label htmlFor="view-mode" className={`text-sm font-medium transition-colors ${!isAdminView ? 'text-primary' : 'text-muted-foreground'}`}>
            Usuario
          </Label>
          <Switch 
            id="view-mode" 
            checked={isAdminView} 
            onCheckedChange={setIsAdminView}
            className="data-[state=checked]:bg-primary"
          />
          <Label htmlFor="view-mode" className={`text-sm font-medium transition-colors ${isAdminView ? 'text-primary' : 'text-muted-foreground'}`}>
            Admin
          </Label>
        </div>
      </div>

      {isAdminView ? (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-headline font-semibold flex items-center gap-2">
              <Users className="h-5 w-5 text-accent" />
              Tus Grupos Creados
            </h2>
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild>
                <Button className="bg-accent hover:bg-accent/90 gap-2 shadow-lg shadow-accent/20">
                  <PlusCircle className="h-4 w-4" />
                  Crear Nuevo Grupo
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Nuevo Grupo de Deuda</DialogTitle>
                  <DialogDescription>Configura un espacio para gestionar gastos compartidos.</DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                  <div className="space-y-2">
                    <Label htmlFor="name">Nombre del Grupo</Label>
                    <Input id="name" value={newGroupName} onChange={(e) => setNewGroupName(e.target.value)} placeholder="Ej: Viaje a la playa" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="type">Tipo de Gestión</Label>
                    <Select value={newGroupType} onValueChange={(val: any) => setNewGroupType(val)}>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecciona tipo" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="variable">Variable (Gastos continuos)</SelectItem>
                        <SelectItem value="fixed">Fijo (Objetivo único)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
                  <Button onClick={handleCreateGroup} className="bg-primary">Crear Grupo</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : adminGroups.length === 0 ? (
            <Card className="border-dashed border-2 flex flex-col items-center justify-center py-20 text-center bg-transparent">
              <Users className="h-10 w-10 text-muted-foreground mb-4" />
              <CardTitle className="text-xl">Aún no tienes grupos</CardTitle>
              <CardDescription className="max-w-[300px] mt-2">
                Crea tu primer grupo para empezar a gestionar deudas con tus amigos.
              </CardDescription>
            </Card>
          ) : (
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {adminGroups.map((group) => (
                <Link key={group.id} href={`/dashboard/groups/${group.id}`}>
                  <Card className="h-full border-none shadow-sm hover:shadow-md transition-all group overflow-hidden">
                    <div className="h-2 bg-primary/20 group-hover:bg-primary transition-colors" />
                    <CardHeader>
                      <div className="flex justify-between items-start mb-2">
                        <Badge variant="outline" className="capitalize text-[10px] tracking-widest px-2">
                          {group.type}
                        </Badge>
                        <span className="text-xs text-muted-foreground flex items-center gap-1">
                          <Users className="h-3 w-3" />
                          {group.memberIds.length}
                        </span>
                      </div>
                      <CardTitle className="font-headline text-xl group-hover:text-primary transition-colors">
                        {group.name}
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="flex items-center justify-between text-sm font-medium text-primary">
                        <span>Gestionar Grupo</span>
                        <ChevronRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-6">
          <h2 className="text-xl font-headline font-semibold flex items-center gap-2">
            <Wallet className="h-5 w-5 text-primary" />
            Resumen de Deudas Pendientes
          </h2>

          {loading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : groupedDebts.length === 0 ? (
            <Card className="border-dashed border-2 flex flex-col items-center justify-center py-20 text-center bg-transparent">
              <Wallet className="h-10 w-10 text-emerald-500 mb-4" />
              <CardTitle className="text-xl">¡Estás al día!</CardTitle>
              <CardDescription>No tienes deudas pendientes registradas.</CardDescription>
            </Card>
          ) : (
            <div className="space-y-6">
              <Accordion type="single" collapsible className="space-y-4">
                {groupedDebts.map((item) => (
                  <AccordionItem key={item.adminId} value={item.adminId} className="border-none">
                    <Card className="border-none shadow-sm overflow-hidden">
                      <AccordionTrigger className="hover:no-underline p-0 data-[state=open]:bg-muted/5 transition-colors">
                        <div className="flex flex-row items-center justify-between w-full p-4 md:p-6 text-left">
                          <div className="flex items-center gap-3">
                            <div className="h-12 w-12 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-lg">
                              {item.adminName[0]}
                            </div>
                            <div>
                              <CardTitle className="text-lg font-headline">{item.adminName}</CardTitle>
                              <CardDescription>{item.debts.length} deudas individuales</CardDescription>
                            </div>
                          </div>
                          <div className="text-right mr-4">
                            <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Total</p>
                            <p className="text-2xl font-headline font-bold text-accent">${item.totalAmount.toFixed(2)}</p>
                          </div>
                        </div>
                      </AccordionTrigger>
                      <AccordionContent className="p-0 border-t bg-muted/5">
                        <div className="divide-y divide-muted/50">
                          {item.debts.map((debt) => (
                            <div key={debt.id} className="flex items-center justify-between p-4 px-6 hover:bg-muted/10 transition-colors">
                              <div>
                                <p className="font-medium text-sm">{debt.description || "Gasto sin descripción"}</p>
                                <div className="flex items-center gap-2 mt-1">
                                  <Badge variant="secondary" className="text-[10px] px-1.5 h-5">
                                    {debt.groupName}
                                  </Badge>
                                  {debt.status === 'under_review' && (
                                    <Badge variant="outline" className="text-[10px] text-blue-600 bg-blue-50 border-blue-200 h-5">
                                      En revisión
                                    </Badge>
                                  )}
                                </div>
                              </div>
                              <div className="flex items-center gap-4">
                                <span className="font-bold text-primary font-mono">${debt.amount.toFixed(2)}</span>
                                <Link href={`/dashboard/groups/${debt.groupId}`}>
                                  <Button size="icon" variant="ghost" className="h-8 w-8">
                                    <ChevronRight className="h-4 w-4" />
                                  </Button>
                                </Link>
                              </div>
                            </div>
                          ))}
                        </div>
                        <div className="p-4 bg-white border-t flex justify-end">
                          <Button 
                            className="bg-accent hover:bg-accent/90 gap-2"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleSettleTotal(item.debts);
                            }}
                            disabled={item.debts.every(d => d.status === 'under_review')}
                          >
                            <CheckCircle2 className="h-4 w-4" />
                            Liquidar Deuda Total
                          </Button>
                        </div>
                      </AccordionContent>
                    </Card>
                  </AccordionItem>
                ))}
              </Accordion>
            </div>
          )}
        </div>
      )}
    </div>
  );
}