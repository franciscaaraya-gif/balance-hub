"use client";

import { useEffect, useState, use } from "react";
import { useAuth } from "@/lib/firebase/auth-context";
import { getGroupById, getDebtsForGroup, getGroupMembersDetails, addDebt, updateDebtStatus, requestLeaveGroup, confirmLeaveGroup } from "@/lib/firebase/store";
import { Group, Debt, UserProfile } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Wallet, Plus, Share2, Sparkles, AlertCircle, CheckCircle2, Clock, LogOut, UserMinus } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { generateDebtSummary, DebtSummaryInput } from "@/ai/flows/ai-debt-summary-generation";
import { useRouter } from "next/navigation";

export default function GroupDetails({ params: paramsPromise }: { params: Promise<{ id: string }> }) {
  const params = use(paramsPromise);
  const { user } = useAuth();
  const router = useRouter();
  const [group, setGroup] = useState<Group | null>(null);
  const [debts, setDebts] = useState<Debt[]>([]);
  const [members, setMembers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [addingDebt, setAddingDebt] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiSummary, setAiSummary] = useState<string | null>(null);
  const [isLeaving, setIsLeaving] = useState(false);
  
  // New debt form
  const [debtAmount, setDebtAmount] = useState("");
  const [debtDescription, setDebtDescription] = useState("");
  const [debtorId, setDebtorId] = useState("");

  const { toast } = useToast();

  useEffect(() => {
    loadData();
  }, [params.id]);

  const loadData = async () => {
    try {
      const g = await getGroupById(params.id);
      if (g) {
        setGroup(g);
        const d = await getDebtsForGroup(params.id);
        setDebts(d);
        const m = await getGroupMembersDetails(g.members);
        setMembers(m);
      }
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleAddDebt = async () => {
    if (!debtAmount || !debtorId) return;
    try {
      await addDebt(params.id, debtorId, parseFloat(debtAmount), debtDescription);
      toast({ title: "Debt Added", description: "Successfully recorded the new debt." });
      setAddingDebt(false);
      setDebtAmount("");
      setDebtDescription("");
      setDebtorId("");
      loadData();
    } catch (error: any) {
      toast({ variant: "destructive", title: "Error", description: error.message });
    }
  };

  const handleUpdateStatus = async (debtId: string, status: any) => {
    try {
      await updateDebtStatus(debtId, status);
      toast({ title: "Status Updated", description: "Debt status was updated successfully." });
      loadData();
    } catch (error: any) {
      toast({ variant: "destructive", title: "Error", description: error.message });
    }
  };

  const handleRequestLeave = async () => {
    if (!group || !user) return;
    setIsLeaving(true);
    try {
      await requestLeaveGroup(group.id, user.uid);
      toast({ title: "Solicitud Enviada", description: "Tu solicitud de salida está pendiente de aprobación por el administrador." });
      loadData();
    } catch (error: any) {
      toast({ variant: "destructive", title: "Error", description: error.message });
    } finally {
      setIsLeaving(false);
    }
  };

  const handleConfirmLeave = async (userId: string) => {
    if (!group) return;
    try {
      await confirmLeaveGroup(group.id, userId);
      toast({ title: "Miembro Eliminado", description: "El miembro ha sido retirado del grupo con éxito." });
      loadData();
    } catch (error: any) {
      toast({ variant: "destructive", title: "Error", description: error.message });
    }
  };

  const handleAiSummary = async () => {
    if (!group) return;
    setAiLoading(true);
    try {
      const input: DebtSummaryInput = {
        groupName: group.name,
        members: members.map(m => ({ id: m.uid, name: m.displayName || 'Unnamed' })),
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
      toast({ variant: "destructive", title: "AI Generation Failed", description: "Could not generate summary at this time." });
    } finally {
      setAiLoading(false);
    }
  };

  const copyInvite = () => {
    if (!group) return;
    const url = `${window.location.origin}/join/${group.inviteToken}`;
    navigator.clipboard.writeText(url);
    toast({ title: "Invite Link Copied", description: "Share it with your friends!" });
  };

  if (loading) return <div className="h-full flex items-center justify-center"><Clock className="h-8 w-8 animate-spin text-primary" /></div>;
  if (!group) return <div>Group not found.</div>;

  const isAdmin = group.adminId === user?.uid;
  const myStatus = group.memberStatuses?.[user?.uid || ''];

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending': return <Badge variant="outline" className="text-orange-600 bg-orange-50 border-orange-200"><AlertCircle className="h-3 w-3 mr-1" /> Pending</Badge>;
      case 'under_review': return <Badge variant="outline" className="text-blue-600 bg-blue-50 border-blue-200"><Clock className="h-3 w-3 mr-1" /> Review</Badge>;
      case 'paid': return <Badge variant="outline" className="text-emerald-600 bg-emerald-50 border-emerald-200"><CheckCircle2 className="h-3 w-3 mr-1" /> Paid</Badge>;
      default: return null;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-headline font-bold text-primary">{group.name}</h1>
          <p className="text-muted-foreground">Tipo: <span className="capitalize">{group.type === 'variable' ? 'Gastos Variables' : 'Objetivo Fijo'}</span> • {members.length} Miembros</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={copyInvite} className="gap-2">
            <Share2 className="h-4 w-4" />
            Copiar Invitación
          </Button>
          
          {isAdmin ? (
            <Dialog open={addingDebt} onOpenChange={setAddingDebt}>
              <DialogTrigger asChild>
                <Button className="bg-accent hover:bg-accent/90 gap-2">
                  <Plus className="h-4 w-4" />
                  Agregar Deuda
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Nueva Deuda</DialogTitle>
                  <DialogDescription>Registra un nuevo gasto asignado a un miembro.</DialogDescription>
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
                  <Button variant="outline" onClick={() => setAddingDebt(false)}>Cancelar</Button>
                  <Button onClick={handleAddDebt} className="bg-primary">Guardar</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
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

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Main Debt Table */}
        <Card className="lg:col-span-2 border-none shadow-sm overflow-hidden">
          <CardHeader className="bg-white border-b">
            <CardTitle className="text-lg font-headline">Registro de Deudas</CardTitle>
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
                {debts.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={isAdmin ? 5 : 4} className="text-center py-12 text-muted-foreground">
                      No hay deudas registradas aún.
                    </TableCell>
                  </TableRow>
                ) : (
                  debts.map((debt) => (
                    <TableRow key={debt.id}>
                      <TableCell className="font-medium">
                        {members.find(m => m.uid === debt.debtorId)?.displayName || 'Desconocido'}
                      </TableCell>
                      <TableCell className="font-mono text-primary font-bold">
                        ${debt.amount.toFixed(2)}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {debt.description || '-'}
                      </TableCell>
                      <TableCell>
                        {getStatusBadge(debt.status)}
                      </TableCell>
                      {isAdmin && (
                        <TableCell className="text-right">
                          <Select 
                            value={debt.status} 
                            onValueChange={(val: any) => handleUpdateStatus(debt.id, val)}
                          >
                            <SelectTrigger className="w-[130px] h-8 text-xs ml-auto">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="pending">Pendiente</SelectItem>
                              <SelectItem value="under_review">Revisión</SelectItem>
                              <SelectItem value="paid">Pagado</SelectItem>
                            </SelectContent>
                          </Select>
                        </TableCell>
                      )}
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* AI Sidepanel */}
        <div className="space-y-6">
          <Card className="border-primary/20 bg-primary/5 shadow-none overflow-hidden">
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <div className="bg-primary text-white p-1.5 rounded-lg">
                  <Sparkles className="h-4 w-4" />
                </div>
                <CardTitle className="text-lg font-headline">Resumen Inteligente</CardTitle>
              </div>
              <CardDescription>
                Análisis automático de saldos y sugerencias de liquidación.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {aiSummary ? (
                <div className="space-y-4">
                  <div className="text-sm font-body leading-relaxed whitespace-pre-wrap p-4 bg-white rounded-xl border border-primary/10">
                    {aiSummary}
                  </div>
                  <Button variant="outline" className="w-full text-xs" onClick={handleAiSummary} disabled={aiLoading}>
                    Actualizar Resumen
                  </Button>
                </div>
              ) : (
                <Button 
                  className="w-full bg-primary hover:bg-primary/90 text-white" 
                  onClick={handleAiSummary}
                  disabled={aiLoading}
                >
                  {aiLoading ? (
                    <>
                      <Clock className="h-4 w-4 mr-2 animate-spin" />
                      Analizando...
                    </>
                  ) : (
                    <>
                      <Sparkles className="h-4 w-4 mr-2" />
                      Generar Resumen
                    </>
                  )}
                </Button>
              )}
            </CardContent>
          </Card>

          <Card className="border-none shadow-sm">
            <CardHeader>
              <CardTitle className="text-lg font-headline">Miembros del Grupo</CardTitle>
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
                            <span className="ml-2 text-[10px] text-orange-500 font-bold uppercase">Solicita Salir</span>
                          )}
                        </p>
                        {group.adminId === member.uid && <p className="text-[10px] text-accent font-bold uppercase tracking-tighter">Administrador</p>}
                      </div>
                    </div>
                    {isAdmin && status === 'leave_pending' && (
                      <Button 
                        size="icon" 
                        variant="ghost" 
                        className="h-8 w-8 text-orange-500 hover:text-orange-600 hover:bg-orange-50"
                        onClick={() => handleConfirmLeave(member.uid)}
                        title="Confirmar salida del miembro"
                      >
                        <UserMinus className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                );
              })}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
