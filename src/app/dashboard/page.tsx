"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/lib/firebase/auth-context";
import { getGroupsForUser, createGroup } from "@/lib/firebase/store";
import { Group } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PlusCircle, Users, ArrowRight, Wallet } from "lucide-react";
import Link from "next/link";
import { useToast } from "@/hooks/use-toast";

export default function Dashboard() {
  const { user } = useAuth();
  const [groups, setGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(true);
  const [newGroupName, setNewGroupName] = useState("");
  const [newGroupType, setNewGroupType] = useState<'fixed' | 'variable'>("variable");
  const [open, setOpen] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (user) {
      loadGroups();
    }
  }, [user]);

  const loadGroups = async () => {
    try {
      const g = await getGroupsForUser(user!.uid);
      setGroups(g);
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
      toast({ title: "Group Created", description: `"${newGroupName}" is ready for action.` });
      setNewGroupName("");
      setOpen(false);
      loadGroups();
    } catch (error: any) {
      toast({ variant: "destructive", title: "Failed to create group", description: error.message });
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-headline font-bold text-primary">Your Groups</h1>
          <p className="text-muted-foreground mt-1">Manage shared expenses with friends and colleagues.</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="bg-accent hover:bg-accent/90 gap-2">
              <PlusCircle className="h-4 w-4" />
              New Group
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create Debt Group</DialogTitle>
              <DialogDescription>Setup a new space to track shared expenses.</DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="name">Group Name</Label>
                <Input id="name" value={newGroupName} onChange={(e) => setNewGroupName(e.target.value)} placeholder="e.g. Europe Trip 2024" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="type">Group Type</Label>
                <Select value={newGroupType} onValueChange={(val: any) => setNewGroupType(val)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="variable">Variable (Ongoing expenses)</SelectItem>
                    <SelectItem value="fixed">Fixed (Single target amount)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
              <Button onClick={handleCreateGroup} className="bg-primary">Create Group</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map(i => <div key={i} className="h-40 bg-muted animate-pulse rounded-xl" />)}
        </div>
      ) : groups.length === 0 ? (
        <Card className="border-dashed border-2 flex flex-col items-center justify-center py-20 text-center">
          <div className="bg-muted p-4 rounded-full mb-4">
            <Users className="h-8 w-8 text-muted-foreground" />
          </div>
          <CardTitle className="text-xl">No groups yet</CardTitle>
          <CardDescription className="max-w-[250px] mt-2">
            Create your first group to start balancing your shared expenses.
          </CardDescription>
          <Button variant="outline" className="mt-6" onClick={() => setOpen(true)}>
            Get Started
          </Button>
        </Card>
      ) : (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {groups.map((group) => (
            <Link key={group.id} href={`/dashboard/groups/${group.id}`}>
              <Card className="h-full transition-all hover:shadow-lg hover:-translate-y-1 group">
                <CardHeader className="pb-4">
                  <div className="flex justify-between items-start mb-2">
                    <div className="p-2 rounded-lg bg-secondary/10 text-secondary">
                      <Wallet className="h-5 w-5" />
                    </div>
                    <div className="bg-muted px-2 py-0.5 rounded text-[10px] uppercase tracking-wider font-bold">
                      {group.type}
                    </div>
                  </div>
                  <CardTitle className="font-headline text-xl group-hover:text-accent transition-colors">
                    {group.name}
                  </CardTitle>
                  <CardDescription>
                    {group.members.length} member{group.members.length !== 1 ? 's' : ''}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center text-sm font-medium text-primary group-hover:gap-2 transition-all">
                    View Details
                    <ArrowRight className="h-4 w-4 ml-1 opacity-0 group-hover:opacity-100 transition-all" />
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}