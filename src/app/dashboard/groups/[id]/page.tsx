"use client";

import { useEffect, useState, use, useRef, useMemo } from "react";
import { useUser, useFirestore, useDoc, useCollection, useMemoFirebase } from "@/firebase";
import { getGroupMembersDetails, addDebt, updateDebtStatusInGroup, requestLeaveGroup, confirmLeaveGroup } from "@/lib/firebase/store";
import { Group, Debt, UserProfile } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Wallet, Plus, Share2, Sparkles, AlertCircle, CheckCircle2, Clock, LogOut, UserMinus, FileUp, Users } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { generateDebtSummary, DebtSummaryInput } from "@/ai/flows/ai-debt-summary-generation";
import { Textarea } from "@/components/ui/textarea";
import { doc, collection, query, orderBy, where } from "firebase/firestore";

export default function GroupDetails({ params: paramsPromise }: { params: Promise<{ id: string }> }) {
  const params = use(paramsPromise);
  const { user } = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();

  const [addingDebt, setAddingDebt] = useState(false);
  const [bulkCsvOpen, setBulkCsvOpen] = useState(false);
  const [fixedAmountOpen, setFixedAmountOpen] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiSummary, setAiSummary] = useState<string | null>(null);
  const [isLeaving, setIsLeaving] = useState(false);
  
  // Formularios
  const [debtAmount, setDebtAmount] = useState("");
  const [debtDescription, setDebtDescription] = useState("");
  const [debtorId, setDebtorId] = useState("");
  const [csvText, setCsvText] = useState("");
  const [fixedAmount, setFixedAmount] = useState("");
  const [fixedDescription, setFixedDescription] = useState("");

  const [members, setMembers] = useState<UserProfile[]>([]);

  // Hooks de tiempo real
  const groupRef = useMemoFirebase(() => {
    if (!firestore || !params.id) return null;
    return doc(firestore, 'groups', params.id);
  }, [firestore, params.id]);
  const { data: group, isLoading: groupLoading } = useDoc<Group>(groupRef);

  const debtsQuery = useMemoFirebase(() => {
    if (!firestore || !params.id || !user?.uid) return null;
    // IMPORTANTE: Aseguramos que la ruta esté completa y protegida
    return query(
      collection(firestore, 'groups', params.id, 'debts'), 
      where('groupMemberIds', 'array-contains', user.uid),
      orderBy('createdAt', 'desc')
    );
  }, [firestore, params.id, user?.uid]);
  const { data: debts, isLoading: debtsLoading } = useCollection<Debt>(debtsQuery);

  useEffect(() => {
    if (group?.memberIds) {
      getGroupMembersDetails(group.memberIds).then(setMembers);
    }
  }, [group?.memberIds]);

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
      const [email, amountStr] = line.split(',').map(s => s.trim());
      const amount = parseFloat(amountStr);
      
      if (email && !isNaN(amount)) {
        const member = members.find(m => m.email?.toLowerCase() === email.toLowerCase());
        if (member) {
          try {
            await addDebt(params.id, member.uid, amount, "Carga masiva CSV");
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
      title: "Proceso CSV completado", 
      description: `Se agregaron ${addedCount} deudas. ${errorCount} errores o correos no encontrados.` 
    });
    setBulkCsvOpen(false);
    setCsvText("");
  };

  const handleFixedQuota = async () => {
    if (!fixedAmount || !group) return;
    const amount = parseFloat(fixedAmount);
    if (isNaN(amount)) return;

    try {
      for (const memberId of group.memberIds) {
        if (memberId === user?.uid) continue;
        await addDebt(params.id, memberId, amount, fixedDescription || `Cuota fija: ${group.name}`);
      }
      toast({ title: "Cuotas Asignadas", description: `Se asignó $${amount} a todos los miembros.` });
      setFixedAmountOpen(false);
      setFixedAmount("");
      setFixedDescription("");
    } catch (error: any) {
      toast({ variant: "destructive", title: "Error", description: error.message });
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      setCsvText(text);
    };
    reader.readAsText(file);
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

  const reviewCount = groupDebts.filter(d => d.status === 'under_review').length;

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-headline font-bold text-primary">{group.name}</h1>
          <p className="text-muted-foreground">Tipo: <span className="capitalize">{group.type === 'variable' ? 'Gastos Variables' : 'Objetivo Fijo'}</span> • {group.memberIds.length} Miembros</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={copyInvite} className="gap-2">
            <Share2 className="h-4 w-4" />
            Invitación
          </Button>
          
          {isAdmin ? (
            <>
              <div className="flex gap-2">
                <Dialog open={addingDebt} onOpenChange={setAddingDebt}>
                  <DialogTrigger asChild>
                    <Button className="bg-primary hover:bg-primary/90 gap-2">
                      <Plus className="h-4 w-4" />
                      Individual
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

                {group.type === 'variable' ? (
                  <Dialog open={bulkCsvOpen} onOpenChange={setBulkCsvOpen}>
                    <DialogTrigger asChild>
                      <Button variant="secondary" className="gap-2">
                        <FileUp className="h-4 w-4" />
                        Cargar CSV
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Carga Masiva vía CSV</DialogTitle>
                        <DialogDescription>Pega el contenido o sube un archivo con formato: correo,monto.</DialogDescription>
                      </DialogHeader>
                      <div className="space-y-4 py-4">
                        <div className="grid w-full max-w-sm items-center gap-1.5">
                          <Label htmlFor="csv-file">Subir Archivo</Label>
                          <Input id="csv-file" type="file" accept=".csv,.txt" onChange={handleFileUpload} />
                        </div>
                        <div className="space-y-2">
                          <Label>Contenido del CSV</Label>
                          <Textarea 
                            placeholder="usuario@ejemplo.com, 50.00" 
                            className="min-h-[150px] font-mono text-xs"
                            value={csvText}
                            onChange={(e) => setCsvText(e.target.value)}
                          />
                        </div>
                      </div>
                      <DialogFooter>
                        <Button variant="outline" onClick={() => setBulkCsvOpen(false)}>Cancelar</Button>
                        <Button onClick={handleBulkCsv} className="bg-primary">Procesar</Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                ) : (
                  <Dialog open={fixedAmountOpen} onOpenChange={setFixedAmountOpen}>
                    <DialogTrigger asChild>
                      <Button variant="secondary" className="gap-2">
                        <Users className="h-4 w-4" />
                        Cuota Fija
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Asignar Cuota Fija</DialogTitle>
                        <DialogDescription>El monto se asignará a TODOS los miembros automáticamente.</DialogDescription>
                      </DialogHeader>
                      <div className="grid gap-4 py-4">
                        <div className="space-y-2">
                          <Label>Monto por Persona ($)</Label>
                          <Input type="number" placeholder="0.00" value={fixedAmount} onChange={(e) => setFixedAmount(e.target.value)} />
                        </div>
                        <div className="space-y-2">
                          <Label>Descripción del Cobro</Label>
                          <Input placeholder="Ej: Pago mensual" value={fixedDescription} onChange={(e) => setFixedDescription(e.target.value)} />
                        </div>
                      </div>
                      <DialogFooter>
                        <Button variant="outline" onClick={() => setFixedAmountOpen(false)}>Cancelar</Button>
                        <Button onClick={handleFixedQuota} className="bg-primary">Asignar a Todos</Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                )}
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

      {isAdmin && reviewCount > 0 && (
        <Card className="border-blue-200 bg-blue-50">
          <CardContent className="py-4 flex items-center justify-between">
            <div className="flex items-center gap-3 text-blue-700">
              <Clock className="h-5 w-5 animate-pulse" />
              <p className="font-medium text-sm">Tienes {reviewCount} pagos pendientes de revisión.</p>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
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
                {groupDebts.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={isAdmin ? 5 : 4} className="text-center py-12 text-muted-foreground">
                      No hay deudas registradas aún.
                    </TableCell>
                  </TableRow>
                ) : (
                  groupDebts.map((debt) => (
                    <TableRow key={debt.id} className={debt.status === 'under_review' ? 'bg-blue-50/50' : ''}>
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
                          <div className="flex items-center justify-end gap-2">
                            {debt.status === 'under_review' && (
                              <Button 
                                size="sm" 
                                className="h-8 bg-emerald-600 hover:bg-emerald-700 gap-1 px-3"
                                onClick={() => handleUpdateStatus(debt.id, 'paid')}
                              >
                                <CheckCircle2 className="h-3 w-3" />
                                Confirmar
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
                <div className="bg-primary text-white p-1.5 rounded-lg">
                  <Sparkles className="h-4 w-4" />
                </div>
                <CardTitle className="text-lg font-headline">Resumen Inteligente</CardTitle>
              </div>
              <CardDescription>
                Análisis automático de saldos y sugerencias.
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
                    <><Clock className="h-4 w-4 mr-2 animate-spin" />Analizando...</>
                  ) : (
                    <><Sparkles className="h-4 w-4 mr-2" />Generar Resumen</>
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