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
  orderBy,
  arrayUnion,
  serverTimestamp 
} from "firebase/firestore";
import { Group, Debt, UserProfile, DebtStatus } from "../types";

export const createUserProfile = async (uid: string, email: string, displayName: string) => {
  const userRef = doc(db, "users", uid);
  await setDoc(userRef, {
    uid,
    email,
    displayName,
    role: 'user',
    createdAt: Date.now(),
  });
};

export const getUserProfile = async (uid: string): Promise<UserProfile | null> => {
  const userRef = doc(db, "users", uid);
  const snap = await getDoc(userRef);
  return snap.exists() ? (snap.data() as UserProfile) : null;
};

export const createGroup = async (name: string, type: 'fixed' | 'variable', adminId: string) => {
  const inviteToken = Math.random().toString(36).substring(2, 15);
  const groupCollection = collection(db, "groups");
  const docRef = await addDoc(groupCollection, {
    name,
    type,
    adminId,
    members: [adminId],
    inviteToken,
    createdAt: Date.now(),
  });
  return docRef.id;
};

export const getGroupsForUser = async (userId: string): Promise<Group[]> => {
  const groupsQuery = query(collection(db, "groups"), where("members", "array-contains", userId));
  const snap = await getDocs(groupsQuery);
  return snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Group));
};

export const getGroupById = async (groupId: string): Promise<Group | null> => {
  const docRef = doc(db, "groups", groupId);
  const snap = await getDoc(docRef);
  return snap.exists() ? ({ id: snap.id, ...snap.data() } as Group) : null;
};

export const joinGroupByInvite = async (userId: string, inviteToken: string) => {
  const q = query(collection(db, "groups"), where("inviteToken", "==", inviteToken));
  const snap = await getDocs(q);
  if (snap.empty) throw new Error("Invalid invite link");
  const groupDoc = snap.docs[0];
  await updateDoc(groupDoc.ref, {
    members: arrayUnion(userId)
  });
  return groupDoc.id;
};

export const addDebt = async (groupId: string, debtorId: string, amount: number, description: string) => {
  const debtCollection = collection(db, "debts");
  await addDoc(debtCollection, {
    groupId,
    debtorId,
    amount,
    description,
    status: 'pending',
    createdAt: Date.now(),
    updatedAt: Date.now(),
  });
};

export const getDebtsForGroup = async (groupId: string): Promise<Debt[]> => {
  const q = query(collection(db, "debts"), where("groupId", "==", groupId), orderBy("createdAt", "desc"));
  const snap = await getDocs(q);
  return snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Debt));
};

export const updateDebtStatus = async (debtId: string, status: DebtStatus) => {
  const docRef = doc(db, "debts", debtId);
  await updateDoc(docRef, {
    status,
    updatedAt: Date.now(),
  });
};

export const getGroupMembersDetails = async (memberIds: string[]): Promise<UserProfile[]> => {
  if (memberIds.length === 0) return [];
  const profiles: UserProfile[] = [];
  for (const id of memberIds) {
    const p = await getUserProfile(id);
    if (p) profiles.push(p);
  }
  return profiles;
};