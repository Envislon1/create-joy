export interface Contestant {
  id: string;
  name: string;
  age: number;
  sex: 'male' | 'female';
  profileImage: string;
  galleryImages: string[];
  votes: number;
  registeredAt: string;
  parentName: string;
  parentEmail: string;
  parentPhone: string;
}

export interface ContestSettings {
  contestName: string;
  contestStartDate: string;
  contestEndDate: string;
  votePrice: number;
  isActive: boolean;
}

export interface VoteTransaction {
  id: string;
  contestantId: string;
  amount: number;
  voteCount: number;
  paymentReference: string;
  status: 'pending' | 'successful' | 'failed';
  createdAt: string;
}
