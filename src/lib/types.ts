
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
  fixedAmount?: number; // Monto por defecto para grupos fijos
  adminId: string;
  members: string[]; // User UIDs
  memberIds: string[]; // Duplicate for queries
  memberStatuses?: Record<string, MemberStatus>;
  inviteToken: string;
  inviteLink: string;
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
  groupAdminId: string; // Denormalized for security rules
  groupMemberIds: string[]; // Denormalized for security rules
  createdAt: number;
  updatedAt: number;
}
