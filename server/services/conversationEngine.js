/**
 * Rule-Based Conversational Engine for Invoice Generation
 *
 * Architecture:
 * 1. INTENT DETECTION — regex + keyword matching to classify user messages
 * 2. STATE MANAGEMENT — immutable invoice state with pure update functions
 * 3. ACTION HANDLERS — one per intent, returns { newState, response }
 * 4. TOTALS ENGINE — automatic recalculation on every state mutation
 *
 * Supported intents:
 *   ADD_ITEM, REMOVE_ITEM, UPDATE_ITEM,
 *   SET_TAX, SET_DISCOUNT,
 *   SET_CURRENCY,
 *   SET_SENDER, SET_RECIPIENT,
 *   ADD_NOTES, SET_DUE_DATE, SET_INVOICE_NUMBER,
 *   SHOW_SUMMARY, SAVE_DRAFT, GENERATE_PDF,
 *   HELP, GREETING, UNKNOWN
 */

// ─── Currency Registry ────────────────────────────────────────────────────────

const CURRENCIES = {
  USD: { symbol: '$', name: 'US Dollar' },
  EUR: { symbol: '€', name: 'Euro' },
  GBP: { symbol: '£', name: 'British Pound' },
  INR: { symbol: '₹', name: 'Indian Rupee' },
  CAD: { symbol: 'C$', name: 'Canadian Dollar' },
  AUD: { symbol: 'A$', name: 'Australian Dollar' },
  JPY: { symbol: '¥', name: 'Japanese Yen' },
  CNY: { symbol: '¥', name: 'Chinese Yuan' },
  CHF: { symbol: 'Fr', name: 'Swiss Franc' },
  SGD: { symbol: 'S$', name: 'Singapore Dollar' },
  BRL: { symbol: 'R$', name: 'Brazilian Real' },
  MXN: { symbol: 'MX$', name: 'Mexican Peso' },
  AED: { symbol: 'د.إ', name: 'UAE Dirham' },
};

// ─── Default State Factory ────────────────────────────────────────────────────

const createDefaultState = () => ({
  from: { name: '', email: '', address: '', phone: '' },
  to: { name: '', email: '', address: '', phone: '' },
  items: [],
  taxRate: 0,
  discountRate: 0,
  shipping: 0,
  currency: 'USD',
  notes: '',
  terms: '',
  dueDate: null,
  issueDate: new Date().toISOString(),
  invoiceNumber: '',
  // Computed (recalculated automatically)
  _computed: { subtotal: 0, taxAmount: 0, discountAmount: 0, shipping: 0, total: 0 },
});

// ─── Totals Recalculation (pure function) ─────────────────────────────────────

const recalculateTotals = (state) => {
  const items = state.items || [];
  const subtotal = items.reduce(
    (sum, item) => sum + (item.quantity || 0) * (item.unit_cost || 0),
    0
  );
  const taxAmount = subtotal * ((state.taxRate || 0) / 100);
  const discountAmount = subtotal * ((state.discountRate || 0) / 100);
  const shipping = state.shipping || 0;
  const total = subtotal + taxAmount - discountAmount + shipping;

  return {
    ...state,
    _computed: {
      subtotal: Math.round(subtotal * 100) / 100,
      taxAmount: Math.round(taxAmount * 100) / 100,
      discountAmount: Math.round(discountAmount * 100) / 100,
      shipping: Math.round(shipping * 100) / 100,
      total: Math.round(total * 100) / 100,
    },
  };
};

// ─── Currency Helper ──────────────────────────────────────────────────────────

const currencySymbol = (code) => CURRENCIES[code]?.symbol || '$';

const formatMoney = (amount, currency = 'USD') => {
  const sym = currencySymbol(currency);
  return `${sym}${(amount || 0).toFixed(2)}`;
};

// ─── Intent Definitions ───────────────────────────────────────────────────────
//
// Each intent has:
//   patterns: array of RegExp(s) tested against the lowercase message
//   keywords: array of keywords that trigger this intent (substring match)
//   priority: higher = matched first when multiple intents qualify
//
// The engine tests patterns first, then keywords. First match wins (by priority).

