const axios = require('axios');
const ApiUsage = require('../models/ApiUsage');

const API_URL = 'https://invoice-generator.com';

// ─── Build API-compatible payload from invoice data ───────────────────────────

const buildPayload = (invoiceData) => {
  const taxRate = invoiceData.taxRate || 0;
  const discountRate = invoiceData.discountRate || 0;
  const shipping = invoiceData.shipping || 0;

  return {
    // ── Required fields ──────────────────────────────────────────────────
    from: invoiceData.from?.name || '',
    to: invoiceData.to?.name || '',
    date: invoiceData.issueDate
      ? new Date(invoiceData.issueDate).toLocaleDateString('en-US')
      : new Date().toLocaleDateString('en-US'),
    items: (invoiceData.items || []).map((item) => ({
      name: item.name || '',
      quantity: item.quantity || 0,
      unit_cost: item.unit_cost || 0,
      description: item.description || '',
    })),

    // ── Optional fields ──────────────────────────────────────────────────
    logo: invoiceData.logo || '',
    number: invoiceData.invoiceNumber || '',
    currency: invoiceData.currency || 'USD',
    due_date: invoiceData.dueDate
      ? new Date(invoiceData.dueDate).toLocaleDateString('en-US')
      : '',

    // ── Financials ───────────────────────────────────────────────────────
    tax: taxRate,
    discounts: discountRate,
    shipping: shipping,

    // ── Dynamic field toggles ────────────────────────────────────────────
    // '%' = show as percentage, true = show as flat, false = hide
    fields: {
      tax: taxRate > 0 ? '%' : false,
      discounts: discountRate > 0 ? '%' : false,
      shipping: shipping > 0 ? true : false,
    },

    // ── Extra info ───────────────────────────────────────────────────────
    notes: invoiceData.notes || '',
    terms: invoiceData.terms || '',
    amount_paid: invoiceData.amountPaid || 0,

    // ── Template labels ──────────────────────────────────────────────────
    from_title: 'From',
    to_title: 'Bill To',
    ship_to: '',

    // ── Custom fields for contact details ────────────────────────────────
    custom_fields: [
      invoiceData.from?.email && {
        name: 'Sender Email',
        value: invoiceData.from.email,
      },
      invoiceData.from?.address && {
        name: 'Sender Address',
        value: invoiceData.from.address,
      },
      invoiceData.from?.phone && {
        name: 'Sender Phone',
        value: invoiceData.from.phone,
      },
      invoiceData.to?.email && {
        name: 'Recipient Email',
        value: invoiceData.to.email,
      },
      invoiceData.to?.address && {
        name: 'Recipient Address',
        value: invoiceData.to.address,
      },
      invoiceData.to?.phone && {
        name: 'Recipient Phone',
        value: invoiceData.to.phone,
      },
    ].filter(Boolean),
  };
};

// ─── Categorize API errors ────────────────────────────────────────────────────

const categorizeError = (error) => {
  const status = error.response?.status;
  const data = error.response?.data;

  // Try to parse arraybuffer error body
  let message = error.message;
  if (data && Buffer.isBuffer(data)) {
    try {
      message = data.toString('utf8');
    } catch {
      // keep original message
    }
  } else if (data && typeof data === 'object') {
    message = data.message || data.error || JSON.stringify(data);
  }

  switch (status) {
    case 400:
      return {
        type: 'VALIDATION_ERROR',
        statusCode: 400,
        message: `Invalid invoice data: ${message}`,
      };
    case 401:
      return {
        type: 'AUTH_ERROR',
        statusCode: 401,
        message: 'Invalid API key. Check your INVOICE_GENERATOR_API_KEY in .env',
      };
    case 429:
      return {
        type: 'RATE_LIMIT',
        statusCode: 429,
        message: 'API rate limit exceeded. You have reached the monthly invoice limit.',
      };
    default:
      return {
        type: 'API_ERROR',
        statusCode: status || 500,
        message: `PDF generation failed: ${message}`,
      };
  }
};

// ─── Generate PDF ─────────────────────────────────────────────────────────────

/**
 * Generate a PDF invoice using the Invoice-Generator.com API.
 *
 * @param {Object} invoiceData - Invoice data from the database
 * @param {Object} options - { userId, invoiceId } for usage tracking
 * @returns {{ success, pdfBuffer?, pdfBase64?, contentType?, error?, errorType? }}
 */
const generatePDF = async (invoiceData, options = {}) => {
  const { userId = null, invoiceId = null } = options;
  const startTime = Date.now();

  // ── 1. Check monthly usage limit ───────────────────────────────────────
  try {
    const monthlyCount = await ApiUsage.getMonthlyCount();
    const limit = parseInt(process.env.INVOICE_API_MONTHLY_LIMIT, 10) || 100;

    if (monthlyCount >= limit) {
      const stats = await ApiUsage.getUsageStats();

      // Log the rejected attempt
      if (userId) {
        await ApiUsage.logUsage({
          userId,
          invoiceId,
          success: false,
          error: 'Monthly API limit reached',
          responseTimeMs: Date.now() - startTime,
        });
      }

      return {
        success: false,
        errorType: 'RATE_LIMIT',
        error: `Monthly API limit reached (${stats.used}/${stats.limit}). Resets on ${stats.resetsAt}.`,
      };
    }
  } catch (err) {
    console.warn('Usage check failed (proceeding):', err.message);
  }

  // ── 2. Build API payload ───────────────────────────────────────────────
  const payload = buildPayload(invoiceData);

  // ── 3. Call Invoice-Generator.com API ──────────────────────────────────
  try {
    const apiKey = process.env.INVOICE_GENERATOR_API_KEY;
    if (!apiKey) {
      throw Object.assign(new Error('INVOICE_GENERATOR_API_KEY is not set in .env'), {
        response: { status: 401 },
      });
    }

    const response = await axios.post(API_URL, payload, {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      responseType: 'arraybuffer',
      timeout: 30000, // 30s timeout
    });

    const pdfBuffer = Buffer.from(response.data);
    const pdfBase64 = pdfBuffer.toString('base64');
    const responseTimeMs = Date.now() - startTime;

    // ── 4. Log successful usage ──────────────────────────────────────────
    if (userId) {
      await ApiUsage.logUsage({
        userId,
        invoiceId,
        success: true,
        responseTimeMs,
      }).catch((err) => console.error('Usage log failed:', err.message));
    }

    console.log(
      `[PDF Service] Generated PDF for invoice ${invoiceId || 'unknown'} in ${responseTimeMs}ms`
    );

    return {
      success: true,
      pdfBuffer,
      pdfBase64,
      contentType: response.headers['content-type'] || 'application/pdf',
    };
  } catch (error) {
    const responseTimeMs = Date.now() - startTime;
    const categorized = categorizeError(error);

    console.error(
      `[PDF Service] ${categorized.type}: ${categorized.message} (${responseTimeMs}ms)`
    );

    // ── Log failed usage ─────────────────────────────────────────────────
    if (userId) {
      await ApiUsage.logUsage({
        userId,
        invoiceId,
        success: false,
        error: categorized.message,
        responseTimeMs,
      }).catch((err) => console.error('Usage log failed:', err.message));
    }

    return {
      success: false,
      errorType: categorized.type,
      error: categorized.message,
      statusCode: categorized.statusCode,
    };
  }
};

// ─── Get usage stats ──────────────────────────────────────────────────────────

const getUsageStats = async (userId) => {
  return ApiUsage.getUsageStats(userId);
};

module.exports = { generatePDF, getUsageStats };
