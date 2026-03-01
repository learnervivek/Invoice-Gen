const Invoice = require('../models/Invoice');
const { generatePDF, getUsageStats } = require('../services/pdfService');
const { sendInvoiceEmail } = require('../services/emailService');
const User = require('../models/User');

// Get all invoices for the current user (with optional filtering & pagination)
const getInvoices = async (req, res, next) => {
  try {
    const { status, page = 1, limit = 20 } = req.query;
    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));
    const skip = (pageNum - 1) * limitNum;

    // Build query filter
    const filter = { userId: req.user._id };
    if (status && ['draft', 'generated', 'sent', 'paid'].includes(status)) {
      filter.status = status;
    }

    const [invoices, total] = await Promise.all([
      Invoice.find(filter)
        .sort({ updatedAt: -1 })
        .skip(skip)
        .limit(limitNum)
        .select('-conversationHistory'),
      Invoice.countDocuments(filter),
    ]);

    res.json({
      invoices,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        pages: Math.ceil(total / limitNum),
      },
    });
  } catch (error) {
    next(error);
  }
};

// Get single invoice
const getInvoice = async (req, res, next) => {
  try {
    const invoice = await Invoice.findOne({
      _id: req.params.id,
      userId: req.user._id,
    });

    if (!invoice) {
      return res.status(404).json({ message: 'Invoice not found' });
    }

    res.json({ invoice });
  } catch (error) {
    next(error);
  }
};

// Create new invoice (draft)
const createInvoice = async (req, res, next) => {
  try {
    // Use validated body from Zod middleware, fallback to raw body
    const data = req.validatedBody || req.body;

    // Handle empty date strings to prevent Mongoose CastError
    if (data.issueDate === '') delete data.issueDate;
    if (data.dueDate === '') delete data.dueDate;

    // Auto-generate professional invoice number if missing
    if (!data.invoiceNumber) {
      const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
      const randomId = Math.floor(1000 + Math.random() * 9000);
      data.invoiceNumber = `INV-${dateStr}-${randomId}`;
    }

    const invoice = await Invoice.create({
      userId: req.user._id,
      ...data,
    });
    res.status(201).json({ invoice });
  } catch (error) {
    next(error);
  }
};

// Update invoice
const updateInvoice = async (req, res, next) => {
  try {
    // Use validated body from Zod middleware, fallback to raw body
    const data = req.validatedBody || req.body;

    // Handle empty date strings to prevent Mongoose CastError
    if (data.issueDate === '') delete data.issueDate;
    if (data.dueDate === '') delete data.dueDate;

    // Prevent overwriting existing invoiceNumber with blank from frontend
    if (!data.invoiceNumber || data.invoiceNumber.trim() === '') {
      delete data.invoiceNumber;
    }

    const invoice = await Invoice.findOneAndUpdate(
      { _id: req.params.id, userId: req.user._id },
      { $set: data },
      { new: true, runValidators: true }
    );

    if (!invoice) {
      return res.status(404).json({ message: 'Invoice not found' });
    }

    res.json({ invoice });
  } catch (error) {
    next(error);
  }
};

// Delete invoice
const deleteInvoice = async (req, res, next) => {
  try {
    const invoice = await Invoice.findOneAndDelete({
      _id: req.params.id,
      userId: req.user._id,
    });

    if (!invoice) {
      return res.status(404).json({ message: 'Invoice not found' });
    }

    res.json({ message: 'Invoice deleted' });
  } catch (error) {
    next(error);
  }
};

// Generate PDF
const generateInvoicePDF = async (req, res, next) => {
  try {
    const invoice = await Invoice.findOne({
      _id: req.params.id,
      userId: req.user._id,
    });

    if (!invoice) {
      return res.status(404).json({ message: 'Invoice not found' });
    }

    // Pass tracking context for API usage logging
    const result = await generatePDF(invoice.toObject(), {
      userId: req.user._id,
      invoiceId: invoice._id,
    });

    if (!result.success) {
      const statusCode = result.statusCode || 500;
      return res.status(statusCode).json({
        message: result.error,
        errorType: result.errorType,
      });
    }

    // Update invoice status
    invoice.status = 'generated';
    await invoice.save();

    // Support ?format=base64 for frontend consumption
    if (req.query.format === 'base64') {
      return res.json({
        pdfBase64: result.pdfBase64,
        filename: `invoice-${invoice.invoiceNumber || invoice._id}.pdf`,
        contentType: result.contentType,
      });
    }

    // Default: stream the PDF buffer
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="invoice-${invoice.invoiceNumber || invoice._id}.pdf"`,
    });
    res.send(result.pdfBuffer);
  } catch (error) {
    next(error);
  }
};

// Send invoice via Gmail
const sendInvoice = async (req, res, next) => {
  try {
    const invoice = await Invoice.findOne({
      _id: req.params.id,
      userId: req.user._id,
    });

    if (!invoice) {
      return res.status(404).json({ message: 'Invoice not found' });
    }

    if (!invoice.to?.email) {
      return res.status(400).json({ message: 'Recipient email is required' });
    }

    // Get user's refresh token
    const user = await User.findById(req.user._id);
    if (!user.refreshToken) {
      return res.status(401).json({
        message: 'Gmail not connected. Please sign out and sign in again to authorize Gmail access.',
        errorType: 'TOKEN_REVOKED',
      });
    }

    // Generate PDF first
    const pdfResult = await generatePDF(invoice.toObject(), {
      userId: req.user._id,
      invoiceId: invoice._id,
    });
    if (!pdfResult.success) {
      return res.status(pdfResult.statusCode || 500).json({
        message: pdfResult.error || 'PDF generation failed',
        errorType: pdfResult.errorType,
      });
    }

    // Send email with professional template
    const emailResult = await sendInvoiceEmail(req.user._id, user.refreshToken, {
      invoice: invoice.toObject(),
      pdfBuffer: pdfResult.pdfBuffer,
      filename: `invoice-${invoice.invoiceNumber || invoice._id}.pdf`,
    });

    if (!emailResult.success) {
      // Map email error types to HTTP status codes
      const statusMap = {
        TOKEN_REVOKED: 401,
        PERMISSION_DENIED: 403,
        INVALID_RECIPIENT: 400,
        RATE_LIMIT: 429,
      };
      const statusCode = statusMap[emailResult.errorType] || 500;
      return res.status(statusCode).json({
        message: emailResult.error,
        errorType: emailResult.errorType,
      });
    }

    // Update status
    invoice.status = 'sent';
    await invoice.save();

    res.json({
      message: 'Invoice sent successfully',
      messageId: emailResult.messageId,
    });
  } catch (error) {
    next(error);
  }
};

// Get API usage stats for current month
const getApiUsage = async (req, res, next) => {
  try {
    const stats = await getUsageStats(req.user._id);
    res.json(stats);
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getInvoices,
  getInvoice,
  createInvoice,
  updateInvoice,
  deleteInvoice,
  generateInvoicePDF,
  sendInvoice,
  getApiUsage,
};
