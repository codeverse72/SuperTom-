/**
 * User & Authentication Type Definitions
 */

export interface UserProfile {
  id: string;
  telegramId?: string;
  username: string;
  firstName?: string;
  lastName?: string;
  photoUrl?: string;
  level: number;
  levelTitle: string;
  referralCode: string;
  friendsInvited: number;
  referralEarnings: number;
  totalMissionsDone: number;
  totalBiscuitsFed: number;
  createdAt?: string;
}

export interface AuthState {
  isAuthenticated: boolean;
  user: UserProfile | null;
  authToken: string | null;
  rawInitData: string | null;
  status: 'IDLE' | 'AUTHENTICATING' | 'UNAUTHENTICATED' | 'AUTHENTICATED' | 'ERROR';
  errorMessage: string | null;
}
