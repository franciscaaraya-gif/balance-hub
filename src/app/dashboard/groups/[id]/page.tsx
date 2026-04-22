"use client";

import { useEffect, useState, use } from "react";
import { useAuth } from "@/lib/firebase/auth-context";
import { getGroupById, getDebtsForGroup, getGroupMembersDetails, addDebt, updateDebtStatus } from "@/lib/firebase/store";
import { Group, Debt, UserProfile } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Wallet, Plus, Share2, Sparkles, AlertCircle, CheckCircle2, Clock } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { generateDebtSummary, DebtSummaryInput } from "@/ai/flows/ai-debt-summary-generation";

export default function GroupDetails({ params: paramsPromise }: { params: Promise<{ id: string }> }) {
  const params = use(paramsPromise);
  const { user } = useAuth();
  const [group, setGroup] = useState<Group | null>(null);
  const [debts, setDebts] = useState<Debt[]>([]);
  const [members, setMembers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [addingDebt, setAddingDebt] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiSummary, setAiSummary] = useState<string | null>(null);
  
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
          <p className="text-muted-foreground">Type: <span className="capitalize">{group.type}</span> • {members.length} Members</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={copyInvite} className="gap-2">
            <Share2 className="h-4 w-4" />
            Invite Members
          </Button>
          <Dialog open={addingDebt} onOpenChange={setAddingDebt}>
            <DialogTrigger asChild>
              <Button className="bg-accent hover:bg-accent/90 gap-2">
                <Plus className="h-4 w-4" />
                Add Debt
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add New Debt</DialogTitle>
                <DialogDescription>Enter the details of the debt incurred.</DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="space-y-2">
                  <Label>Debtor (Who owes money?)</Label>
                  <Select value={debtorId} onValueChange={setDebtorId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select member" />
                    </SelectTrigger>
                    <SelectContent>
                      {members.map(m => (
                        <SelectItem key={m.uid} value={m.uid}>{m.displayName || m.email}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Amount</Label>
                  <Input type="number" placeholder="0.00" value={debtAmount} onChange={(e) => setDebtAmount(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Description</Label>
                  <Input placeholder="Lunch, Movie, Gas, etc." value={debtDescription} onChange={(e) => setDebtDescription(e.target.value)} />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setAddingDebt(false)}>Cancel</Button>
                <Button onClick={handleAddDebt} className="bg-primary">Save Debt</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Main Debt Table */}
        <Card className="lg:col-span-2 border-none shadow-sm overflow-hidden">
          <CardHeader className="bg-white border-b">
            <CardTitle className="text-lg font-headline">Outstanding Debts</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader className="bg-muted/30">
                <TableRow>
                  <TableHead>Member</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Status</TableHead>
                  {isAdmin && <TableHead className="text-right">Actions</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {debts.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={isAdmin ? 5 : 4} className="text-center py-12 text-muted-foreground">
                      No debts recorded in this group yet.
                    </TableCell>
                  </TableRow>
                ) : (
                  debts.map((debt) => (
                    <TableRow key={debt.id}>
                      <TableCell className="font-medium">
                        {members.find(m => m.uid === debt.debtorId)?.displayName || 'Unknown'}
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
                              <SelectItem value="pending">Pending</SelectItem>
                              <SelectItem value="under_review">Review</SelectItem>
                              <SelectItem value="paid">Paid</SelectItem>
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
                <CardTitle className="text-lg font-headline">AI Summarizer</CardTitle>
              </div>
              <CardDescription>
                Get a smart overview of who owes what and suggested settlements.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {aiSummary ? (
                <div className="space-y-4">
                  <div className="text-sm font-body leading-relaxed whitespace-pre-wrap p-4 bg-white rounded-xl border border-primary/10">
                    {aiSummary}
                  </div>
                  <Button variant="outline" className="w-full text-xs" onClick={handleAiSummary} disabled={aiLoading}>
                    Refresh Summary
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
                      Analyzing Debts...
                    </>
                  ) : (
                    <>
                      <Sparkles className="h-4 w-4 mr-2" />
                      Generate Summary
                    </>
                  )}
                </Button>
              )}
            </CardContent>
          </Card>

          <Card className="border-none shadow-sm">
            <CardHeader>
              <CardTitle className="text-lg font-headline">Group Members</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {members.map(member => (
                <div key={member.uid} className="flex items-center gap-3">
                  <div className="h-8 w-8 rounded-full bg-secondary/20 text-secondary flex items-center justify-center text-xs font-bold">
                    {member.displayName?.[0] || 'U'}
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium">{member.displayName}</p>
                    {group.adminId === member.uid && <p className="text-[10px] text-accent font-bold uppercase tracking-tighter">Group Admin</p>}
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}