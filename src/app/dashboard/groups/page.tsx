"use client";

import { useState } from "react";
import { useUser, useFirestore, useCollection, useMemoFirebase } from "@/firebase";
import { createGroup } from "@/lib/firebase/store";
import { Group } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { PlusCircle, Users, ChevronRight, Loader2 } from "lucide-react";
import Link from "next/link";
import { useToast } from "@/hooks/use-toast";
import { collection, query, where } from "firebase/firestore";
import { Carousel, CarouselContent, CarouselItem, CarouselNext, CarouselPrevious } from "@/components/ui/carousel";

export default function GroupsPage() {
  const { user, isUserLoading } = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();

  const [newGroupName, setNewGroupName] = useState("");
  const [open, setOpen] = useState(false);

  const myGroupsQuery = useMemoFirebase(() => {
    if (!firestore || !user?.uid) return null;
    return query(collection(firestore, 'groups'), where('memberIds', 'array-contains', user.uid));
  }, [firestore, user?.uid]);
  const { data: myGroups, isLoading: myGroupsLoading } = useCollection<Group>(myGroupsQuery);

  const handleCreateGroup = async () => {
    if (!newGroupName || !user) return;
    try {
      await createGroup(newGroupName, user.uid);
      toast({ title: "Grupo creado" });
      setNewGroupName("");
      setOpen(false);
    } catch (e: any) {
      toast({ variant: "destructive", title: "Error", description: e.message });
    }
  };

  if (isUserLoading) return <div className="flex justify-center py-20"><Loader2 className="animate-spin text-primary" /></div>;

  return (
    <div className="space-y-6 sm:space-y-10 max-w-6xl mx-auto pb-10 px-2 sm:px-4">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-headline font-bold text-primary">Mis Grupos de Pago</h1>
          <p className="text-sm text-muted-foreground">Administra y organiza tus cuentas grupales de forma transparente.</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="bg-accent h-12 px-6 shadow-lg rounded-2xl font-bold text-white">
              <PlusCircle className="h-5 w-5 mr-2" /> Nuevo Grupo
            </Button>
          </DialogTrigger>
          <DialogContent className="rounded-[2rem] border-none p-8">
            <DialogHeader><DialogTitle className="text-2xl font-headline font-bold">Crear Grupo</DialogTitle></DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-1">
                <Label className="text-[10px] uppercase font-black px-1">Nombre del Grupo</Label>
                <Input placeholder="Ej: Amigos Padel" value={newGroupName} onChange={e => setNewGroupName(e.target.value)} className="rounded-xl h-12" />
              </div>
            </div>
            <DialogFooter>
              <Button onClick={handleCreateGroup} className="w-full h-12 rounded-xl font-bold">Crear Grupo</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="px-1">
        {myGroupsLoading ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[1, 2, 3, 4].map(i => <div key={i} className="h-40 rounded-[2rem] bg-muted animate-pulse" />)}
          </div>
        ) : myGroups?.length === 0 ? (
          <div className="py-20 text-center border-2 border-dashed rounded-[2rem] opacity-30 font-bold uppercase text-[10px]">
            No tienes grupos activos. Crea uno para empezar a dividir gastos.
          </div>
        ) : myGroups && myGroups.length <= 4 ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {myGroups.map(g => <GroupCard key={g.id} g={g} />)}
          </div>
        ) : (
          <Carousel opts={{ align: "start" }} className="w-full">
            <CarouselContent className="-ml-4">
              {myGroups?.map((g) => (
                <CarouselItem key={g.id} className="pl-4 sm:basis-1/2 lg:basis-1/4">
                  <GroupCard g={g} />
                </CarouselItem>
              ))}
            </CarouselContent>
            <div className="hidden sm:block">
              <CarouselPrevious className="-left-6 rounded-xl h-10 w-10 border-2" />
              <CarouselNext className="-right-6 rounded-xl h-10 w-10 border-2" />
            </div>
          </Carousel>
        )}
      </div>
    </div>
  );
}

function GroupCard({ g }: { g: Group }) {
  return (
    <Link href={`/dashboard/groups/${g.id}`}>
      <Card className="hover:shadow-lg transition-all border-none bg-white rounded-[2rem] overflow-hidden group shadow-sm border border-primary/5 h-full flex flex-col justify-between">
        <div>
          <div className="h-1.5 bg-primary w-full" />
          <CardHeader className="pb-4">
            <CardTitle className="mt-2 text-lg font-headline group-hover:text-primary transition-colors truncate">{g.name}</CardTitle>
          </CardHeader>
        </div>
        <CardContent>
          <div className="flex justify-between items-center text-[10px] text-muted-foreground pt-4 border-t font-bold uppercase">
            <span className="flex items-center gap-1"><Users className="h-3 w-3" /> {g.memberIds.length} MIEMBROS</span>
            <span className="text-primary flex items-center">VER <ChevronRight className="h-3 w-3" /></span>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
