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
  deleteField
} from "firebase/firestore";
import { Group, Debt, UserProfile, DebtStatus } from "../types";
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

export const createGroup = (name: string, type: 'fixed' | 'variable', adminId: string) => {
  const inviteToken = Math.random().toString(36).substring(2, 15);
  const inviteLink = `${window.location.origin}/join/${inviteToken}`;
  const groupCollection = collection(db, "groups");
  
  const data = {
    name,
    type,
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

export const joinGroupByInvite = async (userId: string, inviteToken: string) => {
  const q = query(collection(db, "groups"), where("inviteToken", "==", inviteToken));
  const snap = await getDocs(q);
  if (snap.empty) throw new Error("Enlace de invitación inválido");
  const groupDoc = snap.docs[0];
  const groupData = groupDoc.data() as Group;
  
  if (groupData.memberIds.includes(userId)) return groupDoc.id;

  await updateDoc(groupDoc.ref, {
    members: arrayUnion(userId),
    memberIds: arrayUnion(userId),
    [`memberStatuses.${userId}`]: 'active'
  });
  return groupDoc.id;
};

export const requestLeaveGroup = (groupId: string, userId: string) => {
  const docRef = doc(db, "groups", groupId);
  updateDoc(docRef, {
    [`memberStatuses.${userId}`]: 'leave_pending'
  }).catch(error => {
    errorEmitter.emit('permission-error', new FirestorePermissionError({
      path: docRef.path,
      operation: 'update',
      requestResourceData: { [`memberStatuses.${userId}`]: 'leave_pending' }
    }));
  });
};

export const confirmLeaveGroup = (groupId: string, userId: string) => {
  const docRef = doc(db, "groups", groupId);
  updateDoc(docRef, {
    members: arrayRemove(userId),
    memberIds: arrayRemove(userId),
    [`memberStatuses.${userId}`]: deleteField()
  }).catch(error => {
    errorEmitter.emit('permission-error', new FirestorePermissionError({
      path: docRef.path,
      operation: 'update'
    }));
  });
};

export const addDebt = async (groupId: string, debtorId: string, amount: number, description: string) => {
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
    groupAdminId: group.adminId,
    groupMemberIds: group.memberIds,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };

  addDoc(debtCollection, data).catch(error => {
    errorEmitter.emit('permission-error', new FirestorePermissionError({
      path: debtCollection.path,
      operation: 'create',
      requestResourceData: data
    }));
  });
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

export const getGroupMembersDetails = async (memberIds: string[]): Promise<UserProfile[]> => {
  if (!memberIds || memberIds.length === 0) return [];
  const profiles: UserProfile[] = [];
  try {
    for (const id of memberIds) {
      const p = await getUserProfile(id);
      if (p) profiles.push(p);
    }
  } catch (e) {
    console.error("Error fetching member details", e);
  }
  return profiles;
};