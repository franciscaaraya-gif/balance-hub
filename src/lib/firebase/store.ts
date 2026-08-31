
import { db } from "./config";
import { 
  collection, 
  doc, 
  setDoc, 
  getDoc, 
  getDocs, 
  query, 
  where, 
  addDoc, 
  updateDoc,
  arrayUnion,
  arrayRemove,
  deleteField,
  limit,
  writeBatch,
  orderBy
} from "firebase/firestore";
import { Group, Debt, UserProfile, DebtStatus, Receipt, ReceiptItem } from "../types";
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';

export const createUserProfile = async (uid: string, email: string, displayName: string) => {
  const userRef = doc(db, "userProfiles", uid);
  await setDoc(userRef, {
    uid,
    email,
    displayName,
    role: 'user',
    createdAt: Date.now(),
  }, { merge: true });
};

export const getUserProfile = async (uid: string): Promise<UserProfile | null> => {
  const userRef = doc(db, "userProfiles", uid);
  const snap = await getDoc(userRef);
  return snap.exists() ? (snap.data() as UserProfile) : null;
};

export const createGroup = (name: string, type: 'fixed' | 'variable', adminId: string, fixedAmount?: number) => {
  const inviteToken = Math.random().toString(36).substring(2, 15);
  const inviteLink = `${window.location.origin}/join/${inviteToken}`;
  const groupCollection = collection(db, "groups");
  
  const data = {
    name,
    type,
    fixedAmount: fixedAmount || null,
    adminId,
    members: [adminId],
    memberIds: [adminId],
    memberStatuses: {
      [adminId]: 'active'
    },
    inviteToken,
    inviteLink,
    createdAt: Date.now(),
  };

  addDoc(groupCollection, data).catch(error => {
    errorEmitter.emit('permission-error', new FirestorePermissionError({
      path: groupCollection.path,
      operation: 'create',
      requestResourceData: data
    }));
  });
};

export const addDebt = async (groupId: string, debtorId: string, amount: number, description: string, receiptId?: string) => {
  const groupRef = doc(db, "groups", groupId);
  const groupSnap = await getDoc(groupRef);
  if (!groupSnap.exists()) throw new Error("Grupo no encontrado");
  const group = groupSnap.data() as Group;

  const debtCollection = collection(db, "groups", groupId, "debts");
  const data = {
    groupId,
    debtorId,
    amount,
    description,
    status: 'pending',
    receiptId: receiptId || null,
    groupAdminId: group.adminId,
    groupMemberIds: group.memberIds,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };

  return addDoc(debtCollection, data);
};

export const addFixedDebtToAll = async (groupId: string, amount: number, description: string, memberIds: string[], creatorId: string) => {
  const batch = writeBatch(db);
  const groupRef = doc(db, "groups", groupId);
  const groupSnap = await getDoc(groupRef);
  const group = groupSnap?.data() as Group;

  // Filtramos al creador para que no se cobre a sí mismo
  const targets = memberIds.filter(id => id !== creatorId);

  targets.forEach(uid => {
    const debtRef = doc(collection(db, "groups", groupId, "debts"));
    batch.set(debtRef, {
      groupId,
      debtorId: uid,
      amount,
      description,
      status: 'pending',
      groupAdminId: group.adminId,
      groupMemberIds: group.memberIds,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
  });
  return batch.commit();
};

export const updateDebtStatusInGroup = (groupId: string, debtId: string, status: DebtStatus) => {
  const docRef = doc(db, "groups", groupId, "debts", debtId);
  updateDoc(docRef, {
    status,
    updatedAt: Date.now(),
  }).catch(error => {
    errorEmitter.emit('permission-error', new FirestorePermissionError({
      path: docRef.path,
      operation: 'update',
      requestResourceData: { status, updatedAt: Date.now() }
    }));
  });
};

export const createReceipt = (groupId: string, items: { name: string, price: number }[]) => {
  const receiptCollection = collection(db, "groups", groupId, "receipts");
  const data = {
    groupId,
    status: 'open',
    items: items.map(item => ({
      id: Math.random().toString(36).substring(7),
      name: item.name,
      price: item.price,
      claims: []
    })),
    createdAt: Date.now()
  };

  addDoc(receiptCollection, data).catch(error => {
    errorEmitter.emit('permission-error', new FirestorePermissionError({
      path: receiptCollection.path,
      operation: 'create',
      requestResourceData: data
    }));
  });
};

export const claimReceiptItem = (groupId: string, receiptId: string, itemId: string, userId: string, percentage: number, items: ReceiptItem[]) => {
  const receiptRef = doc(db, "groups", groupId, "receipts", receiptId);
  const updatedItems = items.map(item => {
    if (item.id === itemId) {
      const existingClaimIndex = item.claims.findIndex(c => c.userId === userId);
      const newClaims = [...item.claims];
      if (percentage <= 0) {
        if (existingClaimIndex > -1) newClaims.splice(existingClaimIndex, 1);
      } else {
        if (existingClaimIndex > -1) newClaims[existingClaimIndex].percentage = percentage;
        else newClaims.push({ userId, percentage });
      }
      return { ...item, claims: newClaims };
    }
    return item;
  });

  updateDoc(receiptRef, {
    items: updatedItems
  }).catch(error => {
    errorEmitter.emit('permission-error', new FirestorePermissionError({
      path: receiptRef.path,
      operation: 'update'
    }));
  });
};

export const finalizeReceipt = async (groupId: string, receiptId: string, items: ReceiptItem[], adminId: string) => {
  const receiptRef = doc(db, "groups", groupId, "receipts", receiptId);
  
  for (const item of items) {
    for (const claim of item.claims) {
      // Si el reclamo es del admin, no creamos deuda porque él es quien pagó
      if (claim.userId === adminId) continue;
      
      const amount = (item.price * claim.percentage) / 100;
      if (amount > 0) {
        await addDebt(groupId, claim.userId, amount, `Consumo: ${item.name}`, receiptId);
      }
    }
  }

  updateDoc(receiptRef, {
    status: 'completed'
  }).catch(error => {
    errorEmitter.emit('permission-error', new FirestorePermissionError({
      path: receiptRef.path,
      operation: 'update'
    }));
  });
};

export const getGroupByToken = async (inviteToken: string): Promise<Group | null> => {
  const q = query(collection(db, "groups"), where("inviteToken", "==", inviteToken), limit(1));
  const snap = await getDocs(q);
  if (snap.empty) return null;
  const doc = snap.docs[0];
  return { ...doc.data(), id: doc.id } as Group;
};

export const joinGroupByInvite = async (userId: string, inviteToken: string) => {
  const group = await getGroupByToken(inviteToken);
  if (!group) throw new Error("Enlace de invitación inválido o expirado");
  
  if (group.memberIds.includes(userId)) return group.id;

  const groupRef = doc(db, "groups", group.id);
  await updateDoc(groupRef, {
    members: arrayUnion(userId),
    memberIds: arrayUnion(userId),
    [`memberStatuses.${userId}`]: 'active'
  });
  return group.id;
};

export const getGroupMembersDetails = async (memberIds: string[]): Promise<UserProfile[]> => {
  if (!memberIds || memberIds.length === 0) return [];
  const profiles: UserProfile[] = [];
  for (const id of memberIds) {
    const p = await getUserProfile(id);
    if (p) profiles.push(p);
  }
  return profiles;
};
