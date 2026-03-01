const { z } = require('zod');

// ─── Supported Currencies ─────────────────────────────────────────────────────

const SUPPORTED_CURRENCIES = [
  'USD', 'EUR', 'GBP', 'INR', 'CAD', 'AUD', 'JPY',
  'CNY', 'CHF', 'SGD', 'BRL', 'MXN', 'AED',
];

// ─── Shared Sub-Schemas ───────────────────────────────────────────────────────

const contactSchema = z.object({
  name: z.string().max(200, 'Name must be 200 characters or less').optional().default(''),
  email: z.union([
    z.string().email('Invalid email address'),
    z.literal(''),
  ]).optional().default(''),
  address: z.string().max(500, 'Address must be 500 characters or less').optional().default(''),
  phone: z.string().max(30, 'Phone must be 30 characters or less').optional().default(''),
}).optional();

const lineItemSchema = z.object({
  name: z.string().max(300, 'Item name must be 300 characters or less').optional().default(''),
  quantity: z.number().min(0, 'Quantity must be 0 or more').optional().default(1),
  unit_cost: z.number().min(0, 'Unit cost must be 0 or more').optional().default(0),
  description: z.string().max(1000, 'Description must be 1000 characters or less').optional().default(''),
});

// ─── Create Invoice Schema ────────────────────────────────────────────────────

const createInvoiceSchema = z.object({
  invoiceNumber: z.string().max(50, 'Invoice number must be 50 characters or less').optional().default(''),

  // Contact info
  from: contactSchema,
  to: contactSchema,

  // Line items
  items: z.array(lineItemSchema).max(100, 'Maximum 100 line items allowed').optional().default([]),

  // Financial
  taxRate: z.number()
    .min(0, 'Tax rate must be 0% or more')
    .max(100, 'Tax rate must be 100% or less')
    .optional()
    .default(0),
  discountRate: z.number()
    .min(0, 'Discount rate must be 0% or more')
    .max(100, 'Discount rate must be 100% or less')
    .optional()
    .default(0),
  shipping: z.number()
    .min(0, 'Shipping must be 0 or more')
    .optional()
    .default(0),
  currency: z.enum(SUPPORTED_CURRENCIES, {
    errorMap: () => ({ message: `Currency must be one of: ${SUPPORTED_CURRENCIES.join(', ')}` }),
  }).optional().default('USD'),

  // Dates
  issueDate: z.union([z.string().datetime(), z.string().date(), z.string()])
    .optional(),
  dueDate: z.union([z.string().datetime(), z.string().date(), z.string()])
    .optional(),

  // Extra
  notes: z.string().max(2000, 'Notes must be 2000 characters or less').optional().default(''),
  terms: z.string().max(2000, 'Terms must be 2000 characters or less').optional().default(''),

  // Status
  status: z.enum(['draft', 'generated', 'sent', 'paid']).optional().default('draft'),
});

// ─── Update Invoice Schema (all fields optional) ─────────────────────────────

const updateInvoiceSchema = createInvoiceSchema.partial();

// ─── Validation Middleware Factory ────────────────────────────────────────────

/**
 * Express middleware that validates req.body against a Zod schema.
 * On success: sets req.validatedBody and calls next()
 * On failure: returns 400 with field-level error details
 *
 * @param {'create' | 'update'} mode
 */
const validateInvoice = (mode = 'create') => {
  const schema = mode === 'update' ? updateInvoiceSchema : createInvoiceSchema;

  return (req, res, next) => {
    const result = schema.safeParse(req.body);

    if (!result.success) {
      const errors = result.error.issues.map((issue) => ({
        field: issue.path.join('.'),
        message: issue.message,
      }));

      return res.status(400).json({
        message: 'Validation failed',
        errors,
      });
    }

    // Replace body with validated + defaulted data
    req.validatedBody = result.data;
    next();
  };
};

module.exports = {
  createInvoiceSchema,
  updateInvoiceSchema,
  validateInvoice,
  SUPPORTED_CURRENCIES,
};
