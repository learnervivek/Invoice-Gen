const Invoice = require('../models/Invoice');
const engine = require('../services/conversationEngine');

/**
 * Process a chat message through the rule-based conversational engine.
 * Receives user message + current invoice state from the client,
 * runs intent detection and state updates, and returns the new state.
 */
const processMessage = async (req, res, next) => {
  try {
    const { message, invoiceId, invoiceData: clientData } = req.body;

    if (!message || typeof message !== 'string') {
      return res.status(400).json({ message: 'Message is required' });
    }

    // Run the conversational engine (pure, stateless)
    const result = engine.processMessage(message, clientData || null);

    // ── Handle save / generate actions ──────────────────────────────────
    if (result.action === 'save' || result.action === 'generate') {
      // Strip internal computed fields before persisting
      const { _computed, ...stateToSave } = result.state;

      let invoice;
      const status = result.action === 'generate' ? 'generated' : 'draft';

      if (invoiceId) {
        invoice = await Invoice.findOneAndUpdate(
          { _id: invoiceId, userId: req.user._id },
          {
            $set: { ...stateToSave, status },
            $push: {
              conversationHistory: {
                $each: [
                  { role: 'user', message },
                  { role: 'bot', message: `Invoice ${status === 'generated' ? 'generated' : 'saved as draft'}!` },
                ],
              },
            },
          },
          { new: true }
        );
      } else {
        invoice = await Invoice.create({
          userId: req.user._id,
          ...stateToSave,
          status,
          conversationHistory: [
            { role: 'user', message },
            { role: 'bot', message: `Invoice ${status === 'generated' ? 'generated' : 'saved as draft'}!` },
          ],
        });
      }

      const actionMessage =
        result.action === 'generate'
          ? "Invoice saved! 🎉 Click the **'Download PDF'** button in the preview to generate your PDF."
          : 'Invoice saved as draft! 📝 You can find it in your dashboard.';

      return res.json({
        botMessage: actionMessage,
        invoiceData: result.state,
        invoiceId: invoice._id,
        intent: result.intent,
        isComplete: true,
      });
    }

    // ── Normal response ─────────────────────────────────────────────────
    return res.json({
      botMessage: result.response,
      invoiceData: result.state,
      invoiceId: invoiceId || null,
      intent: result.intent,
      confidence: result.confidence,
      isComplete: false,
    });
  } catch (error) {
    next(error);
  }
};

module.exports = { processMessage };