const INTENTS = [
  {
    name: 'GREETING',
    priority: 5,
    patterns: [/^(hi|hello|hey|howdy|greetings|good\s*(morning|afternoon|evening))/i],
    keywords: ['hi', 'hello', 'hey'],
  },
  {
    name: 'HELP',
    priority: 90,
    patterns: [/^(help|what can you do|commands|how to|guide)/i],
    keywords: ['help', 'commands', 'guide'],
  },
  {
    name: 'ADD_ITEM',
    priority: 80,
    patterns: [
      /add\s+(an?\s+)?item/i,
      /new\s+item/i,
      /add\s+line\s*item/i,
      // Direct item format: "Item, qty, price" or "Item name, 5, 100"
      /^(.+?),\s*(\d+(?:\.\d+)?)\s*,\s*(\d+(?:\.\d+)?)/,
    ],
    keywords: ['add item', 'new item', 'add line', 'add product', 'add service'],
  },
  {
    name: 'REMOVE_ITEM',
    priority: 75,
    patterns: [
      /remove\s+(item|line|product|service)\s*#?\s*(\d+)/i,
      /delete\s+(item|line|product|service)\s*#?\s*(\d+)/i,
      /remove\s+(.+)/i,
    ],
    keywords: ['remove item', 'delete item', 'remove line'],
  },
  {
    name: 'UPDATE_ITEM',
    priority: 74,
    patterns: [
      /update\s+(item|line)\s*#?\s*(\d+)/i,
      /change\s+(item|line)\s*#?\s*(\d+)/i,
      /edit\s+(item|line)\s*#?\s*(\d+)/i,
      /set\s+(item|line)\s*#?\s*(\d+)/i,
    ],
    keywords: ['update item', 'edit item', 'change item', 'modify item'],
  },
  {
    name: 'SET_TAX',
    priority: 70,
    patterns: [
      /(?:set|change|update|make)\s+tax\s*(?:rate|%)?\s*(?:to|=|:)?\s*(\d+(?:\.\d+)?)\s*%?/i,
      /tax\s*(?:rate|%)?\s*(?:is|=|:)\s*(\d+(?:\.\d+)?)\s*%?/i,
      /(\d+(?:\.\d+)?)\s*%?\s*tax/i,
    ],
    keywords: ['set tax', 'change tax', 'update tax', 'tax rate'],
  },
  {
    name: 'SET_DISCOUNT',
    priority: 69,
    patterns: [
      /(?:set|change|update|make)\s+discount\s*(?:rate|%)?\s*(?:to|=|:)?\s*(\d+(?:\.\d+)?)\s*%?/i,
      /discount\s*(?:rate|%)?\s*(?:is|=|:)\s*(\d+(?:\.\d+)?)\s*%?/i,
      /(\d+(?:\.\d+)?)\s*%?\s*discount/i,
    ],
    keywords: ['set discount', 'change discount', 'update discount', 'add discount'],
  },
  {
    name: 'SET_CURRENCY',
    priority: 68,
    patterns: [
      /(?:set|change|switch|use)\s+currency\s*(?:to|=|:)?\s*([A-Z]{3})/i,
      /currency\s*(?:is|=|:)\s*([A-Z]{3})/i,
      /(?:in|to|use)\s+(USD|EUR|GBP|INR|CAD|AUD|JPY|CNY|CHF|SGD|BRL|MXN|AED)/i,
    ],
    keywords: ['currency', 'change currency', 'set currency'],
  },
  {
    name: 'SET_SENDER',
    priority: 60,
    patterns: [
      /(?:set|change|update|edit)\s+(?:my|sender|from)\s+(?:name|details?)/i,
      /(?:my|sender|from)\s+name\s*(?:is|=|:)\s*(.+)/i,
      /(?:my|sender|from)\s+email\s*(?:is|=|:)\s*(.+)/i,
      /(?:my|sender|from)\s+address\s*(?:is|=|:)\s*(.+)/i,
      /(?:my|sender|from)\s+phone\s*(?:is|=|:)\s*(.+)/i,
      /(?:i\s+am|i'm)\s+(.+)/i,
    ],
    keywords: ['sender', 'my name', 'my email', 'my address', 'my phone', 'from name', 'from email', 'from details'],
  },
  {
    name: 'SET_RECIPIENT',
    priority: 59,
    patterns: [
      /(?:set|change|update|edit)\s+(?:client|recipient|customer|bill\s*to|to)\s+(?:name|details?)/i,
      /(?:client|recipient|customer|bill\s*to|to)\s+name\s*(?:is|=|:)\s*(.+)/i,
      /(?:client|recipient|customer|bill\s*to|to)\s+email\s*(?:is|=|:)\s*(.+)/i,
      /(?:client|recipient|customer|bill\s*to|to)\s+address\s*(?:is|=|:)\s*(.+)/i,
      /(?:client|recipient|customer|bill\s*to|to)\s+phone\s*(?:is|=|:)\s*(.+)/i,
      /(?:bill|invoice|send)\s+(?:to|for)\s+(.+)/i,
    ],
    keywords: [
      'client name', 'client email', 'client address', 'client phone',
      'recipient', 'customer', 'bill to', 'send to', 'invoice to',
      'client details', 'recipient details',
    ],
  },
  {
    name: 'ADD_NOTES',
    priority: 55,
    patterns: [
      /(?:set|add|change|update)\s+notes?\s*(?:to|=|:)?\s*(.+)/i,
      /notes?\s*(?:is|=|:)\s*(.+)/i,
    ],
    keywords: ['add note', 'set note', 'change note', 'add notes', 'set notes'],
  },
  {
    name: 'SET_DUE_DATE',
    priority: 54,
    patterns: [
      /(?:set|change|update)\s+(?:due\s*date|deadline)\s*(?:to|=|:)?\s*(.+)/i,
      /(?:due\s*date|deadline)\s*(?:is|=|:)\s*(.+)/i,
      /due\s+(?:on|by)\s+(.+)/i,
    ],
    keywords: ['due date', 'deadline', 'set due', 'change due'],
  },
  {
    name: 'SET_INVOICE_NUMBER',
    priority: 53,
    patterns: [
      /(?:set|change|update)\s+invoice\s*(?:number|no|#)\s*(?:to|=|:)?\s*(.+)/i,
      /invoice\s*(?:number|no|#)\s*(?:is|=|:)\s*(.+)/i,
    ],
    keywords: ['invoice number', 'set number', 'invoice no'],
  },
  {
    name: 'SET_SHIPPING',
    priority: 56,
    patterns: [
      /(?:set|change|update|add)\s+shipping\s*(?:cost|fee|charge)?\s*(?:to|=|:)?\s*\$?\s*(\d+(?:\.\d+)?)/i,
      /shipping\s*(?:cost|fee|charge)?\s*(?:is|=|:)\s*\$?\s*(\d+(?:\.\d+)?)/i,
      /\$?\s*(\d+(?:\.\d+)?)\s*(?:for\s+)?shipping/i,
    ],
    keywords: ['shipping', 'delivery', 'shipping cost', 'shipping fee'],
  },
  {
    name: 'SHOW_SUMMARY',
    priority: 50,
    patterns: [
      /^(show|view|display|preview)\s*(summary|invoice|details|total)/i,
      /^summary$/i,
      /^review$/i,
    ],
    keywords: ['summary', 'review', 'show invoice', 'preview'],
  },
  {
    name: 'SAVE_DRAFT',
    priority: 95,
    patterns: [/^save$/i, /save\s*(draft|invoice|it)/i],
    keywords: ['save', 'save draft'],
  },
  {
    name: 'GENERATE_PDF',
    priority: 95,
    patterns: [/^generate$/i, /generate\s*(pdf|invoice)/i, /^(create|make)\s+pdf/i, /download\s*(pdf)?/i],
    keywords: ['generate', 'generate pdf', 'create pdf', 'download pdf', 'make pdf'],
  },
];

// ─── Intent Detection Engine ──────────────────────────────────────────────────

const detectIntent = (message) => {
  const msg = message.trim();
  const lower = msg.toLowerCase();

  // Sort intents by priority (highest first)
  const sorted = [...INTENTS].sort((a, b) => b.priority - a.priority);

  for (const intent of sorted) {
    // 1. Check regex patterns — capture groups returned as `matches`
    for (const pattern of intent.patterns) {
      const match = msg.match(pattern);
      if (match) {
        return {
          intent: intent.name,
          matches: match,
          raw: msg,
          confidence: 'pattern',
        };
      }
    }

    // 2. Check keywords (substring match on lowercase)
    for (const kw of intent.keywords) {
      if (lower.includes(kw)) {
        return {
          intent: intent.name,
          matches: null,
          raw: msg,
          confidence: 'keyword',
        };
      }
    }
  }

  return { intent: 'UNKNOWN', matches: null, raw: msg, confidence: 'none' };
};

// ─── Action Handlers ──────────────────────────────────────────────────────────
//
// Each handler receives (state, detection) and returns { state, response }.
// All state updates are immutable — spread into new objects.

const handlers = {
  GREETING: (state) => ({
    state,
    response:
      "👋 Hello! I'm your **Invoice Assistant**. I can help you build an invoice step by step.\n\n" +
      "You can say things like:\n" +
      "• `Add item Web Design, 10, 150`\n" +
      "• `Set tax to 18%`\n" +
      "• `Client name is Acme Corp`\n" +
      "• `Change currency to EUR`\n" +
      "• `Add notes: Payment due in 30 days`\n\n" +
      "Type **help** anytime to see all commands.",
  }),

  HELP: (state) => ({
    state,
    response:
      "📖 **Available Commands**\n\n" +
      "**Items**\n" +
      "• `Add item <name>, <qty>, <price>` — add a line item\n" +
      "• `Remove item #<n>` — remove item by number\n" +
      "• `Update item #<n> qty <x>` or `price <x>` — edit an item\n\n" +
      "**Financials**\n" +
      "• `Set tax to <x>%` — set tax rate\n" +
      "• `Set discount to <x>%` — set discount\n" +
      "• `Change currency to <CODE>` — e.g. EUR, GBP, INR\n\n" +
      "**Details**\n" +
      "• `My name is <name>` — set sender name\n" +
      "• `My email is <email>` — set sender email\n" +
      "• `Client name is <name>` — set recipient\n" +
      "• `Client email is <email>` — set recipient email\n" +
      "• `Add notes: <text>` — add invoice notes\n" +
      "• `Due date: YYYY-MM-DD` — set due date\n" +
      "• `Invoice number: INV-001` — set invoice number\n\n" +
      "**Actions**\n" +
      "• `Summary` — show invoice summary\n" +
      "• `Save` — save as draft\n" +
      "• `Generate PDF` — save and generate PDF\n\n" +
      `Supported currencies: ${Object.keys(CURRENCIES).join(', ')}`,
  }),

  ADD_ITEM: (state, { matches, raw }) => {
    // Try to parse direct format: "Item name, qty, price"
    const directMatch = raw.match(/^(.+?),\s*(\d+(?:\.\d+)?)\s*,\s*(\d+(?:\.\d+)?)\s*(?:,\s*(.+))?$/);
    // Or: "add item <name>, <qty>, <price>"
    const commandMatch = raw.match(
      /add\s+(?:an?\s+)?(?:item|line\s*item|product|service)\s*:?\s*(.+?),\s*(\d+(?:\.\d+)?)\s*,\s*(\d+(?:\.\d+)?)\s*(?:,\s*(.+))?$/i
    );
    // Or: "add item <name>" (no price, ask for details)
    const nameOnlyMatch = raw.match(
      /add\s+(?:an?\s+)?(?:item|line\s*item|product|service)\s*:?\s*(.+)/i
    );

    // Prefer commandMatch (strips "add item" prefix) over directMatch
    const parsed = commandMatch || directMatch;

    if (parsed) {
      const newItem = {
        name: parsed[1].trim(),
        quantity: parseFloat(parsed[2]) || 1,
        unit_cost: parseFloat(parsed[3]) || 0,
        description: parsed[4]?.trim() || '',
      };

      const newState = {
        ...state,
        items: [...state.items, newItem],
      };

      const idx = newState.items.length;
      const lineTotal = newItem.quantity * newItem.unit_cost;
      const sym = currencySymbol(state.currency);

      return {
        state: newState,
        response:
          `✅ **Item #${idx} added!**\n\n` +
          `• **${newItem.name}** — ${newItem.quantity} × ${sym}${newItem.unit_cost.toFixed(2)} = ${sym}${lineTotal.toFixed(2)}\n\n` +
          `You now have **${idx} item(s)**. Add more items or type **summary** to review.`,
      };
    }

    if (nameOnlyMatch) {
      return {
        state,
        response:
          `Please provide the full item details in this format:\n` +
          `\`${nameOnlyMatch[1].trim()}, <quantity>, <unit price>\`\n\n` +
          `Example: \`${nameOnlyMatch[1].trim()}, 5, 100\``,
      };
    }

    return {
      state,
      response:
        "Please add an item using this format:\n" +
        "`Add item <name>, <quantity>, <unit price>`\n\n" +
        "Example: `Add item Web Development, 10, 150`",
    };
  },

  REMOVE_ITEM: (state, { matches, raw }) => {
    // Try number-based removal: "remove item #2"
    const numMatch = raw.match(/(?:remove|delete)\s+(?:item|line|product|service)\s*#?\s*(\d+)/i);

    if (numMatch) {
      const idx = parseInt(numMatch[1], 10) - 1; // 1-indexed to 0-indexed
      if (idx < 0 || idx >= state.items.length) {
        return {
          state,
          response: `❌ Item #${idx + 1} doesn't exist. You have **${state.items.length}** item(s). Use \`summary\` to see them.`,
        };
      }

      const removed = state.items[idx];
      const newItems = state.items.filter((_, i) => i !== idx);

      return {
        state: { ...state, items: newItems },
        response:
          `🗑️ Removed **${removed.name}** (was item #${idx + 1}).\n\n` +
          `${newItems.length} item(s) remaining.`,
      };
    }

    // Try name-based removal: "remove Web Design"
    const nameMatch = raw.match(/(?:remove|delete)\s+(.+)/i);
    if (nameMatch) {
      const target = nameMatch[1].trim().toLowerCase();
      const idx = state.items.findIndex((i) => i.name.toLowerCase().includes(target));

      if (idx === -1) {
        return {
          state,
          response: `❌ No item matching **"${nameMatch[1].trim()}"** found. Type \`summary\` to see all items.`,
        };
      }

      const removed = state.items[idx];
      const newItems = state.items.filter((_, i) => i !== idx);

      return {
        state: { ...state, items: newItems },
        response: `🗑️ Removed **${removed.name}**.\n\n${newItems.length} item(s) remaining.`,
      };
    }

    return {
      state,
      response: "Please specify which item to remove:\n`Remove item #1` or `Remove Web Design`",
    };
  },

  UPDATE_ITEM: (state, { raw }) => {
    const match = raw.match(
      /(?:update|change|edit|set)\s+(?:item|line)\s*#?\s*(\d+)\s+(.+)/i
    );

    if (!match) {
      return {
        state,
        response:
          "Please specify which item and what to update:\n" +
          "`Update item #1 qty 5`\n" +
          "`Update item #1 price 200`\n" +
          "`Update item #1 name New Name`",
      };
    }

    const idx = parseInt(match[1], 10) - 1;
    if (idx < 0 || idx >= state.items.length) {
      return {
        state,
        response: `❌ Item #${idx + 1} doesn't exist. You have **${state.items.length}** item(s).`,
      };
    }

    const updateStr = match[2].trim();
    const oldItem = state.items[idx];
    let updatedItem = { ...oldItem };
    const changes = [];

    // Parse qty/quantity
    const qtyMatch = updateStr.match(/(?:qty|quantity)\s*(?:to|=|:)?\s*(\d+(?:\.\d+)?)/i);
    if (qtyMatch) {
      updatedItem.quantity = parseFloat(qtyMatch[1]);
      changes.push(`quantity → ${updatedItem.quantity}`);
    }

    // Parse price/cost
    const priceMatch = updateStr.match(/(?:price|cost|rate|unit_cost)\s*(?:to|=|:)?\s*(\d+(?:\.\d+)?)/i);
    if (priceMatch) {
      updatedItem.unit_cost = parseFloat(priceMatch[1]);
      changes.push(`price → ${currencySymbol(state.currency)}${updatedItem.unit_cost.toFixed(2)}`);
    }

    // Parse name
    const nameMatch = updateStr.match(/(?:name)\s*(?:to|=|:)\s*(.+)/i);
    if (nameMatch) {
      updatedItem.name = nameMatch[1].trim();
      changes.push(`name → ${updatedItem.name}`);
    }

    if (changes.length === 0) {
      return {
        state,
        response:
          `Please specify what to update for item #${idx + 1} (**${oldItem.name}**):\n` +
          "`qty 5`, `price 200`, or `name New Name`",
      };
    }

    const newItems = state.items.map((item, i) => (i === idx ? updatedItem : item));

    return {
      state: { ...state, items: newItems },
      response:
        `✏️ Updated **item #${idx + 1}** (${updatedItem.name}):\n` +
        changes.map((c) => `• ${c}`).join('\n'),
    };
  },

  SET_TAX: (state, { raw }) => {
    const match = raw.match(/(\d+(?:\.\d+)?)/);
    if (!match) {
      return {
        state,
        response: "Please specify the tax rate:\n`Set tax to 18%`",
      };
    }

    const rate = parseFloat(match[1]);
    const newState = { ...state, taxRate: rate };
    const recalc = recalculateTotals(newState);

    return {
      state: newState,
      response:
        `💰 Tax rate set to **${rate}%**.\n\n` +
        `Subtotal: ${formatMoney(recalc._computed.subtotal, state.currency)}\n` +
        `Tax: +${formatMoney(recalc._computed.taxAmount, state.currency)}\n` +
        `**Total: ${formatMoney(recalc._computed.total, state.currency)}**`,
    };
  },

  SET_DISCOUNT: (state, { raw }) => {
    const match = raw.match(/(\d+(?:\.\d+)?)/);
    if (!match) {
      return {
        state,
        response: "Please specify the discount rate:\n`Set discount to 10%`",
      };
    }

    const rate = parseFloat(match[1]);
    const newState = { ...state, discountRate: rate };
    const recalc = recalculateTotals(newState);

    return {
      state: newState,
      response:
        `🏷️ Discount set to **${rate}%**.\n\n` +
        `Subtotal: ${formatMoney(recalc._computed.subtotal, state.currency)}\n` +
        `Discount: -${formatMoney(recalc._computed.discountAmount, state.currency)}\n` +
        `**Total: ${formatMoney(recalc._computed.total, state.currency)}**`,
    };
  },

  SET_CURRENCY: (state, { raw }) => {
    const match = raw.match(/([A-Z]{3})/i);
    if (!match) {
      return {
        state,
        response: `Please specify a currency code:\n\`Change currency to EUR\`\n\nSupported: ${Object.keys(CURRENCIES).join(', ')}`,
      };
    }

    const code = match[1].toUpperCase();
    if (!CURRENCIES[code]) {
      return {
        state,
        response: `❌ **${code}** is not supported.\n\nSupported currencies: ${Object.keys(CURRENCIES).join(', ')}`,
      };
    }

    const oldCode = state.currency;
    const newState = { ...state, currency: code };

    return {
      state: newState,
      response:
        `💱 Currency changed from **${oldCode}** (${CURRENCIES[oldCode]?.name || oldCode}) to **${code}** (${CURRENCIES[code].name}).\n\n` +
        `All amounts now displayed in ${CURRENCIES[code].symbol}.`,
    };
  },

  SET_SENDER: (state, { raw }) => {
    const newFrom = { ...state.from };
    const changes = [];

    const nameMatch = raw.match(
      /(?:(?:my|sender|from)\s+name\s*(?:is|=|:)\s*|i\s+am\s+|i'm\s+)(.+)/i
    );
    if (nameMatch) {
      newFrom.name = nameMatch[1].trim();
      changes.push(`Name: **${newFrom.name}**`);
    }

    const emailMatch = raw.match(
      /(?:my|sender|from)\s+email\s*(?:is|=|:)\s*(\S+)/i
    );
    if (emailMatch) {
      newFrom.email = emailMatch[1].trim();
      changes.push(`Email: **${newFrom.email}**`);
    }

    const addressMatch = raw.match(
      /(?:my|sender|from)\s+address\s*(?:is|=|:)\s*(.+)/i
    );
    if (addressMatch) {
      newFrom.address = addressMatch[1].trim();
      changes.push(`Address: **${newFrom.address}**`);
    }

    const phoneMatch = raw.match(
      /(?:my|sender|from)\s+phone\s*(?:is|=|:)\s*(\S+)/i
    );
    if (phoneMatch) {
      newFrom.phone = phoneMatch[1].trim();
      changes.push(`Phone: **${newFrom.phone}**`);
    }

    if (changes.length === 0) {
      return {
        state,
        response:
          "Please set sender details using:\n" +
          "• `My name is <name>`\n" +
          "• `My email is <email>`\n" +
          "• `My address is <address>`\n" +
          "• `My phone is <phone>`",
      };
    }

    return {
      state: { ...state, from: newFrom },
      response:
        `📝 **Sender updated:**\n${changes.join('\n')}\n\n` +
        `Current sender: ${newFrom.name || '—'} (${newFrom.email || '—'})`,
    };
  },

  SET_RECIPIENT: (state, { raw }) => {
    const newTo = { ...state.to };
    const changes = [];

    const nameMatch = raw.match(
      /(?:(?:client|recipient|customer|bill\s*to|to)\s+name\s*(?:is|=|:)\s*|(?:bill|invoice|send)\s+(?:to|for)\s+)(.+)/i
    );
    if (nameMatch) {
      newTo.name = nameMatch[1].trim();
      changes.push(`Name: **${newTo.name}**`);
    }

    const emailMatch = raw.match(
      /(?:client|recipient|customer|bill\s*to|to)\s+email\s*(?:is|=|:)\s*(\S+)/i
    );
    if (emailMatch) {
      newTo.email = emailMatch[1].trim();
      changes.push(`Email: **${newTo.email}**`);
    }

    const addressMatch = raw.match(
      /(?:client|recipient|customer|bill\s*to|to)\s+address\s*(?:is|=|:)\s*(.+)/i
    );
    if (addressMatch) {
      newTo.address = addressMatch[1].trim();
      changes.push(`Address: **${newTo.address}**`);
    }

    const phoneMatch = raw.match(
      /(?:client|recipient|customer|bill\s*to|to)\s+phone\s*(?:is|=|:)\s*(\S+)/i
    );
    if (phoneMatch) {
      newTo.phone = phoneMatch[1].trim();
      changes.push(`Phone: **${newTo.phone}**`);
    }

    if (changes.length === 0) {
      return {
        state,
        response:
          "Please set recipient details using:\n" +
          "• `Client name is <name>`\n" +
          "• `Client email is <email>`\n" +
          "• `Client address is <address>`\n" +
          "• `Client phone is <phone>`\n" +
          "• Or: `Bill to <company name>`",
      };
    }

    return {
      state: { ...state, to: newTo },
      response:
        `📝 **Recipient updated:**\n${changes.join('\n')}\n\n` +
        `Current recipient: ${newTo.name || '—'} (${newTo.email || '—'})`,
    };
  },

  ADD_NOTES: (state, { raw }) => {
    const match = raw.match(
      /(?:(?:set|add|change|update)\s+notes?\s*(?:to|=|:)?\s*|notes?\s*(?:is|=|:)\s*)(.+)/i
    );

    if (!match) {
      return {
        state,
        response: "Please provide the notes:\n`Add notes: Payment due in 30 days`",
      };
    }

    const notes = match[1].trim();
    return {
      state: { ...state, notes },
      response: `📝 Notes updated:\n> ${notes}`,
    };
  },

  SET_DUE_DATE: (state, { raw }) => {
    const match = raw.match(
      /(?:(?:set|change|update)\s+(?:due\s*date|deadline)\s*(?:to|=|:)?\s*|(?:due\s*date|deadline)\s*(?:is|=|:)\s*|due\s+(?:on|by)\s+)(.+)/i
    );

    if (!match) {
      return {
        state,
        response: "Please specify the due date:\n`Set due date to 2025-04-15`",
      };
    }

    const dateStr = match[1].trim();
    const date = new Date(dateStr);

    if (isNaN(date.getTime())) {
      return {
        state,
        response: `❌ Could not parse **"${dateStr}"** as a date.\n\nPlease use a format like: \`2025-04-15\` or \`April 15, 2025\``,
      };
    }

    return {
      state: { ...state, dueDate: date.toISOString() },
      response: `📅 Due date set to **${date.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}**.`,
    };
  },

  SET_INVOICE_NUMBER: (state, { raw }) => {
    const match = raw.match(
      /(?:(?:set|change|update)\s+invoice\s*(?:number|no|#)\s*(?:to|=|:)?\s*|invoice\s*(?:number|no|#)\s*(?:is|=|:)\s*)(.+)/i
    );

    if (!match) {
      return {
        state,
        response: "Please specify the invoice number:\n`Set invoice number to INV-001`",
      };
    }

    const num = match[1].trim();
    return {
      state: { ...state, invoiceNumber: num },
      response: `🔢 Invoice number set to **#${num}**.`,
    };
  },

  SET_SHIPPING: (state, { raw }) => {
    const match = raw.match(/(\d+(?:\.\d+)?)/);
    if (!match) {
      return {
        state,
        response: "Please specify the shipping cost:\n`Set shipping to 25`",
      };
    }

    const amount = parseFloat(match[1]);
    const newState = { ...state, shipping: amount };
    const recalc = recalculateTotals(newState);

    return {
      state: newState,
      response:
        `🚚 Shipping set to **${formatMoney(amount, state.currency)}**.\n\n` +
        `Subtotal: ${formatMoney(recalc._computed.subtotal, state.currency)}\n` +
        `Shipping: +${formatMoney(amount, state.currency)}\n` +
        `**Total: ${formatMoney(recalc._computed.total, state.currency)}**`,
    };
  },

  SHOW_SUMMARY: (state) => {
    return { state, response: buildSummary(state) };
  },

  SAVE_DRAFT: (state) => ({
    state,
    response: '__ACTION:SAVE_DRAFT__',
    action: 'save',
  }),

  GENERATE_PDF: (state) => ({
    state,
    response: '__ACTION:GENERATE_PDF__',
    action: 'generate',
  }),

  UNKNOWN: (state, { raw }) => {
    // Try to parse as a direct item (name, qty, price)
    const directItem = raw.match(/^(.+?),\s*(\d+(?:\.\d+)?)\s*,\s*(\d+(?:\.\d+)?)/);
    if (directItem) {
      return handlers.ADD_ITEM(state, { matches: directItem, raw });
    }

    return {
      state,
      response:
        "🤔 I didn't quite understand that. Here are some things you can do:\n\n" +
        "• `Add item <name>, <qty>, <price>` — add a line item\n" +
        "• `Set tax to 18%` — set tax rate\n" +
        "• `Client name is Acme Corp` — set recipient\n" +
        "• `Change currency to EUR` — change currency\n" +
        "• `Summary` — view current invoice\n\n" +
        "Type **help** for all available commands.",
    };
  },
};

// ─── Summary Builder ──────────────────────────────────────────────────────────

const buildSummary = (state) => {
  const recalc = recalculateTotals(state);
  const { subtotal, taxAmount, discountAmount, total } = recalc._computed;
  const sym = currencySymbol(state.currency);

  let summary = '📋 **Invoice Summary**\n\n';

  // Sender
  summary += `**From:** ${state.from?.name || '—'}`;
  if (state.from?.email) summary += ` (${state.from.email})`;
  summary += '\n';

  // Recipient
  summary += `**To:** ${state.to?.name || '—'}`;
  if (state.to?.email) summary += ` (${state.to.email})`;
  summary += '\n';

  // Number & dates
  if (state.invoiceNumber) summary += `**Invoice #:** ${state.invoiceNumber}\n`;
  if (state.dueDate) {
    summary += `**Due:** ${new Date(state.dueDate).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}\n`;
  }

  summary += `**Currency:** ${state.currency} (${CURRENCIES[state.currency]?.name || state.currency})\n`;

  // Items
  if (state.items.length > 0) {
    summary += '\n**Items:**\n';
    state.items.forEach((item, i) => {
      const lineTotal = item.quantity * item.unit_cost;
      summary += `${i + 1}. **${item.name}** — ${item.quantity} × ${sym}${item.unit_cost.toFixed(2)} = ${sym}${lineTotal.toFixed(2)}\n`;
    });
  } else {
    summary += '\n*No items added yet.*\n';
  }

  // Totals
  summary += `\n───────────────────────\n`;
  summary += `**Subtotal:** ${sym}${subtotal.toFixed(2)}\n`;
  if (state.taxRate > 0)
    summary += `**Tax (${state.taxRate}%):** +${sym}${taxAmount.toFixed(2)}\n`;
  if (state.discountRate > 0)
    summary += `**Discount (${state.discountRate}%):** -${sym}${discountAmount.toFixed(2)}\n`;
  if (state.shipping > 0)
    summary += `**Shipping:** +${sym}${state.shipping.toFixed(2)}\n`;
  summary += `**Total: ${sym}${total.toFixed(2)}**\n`;

  // Notes
  if (state.notes) summary += `\n**Notes:** ${state.notes}\n`;

  summary +=
    "\n\nType **save** to save as draft, **generate** for PDF, or keep editing.";

  return summary;
};

// ─── Main Process Function ────────────────────────────────────────────────────

/**
 * Process a user message through the engine.
 *
 * @param {string} message - Raw user message
 * @param {object} currentState - Current invoice state (immutable input)
 * @returns {{ state: object, response: string, intent: string, action?: string }}
 */
const processMessage = (message, currentState = null) => {
  // Initialize state if needed (immutable — never mutate input)
  const state = currentState
    ? { ...createDefaultState(), ...currentState }
    : createDefaultState();

  // 1. Detect intent
  const detection = detectIntent(message);

  // 2. Run handler
  const handler = handlers[detection.intent] || handlers.UNKNOWN;
  const result = handler(state, detection);

  // 3. Recalculate totals on the new state
  const finalState = recalculateTotals(result.state);

  return {
    state: finalState,
    response: result.response,
    intent: detection.intent,
    confidence: detection.confidence,
    action: result.action || null,
  };
};

// ─── Exports ──────────────────────────────────────────────────────────────────

module.exports = {
  processMessage,
  detectIntent,
  recalculateTotals,
  createDefaultState,
  buildSummary,
  CURRENCIES,
  INTENTS,
};
