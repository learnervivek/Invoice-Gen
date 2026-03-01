const express = require('express');
const {
  getInvoices,
  getInvoice,
  createInvoice,
  updateInvoice,
  deleteInvoice,
  generateInvoicePDF,
  sendInvoice,
  getApiUsage,
} = require('../controllers/invoiceController');
const auth = require('../middleware/auth');
const { validateInvoice } = require('../validators/invoiceValidator');

const router = express.Router();

// All routes are protected
router.use(auth);

router.get('/api-usage', getApiUsage);
router.get('/', getInvoices);
router.get('/:id', getInvoice);
router.post('/', validateInvoice('create'), createInvoice);
router.put('/:id', validateInvoice('update'), updateInvoice);
router.delete('/:id', deleteInvoice);
router.post('/:id/generate-pdf', generateInvoicePDF);
router.post('/:id/send', sendInvoice);

module.exports = router;

