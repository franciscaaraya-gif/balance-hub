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
  const data = {
    uid,
    email,
    displayName,
    role: 'user',
    createdAt: Date.now(),
  };
  
  return setDoc(userRef, data, { merge: true }).catch(error => {
    errorEmitter.emit('permission-error', new FirestorePermissionError({
      path: userRef.path,
      operation: 'write',
      requestResourceData: data
    }));
    throw error;
  });
};

export const updateUserProfile = async (uid: string, data: Partial<UserProfile>) => {
  const userRef = doc(db, "userProfiles", uid);
  return updateDoc(userRef, data).catch(error => {
    errorEmitter.emit('permission-error', new FirestorePermissionError({
      path: userRef.path,
      operation: 'update',
      requestResourceData: data
    }));
    throw error;
  });
};

export const getUserProfile = async (uid: string): Promise<UserProfile | null> => {
  const userRef = doc(db, "userProfiles", uid);
  try {
    const snap = await getDoc(userRef);
    if (snap.exists()) {
      const data = snap.data();
      return {
        uid: data.uid || snap.id,
        email: data.email || "",
        displayName: data.displayName || "Usuario",
        role: data.role || "user",
        transferDetails: data.transferDetails || "",
        createdAt: data.createdAt || Date.now()
      };
    }
  } catch (error) {
    console.error(`[getUserProfile] Error al leer perfil para uid: ${uid}`, error);
  }
  return null;
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

export const createGroup = async (name: string, adminId: string) => {
  const inviteToken = Math.random().toString(36).substring(2, 15);
  const inviteLink = `${window.location.origin}/join/${inviteToken}`;
  const groupCollection = collection(db, "groups");
  
  const data = {
    name,
    type: 'variable',
    adminId,
    memberIds: [adminId],
    memberStatuses: {
      [adminId]: 'active'
    },
    inviteToken,
    inviteLink,
    createdAt: Date.now(),
  };

  return addDoc(groupCollection, data).catch(error => {
    errorEmitter.emit('permission-error', new FirestorePermissionError({
      path: groupCollection.path,
      operation: 'create',
      requestResourceData: data
    }));
    throw error;
  });
};

export const updateGroupTransferDetails = (groupId: string, transferDetails: string) => {
  const docRef = doc(db, "groups", groupId);
  updateDoc(docRef, { transferDetails }).catch(error => {
    errorEmitter.emit('permission-error', new FirestorePermissionError({
      path: docRef.path,
      operation: 'update',
      requestResourceData: { transferDetails }
    }));
  });
};

export const addDebt = async (
  groupId: string, 
  debtorId: string, 
  amount: number, 
  description: string, 
  creditorId?: string,
  chargeGroupId?: string,
  receiptId?: string,
  extraData?: { eventId?: string; eventName?: string }
) => {
  const groupRef = doc(db, "groups", groupId);
  const groupSnap = await getDoc(groupRef);
  if (!groupSnap.exists()) throw new Error("Grupo no encontrado");
  const group = groupSnap.data() as Group;

  const actualCreditorId = creditorId || group.adminId;

  const debtCollection = collection(db, "groups", groupId, "debts");
  const data = {
    groupId,
    debtorId,
    creditorId: actualCreditorId,
    chargeGroupId: chargeGroupId || Math.random().toString(36).substring(7),
    amount,
    description,
    status: debtorId === actualCreditorId ? 'paid' : 'pending',
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

  return addDoc(debtCollection, data).catch(error => {
    errorEmitter.emit('permission-error', new FirestorePermissionError({
      path: debtCollection.path,
      operation: 'create',
      requestResourceData: data
    }));
  });
};

export const addFixedDebtToAll = async (groupId: string, amount: number, description: string, memberIds: string[], creditorId: string) => {
  const batch = writeBatch(db);
  const groupRef = doc(db, "groups", groupId);
  const groupSnap = await getDoc(groupRef);
  if (!groupSnap.exists()) return;
  const group = groupSnap.data() as Group;
  const chargeGroupId = Math.random().toString(36).substring(7);

  memberIds.forEach(uid => {
    const debtRef = doc(collection(db, "groups", groupId, "debts"));
    batch.set(debtRef, {
      groupId,
      debtorId: uid,
      creditorId,
      chargeGroupId,
      amount,
      description,
      status: uid === creditorId ? 'paid' : 'pending',
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

export const bulkUpdateDebtStatus = async (groupId: string, debtIds: string[], status: DebtStatus) => {
  const batch = writeBatch(db);
  debtIds.forEach(id => {
    const ref = doc(db, "groups", groupId, "debts", id);
    batch.update(ref, { status, updatedAt: Date.now() });
  });
  return batch.commit();
};

export const createReceipt = (groupId: string, items: any[], creditorId: string, includeTip: boolean = false, externalGuests?: ExternalGuest[]) => {
  const receiptCollection = collection(db, "groups", groupId, "receipts");
  const data = {
    groupId,
    status: 'active',
    creditorId,
    items: items.map((it, idx) => ({
      id: String(idx),
      name: it.name,
      price: it.price,
      claims: []
    })),
    claims: {},
    includeTip,
    externalGuests: externalGuests || [],
    createdAt: Date.now()
  };
  return addDoc(receiptCollection, data);
};

export const claimReceiptItem = async (groupId: string, receiptId: string, itemId: string, userId: string, percentage: number) => {
  const docRef = doc(db, "groups", groupId, "receipts", receiptId);
  return updateDoc(docRef, {
    [`claims.${itemId}_${userId}`]: percentage
  });
};

export const finalizeReceipt = async (
  groupId: string, 
  receiptId: string, 
  items: ReceiptItem[], 
  claims: Record<string, number> = {}, 
  creditorId: string, 
  description?: string,
  includeTip: boolean = false,
  externalGuests: ExternalGuest[] = []
) => {
  const receiptRef = doc(db, "groups", groupId, "receipts", receiptId);
  const chargeGroupId = Math.random().toString(36).substring(7);
  
  const userBaseAmounts: Record<string, number> = {};
  
  for (const item of items) {
    const itemClaimants = Object.keys(claims).filter(key => key.startsWith(`${item.id}_`) && claims[key] > 0);
    
    if (itemClaimants.length > 0) {
      const splitPrice = item.price / itemClaimants.length;
      for (const key of itemClaimants) {
        const userId = key.substring(item.id.length + 1);
        
        let targetUserId = userId;
        // Si el userId es un invitado (guest_X), asignamos el cargo a su responsable
        if (userId.startsWith('guest_')) {
          const guestIdx = parseInt(userId.split('_')[1]);
          const guest = externalGuests[guestIdx];
          if (guest) {
            targetUserId = guest.addedBy;
          }
        }

        userBaseAmounts[targetUserId] = (userBaseAmounts[targetUserId] || 0) + splitPrice;
      }
    }
  }
  
  const totalBaseCost = Object.values(userBaseAmounts).reduce((sum, val) => sum + val, 0);
  
  for (const [userId, baseAmount] of Object.entries(userBaseAmounts)) {
    if (baseAmount > 0) {
      let finalAmount = baseAmount;
      let extraDescription = "";
      
      if (includeTip && totalBaseCost > 0) {
        const userRatio = baseAmount / totalBaseCost;
        const totalTip = totalBaseCost * 0.10;
        const userTipShare = totalTip * userRatio;
        finalAmount += userTipShare;
        extraDescription = ` (incluye 10% propina proporcional: $${userTipShare.toFixed(2)})`;
      }
      
      await addDebt(
        groupId, 
        userId, 
        finalAmount, 
        description || `Consumo Boleta compartido${extraDescription}`, 
        creditorId, 
        chargeGroupId, 
        receiptId
      );
    }
  }

  return updateDoc(receiptRef, {
    status: 'completed'
  }).catch(error => {
    errorEmitter.emit('permission-error', new FirestorePermissionError({
      path: receiptRef.path,
      operation: 'update',
      requestResourceData: { status: 'completed' }
    }));
  });
};

export const getGroupByToken = async (inviteToken: string): Promise<Group | null> => {
  const q = query(collection(db, "groups"), where("inviteToken", "==", inviteToken), limit(1));
  const snap = await getDocs(q);
  if (snap.empty) return null;
  const docSnap = snap.docs[0];
  return { ...docSnap.data(), id: docSnap.id } as Group;
};

export const joinGroupByInvite = async (userId: string, inviteToken: string) => {
  const group = await getGroupByToken(inviteToken);
  if (!group) throw new Error("Enlace de invitación inválido o expirado");
  
  if (group.memberIds.includes(userId)) return group.id;

  const groupRef = doc(db, "groups", group.id);
  await updateDoc(groupRef, {
    memberIds: arrayUnion(userId),
    [`memberStatuses.${userId}`]: 'active'
  }).catch(error => {
    errorEmitter.emit('permission-error', new FirestorePermissionError({
      path: groupRef.path,
      operation: 'update',
      requestResourceData: { memberIds: userId }
    }));
    throw error;
  });
  return group.id;
};

export const createEvent = (data: Omit<Event, 'id' | 'createdAt' | 'participantIds' | 'presentIds' | 'externalGuests' | 'shareLink' | 'isCharged'>) => {
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

  setDoc(eventRef, eventData).catch(error => {
    errorEmitter.emit('permission-error', new FirestorePermissionError({
      path: eventRef.path,
      operation: 'create',
      requestResourceData: eventData
    }));
  });
  
  return eventRef;
};

export const updateEventSettings = (eventId: string, chargeAbsentees: boolean) => {
  const eventRef = doc(db, "events", eventId);
  return updateDoc(eventRef, { chargeAbsentees });
};

export const chargeEventToGroup = async (eventId: string) => {
  const eventRef = doc(db, "events", eventId);
  const eventSnap = await getDoc(eventRef);
  if (!eventSnap.exists()) throw new Error("Evento no encontrado");
  const event = eventSnap.data() as Event;

  if (event.isCharged) throw new Error("Este evento ya fue cobrado.");

  const totalPresentParticipants = event.presentIds?.length || 0;
  const totalPresentGuests = event.externalGuests?.filter(g => g.present).length || 0;
  
  const absentIds = event.participantIds.filter(id => !event.presentIds.includes(id));
  const totalAbsents = absentIds.length;

  const totalHeads = totalPresentParticipants + totalPresentGuests + (event.chargeAbsentees ? totalAbsents : 0);

  if (totalHeads === 0) throw new Error("No hay asistentes ni ausentes configurados para cobrar.");

  const costPerHead = event.totalCost / totalHeads;
  const conceptText = event.costConcept || "Gasto de Evento";
  const chargeGroupId = event.id;
  const creditorId = event.creatorId;

  for (const uid of event.participantIds) {
    const isPresent = event.presentIds.includes(uid);
    const myGuests = event.externalGuests?.filter(g => g.addedBy === uid && g.present) || [];
    const isAbsentAndCharged = !isPresent && event.chargeAbsentees;

    if (!isPresent && !event.chargeAbsentees) continue;

    let multiplier = 0;
    if (isPresent) multiplier += 1;
    multiplier += myGuests.length;
    if (isAbsentAndCharged) multiplier += 1;

    const finalAmount = costPerHead * multiplier;

    if (finalAmount > 0) {
      let descriptionText = `${event.title}: ${conceptText}`;
      if (isPresent) descriptionText += " (Presente)";
      if (myGuests.length > 0) descriptionText += ` (+${myGuests.length} invitados)`;
      if (isAbsentAndCharged) descriptionText += " (Ausente con cargo)";

      await addDebt(
        event.groupId, 
        uid, 
        finalAmount, 
        descriptionText, 
        creditorId,
        chargeGroupId,
        undefined,
        { eventId: event.id, eventName: event.title }
      );
    }
  }

  return updateDoc(eventRef, { isCharged: true }).catch(error => {
    errorEmitter.emit('permission-error', new FirestorePermissionError({
      path: eventRef.path,
      operation: 'update',
      requestResourceData: { isCharged: true }
    }));
  });
};

export const addParticipantToEvent = async (eventId: string, userId: string) => {
  const eventRef = doc(db, "events", eventId);
  const eventSnap = await getDoc(eventRef);
  if (!eventSnap.exists()) throw new Error("Evento no encontrado");
  const ev = eventSnap.data() as Event;
  const groupRef = doc(db, "groups", ev.groupId);

  const batch = writeBatch(db);
  batch.update(eventRef, { participantIds: arrayUnion(userId) });
  batch.update(groupRef, {
    memberIds: arrayUnion(userId),
    [`memberStatuses.${userId}`]: 'active'
  });

  return batch.commit().catch(error => {
    errorEmitter.emit('permission-error', new FirestorePermissionError({
      path: groupRef.path,
      operation: 'update',
      requestResourceData: { memberIds: userId, eventId }
    }));
    throw error;
  });
};

export const addAndMarkPresent = async (eventId: string, userId: string) => {
  const eventRef = doc(db, "events", eventId);
  const eventSnap = await getDoc(eventRef);
  if (!eventSnap.exists()) throw new Error("Evento no encontrado");
  const ev = eventSnap.data() as Event;
  const groupRef = doc(db, "groups", ev.groupId);

  const batch = writeBatch(db);
  batch.update(eventRef, {
    participantIds: arrayUnion(userId),
    presentIds: arrayUnion(userId)
  });
  batch.update(groupRef, {
    memberIds: arrayUnion(userId),
    [`memberStatuses.${userId}`]: 'active'
  });

  return batch.commit().catch(error => {
    errorEmitter.emit('permission-error', new FirestorePermissionError({
      path: groupRef.path,
      operation: 'update',
      requestResourceData: { memberIds: userId, eventId }
    }));
    throw error;
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
  const eventSnap = await getDoc(eventRef);
  if (!eventSnap.exists()) return;
  const event = eventSnap.data() as Event;

  if (event.isCharged) return;

  const updatedGuests = event.externalGuests.filter(g => g.addedBy !== userId);

  return updateDoc(eventRef, {
    participantIds: arrayRemove(userId),
    presentIds: arrayRemove(userId),
    externalGuests: updatedGuests
  });
};
