
export type UserRole = 'admin' | 'user';

export interface UserProfile {
  uid: string;
  email: string | null;
  displayName: string | null;
  role: UserRole;
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
  amount: number;
  description: string;
  status: DebtStatus;
  receiptId?: string;
  groupAdminId: string;
  groupMemberIds: string[];
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

export interface Receipt {
  id: string;
  groupId: string;
  imageUrl?: string;
  status: 'open' | 'processing' | 'completed';
  items: ReceiptItem[];
  createdAt: number;
}

export interface ExternalGuest {
  name: string;
  addedBy: string;
}

export interface Event {
  id: string;
  title: string;
  date: string;
  time: string;
  location: string;
  totalCost: number;
  creatorId: string;
  creatorName?: string; // Nombre del usuario que creó el evento
  groupId: string; // Vínculo con el grupo de cobro
  participantIds: string[];
  presentIds: string[];
  externalGuests?: ExternalGuest[];
  shareLink?: string;
  isCharged?: boolean; // Indica si las deudas ya se pasaron al grupo
  createdAt: number;
}
