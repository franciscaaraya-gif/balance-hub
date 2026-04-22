"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/lib/firebase/auth-context";
import { getGroupsForUser, createGroup, getDebtsForUser, getGroupById, getUserProfile } from "@/lib/firebase/store";
import { Group, Debt, UserProfile } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PlusCircle, Users, ArrowRight, Wallet, UserCircle, Briefcase, ChevronRight } from "lucide-react";
import Link from "next/link";
import { useToast } from "@/hooks/use-toast";

type GroupedDebt = {
  adminName: string;
  adminId: string;
  totalAmount: number;
  debts: (Debt & { groupName: string })[];
};

export default function Dashboard() {
  const { user } = useAuth();
  const [isAdminView, setIsAdminView] = useState(true);
  const [groups, setGroups] = useState<Group[]>([]);
  const [groupedDebts, setGroupedDebts] = useState<GroupedDebt[]>([]);
  const [loading, setLoading] = useState(true);
  const [newGroupName, setNewGroupName] = useState("");
  const [newGroupType, setNewGroupType] = useState<'fixed' | 'variable'>("variable");
  const [open, setOpen] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (user) {
      loadData();
    }
  }, [user, isAdminView]);

  const loadData = async () => {
    setLoading(true);
    try {
      if (isAdminView) {
        const allGroups = await getGroupsForUser(user!.uid);
        // Filtrar solo los grupos donde el usuario es Admin
        setGroups(allGroups.filter(g => g.adminId === user!.uid));
      } else {
        const debts = await getDebtsForUser(user!.uid);
        const groupsCache: Record<string, Group> = {};
        const adminsCache: Record<string, UserProfile> = {};
        const groupsMap: Record<string, GroupedDebt> = {};

        for (const debt of debts) {
          if (debt.status === 'paid') continue;

          if (!groupsCache[debt.groupId]) {
            const g = await getGroupById(debt.groupId);
            if (g) groupsCache[debt.groupId] = g;
          }

          const group = groupsCache[debt.groupId];
          if (!group) continue;

          if (!adminsCache[group.adminId]) {
            const admin = await getUserProfile(group.adminId);
            if (admin) adminsCache[group.adminId] = admin;
          }

          const admin = adminsCache[group.adminId];
          const adminName = admin?.displayName || "Administrador Desconocido";

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
      }
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateGroup = async () => {
    if (!newGroupName) return;
    try {
      await createGroup(newGroupName, newGroupType, user!.uid);
      toast({ title: "Grupo Creado", description: `"${newGroupName}" ya está listo.` });
      setNewGroupName("");
      setOpen(false);
      loadData();
    } catch (error: any) {
      toast({ variant: "destructive", title: "Error", description: error.message });
    }
  };

  return (
    <div className="space-y-8 max-w-6xl mx-auto">
      {/* View Switcher Header */}
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
        /* ADMIN VIEW */
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
                  <DialogTitle>Crear Grupo de Deuda</DialogTitle>
                  <DialogDescription>Configura un nuevo espacio para gestionar gastos compartidos.</DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                  <div className="space-y-2">
                    <Label htmlFor="name">Nombre del Grupo</Label>
                    <Input id="name" value={newGroupName} onChange={(e) => setNewGroupName(e.target.value)} placeholder="Ej: Viaje a la playa" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="type">Tipo de Grupo</Label>
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
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {[1, 2, 3].map(i => <div key={i} className="h-44 bg-muted animate-pulse rounded-2xl" />)}
            </div>
          ) : groups.length === 0 ? (
            <Card className="border-dashed border-2 flex flex-col items-center justify-center py-20 text-center bg-transparent">
              <div className="bg-white p-6 rounded-3xl shadow-sm mb-4">
                <Users className="h-10 w-10 text-muted-foreground" />
              </div>
              <CardTitle className="text-xl">Aún no tienes grupos</CardTitle>
              <CardDescription className="max-w-[300px] mt-2">
                Empieza creando tu primer grupo para invitar a tus amigos y gestionar deudas.
              </CardDescription>
              <Button variant="outline" className="mt-8 border-primary text-primary" onClick={() => setOpen(true)}>
                Crear mi primer grupo
              </Button>
            </Card>
          ) : (
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {groups.map((group) => (
                <Link key={group.id} href={`/dashboard/groups/${group.id}`}>
                  <Card className="h-full border-none shadow-sm hover:shadow-md hover:-translate-y-1 transition-all group overflow-hidden">
                    <div className="h-2 bg-primary/20 group-hover:bg-primary transition-colors" />
                    <CardHeader className="pb-4">
                      <div className="flex justify-between items-start mb-2">
                        <Badge variant="outline" className="capitalize bg-muted/30 border-none font-bold text-[10px] tracking-widest px-2">
                          {group.type}
                        </Badge>
                        <span className="text-xs text-muted-foreground flex items-center gap-1">
                          <Users className="h-3 w-3" />
                          {group.members.length}
                        </span>
                      </div>
                      <CardTitle className="font-headline text-xl group-hover:text-primary transition-colors">
                        {group.name}
                      </CardTitle>
                      <CardDescription className="line-clamp-1">
                        Creado el {new Date(group.createdAt).toLocaleDateString()}
                      </CardDescription>
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
        /* USER VIEW */
        <div className="space-y-6">
          <h2 className="text-xl font-headline font-semibold flex items-center gap-2">
            <Wallet className="h-5 w-5 text-primary" />
            Resumen de Deudas Pendientes
          </h2>

          {loading ? (
            <div className="space-y-4">
              {[1, 2].map(i => <div key={i} className="h-32 bg-muted animate-pulse rounded-2xl" />)}
            </div>
          ) : groupedDebts.length === 0 ? (
            <Card className="border-dashed border-2 flex flex-col items-center justify-center py-20 text-center bg-transparent">
              <div className="bg-white p-6 rounded-3xl shadow-sm mb-4">
                <Wallet className="h-10 w-10 text-emerald-500" />
              </div>
              <CardTitle className="text-xl">¡Estás al día!</CardTitle>
              <CardDescription className="max-w-[300px] mt-2">
                No tienes deudas pendientes registradas a tu nombre.
              </CardDescription>
            </Card>
          ) : (
            <div className="space-y-6">
              {groupedDebts.map((item) => (
                <Card key={item.adminId} className="border-none shadow-sm overflow-hidden">
                  <CardHeader className="bg-white border-b flex flex-row items-center justify-between py-4">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold">
                        {item.adminName[0]}
                      </div>
                      <div>
                        <CardTitle className="text-lg font-headline">{item.adminName}</CardTitle>
                        <CardDescription>Administrador</CardDescription>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Total Pendiente</p>
                      <p className="text-2xl font-headline font-bold text-accent">${item.totalAmount.toFixed(2)}</p>
                    </div>
                  </CardHeader>
                  <CardContent className="p-0">
                    <div className="divide-y divide-muted/50">
                      {item.debts.map((debt) => (
                        <div key={debt.id} className="flex items-center justify-between p-4 hover:bg-muted/10 transition-colors">
                          <div className="space-y-1">
                            <p className="font-medium text-sm">{debt.description || "Sin descripción"}</p>
                            <div className="flex items-center gap-2">
                              <Badge variant="secondary" className="text-[10px] bg-secondary/10 text-secondary hover:bg-secondary/20 border-none px-1.5 h-5">
                                {debt.groupName}
                              </Badge>
                              <span className="text-[10px] text-muted-foreground">{new Date(debt.createdAt).toLocaleDateString()}</span>
                            </div>
                          </div>
                            <div className="flex items-center gap-4">
                                <span className="font-bold text-primary">${debt.amount.toFixed(2)}</span>
                                <Link href={`/dashboard/groups/${debt.groupId}`}>
                                    <Button size="icon" variant="ghost" className="h-8 w-8 text-muted-foreground hover:text-primary">
                                        <ChevronRight className="h-4 w-4" />
                                    </Button>
                                </Link>
                            </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
