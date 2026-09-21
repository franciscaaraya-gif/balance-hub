"use client";

import { useEffect, useState, use, useMemo, useRef } from "react";
import { useUser, useFirestore, useDoc, useCollection, useMemoFirebase } from "@/firebase";
import { 
  getGroupMembersDetails, 
  addDebt, 
  addFixedDebtToAll, 
  createReceipt, 
  claimReceiptItem, 
  finalizeReceipt, 
  updateDebtStatusInGroup, 
  updateGroupTransferDetails,
  getUserProfile
} from "@/lib/firebase/store";
import { Group, Debt, UserProfile, Receipt, ReceiptItem, Event } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { 
  Wallet, Plus, Share2, Sparkles, AlertCircle, CheckCircle2, QrCode, 
  UserPlus, ScanLine, Camera, Loader2, DollarSign, Users, Trash2, 
  CreditCard, Copy, Pencil, Save, BrainCircuit, ReceiptText, ChevronDown, 
  ChevronRight, ArrowRight, User
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { parseReceipt } from "@/ai/flows/parse-receipt-flow";
import { generateDebtSummary } from "@/ai/flows/ai-debt-summary-generation";
import { doc, collection, query, orderBy, where } from "firebase/firestore";
import { cn } from "@/lib/utils";
import { Textarea } from "@/components/ui/textarea";

export default function GroupDetails({ params: paramsPromise }: { params: Promise<{ id: string }> }) {
  const params = use(paramsPromise);
  const { user } = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();

  const [addingExpense, setAddingExpense] = useState(false);
  const [expenseMode, setExpenseMode] = useState<'manual' | 'event'>('manual');
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [creditorId, setCreditorId] = useState<string>("");
  const [expenseTitle, setExpenseTitle] = useState("");
  const [expenseAmount, setExpenseAmount] = useState("");
  const [selectedMembers, setSelectedMembers] = useState<string[]>([]);

  const [scanningReceipt, setScanningReceipt] = useState(false);
  const [parsingReceipt, setParsingReceipt] = useState(false);
  const [isActionLoading, setIsActionLoading] = useState(false);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [editingTransfer, setEditingTransfer] = useState(false);
  const [transferInput, setTransferInput] = useState("");
  
  const [isGeneratingSummary, setIsGeneratingSummary] = useState(false);
  const [aiSummary, setAiSummary] = useState<string | null>(null);
  const [expandedGastoId, setExpandedGastoId] = useState<string | null>(null);

  const [members, setMembers] = useState<UserProfile[]>([]);
  const [creditorProfile, setCreditorProfile] = useState<UserProfile | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const groupRef = useMemoFirebase(() => {
    if (!firestore || !params.id || !user?.uid) return null;
    return doc(firestore, 'groups', params.id);
  }, [firestore, params.id, user?.uid]);
  const { data: group, isLoading: groupLoading } = useDoc<Group>(groupRef);

  const debtsQuery = useMemoFirebase(() => {
    if (!firestore || !params.id || !user?.uid) return null;
    return query(collection(firestore, 'groups', params.id, 'debts'), orderBy('createdAt', 'desc'));
  }, [firestore, params.id, user?.uid]);
  const { data: debts } = useCollection<Debt>(debtsQuery);

  const receiptsQuery = useMemoFirebase(() => {
    if (!firestore || !params.id || !user?.uid) return null;
    return query(collection(firestore, 'groups', params.id, 'receipts'), orderBy('createdAt', 'desc'));
  }, [firestore, params.id, user?.uid]);
  const { data: receipts } = useCollection<Receipt>(receiptsQuery);

  const eventsQuery = useMemoFirebase(() => {
    if (!firestore || !params.id || !user?.uid) return null;
    return query(collection(firestore, 'events'), where('groupId', '==', params.id), orderBy('createdAt', 'desc'));
  }, [firestore, params.id, user?.uid]);
  const { data: events } = useCollection<Event>(eventsQuery);

  useEffect(() => {
    if (group?.memberIds) {
      getGroupMembersDetails(group.memberIds).then(setMembers);
    }
    if (group?.transferDetails) {
      setTransferInput(group.transferDetails);
    }
    if (user?.uid) {
      setCreditorId(user.uid);
    }
  }, [group?.memberIds, group?.transferDetails, user?.uid]);

  const isAdmin = group?.adminId === user?.uid;

  // Group debts by chargeGroupId
  const groupedExpenses = useMemo(() => {
    if (!debts) return [];
    const groups: Record<string, Debt[]> = {};
    debts.forEach(debt => {
      const gid = debt.chargeGroupId || debt.id; // Fallback to id for ungrouped
      if (!groups[gid]) groups[gid] = [];
      groups[gid].push(debt);
    });
    return Object.entries(groups).map(([id, debts]) => ({
      id,
      creditorId: debts[0].creditorId,
      description: debts[0].description,
      totalAmount: debts.reduce((sum, d) => sum + d.amount, 0),
      createdAt: debts[0].createdAt,
      debts: debts,
      paidCount: debts.filter(d => d.status === 'paid').length,
      totalCount: debts.length
    })).sort((a, b) => b.createdAt - a.createdAt);
  }, [debts]);

  const handleGenerateAiSummary = async () => {
    if (!group || !debts || !members) return;
    setIsGeneratingSummary(true);
    try {
      const result = await generateDebtSummary({
        groupName: group.name,
        members: members.map(m => ({ id: m.uid, name: m.displayName || 'Usuario' })),
        debts: debts.map(d => ({
          id: d.id,
          debtorId: d.debtorId,
          amount: d.amount,
          description: d.description,
          status: d.status
        }))
      });
      setAiSummary(result.summary);
    } catch (error) {
      toast({ variant: "destructive", title: "Error", description: "No se pudo generar el resumen con IA." });
    } finally {
      setIsGeneratingSummary(false);
    }
  };

  const handleRegisterExpense = async () => {
    if (!expenseTitle || !expenseAmount || !creditorId || selectedMembers.length === 0) {
      toast({ variant: "destructive", title: "Faltan datos", description: "Completa el título, monto y selecciona participantes." });
      return;
    }
    setIsActionLoading(true);
    try {
      const amount = parseFloat(expenseAmount) / selectedMembers.length;
      await addFixedDebtToAll(params.id, amount, expenseTitle, selectedMembers, creditorId);
      toast({ title: "Gasto Registrado", description: "Se han generado las deudas correspondientes." });
      setAddingExpense(false);
      resetExpenseForm();
    } catch (error: any) {
      toast({ variant: "destructive", title: "Error", description: error.message });
    } finally {
      setIsActionLoading(false);
    }
  };

  const resetExpenseForm = () => {
    setExpenseTitle("");
    setExpenseAmount("");
    setSelectedMembers([]);
    setCreditorId(user?.uid || "");
    setSelectedEventId(null);
  };

  const handleEventSelect = (eventId: string) => {
    const event = events?.find(e => e.id === eventId);
    if (event) {
      setSelectedEventId(eventId);
      setExpenseTitle(event.title);
      setExpenseAmount(event.totalCost.toString());
      setSelectedMembers(event.presentIds || []);
    }
  };

  const showCreditorDetails = async (cid: string) => {
    const profile = await getUserProfile(cid);
    setCreditorProfile(profile);
  };

  const copyTransfer = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: "Copiado", description: "Datos de transferencia listos." });
  };

  if (groupLoading) return <div className="h-full flex items-center justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  if (!group) return <div className="p-8 text-center"><AlertCircle className="mx-auto h-12 w-12 opacity-50 mb-4" /><p>Grupo no encontrado.</p></div>;

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-20 px-2 sm:px-4">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-headline font-bold text-primary">{group.name}</h1>
          <p className="text-muted-foreground flex items-center gap-2 text-sm">
            {group.type === 'fixed' ? <Badge variant="default" className="rounded-lg">Partes Iguales</Badge> : <Badge variant="secondary" className="rounded-lg">Variable</Badge>}
            • {group.memberIds.length} Miembros
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" className="gap-2 rounded-xl h-10" onClick={handleGenerateAiSummary} disabled={isGeneratingSummary}>
            {isGeneratingSummary ? <Loader2 className="h-4 w-4 animate-spin" /> : <BrainCircuit className="h-4 w-4 text-accent" />}
            Resumen IA
          </Button>
          <Button variant="outline" size="sm" className="gap-2 rounded-xl h-10" onClick={() => setShowInviteModal(true)}>
            <UserPlus className="h-4 w-4" /> Invitar
          </Button>
          <Button size="sm" onClick={() => setAddingExpense(true)} className="bg-primary hover:bg-primary/90 gap-2 rounded-xl h-10 shadow-lg shadow-primary/20">
            <Plus className="h-4 w-4" /> Registrar Gasto
          </Button>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Panel Izquierdo: Historial Agrupado */}
        <Card className="lg:col-span-2 border-none shadow-sm rounded-[2rem] overflow-hidden bg-white">
          <CardHeader className="border-b pb-6">
            <CardTitle className="text-lg font-headline">Historial de Gastos</CardTitle>
            <CardDescription className="text-xs">Cobros agrupados por evento o registro manual.</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y">
              {groupedExpenses.map(expense => (
                <div key={expense.id} className="group">
                  <div 
                    className={cn(
                      "flex items-center justify-between p-5 hover:bg-muted/30 cursor-pointer transition-colors",
                      expandedGastoId === expense.id && "bg-muted/20"
                    )}
                    onClick={() => setExpandedGastoId(expandedGastoId === expense.id ? null : expense.id)}
                  >
                    <div className="flex items-center gap-4">
                      <div className="h-10 w-10 rounded-2xl bg-primary/10 flex items-center justify-center text-primary">
                        <ReceiptText className="h-5 w-5" />
                      </div>
                      <div>
                        <p className="text-sm font-bold text-primary">{expense.description}</p>
                        <p className="text-[10px] text-muted-foreground flex items-center gap-1 font-medium">
                          <User className="h-2.5 w-2.5" /> Acreedor: {members.find(m => m.uid === expense.creditorId)?.displayName || '...'}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-6">
                      <div className="text-right">
                        <p className="text-sm font-black text-primary">${expense.totalAmount.toFixed(2)}</p>
                        <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-tighter">
                          {expense.paidCount}/{expense.totalCount} PAGADOS
                        </p>
                      </div>
                      <ChevronRight className={cn("h-4 w-4 text-muted-foreground transition-transform", expandedGastoId === expense.id && "rotate-90")} />
                    </div>
                  </div>
                  
                  {expandedGastoId === expense.id && (
                    <div className="bg-muted/10 p-4 space-y-3 border-t">
                      <div className="flex justify-between items-center px-2 mb-2">
                        <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Desglose Individual</span>
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          className="h-7 text-[10px] font-bold text-accent hover:text-accent hover:bg-accent/10 rounded-lg"
                          onClick={() => showCreditorDetails(expense.creditorId)}
                        >
                          <CreditCard className="h-3 w-3 mr-1" /> Ver Datos de Pago
                        </Button>
                      </div>
                      {expense.debts.map(debt => (
                        <div key={debt.id} className="flex items-center justify-between bg-white p-3 rounded-2xl border border-primary/5 shadow-sm">
                          <div className="flex items-center gap-3">
                            <div className="h-7 w-7 rounded-full bg-muted flex items-center justify-center text-[10px] font-bold">
                              {members.find(m => m.uid === debt.debtorId)?.displayName?.[0] || '?'}
                            </div>
                            <span className="text-xs font-bold">{members.find(m => m.uid === debt.debtorId)?.displayName || 'Usuario'}</span>
                            {debt.debtorId === user?.uid && <Badge className="text-[7px] h-3.5 bg-accent/20 text-accent border-none uppercase">Yo</Badge>}
                          </div>
                          <div className="flex items-center gap-3">
                            <span className="text-xs font-black text-primary">${debt.amount.toFixed(2)}</span>
                            {debt.status === 'paid' ? (
                              <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                            ) : (
                              <div className="flex items-center gap-1">
                                <Badge variant="outline" className="text-[8px] border-orange-200 text-orange-600 bg-orange-50 font-bold px-1.5">Pendiente</Badge>
                                {(isAdmin || expense.creditorId === user?.uid) && (
                                  <Button 
                                    size="icon" 
                                    variant="ghost" 
                                    className="h-7 w-7 text-emerald-600 hover:bg-emerald-50 rounded-lg"
                                    onClick={() => updateDebtStatusInGroup(params.id, debt.id, 'paid')}
                                  >
                                    <CheckCircle2 className="h-4 w-4" />
                                  </Button>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
              {groupedExpenses.length === 0 && (
                <div className="text-center py-20 opacity-30 flex flex-col items-center">
                  <ReceiptText className="h-12 w-12 mb-2" />
                  <p className="font-bold text-xs uppercase tracking-widest">Sin gastos registrados</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Panel Derecho: Perfiles y Recibos */}
        <div className="space-y-6">
           {receipts?.filter(r => r.status === 'open').map(receipt => (
            <Card key={receipt.id} className="border-accent/30 shadow-md rounded-[2rem] overflow-hidden">
              <CardHeader className="bg-accent/5 pb-3 border-b">
                <CardTitle className="text-xs font-black uppercase tracking-widest text-accent flex items-center gap-2">
                  <ScanLine className="h-4 w-4" /> Boleta Activa
                </CardTitle>
                <CardDescription className="text-[10px]">Marca tus consumos para dividir la cuenta.</CardDescription>
              </CardHeader>
              <CardContent className="p-0 max-h-80 overflow-y-auto">
                <div className="divide-y">
                  {receipt.items.map(item => {
                    const myClaim = item.claims.find(c => c.userId === user?.uid);
                    return (
                      <div key={item.id} className="p-4 flex flex-col gap-2 hover:bg-muted/30 transition-colors">
                        <div className="flex justify-between items-start">
                          <div>
                            <p className="text-xs font-bold">{item.name}</p>
                            <p className="text-[10px] text-muted-foreground">${item.price.toFixed(2)}</p>
                          </div>
                          <Checkbox checked={!!myClaim} onCheckedChange={(val) => claimReceiptItem(params.id, receipt.id, item.id, user!.uid, val ? 100 : 0, receipt.items)} className="h-5 w-5 rounded-lg" />
                        </div>
                        {myClaim && (
                          <div className="flex items-center gap-2 bg-accent/5 p-2 rounded-xl">
                            <span className="text-[10px] font-bold text-accent">Tu Cuota %:</span>
                            <Input 
                              type="number" 
                              className="h-7 w-20 text-[10px] font-bold border-accent/20" 
                              value={myClaim.percentage} 
                              onChange={(e) => claimReceiptItem(params.id, receipt.id, item.id, user!.uid, parseFloat(e.target.value) || 0, receipt.items)} 
                            />
                          </div>
                        )}
                        <div className="flex flex-wrap gap-1 mt-1">
                          {item.claims.filter(c => c.userId !== user?.uid).map(c => (
                            <Badge key={c.userId} variant="secondary" className="text-[8px] px-1.5 py-0.5 rounded-md opacity-70">
                              {members.find(m => m.uid === c.userId)?.displayName?.split(' ')[0]}: {c.percentage}%
                            </Badge>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
              <CardFooter className="p-4 bg-accent/5 border-t">
                {/* Ahora cualquier miembro del grupo puede finalizar una boleta */}
                <Button 
                  className="w-full bg-accent text-xs font-black uppercase tracking-widest h-11 rounded-xl shadow-lg shadow-accent/20" 
                  onClick={() => finalizeReceipt(params.id, receipt.id, receipt.items, user!.uid)}
                  disabled={isActionLoading}
                >
                  {isActionLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : "Finalizar y Generar Cobros"}
                </Button>
              </CardFooter>
            </Card>
          ))}

          <Card className="border-none shadow-sm rounded-[2rem] overflow-hidden bg-white">
            <CardHeader className="pb-3 border-b">
              <CardTitle className="text-xs font-black uppercase tracking-widest flex items-center gap-2 text-primary">
                <Users className="h-4 w-4" /> Miembros ({members.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-4 space-y-3">
              {members.map(m => (
                <div key={m.uid} className="flex items-center gap-3 text-xs p-2.5 rounded-2xl bg-muted/20 border border-transparent hover:border-primary/10 transition-all">
                  <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center font-bold text-primary">{m.displayName?.[0]}</div>
                  <div className="flex-1 min-w-0">
                    <p className="font-bold truncate text-primary/80">{m.displayName}</p>
                    <p className="text-[8px] text-muted-foreground uppercase font-black">{m.uid === group.adminId ? 'Fundador' : 'Miembro'}</p>
                  </div>
                  {m.uid === user?.uid && <Badge variant="outline" className="text-[7px] h-4 border-accent text-accent">Tú</Badge>}
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* DIALOG: Registrar Gasto */}
      <Dialog open={addingExpense} onOpenChange={setAddingExpense}>
        <DialogContent className="max-w-xl rounded-[2.5rem] p-8 border-none overflow-y-auto max-h-[90vh]">
          <DialogHeader>
            <DialogTitle className="text-2xl font-headline font-bold">Registrar Gasto</DialogTitle>
            <DialogDescription className="text-xs">Crea un cobro compartido eligiendo quién pagó y quiénes deben.</DialogDescription>
          </DialogHeader>

          <div className="space-y-6 py-4">
            <div className="grid grid-cols-2 gap-4 bg-muted/30 p-1 rounded-2xl">
              <Button 
                variant={expenseMode === 'manual' ? 'default' : 'ghost'} 
                className="rounded-xl h-10 text-xs font-bold"
                onClick={() => setExpenseMode('manual')}
              >
                Gasto Manual
              </Button>
              <Button 
                variant={expenseMode === 'event' ? 'default' : 'ghost'} 
                className="rounded-xl h-10 text-xs font-bold"
                onClick={() => setExpenseMode('event')}
              >
                Basado en Evento
              </Button>
            </div>

            {expenseMode === 'event' && (
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase tracking-widest px-1">Seleccionar Evento</Label>
                <Select onValueChange={handleEventSelect} value={selectedEventId || ""}>
                  <SelectTrigger className="h-12 rounded-xl">
                    <SelectValue placeholder="Elegir un evento reciente..." />
                  </SelectTrigger>
                  <SelectContent>
                    {events?.map(ev => (
                      <SelectItem key={ev.id} value={ev.id} className="text-xs">
                        {ev.title} ({ev.date}) - ${ev.totalCost}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase tracking-widest px-1">Concepto del Gasto</Label>
                <Input 
                  placeholder="Ej: Pizza post-partido" 
                  value={expenseTitle}
                  onChange={e => setExpenseTitle(e.target.value)}
                  className="h-12 rounded-xl"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase tracking-widest px-1">Monto Total ($)</Label>
                <div className="relative">
                  <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input 
                    type="number" 
                    placeholder="0.00" 
                    value={expenseAmount}
                    onChange={e => setExpenseAmount(e.target.value)}
                    className="h-12 pl-9 rounded-xl font-bold"
                  />
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-[10px] font-black uppercase tracking-widest px-1">¿Quién pagó? (Acreedor)</Label>
              <Select value={creditorId} onValueChange={setCreditorId}>
                <SelectTrigger className="h-12 rounded-xl">
                  <SelectValue placeholder="Seleccionar acreedor" />
                </SelectTrigger>
                <SelectContent>
                  {members.map(m => (
                    <SelectItem key={m.uid} value={m.uid} className="text-xs">
                      {m.displayName} {m.uid === user?.uid ? "(Tú)" : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-3">
              <div className="flex justify-between items-center px-1">
                <Label className="text-[10px] font-black uppercase tracking-widest">¿Quiénes dividen?</Label>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="h-6 text-[9px] font-black uppercase text-accent"
                  onClick={() => setSelectedMembers(members.map(m => m.uid))}
                >
                  Marcar Todos
                </Button>
              </div>
              <div className="grid grid-cols-2 gap-2 bg-muted/20 p-4 rounded-[2rem] max-h-48 overflow-y-auto">
                {members.map(m => (
                  <div 
                    key={m.uid} 
                    className={cn(
                      "flex items-center gap-2 p-2 rounded-xl border transition-all cursor-pointer",
                      selectedMembers.includes(m.uid) ? "bg-primary/5 border-primary/20" : "bg-white border-transparent"
                    )}
                    onClick={() => {
                      setSelectedMembers(prev => 
                        prev.includes(m.uid) ? prev.filter(id => id !== m.uid) : [...prev, m.uid]
                      );
                    }}
                  >
                    <Checkbox checked={selectedMembers.includes(m.uid)} className="h-4 w-4 rounded-md" />
                    <span className="text-[11px] font-bold truncate">{m.displayName}</span>
                  </div>
                ))}
              </div>
            </div>

            {selectedMembers.length > 0 && expenseAmount && (
              <div className="bg-primary/5 p-4 rounded-2xl flex justify-between items-center">
                <span className="text-xs font-bold text-primary/70">Cuota estimada p/p:</span>
                <span className="text-lg font-black text-primary">
                  ${(parseFloat(expenseAmount) / selectedMembers.length).toFixed(2)}
                </span>
              </div>
            )}
          </div>

          <DialogFooter className="gap-2">
            <Button variant="ghost" className="rounded-xl" onClick={() => setAddingExpense(false)}>Cancelar</Button>
            <Button 
              className="rounded-xl px-8 h-12 bg-primary shadow-lg shadow-primary/20" 
              onClick={handleRegisterExpense}
              disabled={isActionLoading}
            >
              {isActionLoading ? <Loader2 className="animate-spin mr-2" /> : "Generar Cobros"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* DIALOG: Datos Bancarios del Acreedor */}
      <Dialog open={!!creditorProfile} onOpenChange={() => setCreditorProfile(null)}>
        <DialogContent className="max-w-md rounded-[2.5rem] p-8 border-none text-center">
          <DialogHeader>
            <div className="bg-accent/10 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
              <CreditCard className="h-8 w-8 text-accent" />
            </div>
            <DialogTitle className="text-2xl font-headline font-bold">Datos de Transferencia</DialogTitle>
            <DialogDescription className="text-xs">Transfiere a {creditorProfile?.displayName} para liquidar tu deuda.</DialogDescription>
          </DialogHeader>
          
          <div className="py-6 space-y-4">
            {creditorProfile?.transferDetails ? (
              <>
                <div className="bg-muted/30 p-6 rounded-[2rem] font-mono text-xs text-primary leading-relaxed text-left whitespace-pre-wrap border border-primary/5">
                  {creditorProfile.transferDetails}
                </div>
                <Button 
                  variant="outline" 
                  className="w-full h-12 rounded-xl text-[10px] font-black uppercase tracking-widest gap-2 border-2"
                  onClick={() => copyTransfer(creditorProfile.transferDetails!)}
                >
                  <Copy className="h-4 w-4" /> Copiar CBU / Alias
                </Button>
              </>
            ) : (
              <div className="py-10 opacity-40 italic text-sm">
                Este usuario no ha cargado sus datos bancarios todavía.
              </div>
            )}
          </div>
          
          <Button className="w-full h-12 rounded-2xl" onClick={() => setCreditorProfile(null)}>Cerrar</Button>
        </DialogContent>
      </Dialog>

      {/* MODAL: Resumen IA */}
      <Dialog open={!!aiSummary} onOpenChange={(val) => !val && setAiSummary(null)}>
        <DialogContent className="max-w-md rounded-[2.5rem] p-8 border-none">
          <DialogHeader className="text-center pb-4">
            <div className="bg-accent/10 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
              <BrainCircuit className="h-8 w-8 text-accent" />
            </div>
            <DialogTitle className="text-2xl font-headline font-bold">Resumen Financiero IA</DialogTitle>
            <DialogDescription className="text-[10px] font-black uppercase tracking-widest opacity-60">Análisis inteligente de saldos</DialogDescription>
          </DialogHeader>
          <div className="py-4">
             <div className="bg-muted/30 p-6 rounded-[2rem] text-sm leading-relaxed whitespace-pre-wrap font-body text-primary/90">
               {aiSummary}
             </div>
          </div>
          <Button className="w-full h-14 rounded-2xl font-bold text-lg shadow-xl shadow-primary/20" onClick={() => setAiSummary(null)}>Entendido</Button>
        </DialogContent>
      </Dialog>

      {/* MODAL: Invitar / QR */}
      <Dialog open={showInviteModal} onOpenChange={setShowInviteModal}>
        <DialogContent className="max-w-sm rounded-[2.5rem] p-8 border-none text-center">
          <DialogHeader>
            <DialogTitle className="text-2xl font-headline">Invitar al Grupo</DialogTitle>
            <DialogDescription className="text-xs">Comparte el enlace o escanea el QR.</DialogDescription>
          </DialogHeader>
          <div className="flex flex-col items-center gap-6 py-6">
            <div className="bg-white p-4 rounded-[2rem] border-2 border-primary/10 shadow-xl">
              <QrCode className="h-40 w-40 text-primary" />
            </div>
            <div className="w-full space-y-3">
              <Label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Enlace de Invitación</Label>
              <div className="flex gap-2">
                <Input readOnly value={group.inviteLink} className="text-xs h-11 rounded-xl bg-muted/50 border-none" />
                <Button size="icon" variant="outline" className="h-11 w-11 rounded-xl border-2" onClick={() => { navigator.clipboard.writeText(group.inviteLink); toast({ title: "¡Copiado!" }); }}>
                  <Share2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
          <Button className="w-full h-12 rounded-2xl" onClick={() => setShowInviteModal(false)}>Cerrar</Button>
        </DialogContent>
      </Dialog>
    </div>
  );
}