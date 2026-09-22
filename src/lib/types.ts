export type UserRole = 'admin' | 'user';

export interface UserProfile {
  uid: string;
  email: string | null;
  displayName: string | null;
  role: UserRole;
  transferDetails?: string;
  createdAt: number;
}

export type GroupType = 'fixed' | 'variable';
export type MemberStatus = 'active' | 'leave_pending';

export interface Group {
  id: string;
  name: string;
  type: GroupType;
  fixedAmount?: number;
  adminId: string;
  members: string[];
  memberIds: string[];
  memberStatuses?: Record<string, MemberStatus>;
  inviteToken: string;
  inviteLink: string;
  transferDetails?: string;
  createdAt: number;
}

export type DebtStatus = 'pending' | 'under_review' | 'paid';

export interface Debt {
  id: string;
  groupId: string;
  debtorId: string;
  creditorId: string;
  chargeGroupId: string;
  amount: number;
  description: string;
  status: DebtStatus;
  receiptId?: string;
  groupAdminId: string;
  groupMemberIds: string[];
  groupName?: string;
  eventName?: string;
  eventId?: string;
  transferDetails?: string;
  createdAt: number;
  updatedAt: number;
}

export interface ReceiptItemClaim {
  userId: string;
  percentage: number;
}

export interface ReceiptItem {
  id: string;
  name: string;
  price: number;
  claims: ReceiptItemClaim[];
}

export interface ExternalGuest {
  name: string;
  addedBy: string;
  present: boolean;
}

export interface Receipt {
  id: string;
  groupId: string;
  imageUrl?: string;
  status: 'active' | 'completed';
  items: ReceiptItem[];
  claims?: Record<string, number>;
  creditorId: string;
  externalGuests?: ExternalGuest[];
  includeTip?: boolean;
  createdAt: number;
}

export interface Event {
  id: string;
  title: string;
  date: string;
  time: string;
  location: string;
  totalCost: number;
  costConcept: string;
  chargeAbsentees: boolean;
  creatorId: string;
  creatorName?: string;
  groupId: string;
  participantIds: string[];
  presentIds: string[];
  externalGuests: ExternalGuest[];
  shareLink: string;
  checkInToken?: string;
  isCharged: boolean;
  createdAt: number;
}
