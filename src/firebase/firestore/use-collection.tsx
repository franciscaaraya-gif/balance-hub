'use client';

import { useState, useEffect } from 'react';
import {
  Query,
  onSnapshot,
  DocumentData,
  FirestoreError,
  QuerySnapshot,
} from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';

export type WithId<T> = T & { id: string };

export interface UseCollectionResult<T> {
  data: WithId<T>[] | null;
  isLoading: boolean;
  error: Error | null;
}

/**
 * Hook to subscribe to a Firestore collection or query in real-time.
 */
export function useCollection<T = any>(
    memoizedTargetRefOrQuery: (Query<DocumentData> & {__memo?: boolean}) | null | undefined,
): UseCollectionResult<T> {
  type ResultItemType = WithId<T>;
  
  const [data, setData] = useState<ResultItemType[] | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!memoizedTargetRefOrQuery) {
      setData(null);
      setIsLoading(false);
      setError(null);
      return;
    }

    setIsLoading(true);
    setError(null);

    const unsubscribe = onSnapshot(
      memoizedTargetRefOrQuery,
      (snapshot: QuerySnapshot<DocumentData>) => {
        const results: ResultItemType[] = [];
        snapshot.forEach((doc) => {
          results.push({ ...(doc.data() as T), id: doc.id });
        });
        setData(results);
        setError(null);
        setIsLoading(false);
      },
      async (serverError: FirestoreError) => {
        // RACE CONDITION CHECK:
        // If the user just logged out, Firestore will immediately deny all active listeners.
        // We check auth state. If no user is logged in, we ignore the error as it's expected during logout.
        const auth = getAuth();
        if (!auth.currentUser) {
          setData(null);
          setIsLoading(false);
          return;
        }

        let reportedPath = "dynamic-query";
        const queryAny = memoizedTargetRefOrQuery as any;
        
        if (queryAny.path) {
          reportedPath = queryAny.path;
        } else if (queryAny._query?.path?.segments) {
          reportedPath = queryAny._query.path.segments.join('/');
        } else if (queryAny.type === 'collectionGroup' || queryAny._query?.collectionGroup) {
          reportedPath = `(collectionGroup: ${queryAny._query?.collectionGroup || 'unknown'})`;
        }

        const contextualError = new FirestorePermissionError({
          operation: 'list',
          path: reportedPath || 'root',
        });

        console.warn('Firestore Permission Issue:', contextualError.message);
        setError(contextualError);
        setData(null);
        setIsLoading(false);
        
        // Only emit global error if we are still supposedly logged in
        errorEmitter.emit('permission-error', contextualError);
      }
    );

    return () => unsubscribe();
  }, [memoizedTargetRefOrQuery]);

  if(memoizedTargetRefOrQuery && !memoizedTargetRefOrQuery.__memo) {
    throw new Error('useCollection: Target was not properly memoized using useMemoFirebase.');
  }

  return { data, isLoading, error };
}
