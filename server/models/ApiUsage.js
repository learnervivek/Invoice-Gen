const mongoose = require('mongoose');

const MONTHLY_LIMIT = parseInt(process.env.INVOICE_API_MONTHLY_LIMIT, 10) || 100;

const apiUsageSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    invoiceId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Invoice',
      default: null,
    },
    success: {
      type: Boolean,
      required: true,
    },
    error: {
      type: String,
      default: '',
    },
    responseTimeMs: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
  }
);

// ── Static: count API calls for the current calendar month ────────────────────

apiUsageSchema.statics.getMonthlyCount = async function (userId) {
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  const count = await this.countDocuments({
    ...(userId ? { userId } : {}),
    success: true,
    createdAt: { $gte: startOfMonth },
  });

  return count;
};

// ── Static: get full usage stats for a user ───────────────────────────────────

apiUsageSchema.statics.getUsageStats = async function (userId) {
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const startOfNextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);

  const used = await this.countDocuments({
    ...(userId ? { userId } : {}),
    success: true,
    createdAt: { $gte: startOfMonth },
  });

  return {
    used,
    limit: MONTHLY_LIMIT,
    remaining: Math.max(0, MONTHLY_LIMIT - used),
    resetsAt: startOfNextMonth.toISOString(),
  };
};

// ── Static: log a usage entry ─────────────────────────────────────────────────

apiUsageSchema.statics.logUsage = async function ({
  userId,
  invoiceId = null,
  success,
  error = '',
  responseTimeMs = 0,
}) {
  return this.create({
    userId,
    invoiceId,
    success,
    error,
    responseTimeMs,
  });
};

const ApiUsage = mongoose.model('ApiUsage', apiUsageSchema);

module.exports = ApiUsage;
module.exports.MONTHLY_LIMIT = MONTHLY_LIMIT;
