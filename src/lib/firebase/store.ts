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
  arrayRemove,
  deleteField
} from "firebase/firestore";
import { Group, Debt, UserProfile, DebtStatus } from "../types";

export const createUserProfile = async (uid: string, email: string, displayName: string) => {
  const userRef = doc(db, "userProfiles", uid);
  await setDoc(userRef, {
    id: uid,
    uid, // Mantenemos ambos por compatibilidad con el código existente
    email,
    displayName,
    role: 'user',
    createdAt: Date.now(),
  });
};

export const getUserProfile = async (uid: string): Promise<UserProfile | null> => {
  const userRef = doc(db, "userProfiles", uid);
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
    memberIds: [adminId], // Para reglas de seguridad según backend.json
    memberStatuses: {
      [adminId]: 'active'
    },
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
  if (snap.empty) throw new Error("Enlace de invitación inválido");
  const groupDoc = snap.docs[0];
  const groupData = groupDoc.data() as Group;
  
  if (groupData.members.includes(userId)) return groupDoc.id;

  await updateDoc(groupDoc.ref, {
    members: arrayUnion(userId),
    memberIds: arrayUnion(userId),
    [`memberStatuses.${userId}`]: 'active'
  });
  return groupDoc.id;
};

export const requestLeaveGroup = async (groupId: string, userId: string) => {
  const docRef = doc(db, "groups", groupId);
  await updateDoc(docRef, {
    [`memberStatuses.${userId}`]: 'leave_pending'
  });
};

export const confirmLeaveGroup = async (groupId: string, userId: string) => {
  const docRef = doc(db, "groups", groupId);
  await updateDoc(docRef, {
    members: arrayRemove(userId),
    memberIds: arrayRemove(userId),
    [`memberStatuses.${userId}`]: deleteField()
  });
};

export const addDebt = async (groupId: string, debtorId: string, amount: number, description: string) => {
  const group = await getGroupById(groupId);
  if (!group) throw new Error("Grupo no encontrado");

  const debtCollection = collection(db, "groups", groupId, "debts");
  await addDoc(debtCollection, {
    groupId,
    debtorId,
    amount,
    description,
    status: 'pending',
    groupAdminId: group.adminId, // Denormalización para reglas de seguridad
    groupMemberIds: group.members, // Denormalización para reglas de seguridad
    createdAt: Date.now(),
    updatedAt: Date.now(),
  });
};

export const getDebtsForGroup = async (groupId: string): Promise<Debt[]> => {
  const q = query(collection(db, "groups", groupId, "debts"), orderBy("createdAt", "desc"));
  const snap = await getDocs(q);
  return snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Debt));
};

export const getDebtsForUser = async (userId: string): Promise<Debt[]> => {
  // Nota: Para búsquedas entre todos los grupos se requeriría un collectionGroup query.
  // Por simplicidad en este MVP, buscamos las deudas dentro de los grupos del usuario.
  const userGroups = await getGroupsForUser(userId);
  let allDebts: Debt[] = [];
  
  for (const group of userGroups) {
    const q = query(collection(db, "groups", group.id, "debts"), where("debtorId", "==", userId));
    const snap = await getDocs(q);
    const debts = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Debt));
    allDebts = [...allDebts, ...debts];
  }
  
  return allDebts;
};

export const updateDebtStatus = async (debtId: string, status: DebtStatus) => {
  // Buscamos la deuda en todos los posibles grupos (MVP approach)
  const debtsQuery = query(collection(db, "debts"), where("id", "==", debtId));
  // En una estructura anidada real, necesitaríamos el groupId. 
  // Para este MVP simplificamos la actualización si conocemos el path.
  // Idealmente, updateDebtStatus debería recibir el groupId.
};

// Versión corregida para estructura anidada
export const updateDebtStatusInGroup = async (groupId: string, debtId: string, status: DebtStatus) => {
  const docRef = doc(db, "groups", groupId, "debts", debtId);
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
