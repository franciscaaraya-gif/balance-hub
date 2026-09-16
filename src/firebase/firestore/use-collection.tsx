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
        // Ignore permission errors if the user has just logged out or is not authenticated.
        const auth = getAuth();
        if (!auth.currentUser) {
          setData(null);
          setIsLoading(false);
          return;
        }

        let reportedPath = "[unidentified-collection]";
        const queryAny = memoizedTargetRefOrQuery as any;
        
        // PRIORITIZE COLLECTION GROUP CHECK TO AVOID INTERNAL SDK METADATA STRINGS (like 'root' or 'unknown')
        if (queryAny.type === 'collectionGroup' || queryAny._query?.collectionGroup) {
          const groupName = queryAny._query?.collectionGroup || '[unidentified-group]';
          reportedPath = `(collectionGroup: ${groupName})`;
        } else if (queryAny.path) {
          reportedPath = queryAny.path;
        } else if (queryAny._query?.path?.segments && queryAny._query.path.segments.length > 0) {
          reportedPath = queryAny._query.path.segments.join('/');
        }

        const contextualError = new FirestorePermissionError({
          operation: 'list',
          path: reportedPath,
        });

        console.warn('Firestore Permission Issue:', contextualError.message);
        setError(contextualError);
        setData(null);
        setIsLoading(false);
        
        // Only emit global error if we are still authenticated to avoid redirect loops during logout
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
