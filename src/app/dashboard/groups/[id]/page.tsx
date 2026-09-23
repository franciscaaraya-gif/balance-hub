"use client";

import { useEffect, useState, use, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useUser, useFirestore, useDoc, useCollection, useMemoFirebase } from "@/firebase";
import { 
  getGroupMembersDetails, 
  addDebt, 
  addFixedDebtToAll, 
  createReceipt, 
  claimReceiptItem, 
  finalizeReceipt, 
  updateDebtStatusInGroup, 
  getUserProfile,
  archiveGroup,
  deleteGroup
} from "@/lib/firebase/store";
import { Group, Debt, UserProfile, Receipt, ReceiptItem, Event } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { 
  Plus, Share2, AlertCircle, CheckCircle2, QrCode, 
  UserPlus, ScanLine, Loader2, DollarSign, Users, 
  CreditCard, Copy, ReceiptText, ChevronRight, User, Info, Settings2, Download, Archive, Trash2, Search
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { doc, collection, query, orderBy, where, updateDoc } from "firebase/firestore";
import { cn, formatCurrency } from "@/lib/utils";
import { Textarea } from "@/components/ui/textarea";
import * as XLSX from "xlsx";

export default function GroupDetails({ params: paramsPromise }: { params: Promise<{ id: string }> }) {
  const params = use(paramsPromise);
  const router = useRouter();
  const { user } = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();

  const [addingExpense, setAddingExpense] = useState(false);
  const [expenseMode, setExpenseMode] = useState<'manual' | 'event' | 'item'>('manual');
  const [divideEqually, setDivideEqually] = useState(true);
  const [manualAmounts, setManualAmounts] = useState<Record<string, string>>({});
  
  const [pastedText, setPastedText] = useState("");
  const [parsedItems, setParsedItems] = useState<Array<{ name: string; quantity: number; unitPrice: number; totalPrice: number }>>([]);
  const [includeTip, setIncludeTip] = useState(false);

  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [creditorId, setCreditorId] = useState<string>("");
  const [expenseTitle, setExpenseTitle] = useState("");
  const [expenseAmount, setExpenseAmount] = useState("");
  const [selectedMembers, setSelectedMembers] = useState<string[]>([]);

  // Estados para búsqueda de miembros
  const [memberSearchTerm, setMemberSearchTerm] = useState("");
  const [receiptSearchTerm, setReceiptSearchTerm] = useState("");

  const [isActionLoading, setIsActionLoading] = useState(false);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [expandedGastoId, setExpandedGastoId] = useState<string | null>(null);

  const [members, setMembers] = useState<UserProfile[]>([]);
  const [creditorProfile, setCreditorProfile] = useState<UserProfile | null>(null);

  const [confirmingDebt, setConfirmingDebt] = useState<{ id: string; amount: number; name: string } | null>(null);

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
    return query(
      collection(firestore, 'events'), 
      where('groupId', '==', params.id), 
      orderBy('createdAt', 'desc')
    );
  }, [firestore, params.id, user?.uid]);
  const { data: events } = useCollection<Event>(eventsQuery);

  useEffect(() => {
    if (group?.memberIds) {
      getGroupMembersDetails(group.memberIds).then(setMembers);
    }
    if (user?.uid) {
      setCreditorId(user.uid);
    }
  }, [group?.memberIds, user?.uid]);

  const handleEventSelect = (eventId: string) => {
    const event = events?.find(e => e.id === eventId);
    if (event) {
      setSelectedEventId(eventId);
      setExpenseTitle("");
      setExpenseAmount("");
      setCreditorId(event.creditorId || event.creatorId);

      const absentIds = event.participantIds.filter(id => !event.presentIds.includes(id));
      const candidates = [...(event.presentIds || [])];
      if (event.chargeAbsentees) {
        absentIds.forEach(id => {
          if (!candidates.includes(id)) candidates.push(id);
        });
      }
      setSelectedMembers(candidates);
      setManualAmounts({});
    }
  };

  useEffect(() => {
    if (typeof window !== 'undefined' && events && events.length > 0) {
      const urlParams = new URLSearchParams(window.location.search);
      const openExpense = urlParams.get('openExpense');
      const evId = urlParams.get('eventId');
      if (openExpense === 'true' && evId) {
        window.history.replaceState({}, document.title, window.location.pathname);
        setAddingExpense(true);
        setExpenseMode('event');
        handleEventSelect(evId);
      }
    }
  }, [events]);

  const isAdmin = group?.adminId === user?.uid;

  const aggregatedItemsTotal = useMemo(() => {
    return parsedItems.reduce((acc, it) => acc + (it.totalPrice || 0), 0);
  }, [parsedItems]);

  const groupedExpenses = useMemo(() => {
    if (!debts) return [];
    const groupsMap: Record<string, Debt[]> = {};
    debts.forEach(debt => {
      const gid = debt.chargeGroupId || debt.id;
      if (!groupsMap[gid]) groupsMap[gid] = [];
      groupsMap[gid].push(debt);
    });
    return Object.entries(groupsMap).map(([id, debtsList]) => ({
      id,
      creditorId: debtsList[0].creditorId,
      description: debtsList[0].description,
      totalAmount: debtsList.reduce((sum, d) => sum + d.amount, 0),
      createdAt: debtsList[0].createdAt,
      debts: debtsList,
      paidCount: debtsList.filter(d => d.status === 'paid').length,
      totalCount: debtsList.length
    })).sort((a, b) => b.createdAt - a.createdAt);
  }, [debts]);

  const manualSum = useMemo(() => {
    return Object.values(manualAmounts).reduce((acc, val) => acc + (parseFloat(val) || 0), 0);
  }, [manualAmounts]);

  const totalTarget = useMemo(() => {
    return parseFloat(expenseAmount) || 0;
  }, [expenseAmount]);

  const difference = useMemo(() => {
    return totalTarget - manualSum;
  }, [totalTarget, manualSum]);

  // Filtrado de miembros en el modal de gasto
  const filteredMembers = useMemo(() => {
    if (!memberSearchTerm) return members;
    return members.filter(m => 
      m.displayName?.toLowerCase().includes(memberSearchTerm.toLowerCase()) ||
      m.email?.toLowerCase().includes(memberSearchTerm.toLowerCase())
    );
  }, [members, memberSearchTerm]);

  const handleParseItems = () => {
    const lines = pastedText.split('\n').map(l => l.trim()).filter(Boolean);
    const items: Array<{ name: string; quantity: number; unitPrice: number; totalPrice: number }> = [];
    
    for (let i = 0; i < lines.length; i++) {
      const parts = lines[i].split(';');
      if (parts.length < 2) {
        toast({ variant: "destructive", title: "Error de formato", description: `Línea ${i + 1} inválida.` });
        return;
      }
      const name = parts[0].trim();
      const quantity = parseInt(parts[1]) || 1;
      const unitPrice = parseFloat(parts[2]) || 0;
      const totalPrice = parseFloat(parts[3]) || (quantity * unitPrice) || 0;
      items.push({ name, quantity, unitPrice, totalPrice });
    }
    
    setParsedItems(items);
    const sum = items.reduce((acc, item) => acc + item.totalPrice, 0);
    setExpenseAmount(sum.toString());
    toast({ title: "Boleta Procesada", description: `Extraídos ${items.length} ítems.` });
  };

  const handleRegisterExpense = async () => {
    if (expenseMode === 'item') {
      if (parsedItems.length === 0) {
        toast({ variant: "destructive", title: "Faltan datos", description: "Procesa la boleta primero." });
        return;
      }
      setIsActionLoading(true);
      try {
        const event = selectedEventId ? events?.find(e => e.id === selectedEventId) : null;
        await createReceipt(
          params.id, 
          parsedItems.map(it => ({ name: it.name, price: it.totalPrice })), 
          creditorId || user!.uid, 
          includeTip,
          event?.externalGuests || []
        );
        toast({ title: "Boleta Activa Creada" });
        setAddingExpense(false);
        resetExpenseForm();
      } catch (error: any) {
        toast({ variant: "destructive", title: "Error", description: error.message });
      } finally {
        setIsActionLoading(false);
      }
      return;
    }

    if (!expenseTitle || !expenseAmount || !creditorId) {
      toast({ variant: "destructive", title: "Faltan datos" });
      return;
    }

    setIsActionLoading(true);
    try {
      if (divideEqually) {
        if (selectedMembers.length === 0) {
          toast({ variant: "destructive", title: "Selecciona participantes" });
          setIsActionLoading(false);
          return;
        }
        const amountPerPerson = parseFloat(expenseAmount) / selectedMembers.length;
        await addFixedDebtToAll(params.id, amountPerPerson, expenseTitle, selectedMembers, creditorId);
      } else {
        if (Math.abs(difference) > 0.01) {
          toast({ variant: "destructive", title: "Monto no cuadra", description: `Diferencia: ${formatCurrency(difference)}` });
          setIsActionLoading(false);
          return;
        }
        const chargeGroupId = Math.random().toString(35).substring(7);
        for (const uid of Object.keys(manualAmounts)) {
          const amt = parseFloat(manualAmounts[uid]) || 0;
          if (amt > 0) {
            await addDebt(params.id, uid, amt, expenseTitle, creditorId, chargeGroupId);
          }
        }
      }

      toast({ title: "Gasto Registrado Correctamente" });
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
    setDivideEqually(true);
    setManualAmounts({});
    setPastedText("");
    setParsedItems([]);
    setIncludeTip(false);
    setMemberSearchTerm("");
  };

  const copyAiPrompt = () => {
    const promptText = `Analiza la imagen de esta boleta/factura y devuélveme SOLO una lista, un ítem por línea, en este formato exacto:
nombre_item;cantidad;precio_unitario;precio_total`;
    navigator.clipboard.writeText(promptText);
    toast({ title: "Prompt Copiado" });
  };

  const showCreditorDetails = async (cid: string) => {
    const profile = await getUserProfile(cid);
    setCreditorProfile(profile);
  };

  const confirmPaid = async () => {
    if (!confirmingDebt) return;
    try {
      await updateDebtStatusInGroup(params.id, confirmingDebt.id, 'paid');
      toast({ title: "Pago Validado" });
    } catch (e) {
      toast({ variant: "destructive", title: "Error" });
    } finally {
      setConfirmingDebt(null);
    }
  };

  const handleExportExcel = () => {
    if (!debts || !group) return;

    const sortedDebts = [...debts].sort((a, b) => a.createdAt - b.createdAt);

    const data = sortedDebts.map(debt => {
      const debtorName = members.find(m => m.uid === debt.debtorId)?.displayName || debt.debtorId;
      const creditorName = members.find(m => m.uid === debt.creditorId)?.displayName || debt.creditorId;
      
      let statusText = "Pendiente";
      if (debt.status === "under_review") statusText = "En Revisión";
      if (debt.status === "paid") statusText = "Pagado";

      return {
        "Deudor": debtorName,
        "Acreedor": creditorName,
        "Concepto/Gasto": debt.description,
        "Monto": debt.amount,
        "Estado": statusText,
        "Fecha de creación": new Date(debt.createdAt).toLocaleDateString("es-ES"),
        "Fecha de pago": debt.status === "paid" ? new Date(debt.updatedAt || debt.createdAt).toLocaleDateString("es-ES") : ""
      };
    });

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Cobros");
    
    const sanitizedName = group.name.replace(/[^a-zA-Z0-9]/g, "_");
    const today = new Date().toISOString().split("T")[0];
    
    XLSX.writeFile(wb, `cobros-${sanitizedName}-${today}.xlsx`);
    toast({ title: "Excel Descargado", description: "El historial de deudas se ha exportado correctamente." });
  };

  const handleSelectAll = () => {
    if (selectedMembers.length === members.length) {
      setSelectedMembers([]);
    } else {
      setSelectedMembers(members.map(m => m.uid));
    }
  };

  const handleArchive = async () => {
    try {
      await archiveGroup(params.id, true);
      toast({ title: "Grupo Archivado", description: "El grupo se ha movido a la sección de archivados." });
      router.push("/dashboard/groups");
    } catch (e) {
      toast({ variant: "destructive", title: "Error al archivar" });
    }
  };

  const handleDelete = async () => {
    setIsActionLoading(true);
    try {
      await deleteGroup(params.id);
      toast({ title: "Grupo Eliminado", description: "El grupo se ha borrado definitivamente." });
      router.push("/dashboard/groups");
    } catch (e: any) {
      toast({ variant: "destructive", title: "No se puede eliminar", description: e.message });
    } finally {
      setIsActionLoading(false);
      setShowSettingsModal(false);
    }
  };

  if (groupLoading) return <div className="h-full flex items-center justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  if (!group) return <div className="p-8 text-center"><AlertCircle className="mx-auto h-12 w-12 opacity-50 mb-4" /><p>Grupo no encontrado.</p></div>;

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-20 px-0 sm:px-4">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 px-4 sm:px-0">
        <div className="min-w-0">
          <h1 className="text-2xl sm:text-3xl font-headline font-bold text-primary truncate">{group.name}</h1>
          <div className="flex items-center gap-2 text-[10px] sm:text-sm text-muted-foreground font-medium mt-1">
            <Badge variant="secondary" className="rounded-lg text-[9px] uppercase font-black">{group.isArchived ? "Archivado" : "Activo"}</Badge>
            <span>• {group.memberIds.length} Miembros</span>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {isAdmin && (
            <Button variant="outline" size="sm" className="flex-1 md:flex-none gap-2 rounded-xl h-10 text-[10px] font-black uppercase" onClick={() => setShowSettingsModal(true)}>
              <Settings2 className="h-4 w-4" /> Gestión
            </Button>
          )}
          <Button variant="outline" size="sm" className="flex-1 md:flex-none gap-2 rounded-xl h-10 text-[10px] font-black uppercase" onClick={() => setShowInviteModal(true)}>
            <UserPlus className="h-4 w-4" /> Invitar
          </Button>
          <Button size="sm" onClick={() => setAddingExpense(true)} className="w-full md:w-auto bg-primary hover:bg-primary/90 gap-2 rounded-xl h-11 shadow-lg shadow-primary/20 text-[10px] font-black uppercase">
            <Plus className="h-4 w-4" /> Registrar Gasto
          </Button>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-4 sm:space-y-6">
          <Card className="border-none shadow-sm rounded-[1.5rem] sm:rounded-[2rem] overflow-hidden bg-white">
            <CardHeader className="border-b pb-6 px-4 sm:px-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <CardTitle className="text-lg font-headline">Historial de Cobros</CardTitle>
                <CardDescription className="text-xs">Cobros agrupados por gasto o evento.</CardDescription>
              </div>
              {debts && debts.length > 0 && (
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={handleExportExcel} 
                  className="rounded-xl h-10 border-2 font-bold text-xs gap-2 w-full sm:w-auto"
                >
                  <Download className="h-4 w-4" /> Descargar Excel
                </Button>
              )}
            </CardHeader>
            <CardContent className="p-0">
              <div className="divide-y">
                {groupedExpenses.map(expense => (
                  <div key={expense.id} className="group">
                    <div 
                      className={cn(
                        "flex items-center justify-between p-4 sm:p-5 hover:bg-muted/30 cursor-pointer transition-colors active:bg-muted/50",
                        expandedGastoId === expense.id && "bg-muted/20"
                      )}
                      onClick={() => setExpandedGastoId(expandedGastoId === expense.id ? null : expense.id)}
                    >
                      <div className="flex items-center gap-3 sm:gap-4 min-w-0">
                        <div className="h-9 w-9 sm:h-10 sm:w-10 rounded-xl sm:rounded-2xl bg-primary/10 flex items-center justify-center text-primary shrink-0">
                          <ReceiptText className="h-5 w-5" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs sm:text-sm font-bold text-primary truncate pr-2">{expense.description}</p>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            <span className="text-[9px] text-muted-foreground font-medium flex items-center gap-1 shrink-0">
                              <User className="h-2.5 w-2.5" /> {members.find(m => m.uid === expense.creditorId)?.displayName?.split(' ')[0] || '...'}
                            </span>
                            <span className="text-[8px] bg-muted px-1.5 py-0.5 rounded text-muted-foreground font-black uppercase tracking-tighter shrink-0">
                              {expense.paidCount}/{expense.totalCount} Pagos
                            </span>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 sm:gap-6 shrink-0 ml-2">
                        <div className="text-right">
                          <p className="text-sm sm:text-base font-black text-primary font-headline">{formatCurrency(expense.totalAmount)}</p>
                        </div>
                        <ChevronRight className={cn("h-4 w-4 text-muted-foreground transition-transform shrink-0", expandedGastoId === expense.id && "rotate-90")} />
                      </div>
                    </div>
                    
                    {expandedGastoId === expense.id && (
                      <div className="bg-muted/10 p-4 space-y-3 border-t">
                        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 px-2 mb-2">
                          <span className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">Desglose Individual</span>
                          <Button 
                            variant="secondary" 
                            size="sm" 
                            className="h-9 text-[10px] font-bold text-accent hover:text-accent hover:bg-accent/10 rounded-xl w-full sm:w-auto"
                            onClick={() => showCreditorDetails(expense.creditorId)}
                          >
                            <CreditCard className="h-3 w-3 mr-2" /> Datos de Pago Acreedor
                          </Button>
                        </div>
                        <div className="space-y-2">
                          {expense.debts.map(debt => (
                            <div key={debt.id} className="flex items-center justify-between bg-white p-3 sm:p-4 rounded-xl sm:rounded-2xl border border-primary/5 shadow-sm">
                              <div className="flex items-center gap-3 min-w-0">
                                <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center text-[10px] font-bold shrink-0">
                                  {members.find(m => m.uid === debt.debtorId)?.displayName?.[0] || '?'}
                                </div>
                                <span className="text-xs font-bold truncate pr-2">{members.find(m => m.uid === debt.debtorId)?.displayName || 'Usuario'}</span>
                              </div>
                              <div className="flex items-center gap-3 shrink-0">
                                <span className="text-xs font-black text-primary">{formatCurrency(debt.amount)}</span>
                                {debt.status === 'paid' ? (
                                  <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                                ) : (
                                  <div className="flex items-center gap-1.5">
                                    <Badge variant="outline" className={cn(
                                      "text-[8px] font-bold px-1.5 py-0.5",
                                      debt.status === 'under_review' ? "border-blue-200 text-blue-600 bg-blue-50 animate-pulse" : "border-orange-200 text-orange-600 bg-orange-50"
                                    )}>
                                      {debt.status === 'under_review' ? 'En Revisión' : 'Pendiente'}
                                    </Badge>
                                    {(isAdmin || expense.creditorId === user?.uid) && (
                                      <Button 
                                        size="icon" 
                                        variant="ghost" 
                                        className="h-8 w-8 text-emerald-600 hover:bg-emerald-50 rounded-lg shrink-0 border border-emerald-100"
                                        onClick={() => setConfirmingDebt({ 
                                          id: debt.id, 
                                          amount: debt.amount, 
                                          name: members.find(m => m.uid === debt.debtorId)?.displayName || 'Usuario' 
                                        })}
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
                      </div>
                    )}
                  </div>
                ))}
                {groupedExpenses.length === 0 && (
                  <div className="text-center py-20 opacity-30 flex flex-col items-center">
                    <ReceiptText className="h-12 w-12 mb-2" />
                    <p className="font-bold text-[10px] uppercase tracking-widest">Sin gastos registrados</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-4 sm:space-y-6 px-4 sm:px-0">
           {receipts?.filter(r => r.status === 'active').map(receipt => {
             // Filtrado de miembros en la boleta activa
             const filteredMembersForReceipt = members.filter(m => 
               m.displayName?.toLowerCase().includes(receiptSearchTerm.toLowerCase())
             );
             const filteredGuestsForReceipt = receipt.externalGuests?.filter(g => 
               g.name.toLowerCase().includes(receiptSearchTerm.toLowerCase())
             ) || [];

             return (
              <Card key={receipt.id} className="border-accent/30 shadow-lg rounded-[1.5rem] sm:rounded-[2rem] overflow-hidden bg-white">
                <CardHeader className="bg-accent/5 pb-3 border-b px-4">
                  <CardTitle className="text-[10px] font-black uppercase tracking-widest text-accent flex items-center gap-2">
                    <ScanLine className="h-4 w-4" /> Boleta Colaborativa {receipt.includeTip && " + 10% Propina"}
                  </CardTitle>
                  <p className="text-[9px] text-muted-foreground font-medium">Marca lo que consumiste.</p>
                  
                  {/* Buscador en la boleta */}
                  <div className="relative mt-3">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground" />
                    <Input 
                      placeholder="Filtrar por nombre..." 
                      value={receiptSearchTerm}
                      onChange={e => setReceiptSearchTerm(e.target.value)}
                      className="h-8 pl-8 rounded-lg text-[10px] bg-white border-accent/20"
                    />
                  </div>
                </CardHeader>
                <CardContent className="p-0 max-h-[350px] sm:max-h-[450px] overflow-y-auto">
                  <div className="divide-y">
                    {receipt.items.map(item => (
                      <div key={item.id} className="p-4 space-y-3 hover:bg-muted/5 transition-colors">
                        <div className="flex justify-between items-start">
                          <div className="min-w-0 pr-2">
                            <p className="text-xs font-bold text-primary truncate">{item.name}</p>
                            <p className="text-[10px] text-muted-foreground font-medium">{formatCurrency(item.price)}</p>
                          </div>
                        </div>
                        
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          {filteredMembersForReceipt.map(m => {
                            const claimKey = `${item.id}_${m.uid}`;
                            const currentPercentage = receipt.claims?.[claimKey] || 0;
                            const isClaimed = currentPercentage > 0;
                            
                            return (
                              <div 
                                key={m.uid} 
                                className={cn(
                                  "flex items-center gap-2 p-2 rounded-xl border transition-all active:scale-[0.98]",
                                  isClaimed ? "bg-accent/5 border-accent/20" : "bg-muted/20 border-transparent"
                                )}
                                onClick={() => claimReceiptItem(params.id, receipt.id, item.id, m.uid, isClaimed ? 0 : 100)}
                              >
                                <Checkbox 
                                  checked={isClaimed} 
                                  onCheckedChange={() => {}} 
                                  className="h-4 w-4 rounded pointer-events-none" 
                                />
                                <span className="font-bold text-[10px] truncate flex-1">{m.displayName?.split(' ')[0]}</span>
                              </div>
                            );
                          })}

                          {filteredGuestsForReceipt.map((guest, gIdx) => {
                            const guestId = `guest_${gIdx}`;
                            const claimKey = `${item.id}_${guestId}`;
                            const currentPercentage = receipt.claims?.[claimKey] || 0;
                            const isClaimed = currentPercentage > 0;
                            const responsibleName = members.find(m => m.uid === guest.addedBy)?.displayName?.split(' ')[0] || '...';

                            return (
                              <div 
                                key={guestId} 
                                className={cn(
                                  "flex items-center gap-2 p-2 rounded-xl border transition-all active:scale-[0.98] border-dashed",
                                  isClaimed ? "bg-accent/5 border-accent/40" : "bg-muted/10 border-transparent"
                                )}
                                onClick={() => claimReceiptItem(params.id, receipt.id, item.id, guestId, isClaimed ? 0 : 100)}
                              >
                                <Checkbox 
                                  checked={isClaimed} 
                                  onCheckedChange={() => {}} 
                                  className="h-4 w-4 rounded pointer-events-none" 
                                />
                                <div className="flex flex-col min-w-0">
                                  <span className="font-bold text-[10px] truncate">{guest.name}</span>
                                  <span className="text-[7px] text-muted-foreground font-medium truncate italic">De {responsibleName}</span>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
                <CardFooter className="p-4 bg-accent/5 border-t">
                  {user?.uid === receipt.creditorId ? (
                    <Button 
                      className="w-full bg-accent text-[10px] font-black uppercase tracking-widest h-11 rounded-xl shadow-lg" 
                      onClick={() => finalizeReceipt(
                        params.id, 
                        receipt.id, 
                        receipt.items, 
                        receipt.claims, 
                        receipt.creditorId, 
                        undefined, 
                        receipt.includeTip,
                        receipt.externalGuests
                      )}
                    >
                      Finalizar y Cobrar
                    </Button>
                  ) : (
                    <div className="w-full text-center py-2 px-4 rounded-xl bg-muted/50 border border-dashed text-[9px] font-bold text-muted-foreground uppercase tracking-widest">
                      Esperando al acreedor
                    </div>
                  )}
                </CardFooter>
              </Card>
            );
          })}

          <Card className="border-none shadow-sm rounded-[1.5rem] sm:rounded-[2rem] overflow-hidden bg-white">
            <CardHeader className="pb-3 border-b px-4">
              <CardTitle className="text-[10px] font-black uppercase tracking-widest flex items-center gap-2 text-primary">
                <Users className="h-4 w-4" /> Miembros ({members.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-4 space-y-2 px-4">
              {members.map(m => (
                <div key={m.uid} className="flex items-center gap-3 text-xs p-2.5 rounded-xl bg-muted/30 border border-transparent hover:border-primary/5">
                  <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center font-bold text-primary shrink-0">{m.displayName?.[0] || 'U'}</div>
                  <div className="flex-1 min-w-0"><p className="font-bold truncate text-primary/80">{m.displayName}</p></div>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>

      <Dialog open={addingExpense} onOpenChange={setAddingExpense}>
        <DialogContent className="w-[95vw] sm:max-w-xl rounded-[2rem] p-6 sm:p-8 border-none overflow-y-auto max-h-[90vh] mx-auto">
          <DialogHeader>
            <DialogTitle className="text-xl sm:text-2xl font-headline font-bold text-primary">Registrar Gasto</DialogTitle>
          </DialogHeader>

          <div className="space-y-6 py-4">
            <div className="grid grid-cols-3 gap-2 bg-muted/30 p-1.5 rounded-2xl">
              <Button variant={expenseMode === 'manual' ? 'default' : 'ghost'} className="rounded-xl h-10 text-[9px] sm:text-[11px] font-bold uppercase tracking-tighter" onClick={() => setExpenseMode('manual')}>Manual</Button>
              <Button variant={expenseMode === 'event' ? 'default' : 'ghost'} className="rounded-xl h-10 text-[9px] sm:text-[11px] font-bold uppercase tracking-tighter" onClick={() => setExpenseMode('event')}>Evento</Button>
              <Button variant={expenseMode === 'item' ? 'default' : 'ghost'} className="rounded-xl h-10 text-[9px] sm:text-[11px] font-bold uppercase tracking-tighter" onClick={() => setExpenseMode('item')}>Boleta IA</Button>
            </div>

            {expenseMode === 'event' && (
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase tracking-widest px-1 text-muted-foreground">Vincular a Evento</Label>
                <Select onValueChange={handleEventSelect} value={selectedEventId || ""}>
                  <SelectTrigger className="h-12 rounded-xl text-xs">
                    <SelectValue placeholder="Elegir evento..." />
                  </SelectTrigger>
                  <SelectContent>
                    {events?.map(ev => (
                      <SelectItem key={ev.id} value={ev.id} className="text-xs">
                        {ev.title} ({ev.date})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="space-y-2">
              <Label className="text-[10px] font-black uppercase tracking-widest px-1 text-muted-foreground">¿Quién pagó?</Label>
              <Select value={creditorId} onValueChange={setCreditorId}>
                <SelectTrigger className="h-12 rounded-xl text-xs">
                  <SelectValue placeholder="Seleccionar acreedor" />
                </SelectTrigger>
                <SelectContent>
                  {members.map(m => (
                    <SelectItem key={m.uid} value={m.uid} className="text-xs">{m.displayName} {m.uid === user?.uid ? "(Tú)" : ""}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {expenseMode !== 'item' ? (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase tracking-widest px-1 text-muted-foreground">Concepto</Label>
                    <Input placeholder="Ej: Pizza" value={expenseTitle} onChange={e => setExpenseTitle(e.target.value)} className="h-12 rounded-xl text-sm" />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase tracking-widest px-1 text-muted-foreground">Monto Total</Label>
                    <div className="relative">
                      <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input type="number" placeholder="0.00" value={expenseAmount} onChange={e => setExpenseAmount(e.target.value)} className="h-12 pl-9 rounded-xl font-bold text-sm" />
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between p-4 bg-muted/40 rounded-2xl border">
                  <div className="space-y-0.5"><Label className="text-xs font-bold">Dividir en partes iguales</Label></div>
                  <Switch checked={divideEqually} onCheckedChange={(val) => { setDivideEqually(val); }} />
                </div>

                <div className="space-y-3">
                  <div className="flex items-center justify-between px-1">
                    <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                      {divideEqually ? "¿Quiénes entran en la división?" : "Montos Manuales"}
                    </Label>
                    {divideEqually && (
                      <Button variant="ghost" size="sm" className="h-6 text-[9px] font-black uppercase text-accent hover:bg-accent/5" onClick={handleSelectAll}>
                        {selectedMembers.length === members.length ? "Desmarcar todos" : "Marcar todos"}
                      </Button>
                    )}
                  </div>
                  
                  {/* Buscador de miembros en el modal */}
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                    <Input 
                      placeholder="Buscar por nombre..." 
                      value={memberSearchTerm}
                      onChange={e => setMemberSearchTerm(e.target.value)}
                      className="h-10 pl-10 rounded-xl text-xs bg-muted/20 border-none"
                    />
                  </div>

                  {divideEqually ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 bg-muted/10 p-4 rounded-2xl max-h-48 overflow-y-auto border">
                      {filteredMembers.map(m => (
                        <div key={m.uid} className={cn("flex items-center gap-2 p-2.5 rounded-xl border transition-all cursor-pointer active:scale-[0.98]", selectedMembers.includes(m.uid) ? "bg-white border-primary/20 shadow-sm" : "bg-transparent border-transparent")} onClick={() => setSelectedMembers(prev => prev.includes(m.uid) ? prev.filter(id => id !== m.uid) : [...prev, m.uid])}>
                          <Checkbox checked={selectedMembers.includes(m.uid)} className="h-4 w-4 rounded-md pointer-events-none" />
                          <span className="text-[11px] font-bold truncate">{m.displayName}</span>
                        </div>
                      ))}
                      {filteredMembers.length === 0 && <p className="text-[10px] text-muted-foreground text-center py-2 col-span-full">Sin coincidencias.</p>}
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <div className="space-y-2 bg-muted/10 p-3 sm:p-4 rounded-2xl max-h-60 overflow-y-auto border border-dashed">
                        {filteredMembers.map(m => (
                          <div key={m.uid} className="flex items-center justify-between bg-white p-3 rounded-xl border shadow-sm">
                            <span className="text-[11px] font-bold truncate pr-2">{m.displayName?.split(' ')[0]}</span>
                            <Input type="number" placeholder="0.00" className="h-9 w-24 sm:w-32 font-bold text-xs" value={manualAmounts[m.uid] || ""} onChange={(e) => setManualAmounts({ ...manualAmounts, [m.uid]: e.target.value })} />
                          </div>
                        ))}
                        {filteredMembers.length === 0 && <p className="text-[10px] text-muted-foreground text-center py-2">Sin coincidencias.</p>}
                      </div>
                      <div className={cn("p-4 rounded-xl text-[10px] font-bold flex justify-between items-center shadow-inner", Math.abs(difference) < 0.01 ? "bg-emerald-50 text-emerald-700" : "bg-orange-50 text-orange-700")}>
                        <span>Asignado: {formatCurrency(manualSum)}</span>
                        <span>{Math.abs(difference) < 0.01 ? <CheckCircle2 className="h-4 w-4" /> : `Falta: ${formatCurrency(difference)}`}</span>
                      </div>
                    </div>
                  )}
                </div>
              </>
            ) : (
              <div className="space-y-4">
                <div className="bg-primary/5 p-5 rounded-2xl border border-primary/10 space-y-3 text-center">
                  <p className="text-[10px] text-muted-foreground font-medium">Copia el prompt, procésalo en una IA externa y pega aquí el resultado.</p>
                  <Button type="button" onClick={copyAiPrompt} variant="outline" className="w-full h-11 text-[10px] font-black uppercase rounded-xl gap-2">
                    <Copy className="h-4 w-4" /> Copiar Prompt
                  </Button>
                </div>
                <Textarea placeholder="nombre;cantidad;precio_unitario;precio_total" className="min-h-[150px] rounded-xl text-[11px] font-mono p-4" value={pastedText} onChange={(e) => setPastedText(e.target.value)} />
                <Button type="button" className="w-full h-12 rounded-xl text-[11px] font-black uppercase" onClick={handleParseItems}>Procesar Texto</Button>
                
                {parsedItems.length > 0 && (
                  <div className="space-y-4 mt-4 border-t pt-4">
                    <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Revisar ítems</Label>
                    <div className="space-y-2 max-h-48 overflow-y-auto bg-muted/10 p-2 rounded-xl border">
                      {parsedItems.map((item, idx) => (
                        <div key={idx} className="grid grid-cols-12 gap-2 items-center bg-white p-2 rounded-lg border shadow-sm">
                          <div className="col-span-6">
                            <Input 
                              value={item.name} 
                              onChange={(e) => {
                                const updated = [...parsedItems];
                                updated[idx].name = e.target.value;
                                setParsedItems(updated);
                              }}
                              className="h-8 text-xs rounded-lg"
                            />
                          </div>
                          <div className="col-span-2">
                            <Input 
                              type="number"
                              value={item.quantity || ""} 
                              onChange={(e) => {
                                const updated = [...parsedItems];
                                updated[idx].quantity = parseInt(e.target.value) || 0;
                                updated[idx].totalPrice = updated[idx].quantity * updated[idx].unitPrice;
                                setParsedItems(updated);
                                setExpenseAmount(updated.reduce((acc, it) => acc + (it.totalPrice || 0), 0).toString());
                              }}
                              className="h-8 text-xs p-1 text-center rounded-lg"
                            />
                          </div>
                          <div className="col-span-4">
                            <Input 
                              type="number"
                              value={item.totalPrice || ""} 
                              onChange={(e) => {
                                const updated = [...parsedItems];
                                updated[idx].totalPrice = parseFloat(e.target.value) || 0;
                                setParsedItems(updated);
                                setExpenseAmount(updated.reduce((acc, it) => acc + (it.totalPrice || 0), 0).toString());
                              }}
                              className="h-8 text-xs font-bold text-right rounded-lg"
                            />
                          </div>
                        </div>
                      ))}
                    </div>

                    <div className="flex justify-between items-center bg-muted/30 p-3 rounded-xl font-bold text-sm">
                      <span className="text-muted-foreground text-xs uppercase tracking-wider">Total:</span>
                      <span className="text-primary">{formatCurrency(aggregatedItemsTotal)}</span>
                    </div>

                    <div className="flex items-center justify-between p-4 bg-muted/40 rounded-xl border">
                      <div className="space-y-0.5"><Label className="text-xs font-bold">¿Propina 10%?</Label></div>
                      <Switch checked={includeTip} onCheckedChange={setIncludeTip} />
                    </div>

                    {includeTip && (
                      <p className="text-[11px] text-accent font-medium leading-relaxed bg-accent/5 p-3 rounded-xl border border-accent/20">
                        Total + Propina: {formatCurrency(aggregatedItemsTotal * 1.10)} (Proporcional).
                      </p>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          <DialogFooter className="flex-col sm:flex-row gap-3">
            <Button variant="ghost" className="rounded-xl h-12 w-full sm:w-auto" onClick={() => setAddingExpense(false)}>Cancelar</Button>
            <Button className="rounded-xl px-10 h-12 w-full sm:w-auto font-bold shadow-lg" onClick={handleRegisterExpense} disabled={isActionLoading || (!divideEqually && expenseMode !== 'item' && Math.abs(difference) > 0.01)}>
              {isActionLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : "Confirmar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!creditorProfile} onOpenChange={() => setCreditorProfile(null)}>
        <DialogContent className="w-[90vw] max-w-md rounded-[2rem] p-6 sm:p-8 border-none text-center mx-auto">
          <DialogHeader>
            <DialogTitle className="text-xl sm:text-2xl font-headline font-bold text-primary">Datos de Transferencia</DialogTitle>
            <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">{creditorProfile?.displayName}</p>
          </DialogHeader>
          <div className="bg-muted/30 p-6 rounded-[1.5rem] font-mono text-xs sm:text-sm text-left whitespace-pre-wrap border border-dashed mt-4 leading-relaxed">
            {creditorProfile?.transferDetails || "Sin datos configurados."}
          </div>
          <Button className="w-full h-12 rounded-xl mt-6 font-bold" onClick={() => setCreditorProfile(null)}>Entendido</Button>
        </DialogContent>
      </Dialog>

      <Dialog open={showInviteModal} onOpenChange={setShowInviteModal}>
        <DialogContent className="w-[90vw] max-w-sm rounded-[2rem] p-6 sm:p-8 text-center border-none mx-auto">
          <DialogHeader className="pb-4"><DialogTitle className="text-xl font-headline">Invitación</DialogTitle></DialogHeader>
          <div className="space-y-6">
            <div className="p-4 bg-muted/30 rounded-2xl border-2 border-dashed text-xs font-mono break-all leading-relaxed">
              {group.inviteLink}
            </div>
            <Button 
              className="w-full h-12 rounded-xl font-bold gap-2" 
              onClick={() => { 
                const shareText = `¡Hola! Te invito a unirte a nuestro grupo '${group.name}' en Zygos, para llevar la cuenta de los gastos compartidos 💰\n\n${group.inviteLink}`;
                navigator.clipboard.writeText(shareText); 
                toast({ title: "Copiado" }); 
              }}
            >
              <Copy className="h-4 w-4" /> Copiar Enlace
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={showSettingsModal} onOpenChange={setShowSettingsModal}>
        <DialogContent className="w-[95vw] sm:max-w-md rounded-[2rem] p-6 sm:p-8 border-none mx-auto">
          <DialogHeader>
            <DialogTitle className="text-xl font-headline font-bold">Gestión del Grupo</DialogTitle>
            <DialogDescription className="text-xs">Opciones de administración para el grupo.</DialogDescription>
          </DialogHeader>
          <div className="space-y-6 py-4">
            <div className="space-y-3">
               <Label className="text-[10px] uppercase font-black tracking-widest text-muted-foreground px-1">Archivar</Label>
               <div className="bg-muted/20 p-4 rounded-2xl space-y-3">
                 <p className="text-[11px] text-muted-foreground leading-relaxed">El grupo dejará de aparecer en tu lista principal, pero no se borrará ningún dato.</p>
                 <Button variant="outline" className="w-full h-11 rounded-xl gap-2 font-bold" onClick={handleArchive}>
                    <Archive className="h-4 w-4" /> Archivar Grupo
                 </Button>
               </div>
            </div>

            <div className="space-y-3">
               <Label className="text-[10px] uppercase font-black tracking-widest text-destructive px-1">Eliminar</Label>
               <div className="bg-destructive/5 p-4 rounded-2xl space-y-3 border border-destructive/10">
                 <p className="text-[11px] text-muted-foreground leading-relaxed">Esta acción es irreversible y borrará todo permanentemente. Solo permitido si no hay historial financiero.</p>
                 <Button variant="destructive" className="w-full h-11 rounded-xl gap-2 font-bold" onClick={handleDelete} disabled={isActionLoading}>
                    {isActionLoading ? <Loader2 className="animate-spin" /> : <><Trash2 className="h-4 w-4" /> Eliminar Definitivamente</>}
                 </Button>
               </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={!!confirmingDebt} onOpenChange={() => setConfirmingDebt(null)}>
        <DialogContent className="w-[90vw] max-w-sm rounded-[2rem] p-6 sm:p-8 text-center border-none mx-auto">
          <DialogHeader className="pb-4">
            <div className="mx-auto bg-emerald-100 p-4 rounded-full w-fit mb-4">
              <CheckCircle2 className="h-8 w-8 text-emerald-600" />
            </div>
            <DialogTitle className="text-xl font-headline">Validar Pago</DialogTitle>
            <DialogDescription className="text-xs pt-2">
              ¿Confirmas que recibiste <strong>{formatCurrency(confirmingDebt?.amount || 0)}</strong> de <strong>{confirmingDebt?.name}</strong>?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex gap-2">
            <Button variant="ghost" className="flex-1 rounded-xl" onClick={() => setConfirmingDebt(null)}>Cancelar</Button>
            <Button className="flex-1 rounded-xl bg-emerald-600 hover:bg-emerald-700" onClick={confirmPaid}>Confirmar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
