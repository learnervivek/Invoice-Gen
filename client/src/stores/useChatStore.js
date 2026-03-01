import { create } from 'zustand';

// ─── Initial bot message ──────────────────────────────────────────────────────

const INITIAL_BOT_MESSAGE =
  "👋 Hello! I'm your **Invoice Assistant**. I'll guide you through creating an invoice step by step.\n\n" +
  "• Type `edit [section]` anytime to modify a previous field.\n" +
  "• Type `delete item [name]` to remove an item you added by mistake.\n\n" +
  "Let's get started! 🚀";

// ─── Store ────────────────────────────────────────────────────────────────────

const useChatStore = create((set) => ({
  // ── State ─────────────────────────────────────────────────────────────────
  messages: [{ role: 'bot', message: INITIAL_BOT_MESSAGE }],
  input: '',
  loading: false,
  activeChipCategory: 'actions',
  chipsExpanded: true,

  // ── Flow state ────────────────────────────────────────────────────────────
  currentStep: 0,
  furthestStep: 0,       // tracks the furthest step reached to jump back after editing
  pendingItem: {},       // accumulates item fields before pushing to items[]
  flowStarted: false,    // whether the first question has been asked

  // ── Actions ───────────────────────────────────────────────────────────────

  addMessage: (msg) =>
    set((state) => ({
      messages: [...state.messages, msg],
    })),

  setInput: (val) => set({ input: val }),

  setLoading: (bool) => set({ loading: bool }),

  setActiveChipCategory: (id) =>
    set(() => ({
      activeChipCategory: id,
      chipsExpanded: true,
    })),

  toggleChips: () =>
    set((state) => ({ chipsExpanded: !state.chipsExpanded })),

  // ── Flow actions ──────────────────────────────────────────────────────────

  setCurrentStep: (step) => set({ currentStep: step }),

  setFurthestStep: (step) => set({ furthestStep: step }),

  setPendingItem: (item) => set({ pendingItem: item }),

  resetPendingItem: () => set({ pendingItem: {} }),

  setFlowStarted: (val) => set({ flowStarted: val }),

  resetChat: () =>
    set({
      messages: [{ role: 'bot', message: INITIAL_BOT_MESSAGE }],
      input: '',
      loading: false,
      activeChipCategory: 'actions',
      chipsExpanded: true,
      currentStep: 0,
      furthestStep: 0,
      pendingItem: {},
      flowStarted: false,
    }),
}));

export default useChatStore;
