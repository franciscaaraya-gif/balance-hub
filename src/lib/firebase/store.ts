
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
  limit,
  writeBatch
} from "firebase/firestore";
import { Group, UserProfile, DebtStatus, ReceiptItem, Event, ExternalGuest, Debt } from "../types";
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

export const getAllUsers = async (): Promise<UserProfile[]> => {
  const q = query(collection(db, "userProfiles"), limit(100));
  const snap = await getDocs(q);
  return snap.docs.map(doc => doc.data() as UserProfile);
};

export const createGroup = async (name: string, type: 'fixed' | 'variable', adminId: string, fixedAmount?: number) => {
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

  return addDoc(groupCollection, data);
};

export const updateGroupTransferDetails = (groupId: string, transferDetails: string) => {
  const docRef = doc(db, "groups", groupId);
  return updateDoc(docRef, { transferDetails });
};

export const addDebt = async (
  groupId: string, 
  debtorId: string, 
  amount: number, 
  description: string, 
  receiptId?: string,
  extraData?: { eventId?: string; eventName?: string }
) => {
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
    groupName: group.name,
    transferDetails: group.transferDetails || null,
    eventId: extraData?.eventId || null,
    eventName: extraData?.eventName || null,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };

  return addDoc(debtCollection, data);
};

export const addFixedDebtToAll = async (groupId: string, amount: number, description: string, memberIds: string[]) => {
  const batch = writeBatch(db);
  const groupRef = doc(db, "groups", groupId);
  const groupSnap = await getDoc(groupRef);
  if (!groupSnap.exists()) return;
  const group = groupSnap.data() as Group;

  memberIds.forEach(uid => {
    const debtRef = doc(collection(db, "groups", groupId, "debts"));
    batch.set(debtRef, {
      groupId,
      debtorId: uid,
      amount,
      description,
      status: 'pending',
      groupAdminId: group.adminId,
      groupMemberIds: group.memberIds,
      groupName: group.name,
      transferDetails: group.transferDetails || null,
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

export const finalizeReceipt = async (groupId: string, receiptId: string, items: ReceiptItem[]) => {
  const receiptRef = doc(db, "groups", groupId, "receipts", receiptId);
  
  for (const item of items) {
    for (const claim of item.claims) {
      const amount = (item.price * claim.percentage) / 100;
      if (amount > 0) {
        await addDebt(groupId, claim.userId, amount, `Consumo: ${item.name}`, receiptId);
      }
    }
  }

  updateDoc(receiptRef, {
    status: 'completed'
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

export const createEvent = async (data: Omit<Event, 'id' | 'createdAt' | 'participantIds' | 'presentIds' | 'externalGuests' | 'shareLink' | 'isCharged'>) => {
  const eventCollection = collection(db, "events");
  const eventRef = doc(eventCollection);
  const checkInToken = Math.random().toString(36).substring(7);
  const eventData = {
    ...data,
    id: eventRef.id,
    participantIds: [data.creatorId],
    presentIds: [data.creatorId],
    externalGuests: [],
    shareLink: `${window.location.origin}/attendance/join/${eventRef.id}`,
    checkInToken,
    isCharged: false,
    createdAt: Date.now(),
  };
  await setDoc(eventRef, eventData);
  return eventRef;
};

export const chargeEventToGroup = async (eventId: string) => {
  const eventRef = doc(db, "events", eventId);
  const eventSnap = await getDoc(eventRef);
  if (!eventSnap.exists()) throw new Error("Evento no encontrado");
  const event = eventSnap.data() as Event;

  if (event.isCharged) throw new Error("Este evento ya fue cobrado.");

  const totalPresentParticipants = event.presentIds?.length || 0;
  const totalPresentGuests = event.externalGuests?.filter(g => g.present).length || 0;
  const totalHeads = totalPresentParticipants + totalPresentGuests;

  if (totalHeads === 0) throw new Error("No hay asistentes para cobrar.");

  const costPerHead = event.totalCost / totalHeads;

  for (const uid of event.presentIds) {
    const myGuests = event.externalGuests?.filter(g => g.addedBy === uid && g.present) || [];
    const multiplier = 1 + myGuests.length;
    const finalAmount = costPerHead * multiplier;

    if (finalAmount > 0) {
      await addDebt(
        event.groupId, 
        uid, 
        finalAmount, 
        `Asistencia: ${event.title} (${multiplier} cabezas)`, 
        undefined,
        { eventId: event.id, eventName: event.title }
      );
    }
  }

  await updateDoc(eventRef, { isCharged: true });
};

export const addParticipantToEvent = (eventId: string, userId: string) => {
  const eventRef = doc(db, "events", eventId);
  return updateDoc(eventRef, {
    participantIds: arrayUnion(userId)
  });
};

export const addAndMarkPresent = (eventId: string, userId: string) => {
  const eventRef = doc(db, "events", eventId);
  return updateDoc(eventRef, {
    participantIds: arrayUnion(userId),
    presentIds: arrayUnion(userId)
  });
};

export const toggleAttendance = (eventId: string, userId: string, isPresent: boolean) => {
  const eventRef = doc(db, "events", eventId);
  return updateDoc(eventRef, {
    presentIds: isPresent ? arrayUnion(userId) : arrayRemove(userId)
  });
};

export const addExternalGuest = (eventId: string, name: string, addedBy: string) => {
  const eventRef = doc(db, "events", eventId);
  return updateDoc(eventRef, {
    externalGuests: arrayUnion({ name, addedBy, present: false })
  });
};

export const removeExternalGuest = async (eventId: string, guest: ExternalGuest) => {
  const eventRef = doc(db, "events", eventId);
  return updateDoc(eventRef, {
    externalGuests: arrayRemove(guest)
  });
};

export const toggleGuestPresence = async (eventId: string, guestName: string, addedBy: string, present: boolean) => {
  const eventRef = doc(db, "events", eventId);
  const snap = await getDoc(eventRef);
  if (!snap.exists()) return;
  const event = snap.data() as Event;
  const updatedGuests = event.externalGuests.map(g => {
    if (g.name === guestName && g.addedBy === addedBy) {
      return { ...g, present };
    }
    return g;
  });
  return updateDoc(eventRef, { externalGuests: updatedGuests });
};

export const removeParticipantFromEvent = async (eventId: string, userId: string) => {
  const eventRef = doc(db, "events", eventId);
  const snap = await getDoc(eventRef);
  if (!snap.exists()) return;
  const event = snap.data() as Event;
  if (event.isCharged) return;
  
  return updateDoc(eventRef, {
    participantIds: arrayRemove(userId),
    presentIds: arrayRemove(userId),
    externalGuests: event.externalGuests.filter(g => g.addedBy !== userId)
  });
};
