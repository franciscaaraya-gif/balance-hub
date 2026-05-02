
"use client";

import { useEffect, useState, use, useMemo, useRef } from "react";
import { useUser, useFirestore, useDoc, useCollection, useMemoFirebase } from "@/firebase";
import { getGroupMembersDetails, addDebt, updateDebtStatusInGroup, requestLeaveGroup, confirmLeaveGroup, updateGroupAmount, createReceipt, claimReceiptItem, finalizeReceipt } from "@/lib/firebase/store";
import { Group, Debt, UserProfile, Receipt, ReceiptItem } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Wallet, Plus, Share2, Sparkles, AlertCircle, CheckCircle2, Clock, LogOut, UserMinus, FileUp, Users, DollarSign, Settings, TrendingUp, HandCoins, ReceiptText, Camera, Loader2, ScanLine, Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { generateDebtSummary, DebtSummaryInput } from "@/ai/flows/ai-debt-summary-generation";
import { parseReceipt } from "@/ai/flows/parse-receipt-flow";
import { Textarea } from "@/components/ui/textarea";
import { doc, collection, query, where } from "firebase/firestore";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";

export default function GroupDetails({ params: paramsPromise }: { params: Promise<{ id: string }> }) {
  const params = use(paramsPromise);
  const { user } = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();

  const [addingDebt, setAddingDebt] = useState(false);
  const [bulkCsvOpen, setBulkCsvOpen] = useState(false);
  const [fixedAmountOpen, setFixedAmountOpen] = useState(false);
  const [editGroupOpen, setEditGroupOpen] = useState(false);
  const [scanningReceipt, setScanningReceipt] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiSummary, setAiSummary] = useState<string | null>(null);
  const [isLeaving, setIsLeaving] = useState(false);
  const [parsingReceipt, setParsingReceipt] = useState(false);
  
  const [debtAmount, setDebtAmount] = useState("");
  const [debtDescription, setDebtDescription] = useState("");
  const [debtorId, setDebtorId] = useState("");
  const [csvText, setCsvText] = useState("");
  const [fixedDescription, setFixedDescription] = useState("");
  const [newGroupFixedAmount, setNewGroupFixedAmount] = useState("");

  const [members, setMembers] = useState<UserProfile[]>([]);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [hasCameraPermission, setHasCameraPermission] = useState<boolean | null>(null);

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

  const receiptsQuery = useMemoFirebase(() => {
    if (!firestore || !params.id) return null;
    return query(collection(firestore, 'groups', params.id, 'receipts'));
  }, [firestore, params.id]);
  const { data: receipts } = useCollection<Receipt>(receiptsQuery);

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

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
      setHasCameraPermission(true);
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch (error) {
      setHasCameraPermission(false);
      toast({ variant: "destructive", title: "Cámara no disponible", description: "Por favor permite el acceso a la cámara." });
    }
  };

  const stopCamera = () => {
    if (videoRef.current && videoRef.current.srcObject) {
      (videoRef.current.srcObject as MediaStream).getTracks().forEach(track => track.stop());
    }
  };

  const captureAndParse = async () => {
    if (!videoRef.current || !canvasRef.current) return;
    setParsingReceipt(true);
    
    const context = canvasRef.current.getContext('2d');
    if (!context) return;
    
    context.drawImage(videoRef.current, 0, 0, canvasRef.current.width, canvasRef.current.height);
    const dataUrl = canvasRef.current.toDataURL('image/jpeg');
    
    try {
      const result = await parseReceipt({ photoDataUri: dataUrl });
      if (result.items.length > 0) {
        await createReceipt(params.id, result.items);
        toast({ title: "Boleta Escaneada", description: `Se encontraron ${result.items.length} productos.` });
        setScanningReceipt(false);
        stopCamera();
      } else {
        toast({ variant: "destructive", title: "No se leyó nada", description: "Asegúrate de que la boleta esté bien iluminada." });
      }
    } catch (error) {
      toast({ variant: "destructive", title: "Error de IA", description: "No pudimos procesar la imagen." });
    } finally {
      setParsingReceipt(false);
    }
  };

  const handleClaim = (receiptId: string, itemId: string, percentage: number, items: ReceiptItem[]) => {
    if (!user) return;
    claimReceiptItem(params.id, receiptId, itemId, user.uid, percentage, items);
  };

  const handleFinalizeReceipt = (receipt: Receipt) => {
    finalizeReceipt(params.id, receipt.id, receipt.items);
    toast({ title: "Boleta Cerrada", description: "Se han generado todas las deudas personales." });
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

  if (groupLoading) return <div className="h-full flex items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  if (!group) return <div className="p-8 text-center">Grupo no encontrado.</div>;

  const isAdmin = group.adminId === user?.uid;
  const myStatus = group.memberStatuses?.[user?.uid || ''];
  const groupDebts = debts || [];

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-headline font-bold text-primary">{group.name}</h1>
            {isAdmin && (
              <Button variant="ghost" size="icon" onClick={() => setEditGroupOpen(true)} className="h-8 w-8 text-muted-foreground hover:text-primary">
                <Settings className="h-4 w-4" />
              </Button>
            )}
          </div>
          <p className="text-muted-foreground">
            {group.type === 'variable' ? 'Gastos Variables' : `Cobro Fijo: $${group.fixedAmount}`} • {group.memberIds.length} Miembros
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {isAdmin && group.type === 'variable' && (
            <Dialog open={scanningReceipt} onOpenChange={(val) => {
              setScanningReceipt(val);
              if (val) startCamera();
              else stopCamera();
            }}>
              <DialogTrigger asChild>
                <Button className="bg-accent hover:bg-accent/90 gap-2">
                  <ScanLine className="h-4 w-4" />
                  Escanear Boleta
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-md">
                <DialogHeader>
                  <DialogTitle>Escanear Boleta</DialogTitle>
                  <DialogDescription>Apunta a los ítems y precios de la boleta.</DialogDescription>
                </DialogHeader>
                <div className="relative aspect-[3/4] bg-black rounded-lg overflow-hidden border">
                  <video ref={videoRef} autoPlay playsInline className="w-full h-full object-cover" />
                  <canvas ref={canvasRef} className="hidden" width={640} height={853} />
                  {parsingReceipt && (
                    <div className="absolute inset-0 bg-black/60 flex flex-col items-center justify-center text-white gap-3">
                      <Loader2 className="h-10 w-10 animate-spin" />
                      <p className="font-headline font-bold">La IA está leyendo...</p>
                    </div>
                  )}
                </div>
                <DialogFooter className="flex-row gap-2">
                  <Button variant="outline" className="flex-1" onClick={() => setScanningReceipt(false)}>Cancelar</Button>
                  <Button className="flex-1 bg-primary" onClick={captureAndParse} disabled={parsingReceipt}>
                    <Camera className="h-4 w-4 mr-2" />
                    Capturar
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          )}
          
          {isAdmin && (
            <Button variant="outline" className="gap-2 border-primary text-primary hover:bg-primary/5" onClick={() => setAddingDebt(true)}>
              <Plus className="h-4 w-4" />
              Deuda Manual
            </Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="border-emerald-100 bg-emerald-50/30">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-bold text-emerald-600 uppercase tracking-wider">Recaudado</p>
                <h3 className="text-2xl font-headline font-bold text-emerald-700">${stats.paid.toFixed(2)}</h3>
              </div>
              <div className="p-3 bg-emerald-100 rounded-xl text-emerald-600"><TrendingUp className="h-6 w-6" /></div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-orange-100 bg-orange-50/30">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-bold text-orange-600 uppercase tracking-wider">Pendiente</p>
                <h3 className="text-2xl font-headline font-bold text-orange-700">${stats.pending.toFixed(2)}</h3>
              </div>
              <div className="p-3 bg-orange-100 rounded-xl text-orange-600"><HandCoins className="h-6 w-6" /></div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-primary/10 bg-primary/5">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-bold text-primary uppercase tracking-wider">Meta Total</p>
                <h3 className="text-2xl font-headline font-bold text-primary">${stats.total.toFixed(2)}</h3>
              </div>
              <div className="p-3 bg-primary/10 rounded-xl text-primary"><ReceiptText className="h-6 w-6" /></div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Sección de Boletas Activas */}
      {receipts && receipts.filter(r => r.status === 'open').length > 0 && (
        <div className="space-y-4">
          <h2 className="text-xl font-headline font-bold flex items-center gap-2">
            <ScanLine className="h-5 w-5 text-accent" /> Boletas por Dividir
          </h2>
          <div className="grid gap-6 md:grid-cols-2">
            {receipts.filter(r => r.status === 'open').map(receipt => (
              <Card key={receipt.id} className="border-accent/20 overflow-hidden">
                <CardHeader className="bg-accent/5 pb-3">
                  <div className="flex justify-between items-center">
                    <CardTitle className="text-sm font-bold uppercase tracking-widest text-accent">Desglose de Ítems</CardTitle>
                    <Badge variant="outline" className="bg-white">Abierta</Badge>
                  </div>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="divide-y">
                    {receipt.items.map(item => {
                      const myClaim = item.claims.find(c => c.userId === user?.uid);
                      const isClaimedByMe = !!myClaim;
                      const totalPercentage = item.claims.reduce((acc, c) => acc + c.percentage, 0);
                      
                      return (
                        <div key={item.id} className="p-4 flex items-center justify-between hover:bg-muted/30 transition-colors">
                          <div className="flex-1">
                            <p className="text-sm font-bold">{item.name}</p>
                            <p className="text-xs text-muted-foreground font-mono">${item.price.toFixed(2)}</p>
                            <div className="mt-2 flex flex-wrap gap-1">
                              {item.claims.map(claim => (
                                <Badge key={claim.userId} variant="secondary" className="text-[9px] h-4">
                                  {members.find(m => m.uid === claim.userId)?.displayName?.split(' ')[0]}: {claim.percentage}%
                                </Badge>
                              ))}
                            </div>
                          </div>
                          <div className="flex items-center gap-3">
                            <div className="flex flex-col items-end gap-1">
                              <span className="text-[10px] text-muted-foreground font-bold">¿Es tuyo?</span>
                              <div className="flex items-center gap-2">
                                <Checkbox 
                                  checked={isClaimedByMe} 
                                  onCheckedChange={(checked) => handleClaim(receipt.id, item.id, checked ? 100 : 0, receipt.items)} 
                                />
                                {isClaimedByMe && (
                                  <Select 
                                    value={myClaim.percentage.toString()} 
                                    onValueChange={(val) => handleClaim(receipt.id, item.id, parseInt(val), receipt.items)}
                                  >
                                    <SelectTrigger className="h-7 w-20 text-[10px]">
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="25">25%</SelectItem>
                                      <SelectItem value="33">33%</SelectItem>
                                      <SelectItem value="50">50%</SelectItem>
                                      <SelectItem value="100">100%</SelectItem>
                                    </SelectContent>
                                  </Select>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
                <CardFooter className="bg-muted/30 p-4 border-t">
                  <div className="w-full flex items-center justify-between">
                    <p className="text-xs text-muted-foreground">Marca lo que consumiste para generar tu deuda.</p>
                    {isAdmin && (
                      <Button size="sm" className="bg-accent" onClick={() => handleFinalizeReceipt(receipt)}>
                        Finalizar Cobro
                      </Button>
                    )}
                  </div>
                </CardFooter>
              </Card>
            ))}
          </div>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader><CardTitle className="text-lg font-headline">Historial de Cobros</CardTitle></CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Miembro</TableHead>
                  <TableHead>Monto</TableHead>
                  <TableHead>Descripción</TableHead>
                  <TableHead>Estado</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {groupDebts.map(debt => (
                  <TableRow key={debt.id}>
                    <TableCell className="font-medium">{members.find(m => m.uid === debt.debtorId)?.displayName}</TableCell>
                    <TableCell className="font-bold text-primary">${debt.amount.toFixed(2)}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{debt.description}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className={debt.status === 'paid' ? 'bg-emerald-50 text-emerald-600' : 'bg-orange-50 text-orange-600'}>
                        {debt.status === 'paid' ? 'Pagado' : 'Pendiente'}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card className="border-primary/20 bg-primary/5">
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-primary" />
                <CardTitle className="text-lg font-headline">Resumen IA</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              {aiSummary ? (
                <div className="text-sm font-body leading-relaxed whitespace-pre-wrap p-4 bg-white rounded-xl border">
                  {aiSummary}
                </div>
              ) : (
                <Button className="w-full" onClick={handleAiSummary} disabled={aiLoading}>
                  {aiLoading ? "Analizando..." : "Generar Balance"}
                </Button>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
