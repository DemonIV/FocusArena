import { create } from 'zustand';
import { checkProEntitlement, billingEnabled } from '../services/billing';

interface BillingState {
  isPro: boolean;
  /** Optimistically set after a successful purchase/restore. */
  setPro: (v: boolean) => void;
  /** Re-read entitlement from the store (call on launch / after auth). */
  refresh: () => Promise<void>;
}

export const useBillingStore = create<BillingState>((set) => ({
  isPro: false,
  setPro: (v) => set({ isPro: v }),
  refresh: async () => {
    if (!billingEnabled) return;
    set({ isPro: await checkProEntitlement() });
  },
}));
