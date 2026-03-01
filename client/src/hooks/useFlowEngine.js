import { useCallback } from 'react';
import { toast } from 'sonner';
import useInvoiceStore from '@/stores/useInvoiceStore';
import useChatStore from '@/stores/useChatStore';

// ─── Supported Currencies ─────────────────────────────────────────────────────

const CURRENCIES = ['USD', 'EUR', 'GBP', 'INR', 'JPY', 'CAD', 'AUD', 'CNY', 'CHF', 'SGD', 'BRL', 'MXN', 'AED'];

// ─── Validators ───────────────────────────────────────────────────────────────

const nonEmpty = (v) => v.trim().length > 0 ? null : 'This field cannot be empty.';

const emailValidator = (v) => {
    const trimmed = v.trim();
    if (!trimmed) return 'Email cannot be empty.';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) return 'Please enter a valid email (e.g. name@example.com).';
    return null;
};

const currencyValidator = (v) => {
    const upper = v.trim().toUpperCase();
    if (!CURRENCIES.includes(upper)) return `Invalid currency. Choose from: ${CURRENCIES.join(', ')}`;
    return null;
};

const positiveInt = (v) => {
    const n = parseInt(v.trim(), 10);
    if (isNaN(n) || n <= 0) return 'Please enter a positive whole number.';
    return null;
};

const positiveNumber = (v) => {
    const n = parseFloat(v.trim());
    if (isNaN(n) || n <= 0) return 'Please enter a positive number.';
    return null;
};

const alwaysValid = () => null;

const taxValidator = (v) => {
    const n = parseFloat(v.trim().replace('%', ''));
    if (isNaN(n) || n < 0 || n > 100) return 'Tax must be between 0 and 100.';
    return null;
};

const discountValidator = (v) => {
    const cleaned = v.trim().replace('%', '');
    const n = parseFloat(cleaned);
    if (isNaN(n) || n < 0) return 'Discount must be a non-negative number.';
    return null;
};

const nonNegativeNumber = (v) => {
    const n = parseFloat(v.trim());
    if (isNaN(n) || n < 0) return 'Please enter 0 or a positive number.';
    return null;
};

const dateValidator = (v) => {
    const trimmed = v.trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return 'Please use YYYY-MM-DD format (e.g. 2025-12-31).';
    const d = new Date(trimmed);
    if (isNaN(d.getTime())) return 'Invalid date.';
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (d < today) return 'Due date must be today or in the future.';
    return null;
};

const yesNoValidator = (v) => {
    const lower = v.trim().toLowerCase();
    if (!['yes', 'no', 'y', 'n'].includes(lower)) return 'Please answer **yes** or **no**.';
    return null;
};

// ─── Step Definitions ─────────────────────────────────────────────────────────

