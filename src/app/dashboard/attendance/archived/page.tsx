"use client";

import { useUser, useFirestore, useCollection, useMemoFirebase } from "@/firebase";
import { Event } from "@/lib/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, Calendar, Users, ChevronRight, User, Clock, MapPin, ArrowLeft } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { collection, query, where, orderBy } from "firebase/firestore";

export default function ArchivedEventsPage() {
  const { user, isUserLoading } = useUser();
  const firestore = useFirestore();

  const eventsQuery = useMemoFirebase(() => {
    if (!firestore || !user?.uid) return null;
    return query(
      collection(firestore, 'events'), 
      where('participantIds', 'array-contains', user.uid),
      orderBy('createdAt', 'desc')
    );
  }, [firestore, user?.uid]);
  const { data: events, isLoading: eventsLoading } = useCollection<Event>(eventsQuery);

  const archivedEvents = events?.filter(e => e.isCharged) || [];

  if (isUserLoading) return <div className="flex justify-center py-20"><Loader2 className="animate-spin text-primary" /></div>;

  return (
    <div className="space-y-6 sm:space-y-10 max-w-6xl mx-auto pb-10 px-2 sm:px-4">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild className="rounded-xl">
          <Link href="/dashboard/attendance"><ArrowLeft className="h-5 w-5" /></Link>
        </Button>
        <div>
          <h1 className="text-2xl sm:text-3xl font-headline font-bold text-primary">Eventos Archivados</h1>
          <p className="text-sm text-muted-foreground">Historial de fechas ya liquidadas y cobradas.</p>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {eventsLoading ? (
          [1, 2, 3].map(i => <div key={i} className="h-48 rounded-[2rem] bg-muted animate-pulse" />)
        ) : archivedEvents.length === 0 ? (
          <div className="col-span-full py-20 flex flex-col items-center justify-center border-2 border-dashed rounded-[2.5rem] opacity-30 bg-muted/20">
             <ArchiveIcon className="h-12 w-12 mb-4 text-primary" />
             <p className="font-bold text-[10px] uppercase tracking-widest">Sin eventos archivados</p>
          </div>
        ) : (
          archivedEvents.map(event => (
            <Link key={event.id} href={`/dashboard/attendance/${event.id}`}>
              <Card className="hover:shadow-lg transition-all border-l-4 border-l-slate-400 rounded-[2rem] group relative overflow-hidden bg-white shadow-sm opacity-80 hover:opacity-100">
                <div className="absolute top-0 right-0 p-1 bg-emerald-500 text-white rounded-bl-lg text-[9px] font-bold px-2 uppercase tracking-tighter">Liquidado</div>
                <CardHeader className="pb-3 px-5">
                  <div className="flex justify-between items-start gap-2">
                    <div className="min-w-0">
                      <CardTitle className="text-base font-headline group-hover:text-primary transition-colors truncate">{event.title}</CardTitle>
                      <div className="flex items-center gap-1.5 mt-1">
                        <User className="h-3 w-3 text-muted-foreground shrink-0" />
                        <span className="text-[10px] text-muted-foreground font-bold uppercase truncate">{event.creatorName}</span>
                      </div>
                    </div>
                    <Badge variant="outline" className="text-[9px] font-black shrink-0 px-2 rounded-lg">{event.date.split('-').reverse().slice(0,2).join('/')}</Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4 px-5 pb-5">
                  <div className="flex flex-col gap-2 text-[10px] text-muted-foreground font-medium">
                    <span className="flex items-center gap-1"><Clock className="h-3 w-3" /> {event.time}</span>
                    <span className="flex items-center gap-1"><MapPin className="h-3 w-3" /> {event.location || "Presencial"}</span>
                  </div>
                  
                  <div className="pt-4 border-t flex justify-between items-center text-[10px] font-black uppercase tracking-widest">
                    <span className="flex items-center gap-1.5 text-muted-foreground"><Users className="h-3.5 w-3.5" /> {event.participantIds?.length || 0} TOTAL</span>
                    <span className="text-primary font-headline text-sm">${event.totalCost.toFixed(0)}</span>
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

function ArchiveIcon(props: any) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect width="20" height="5" x="2" y="3" rx="1" />
      <path d="M4 8v11a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8" />
      <path d="M10 12h4" />
    </svg>
  );
}
