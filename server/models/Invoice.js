const mongoose = require('mongoose');

const lineItemSchema = new mongoose.Schema({
  name: { type: String, default: '' },
  quantity: { type: Number, default: 1 },
  unit_cost: { type: Number, default: 0 },
  description: { type: String, default: '' },
});

const invoiceSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    status: {
      type: String,
      enum: ['draft', 'generated', 'sent', 'paid'],
      default: 'draft',
    },
    invoiceNumber: {
      type: String,
      default: '',
    },
    // Sender info
    from: {
      name: { type: String, default: '' },
      email: { type: String, default: '' },
      address: { type: String, default: '' },
      phone: { type: String, default: '' },
    },
    // Recipient info
    to: {
      name: { type: String, default: '' },
      email: { type: String, default: '' },
      address: { type: String, default: '' },
      phone: { type: String, default: '' },
    },
    // Line items
    items: [lineItemSchema],
    // Financial
    taxRate: { type: Number, default: 0 },
    discountRate: { type: Number, default: 0 },
    shipping: { type: Number, default: 0 },
    currency: { type: String, default: 'USD' },
    // Extra
    notes: { type: String, default: '' },
    terms: { type: String, default: '' },
    dueDate: { type: Date },
    issueDate: { type: Date, default: Date.now },
    // PDF
    pdfUrl: { type: String, default: '' },
    // Chat history for this invoice
    conversationHistory: [
      {
        role: { type: String, enum: ['user', 'bot'] },
        message: { type: String },
        timestamp: { type: Date, default: Date.now },
      },
    ],
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Virtual: computed subtotal
invoiceSchema.virtual('subtotal').get(function () {
  return this.items.reduce((sum, item) => sum + item.quantity * item.unit_cost, 0);
});

// Virtual: computed total
invoiceSchema.virtual('total').get(function () {
  const subtotal = this.items.reduce((sum, item) => sum + item.quantity * item.unit_cost, 0);
  const tax = subtotal * (this.taxRate / 100);
  const discount = subtotal * (this.discountRate / 100);
  return subtotal + tax - discount + (this.shipping || 0);
});

// ── Compound Indexes ──────────────────────────────────────────────────────────
// Optimize common query patterns

// "Get my drafts" — filters by user + status
invoiceSchema.index({ userId: 1, status: 1 });

// "Recent invoices" — sorts by creation date descending per user
invoiceSchema.index({ userId: 1, createdAt: -1 });

// "Find by invoice number" — lookup by number per user
invoiceSchema.index({ userId: 1, invoiceNumber: 1 });

module.exports = mongoose.model('Invoice', invoiceSchema);
