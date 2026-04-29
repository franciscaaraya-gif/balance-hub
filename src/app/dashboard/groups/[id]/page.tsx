
"use client";

import { useEffect, useState, use, useMemo } from "react";
import { useUser, useFirestore, useDoc, useCollection, useMemoFirebase } from "@/firebase";
import { getGroupMembersDetails, addDebt, updateDebtStatusInGroup, requestLeaveGroup, confirmLeaveGroup, updateGroupAmount } from "@/lib/firebase/store";
import { Group, Debt, UserProfile } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Wallet, Plus, Share2, Sparkles, AlertCircle, CheckCircle2, Clock, LogOut, UserMinus, FileUp, Users, DollarSign, Settings, TrendingUp, HandCoins } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { generateDebtSummary, DebtSummaryInput } from "@/ai/flows/ai-debt-summary-generation";
import { Textarea } from "@/components/ui/textarea";
import { doc, collection, query, where } from "firebase/firestore";

export default function GroupDetails({ params: paramsPromise }: { params: Promise<{ id: string }> }) {
  const params = use(paramsPromise);
  const { user } = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();

  const [addingDebt, setAddingDebt] = useState(false);
  const [bulkCsvOpen, setBulkCsvOpen] = useState(false);
  const [fixedAmountOpen, setFixedAmountOpen] = useState(false);
  const [editGroupOpen, setEditGroupOpen] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiSummary, setAiSummary] = useState<string | null>(null);
  const [isLeaving, setIsLeaving] = useState(false);
  
  const [debtAmount, setDebtAmount] = useState("");
  const [debtDescription, setDebtDescription] = useState("");
  const [debtorId, setDebtorId] = useState("");
  const [csvText, setCsvText] = useState("");
  const [fixedDescription, setFixedDescription] = useState("");
  const [newGroupFixedAmount, setNewGroupFixedAmount] = useState("");

  const [members, setMembers] = useState<UserProfile[]>([]);

  const groupRef = useMemoFirebase(() => {
    if (!firestore || !params.id) return null;
    return doc(firestore, 'groups', params.id);
  }, [firestore, params.id]);
  const { data: group, isLoading: groupLoading } = useDoc<Group>(groupRef);

  const debtsQuery = useMemoFirebase(() => {
    if (!firestore || !params.id) return null;
    return query(collection(firestore, 'groups', params.id, 'debts'));
  }, [firestore, params.id]);
  const { data: debts, isLoading: debtsLoading } = useCollection<Debt>(debtsQuery);

  const stats = useMemo(() => {
    if (!debts) return { total: 0, paid: 0, pending: 0 };
    return debts.reduce((acc, debt) => {
      acc.total += debt.amount;
      if (debt.status === 'paid') acc.paid += debt.amount;
      else acc.pending += debt.amount;
      return acc;
    }, { total: 0, paid: 0, pending: 0 });
  }, [debts]);

  useEffect(() => {
    if (group?.memberIds) {
      getGroupMembersDetails(group.memberIds).then(setMembers);
    }
    if (group?.fixedAmount) {
      setNewGroupFixedAmount(group.fixedAmount.toString());
    }
  }, [group?.memberIds, group?.fixedAmount]);

  const handleAddDebt = async () => {
    if (!debtAmount || !debtorId) return;
    try {
      await addDebt(params.id, debtorId, parseFloat(debtAmount), debtDescription);
      toast({ title: "Deuda Agregada", description: "Se registró la deuda correctamente." });
      setAddingDebt(false);
      setDebtAmount("");
      setDebtDescription("");
      setDebtorId("");
    } catch (error: any) {
      toast({ variant: "destructive", title: "Error", description: error.message });
    }
  };

  const handleBulkCsv = async () => {
    if (!csvText) return;
    const lines = csvText.split('\n').filter(l => l.trim());
    let addedCount = 0;
    let errorCount = 0;

    for (const line of lines) {
      const parts = line.split(',');
      const email = parts[0]?.trim();
      const amount = parts[1] ? parseFloat(parts[1].trim()) : group?.fixedAmount;
      
      if (email && amount && !isNaN(amount)) {
        const member = members.find(m => m.email?.toLowerCase() === email.toLowerCase());
        if (member) {
          try {
            await addDebt(params.id, member.uid, amount, "Carga masiva");
            addedCount++;
          } catch (e) {
            errorCount++;
          }
        } else {
          errorCount++;
        }
      }
    }

    toast({ 
      title: "Proceso completado", 
      description: `Se agregaron ${addedCount} deudas. ${errorCount} errores.` 
    });
    setBulkCsvOpen(false);
    setCsvText("");
  };

  const handleApplyFixedQuota = async () => {
    if (!group?.fixedAmount || !group) return;
    
    try {
      for (const memberId of group.memberIds) {
        if (memberId === group.adminId) continue;
        await addDebt(params.id, memberId, group.fixedAmount, fixedDescription || `Cobro: ${group.name}`);
      }
      toast({ title: "Cobros Asignados", description: `Se asignó $${group.fixedAmount} a todos los miembros.` });
      setFixedAmountOpen(false);
      setFixedDescription("");
    } catch (error: any) {
      toast({ variant: "destructive", title: "Error", description: error.message });
    }
  };

  const handleUpdateGroupAmount = () => {
    const amount = parseFloat(newGroupFixedAmount);
    if (isNaN(amount)) return;
    updateGroupAmount(params.id, amount);
    toast({ title: "Monto Actualizado", description: "El monto del grupo ha sido modificado." });
    setEditGroupOpen(false);
  };

  const handleUpdateStatus = (debtId: string, status: any) => {
    updateDebtStatusInGroup(params.id, debtId, status);
    toast({ title: "Estado Actualizado", description: "Se actualizó el estado de la deuda." });
  };

  const handleRequestLeave = () => {
    if (!group || !user) return;
    setIsLeaving(true);
    requestLeaveGroup(group.id, user.uid);
    toast({ title: "Solicitud Enviada", description: "Tu solicitud de salida está pendiente de aprobación." });
    setIsLeaving(false);
  };

  const handleConfirmLeave = (userId: string) => {
    if (!group) return;
    confirmLeaveGroup(group.id, userId);
    toast({ title: "Miembro Eliminado", description: "El miembro ha sido retirado del grupo." });
  };

  const handleAiSummary = async () => {
    if (!group || !debts) return;
    setAiLoading(true);
    try {
      const input: DebtSummaryInput = {
        groupName: group.name,
        members: members.map(m => ({ id: m.uid, name: m.displayName || 'Sin nombre' })),
        debts: debts.map(d => ({
          id: d.id,
          debtorId: d.debtorId,
          amount: d.amount,
          description: d.description,
          status: d.status
        }))
      };
      const result = await generateDebtSummary(input);
      setAiSummary(result.summary);
    } catch (error: any) {
      toast({ variant: "destructive", title: "Fallo de IA", description: "No se pudo generar el resumen." });
    } finally {
      setAiLoading(false);
    }
  };

  const copyInvite = () => {
    if (!group) return;
    const url = `${window.location.origin}/join/${group.inviteToken}`;
    navigator.clipboard.writeText(url);
    toast({ title: "Enlace Copiado", description: "¡Compártelo con tus amigos!" });
  };

  if (groupLoading) return <div className="h-full flex items-center justify-center"><Clock className="h-8 w-8 animate-spin text-primary" /></div>;
  if (!group) return <div className="p-8 text-center">Grupo no encontrado.</div>;

  const isAdmin = group.adminId === user?.uid;
  const myStatus = group.memberStatuses?.[user?.uid || ''];
  const groupDebts = debts || [];

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending': return <Badge variant="outline" className="text-orange-600 bg-orange-50 border-orange-200"><AlertCircle className="h-3 w-3 mr-1" /> Pendiente</Badge>;
      case 'under_review': return <Badge variant="outline" className="text-blue-600 bg-blue-50 border-blue-200 animate-pulse"><Clock className="h-3 w-3 mr-1" /> Revisión</Badge>;
      case 'paid': return <Badge variant="outline" className="text-emerald-600 bg-emerald-50 border-emerald-200"><CheckCircle2 className="h-3 w-3 mr-1" /> Pagado</Badge>;
      default: return null;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-headline font-bold text-primary">{group.name}</h1>
            {isAdmin && (
              <Dialog open={editGroupOpen} onOpenChange={setEditGroupOpen}>
                <DialogTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-primary">
                    <Settings className="h-4 w-4" />
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader><DialogTitle>Ajustes del Grupo</DialogTitle></DialogHeader>
                  <div className="space-y-4 py-4">
                    <div className="space-y-2">
                      <Label>Monto Fijo del Cobro ($)</Label>
                      <Input type="number" value={newGroupFixedAmount} onChange={(e) => setNewGroupFixedAmount(e.target.value)} />
                      <p className="text-[10px] text-muted-foreground">Este monto se usará por defecto para los cobros masivos.</p>
                    </div>
                  </div>
                  <DialogFooter>
                    <Button onClick={handleUpdateGroupAmount} className="bg-primary">Guardar Cambios</Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            )}
          </div>
          <p className="text-muted-foreground">
            {group.type === 'variable' ? 'Gastos Variables' : `Cobro Fijo: $${group.fixedAmount}`} • {group.memberIds.length} Miembros
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={copyInvite} className="gap-2">
            <Share2 className="h-4 w-4" />
            Invitación
          </Button>
          
          {isAdmin ? (
            <>
              <div className="flex gap-2">
                {group.type === 'fixed' && (
                  <Dialog open={fixedAmountOpen} onOpenChange={setFixedAmountOpen}>
                    <DialogTrigger asChild>
                      <Button className="bg-accent hover:bg-accent/90 gap-2">
                        <Users className="h-4 w-4" />
                        Cobrar a Todos
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Asignar Cobro Fijo</DialogTitle>
                        <DialogDescription>Se asignará el monto de <b>${group.fixedAmount}</b> a todos los miembros.</DialogDescription>
                      </DialogHeader>
                      <div className="grid gap-4 py-4">
                        <div className="space-y-2">
                          <Label>Monto Actual del Grupo</Label>
                          <div className="p-3 bg-muted rounded-lg font-bold text-primary flex items-center gap-2">
                            <DollarSign className="h-4 w-4" /> {group.fixedAmount}
                          </div>
                        </div>
                        <div className="space-y-2">
                          <Label>Descripción del Cobro</Label>
                          <Input placeholder="Ej: Pago de Mayo" value={fixedDescription} onChange={(e) => setFixedDescription(e.target.value)} />
                        </div>
                      </div>
                      <DialogFooter>
                        <Button variant="outline" onClick={() => setFixedAmountOpen(false)}>Cancelar</Button>
                        <Button onClick={handleApplyFixedQuota} className="bg-primary">Asignar a Todos</Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                )}

                <Dialog open={addingDebt} onOpenChange={setAddingDebt}>
                  <DialogTrigger asChild>
                    <Button variant="outline" className="gap-2 border-primary text-primary hover:bg-primary/5">
                      <Plus className="h-4 w-4" />
                      Deuda Individual
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Registrar Deuda</DialogTitle>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                      <div className="space-y-2">
                        <Label>Deudor</Label>
                        <Select value={debtorId} onValueChange={setDebtorId}>
                          <SelectTrigger>
                            <SelectValue placeholder="Seleccionar miembro" />
                          </SelectTrigger>
                          <SelectContent>
                            {members.map(m => (
                              <SelectItem key={m.uid} value={m.uid}>{m.displayName || m.email}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label>Monto ($)</Label>
                        <Input type="number" placeholder="0.00" value={debtAmount} onChange={(e) => setDebtAmount(e.target.value)} />
                      </div>
                      <div className="space-y-2">
                        <Label>Descripción</Label>
                        <Input placeholder="Comida, transporte, etc." value={debtDescription} onChange={(e) => setDebtDescription(e.target.value)} />
                      </div>
                    </div>
                    <DialogFooter>
                      <Button onClick={handleAddDebt} className="bg-primary">Guardar</Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </div>
            </>
          ) : (
            myStatus === 'leave_pending' ? (
              <Badge variant="secondary" className="bg-yellow-100 text-yellow-800 border-yellow-200 gap-1.5 px-4 py-2">
                <Clock className="h-4 w-4" /> Salida Pendiente
              </Badge>
            ) : (
              <Button variant="destructive" onClick={handleRequestLeave} disabled={isLeaving} className="gap-2">
                <LogOut className="h-4 w-4" />
                Salir del Grupo
              </Button>
            )
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="border-emerald-100 bg-emerald-50/30">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-bold text-emerald-600 uppercase tracking-wider">Total Recaudado</p>
                <h3 className="text-2xl font-headline font-bold text-emerald-700">${stats.paid.toFixed(2)}</h3>
              </div>
              <div className="p-3 bg-emerald-100 rounded-xl text-emerald-600">
                <TrendingUp className="h-6 w-6" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-orange-100 bg-orange-50/30">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-bold text-orange-600 uppercase tracking-wider">Por Recaudar</p>
                <h3 className="text-2xl font-headline font-bold text-orange-700">${stats.pending.toFixed(2)}</h3>
              </div>
              <div className="p-3 bg-orange-100 rounded-xl text-orange-600">
                <HandCoins className="h-6 w-6" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-primary/10 bg-primary/5">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-bold text-primary uppercase tracking-wider">Total de Deuda</p>
                <h3 className="text-2xl font-headline font-bold text-primary">${stats.total.toFixed(2)}</h3>
              </div>
              <div className="p-3 bg-primary/10 rounded-xl text-primary">
                <ReceiptText className="h-6 w-6" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2 border-none shadow-sm overflow-hidden">
          <CardHeader className="bg-white border-b flex flex-row items-center justify-between space-y-0">
            <div>
              <CardTitle className="text-lg font-headline">Registro de Cobros</CardTitle>
              <CardDescription>Seguimiento de saldos individuales</CardDescription>
            </div>
            {isAdmin && group.type === 'variable' && (
              <Button variant="ghost" size="sm" className="gap-2 h-8" onClick={() => setBulkCsvOpen(true)}>
                <FileUp className="h-3 w-3" /> Carga Masiva
              </Button>
            )}
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader className="bg-muted/30">
                <TableRow>
                  <TableHead>Miembro</TableHead>
                  <TableHead>Monto</TableHead>
                  <TableHead>Descripción</TableHead>
                  <TableHead>Estado</TableHead>
                  {isAdmin && <TableHead className="text-right">Acciones</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {groupDebts.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={isAdmin ? 5 : 4} className="text-center py-12 text-muted-foreground">
                      No hay cobros registrados.
                    </TableCell>
                  </TableRow>
                ) : (
                  groupDebts.map((debt) => (
                    <TableRow key={debt.id} className={debt.status === 'under_review' ? 'bg-blue-50/50' : ''}>
                      <TableCell className="font-medium">
                        {members.find(m => m.uid === debt.debtorId)?.displayName || 'Miembro'}
                      </TableCell>
                      <TableCell className="font-mono text-primary font-bold">
                        ${debt.amount.toFixed(2)}
                      </TableCell>
                      <TableCell className="text-muted-foreground text-xs">
                        {debt.description || '-'}
                      </TableCell>
                      <TableCell>
                        {getStatusBadge(debt.status)}
                      </TableCell>
                      {isAdmin && (
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-2">
                            {debt.status === 'under_review' && (
                              <Button 
                                size="sm" 
                                className="h-8 bg-emerald-600 hover:bg-emerald-700 gap-1 px-3"
                                onClick={() => handleUpdateStatus(debt.id, 'paid')}
                              >
                                <CheckCircle2 className="h-3 w-3" />
                                Validar
                              </Button>
                            )}
                            <Select 
                              value={debt.status} 
                              onValueChange={(val: any) => handleUpdateStatus(debt.id, val)}
                            >
                              <SelectTrigger className="w-[110px] h-8 text-xs">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="pending">Pendiente</SelectItem>
                                <SelectItem value="under_review">Revisión</SelectItem>
                                <SelectItem value="paid">Pagado</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        </TableCell>
                      )}
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card className="border-primary/20 bg-primary/5 shadow-none overflow-hidden">
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-primary" />
                <CardTitle className="text-lg font-headline">Resumen IA</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              {aiSummary ? (
                <div className="space-y-4">
                  <div className="text-sm font-body leading-relaxed whitespace-pre-wrap p-4 bg-white rounded-xl border border-primary/10">
                    {aiSummary}
                  </div>
                  <Button variant="ghost" className="w-full text-[10px]" onClick={handleAiSummary} disabled={aiLoading}>
                    Actualizar Reporte
                  </Button>
                </div>
              ) : (
                <Button 
                  className="w-full bg-primary hover:bg-primary/90" 
                  onClick={handleAiSummary}
                  disabled={aiLoading}
                >
                  {aiLoading ? "Analizando..." : "Generar Balance"}
                </Button>
              )}
            </CardContent>
          </Card>

          <Card className="border-none shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-headline">Miembros</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {members.map(member => {
                const status = group.memberStatuses?.[member.uid];
                return (
                  <div key={member.uid} className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="h-8 w-8 rounded-full bg-secondary/20 text-secondary flex items-center justify-center text-xs font-bold">
                        {member.displayName?.[0] || 'U'}
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-medium">
                          {member.displayName}
                          {status === 'leave_pending' && (
                            <span className="ml-2 text-[8px] bg-orange-100 text-orange-600 px-1 rounded font-bold uppercase">Solicita Salir</span>
                          )}
                        </p>
                        {group.adminId === member.uid && <p className="text-[9px] text-accent font-bold uppercase tracking-tighter">Administrador</p>}
                      </div>
                    </div>
                    {isAdmin && status === 'leave_pending' && (
                      <Button 
                        size="icon" 
                        variant="ghost" 
                        className="h-7 w-7 text-orange-500"
                        onClick={() => handleConfirmLeave(member.uid)}
                      >
                        <UserMinus className="h-3 w-3" />
                      </Button>
                    )}
                  </div>
                );
              })}
            </CardContent>
          </Card>
        </div>
      </div>

      <Dialog open={bulkCsvOpen} onOpenChange={setBulkCsvOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Carga Masiva</DialogTitle>
            <DialogDescription>Formato: correo,monto (opcional). Se usará el monto del grupo por defecto.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <Textarea 
              placeholder="juan@ejemplo.com, 50.00&#10;ana@ejemplo.com" 
              className="min-h-[150px] font-mono text-xs"
              value={csvText}
              onChange={(e) => setCsvText(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button onClick={handleBulkCsv} className="bg-primary">Procesar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
