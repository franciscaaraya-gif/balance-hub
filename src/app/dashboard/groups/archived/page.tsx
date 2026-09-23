"use client";

import { useMemo } from "react";
import { useUser, useFirestore, useCollection, useMemoFirebase } from "@/firebase";
import { Group } from "@/lib/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, Users, ChevronRight, Archive, ArrowLeft } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { collection, query, where } from "firebase/firestore";

export default function ArchivedGroupsPage() {
  const { user, isUserLoading } = useUser();
  const firestore = useFirestore();

  const groupsQuery = useMemoFirebase(() => {
    if (!firestore || !user?.uid) return null;
    return query(collection(firestore, 'groups'), where('memberIds', 'array-contains', user.uid));
  }, [firestore, user?.uid]);
  const { data: rawGroups, isLoading: groupsLoading } = useCollection<Group>(groupsQuery);

  const archivedGroups = useMemo(() => {
    return rawGroups?.filter(g => g.isArchived) || [];
  }, [rawGroups]);

  if (isUserLoading) return <div className="flex justify-center py-20"><Loader2 className="animate-spin text-primary" /></div>;

  return (
    <div className="space-y-6 sm:space-y-10 max-w-6xl mx-auto pb-10 px-2 sm:px-4">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild className="rounded-xl">
          <Link href="/dashboard/groups"><ArrowLeft className="h-5 w-5" /></Link>
        </Button>
        <div>
          <h1 className="text-2xl sm:text-3xl font-headline font-bold text-primary">Grupos Archivados</h1>
          <p className="text-sm text-muted-foreground">Grupos fuera de circulación pero con historial guardado.</p>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {groupsLoading ? (
          [1, 2, 3].map(i => <div key={i} className="h-40 rounded-[2rem] bg-muted animate-pulse" />)
        ) : archivedGroups.length === 0 ? (
          <div className="col-span-full py-20 flex flex-col items-center justify-center border-2 border-dashed rounded-[2.5rem] opacity-30 bg-muted/20">
             <Archive className="h-12 w-12 mb-4 text-primary" />
             <p className="font-bold text-[10px] uppercase tracking-widest">Sin grupos archivados</p>
          </div>
        ) : (
          archivedGroups.map(group => (
            <Link key={group.id} href={`/dashboard/groups/${group.id}`}>
              <Card className="hover:shadow-lg transition-all border-none bg-white rounded-[2rem] overflow-hidden group shadow-sm opacity-80 hover:opacity-100 h-full flex flex-col justify-between">
                <div>
                  <div className="h-1.5 w-full bg-slate-400" />
                  <CardHeader className="pb-4">
                    <CardTitle className="mt-2 text-lg font-headline group-hover:text-primary transition-colors truncate">{group.name}</CardTitle>
                  </CardHeader>
                </div>
                <CardContent>
                  <div className="flex justify-between items-center text-[10px] text-muted-foreground pt-4 border-t font-bold uppercase">
                    <span className="flex items-center gap-1"><Users className="h-3 w-3" /> {group.memberIds.length} MIEMBROS</span>
                    <span className="text-primary flex items-center">REVISAR <ChevronRight className="h-3 w-3" /></span>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))
        )}
      </div>
    </div>
  );
}
