import { create } from 'zustand';

// ─── Constants ────────────────────────────────────────────────────────────────

const MAX_HISTORY = 20;

const DEFAULT_INVOICE = {
  invoiceNumber: '',
  from: { name: '', email: '', address: '', phone: '' },
  to: { name: '', email: '', address: '', phone: '' },
  items: [],
  taxRate: 0,
  discountRate: 0,
  shipping: 0,
  currency: 'USD',
  notes: '',
  terms: '',
  issueDate: '',
  dueDate: '',
  status: 'draft',
};

// ─── Computation Helpers ──────────────────────────────────────────────────────

const computeSubtotal = (items) =>
  (items || []).reduce((sum, item) => sum + (item.quantity || 0) * (item.unit_cost || 0), 0);

const computeTaxAmount = (subtotal, taxRate) =>
  subtotal * ((taxRate || 0) / 100);

const computeDiscountAmount = (subtotal, discountRate) =>
  subtotal * ((discountRate || 0) / 100);

const computeTotal = (data) => {
  const subtotal = computeSubtotal(data.items);
  const tax = computeTaxAmount(subtotal, data.taxRate);
  const discount = computeDiscountAmount(subtotal, data.discountRate);
  return subtotal + tax - discount + (data.shipping || 0);
};

// ─── Store ────────────────────────────────────────────────────────────────────

const useInvoiceStore = create((set, get) => ({
  // ── State ─────────────────────────────────────────────────────────────────
  invoiceData: { ...DEFAULT_INVOICE },
  invoiceId: null,
  history: [], // undo stack

  // ── Actions ───────────────────────────────────────────────────────────────

  /**
   * Update invoice data. Pushes current state onto the undo stack.
   * Accepts a partial object that merges into the current data.
   */
  setInvoiceData: (newData) =>
    set((state) => {
      // Push current state to history (cap at MAX_HISTORY)
      const updatedHistory = [
        { ...state.invoiceData },
        ...state.history,
      ].slice(0, MAX_HISTORY);

      return {
        invoiceData: { ...state.invoiceData, ...newData },
        history: updatedHistory,
      };
    }),

  /**
   * Replace the entire invoice data (e.g., from API response).
   * Also pushes current state onto the undo stack.
   */
  replaceInvoiceData: (fullData) =>
    set((state) => {
      const updatedHistory = [
        { ...state.invoiceData },
        ...state.history,
      ].slice(0, MAX_HISTORY);

      return {
        invoiceData: { ...DEFAULT_INVOICE, ...fullData },
        history: updatedHistory,
      };
    }),

  setInvoiceId: (id) => set({ invoiceId: id }),

  /**
   * Undo the last change. Pops the most recent state from the history stack.
   * Returns true if an undo was performed, false if history is empty.
   */
  undo: () => {
    const { history } = get();
    if (history.length === 0) return false;

    const [previous, ...rest] = history;
    set({
      invoiceData: previous,
      history: rest,
    });
    return true;
  },

  /**
   * Check if undo is available.
   */
  canUndo: () => get().history.length > 0,

  /**
   * Reset everything back to defaults.
   */
  resetInvoice: () =>
    set({
      invoiceData: { ...DEFAULT_INVOICE },
      invoiceId: null,
      history: [],
    }),
}));

// ─── Derived Selectors (use outside of store for optimal re-render) ───────────
// Components that only need totals won't re-render when unrelated fields change.

export const useSubtotal = () =>
  useInvoiceStore((state) => computeSubtotal(state.invoiceData.items));

export const useTotal = () =>
  useInvoiceStore((state) => computeTotal(state.invoiceData));

export const useTaxAmount = () =>
  useInvoiceStore((state) =>
    computeTaxAmount(
      computeSubtotal(state.invoiceData.items),
      state.invoiceData.taxRate
    )
  );

export const useDiscountAmount = () =>
  useInvoiceStore((state) =>
    computeDiscountAmount(
      computeSubtotal(state.invoiceData.items),
      state.invoiceData.discountRate
    )
  );

export default useInvoiceStore;
