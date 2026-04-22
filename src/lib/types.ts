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
  adminId: string;
  members: string[]; // User UIDs
  memberStatuses?: Record<string, MemberStatus>; // Track member state
  inviteToken: string;
  createdAt: number;
}

export type DebtStatus = 'pending' | 'under_review' | 'paid';

export interface Debt {
  id: string;
  groupId: string;
  debtorId: string; // The person who owes money
  amount: number;
  description: string;
  status: DebtStatus;
  createdAt: number;
  updatedAt: number;
}
