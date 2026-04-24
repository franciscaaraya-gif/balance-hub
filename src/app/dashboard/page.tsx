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
import { PlusCircle, Users, Wallet, UserCircle, Briefcase, ChevronRight, CheckCircle2, Loader2 } from "lucide-react";
import Link from "next/link";
import { useToast } from "@/hooks/use-toast";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { collection, query, where, collectionGroup, limit } from "firebase/firestore";

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

  // 1. Grupos filtrados por membresía (Protegido contra undefined)
  const groupsQuery = useMemoFirebase(() => {
    if (!firestore || !user?.uid) return null;
    return query(
      collection(firestore, 'groups'), 
      where('memberIds', 'array-contains', user.uid)
    );
  }, [firestore, user?.uid]);
  const { data: allGroups, isLoading: groupsLoading } = useCollection<Group>(groupsQuery);

  // 2. Mis deudas globales (Protegido contra undefined)
  const debtsQuery = useMemoFirebase(() => {
    if (!firestore || !user?.uid) return null;
    return query(
      collectionGroup(firestore, 'debts'), 
      where('debtorId', '==', user.uid),
      limit(100)
    );
  }, [firestore, user?.uid]);
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
          groupsMap[group.adminId] = { adminName, adminId: group.adminId, totalAmount: 0, debts: [] };
        }
        groupsMap[group.adminId].totalAmount += debt.amount;
        groupsMap[group.adminId].debts.push({ ...debt, groupName: group.name });
      }
      setGroupedDebts(Object.values(groupsMap));
    };

    resolveGroupedDebts();
  }, [myDebts, allGroups]);

  const handleCreateGroup = () => {
    if (!newGroupName || !user) return;
    createGroup(newGroupName, newGroupType, user.uid);
    toast({ title: "¡Éxito!", description: "Grupo creado." });
    setNewGroupName("");
    setOpen(false);
  };

  const handleSettleTotal = (adminDebts: (Debt & { groupName: string })[]) => {
    adminDebts.filter(d => d.status === 'pending').forEach(debt => {
      updateDebtStatusInGroup(debt.groupId, debt.id, 'under_review');
    });
    toast({ title: "Enviado", description: "El administrador revisará tus pagos." });
  };

  const loading = groupsLoading || debtsLoading;

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
              <DialogTrigger asChild><Button className="bg-accent gap-2"><PlusCircle className="h-4 w-4" /> Crear Grupo</Button></DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>Nuevo Grupo</DialogTitle></DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2"><Label>Nombre</Label><Input value={newGroupName} onChange={(e) => setNewGroupName(e.target.value)} /></div>
                  <div className="space-y-2"><Label>Tipo</Label>
                    <Select value={newGroupType} onValueChange={(v: any) => setNewGroupType(v)}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent><SelectItem value="variable">Variable</SelectItem><SelectItem value="fixed">Fijo</SelectItem></SelectContent>
                    </Select>
                  </div>
                </div>
                <DialogFooter><Button onClick={handleCreateGroup}>Crear</Button></DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
          {loading ? <div className="flex justify-center py-20"><Loader2 className="animate-spin" /></div> : (
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {adminGroups.map(g => (
                <Link key={g.id} href={`/dashboard/groups/${g.id}`}>
                  <Card className="hover:shadow-md transition-all">
                    <CardHeader><Badge variant="outline" className="w-fit">{g.type}</Badge><CardTitle>{g.name}</CardTitle></CardHeader>
                    <CardContent className="flex justify-between items-center text-sm"><span>{g.memberIds.length} Miembros</span><ChevronRight className="h-4 w-4" /></CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-6">
          <h2 className="text-xl font-headline font-semibold flex items-center gap-2"><Wallet className="h-5 w-5" /> Deudas Pendientes</h2>
          {loading ? <div className="flex justify-center py-20"><Loader2 className="animate-spin" /></div> : groupedDebts.length === 0 ? (
            <Card className="p-20 text-center border-dashed border-2 bg-transparent"><CardTitle>¡Estás al día!</CardTitle></Card>
          ) : (
            <Accordion type="single" collapsible className="space-y-4">
              {groupedDebts.map(item => (
                <AccordionItem key={item.adminId} value={item.adminId}>
                  <Card className="overflow-hidden">
                    <AccordionTrigger className="px-6 hover:no-underline">
                      <div className="flex items-center gap-4 text-left w-full">
                        <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center font-bold">{item.adminName[0]}</div>
                        <div className="flex-1"><p className="font-bold">{item.adminName}</p><p className="text-xs text-muted-foreground">{item.debts.length} deudas</p></div>
                        <p className="text-xl font-bold text-accent pr-4">${item.totalAmount.toFixed(2)}</p>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent className="bg-muted/5 p-0">
                      {item.debts.map(d => (
                        <div key={d.id} className="flex justify-between p-4 px-8 border-t">
                          <div><p className="font-medium text-sm">{d.description}</p><Badge variant="secondary" className="text-[10px]">{d.groupName}</Badge></div>
                          <p className="font-bold">${d.amount.toFixed(2)}</p>
                        </div>
                      ))}
                      <div className="p-4 bg-white border-t flex justify-end">
                        <Button className="bg-accent" onClick={() => handleSettleTotal(item.debts)}>Liquidar Total</Button>
                      </div>
                    </AccordionContent>
                  </Card>
                </AccordionItem>
              ))}
            </Accordion>
          )}
        </div>
      )}
    </div>
  );
}