const STEPS = [
    {
        id: 'company_name',
        question: "Let's start building your invoice! 🧾\n\nWhat is your **company name**?",
        validate: nonEmpty,
        apply: (val, store) => {
            const d = store.invoiceData;
            store.setInvoiceData({ from: { ...d.from, name: val.trim() } });
        },
        chips: [],
        editAliases: ['company name', 'company', 'from name'],
    },
    {
        id: 'company_address',
        question: 'What is your **company address**?',
        validate: nonEmpty,
        apply: (val, store) => {
            const d = store.invoiceData;
            store.setInvoiceData({ from: { ...d.from, address: val.trim() } });
        },
        chips: [],
        editAliases: ['company address', 'from address'],
    },
    {
        id: 'customer_name',
        question: 'Who is this invoice for? Enter the **customer name**.',
        validate: nonEmpty,
        apply: (val, store) => {
            const d = store.invoiceData;
            store.setInvoiceData({ to: { ...d.to, name: val.trim() } });
        },
        chips: [],
        editAliases: ['customer name', 'client name', 'customer', 'client', 'to name'],
    },
    {
        id: 'customer_address',
        question: "What is the **customer's address**?",
        validate: nonEmpty,
        apply: (val, store) => {
            const d = store.invoiceData;
            store.setInvoiceData({ to: { ...d.to, address: val.trim() } });
        },
        chips: [],
        editAliases: ['customer address', 'client address', 'to address'],
    },
    {
        id: 'customer_email',
        question: "What is the **customer's email**? (for sending the invoice)",
        validate: emailValidator,
        apply: (val, store) => {
            const d = store.invoiceData;
            store.setInvoiceData({ to: { ...d.to, email: val.trim() } });
        },
        chips: [],
        editAliases: ['customer email', 'client email', 'email', 'to email'],
    },
    {
        id: 'currency',
        question: 'Which **currency** should be used?\n\nSupported: `USD`, `EUR`, `GBP`, `INR`, `JPY`, `CAD`, `AUD`',
        validate: currencyValidator,
        apply: (val, store) => {
            store.setInvoiceData({ currency: val.trim().toUpperCase() });
        },
        chips: [
            { label: '🇺🇸 USD', value: 'USD' },
            { label: '🇪🇺 EUR', value: 'EUR' },
            { label: '🇬🇧 GBP', value: 'GBP' },
            { label: '🇮🇳 INR', value: 'INR' },
            { label: '🇯🇵 JPY', value: 'JPY' },
        ],
        editAliases: ['currency'],
    },
    {
        id: 'item_name',
        question: "Now let's add an item. What is the **item name**?",
        validate: nonEmpty,
        apply: () => {}, // stored in pendingItem
        chips: [],
        editAliases: ['item name', 'item'],
    },
    {
        id: 'item_qty',
        question: 'How many units? (**quantity**)',
        validate: positiveInt,
        apply: () => {},
        chips: [
            { label: '1', value: '1' },
            { label: '5', value: '5' },
            { label: '10', value: '10' },
        ],
        editAliases: ['item quantity', 'quantity', 'qty'],
    },
    {
        id: 'item_price',
        question: 'What is the **price per unit**?',
        validate: positiveNumber,
        apply: () => {},
        chips: [],
        editAliases: ['item price', 'price', 'unit cost'],
    },
    {
        id: 'item_desc',
        question: 'Any **description** for this item? (type `skip` to skip)',
        validate: alwaysValid,
        apply: () => {},
        chips: [{ label: 'Skip', value: 'skip' }],
        editAliases: ['item description', 'description'],
    },
    {
        id: 'add_more_items',
        question: 'Item added! ✅ Would you like to **add another item**? (yes/no)',
        validate: yesNoValidator,
        apply: () => {}, // handled specially
        chips: [
            { label: '✅ Yes', value: 'yes' },
            { label: '❌ No', value: 'no' },
        ],
        editAliases: ['add item', 'more items'],
    },
    {
        id: 'tax',
        question: 'What **tax percentage** should be applied? (0–100)',
        validate: taxValidator,
        apply: (val, store) => {
            store.setInvoiceData({ taxRate: parseFloat(val.replace('%', '')) });
        },
        chips: [
            { label: '0%', value: '0' },
            { label: '5%', value: '5' },
            { label: '10%', value: '10' },
            { label: '18%', value: '18' },
        ],
        editAliases: ['tax', 'tax rate', 'tax percentage'],
    },
    {
        id: 'discount',
        question: 'Any **discount**? Enter percentage (e.g. `10`) or `0` for none.',
        validate: discountValidator,
        apply: (val, store) => {
            store.setInvoiceData({ discountRate: parseFloat(val.replace('%', '')) });
        },
        chips: [
            { label: '0%', value: '0' },
            { label: '5%', value: '5' },
            { label: '10%', value: '10' },
        ],
        editAliases: ['discount'],
    },
    {
        id: 'shipping',
        question: '**Shipping cost**? (enter `0` if none)',
        validate: nonNegativeNumber,
        apply: (val, store) => {
            store.setInvoiceData({ shipping: parseFloat(val) });
        },
        chips: [{ label: '0 (None)', value: '0' }],
        editAliases: ['shipping', 'shipping cost'],
    },
    {
        id: 'due_date',
        question: '**Payment due date**? (format: `YYYY-MM-DD`)',
        validate: dateValidator,
        apply: (val, store) => {
            store.setInvoiceData({ dueDate: val.trim() });
        },
        chips: [],
        editAliases: ['due date', 'payment date', 'date'],
    },
    {
        id: 'complete',
        question: '🎉 **Invoice complete!** Here\'s a summary of your invoice.\n\nYou can:\n• Type `save` to save the invoice\n• Type `edit [section]` to modify any field\n• Check the **preview panel** on the right',
        validate: alwaysValid,
        apply: () => {},
        chips: [
            { label: '💾 Save Invoice', value: 'save invoice' },
            { label: '📄 View Summary', value: 'summary' },
        ],
        editAliases: [],
    },
];

// ─── Edit Command Parser ──────────────────────────────────────────────────────

