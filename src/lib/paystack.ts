// Paystack public key - this is safe to expose in frontend
export const PAYSTACK_PUBLIC_KEY = "pk_test_xxxxxxxxxxxxxxxxxxxxxxxxxx";

export const VOTE_PRICE_NAIRA = 50;

export interface PaystackConfig {
  key: string;
  email: string;
  amount: number; // in kobo
  ref: string;
  currency?: string;
  metadata?: Record<string, unknown>;
  callback: (response: { reference: string }) => void;
  onClose: () => void;
}

declare global {
  interface Window {
    PaystackPop: {
      setup: (config: PaystackConfig) => { openIframe: () => void };
    };
  }
}

export const generateReference = () => {
  return `vote_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
};

export const initializePaystack = (config: PaystackConfig) => {
  const handler = window.PaystackPop.setup(config);
  handler.openIframe();
};