function findEditStep(text) {
    const lower = text.toLowerCase().replace(/^edit\s+/, '').trim();
    for (let i = 0; i < STEPS.length; i++) {
        const step = STEPS[i];
        if (step.editAliases.some((alias) => lower === alias || lower.includes(alias))) {
            return i;
        }
    }
    return -1;
}

// ─── Build Summary ────────────────────────────────────────────────────────────

function buildSummary(data) {
    const items = (data.items || [])
        .map((it, i) => `  ${i + 1}. **${it.name}** — ${it.quantity} × ${it.unit_cost} ${it.description ? `(${it.description})` : ''}`)
        .join('\n');

    return (
        `**From:** ${data.from?.name || '—'}\n` +
        `**Address:** ${data.from?.address || '—'}\n\n` +
        `**To:** ${data.to?.name || '—'}\n` +
        `**Address:** ${data.to?.address || '—'}\n` +
        `**Email:** ${data.to?.email || '—'}\n\n` +
        `**Currency:** ${data.currency}\n\n` +
        `**Items:**\n${items || '  (none)'}\n\n` +
        `**Tax:** ${data.taxRate}%\n` +
        `**Discount:** ${data.discountRate}%\n` +
        `**Shipping:** ${data.shipping}\n` +
        `**Due Date:** ${data.dueDate || '—'}`
    );
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export default function useFlowEngine() {
    const invoiceStore = useInvoiceStore();
    const chatStore = useChatStore();

    const { currentStep, pendingItem } = chatStore;

    const getCurrentStep = useCallback(() => {
        return STEPS[currentStep] || STEPS[STEPS.length - 1];
    }, [currentStep]);

    const getContextChips = useCallback(() => {
        const step = STEPS[currentStep];
        return step?.chips || [];
    }, [currentStep]);

    const processInput = useCallback((text) => {
        const trimmed = text.trim();

        // ── Handle "edit" command ─────────────────────────────────────────
        if (/^edit\s+/i.test(trimmed)) {
            const targetStep = findEditStep(trimmed);
            if (targetStep === -1) {
                const sections = STEPS
                    .filter((s) => s.editAliases.length > 0)
                    .map((s) => `\`${s.editAliases[0]}\``)
                    .join(', ');
                return {
                    botMessage: `❓ I couldn't find that section. You can edit: ${sections}`,
                    valid: false,
                };
            }
            
            // Ensure furthestStep is saved before jumping back
            if (currentStep > chatStore.furthestStep) {
                chatStore.setFurthestStep(currentStep);
            }
            
            chatStore.setCurrentStep(targetStep);
            const step = STEPS[targetStep];
            return {
                botMessage: `✏️ Editing **${step.editAliases[0]}**.\n\n${step.question}`,
                valid: true,
                jumped: true,
            };
        }

        // ── Handle "delete item" / "remove item" command ──────────────────
        const deleteMatch = /^((delete|remove)\s+(item\s+)?)?(.+)$/i.exec(trimmed);
        if (/^(delete|remove)\s+/i.test(trimmed) && deleteMatch) {
            const targetName = deleteMatch[4].toLowerCase().trim();
            const currentItems = invoiceStore.invoiceData.items || [];
            
            // Allow deleting by exact name or index
            const itemIdx = currentItems.findIndex((it, idx) => 
                it.name.toLowerCase() === targetName || 
                (idx + 1).toString() === targetName
            );

            if (itemIdx !== -1) {
                const deletedName = currentItems[itemIdx].name;
                const newItems = [...currentItems];
                newItems.splice(itemIdx, 1);
                invoiceStore.setInvoiceData({ items: newItems });
                
                return {
                    botMessage: `🗑️ Deleted item: **${deletedName}**.\n\n${getCurrentStep().question}`,
                    valid: true,
                    jumped: true,
                };
            }
        }

        // ── Handle "summary" command ──────────────────────────────────────
        if (/^summary$/i.test(trimmed)) {
            return {
                botMessage: `📋 **Invoice Summary:**\n\n${buildSummary(invoiceStore.invoiceData)}`,
                valid: true,
                jumped: true,
            };
        }

        // ── Handle "save" command (delegate to ChatPanel) ─────────────────
        if (/^save(\s+invoice)?$/i.test(trimmed)) {
            return { botMessage: null, valid: true, saveRequested: true };
        }

        // ── Handle "generate pdf" / "pdf" command ─────────────────────────
        if (/^(generate\s+)?pdf$/i.test(trimmed)) {
            return { botMessage: null, valid: true, pdfRequested: true };
        }

        // ── Handle "email" / "send email" command ─────────────────────────
        if (/^(send\s+)?(email|invoice)$/i.test(trimmed)) {
            return { botMessage: null, valid: true, emailRequested: true };
        }

        // ── Get current step ──────────────────────────────────────────────
        const step = STEPS[currentStep];
        if (!step) {
            return { botMessage: 'Flow is complete. Type `save` or `edit [section]`.', valid: false };
        }

        // ── Validate ──────────────────────────────────────────────────────
        const error = step.validate(trimmed);
        if (error) {
            toast.error('Validation Error', { description: error });
            return {
                botMessage: `⚠️ ${error}\n\n${step.question}`,
                valid: false,
            };
        }

        // ── Apply based on step type ──────────────────────────────────────
        let nextStep = currentStep + 1;
        let extraMessage = '';

        switch (step.id) {
            case 'item_name':
                chatStore.setPendingItem({ ...pendingItem, name: trimmed });
                break;

            case 'item_qty':
                chatStore.setPendingItem({ ...pendingItem, quantity: parseInt(trimmed, 10) });
                break;

            case 'item_price':
                chatStore.setPendingItem({ ...pendingItem, unit_cost: parseFloat(trimmed) });
                break;

            case 'item_desc': {
                const desc = trimmed.toLowerCase() === 'skip' ? '' : trimmed;
                const newItem = { ...pendingItem, description: desc };
                const currentItems = invoiceStore.invoiceData.items || [];
                
                // Check if item with exact name already exists to merge them
                const existingIdx = currentItems.findIndex(
                    it => it.name.toLowerCase().trim() === newItem.name.toLowerCase().trim()
                );

                if (existingIdx !== -1) {
                    const newItems = [...currentItems];
                    const existing = newItems[existingIdx];
                    newItems[existingIdx] = {
                        ...existing,
                        quantity: existing.quantity + newItem.quantity,
                        unit_cost: newItem.unit_cost, // update to latest price
                        description: newItem.description || existing.description
                    };
                    invoiceStore.setInvoiceData({ items: newItems });
                    extraMessage = `\n\n🔄 Updated existing **${existing.name}** to ${newItems[existingIdx].quantity} units.`;
                } else {
                    invoiceStore.setInvoiceData({ items: [...currentItems, newItem] });
                    extraMessage = `\n\n📦 Added: **${newItem.name}** — ${newItem.quantity} × ${newItem.unit_cost}`;
                }
                
                chatStore.resetPendingItem();
                break;
            }

            case 'add_more_items': {
                const answer = trimmed.toLowerCase();
                if (answer === 'yes' || answer === 'y') {
                    // Jump back to item_name step
                    const itemNameIdx = STEPS.findIndex((s) => s.id === 'item_name');
                    nextStep = itemNameIdx;
                    extraMessage = "\n\nLet's add another item!";
                }
                // If 'no', nextStep naturally moves to 'tax'
                break;
            }

            default:
                // Regular apply
                step.apply(trimmed, invoiceStore);
                
                // If we edited a past step and have a furthestStep ahead of nextStep, jump back
                if (chatStore.furthestStep > nextStep) {
                    nextStep = chatStore.furthestStep;
                }
                break;
        }

        // Always update furthestStep to high-water mark
        if (nextStep > chatStore.furthestStep) {
            chatStore.setFurthestStep(nextStep);
        }

        chatStore.setCurrentStep(nextStep);

        // ── Build response ────────────────────────────────────────────────
        const nextStepDef = STEPS[nextStep];
        let botMessage;

        if (nextStepDef) {
            if (nextStepDef.id === 'complete') {
                botMessage = `✅ Got it!${extraMessage}\n\n${buildSummary(invoiceStore.invoiceData)}\n\n${nextStepDef.question}`;
            } else {
                botMessage = `✅ Got it!${extraMessage}\n\n${nextStepDef.question}`;
            }
        } else {
            botMessage = `✅ Got it!${extraMessage}\n\nFlow complete! Type \`save\` to save.`;
        }

        return { botMessage, valid: true };
    }, [currentStep, pendingItem, invoiceStore, chatStore]);

    return {
        currentStep,
        getCurrentStep,
        getContextChips,
        processInput,
        totalSteps: STEPS.length,
        isComplete: currentStep >= STEPS.length - 1,
        STEPS,
    };
}
