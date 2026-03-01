const { google } = require('googleapis');
const User = require('../models/User');

// ─── Create a fresh OAuth2 client per request ─────────────────────────────────
// Avoids shared state issues when multiple users send emails concurrently.

const createOAuth2Client = () => {
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI
  );
};

// ─── Token Refresh Helper ─────────────────────────────────────────────────────
// Explicitly refreshes the access token and persists the new refresh token
// back to the database if Google issues one.

const getAuthenticatedClient = async (userId, refreshToken) => {
  const client = createOAuth2Client();
  client.setCredentials({ refresh_token: refreshToken });

  try {
    // Force a token refresh to ensure we have a valid access token
    const { credentials } = await client.refreshAccessToken();

    // If Google issued a new refresh token, persist it
    if (credentials.refresh_token && credentials.refresh_token !== refreshToken) {
      await User.findByIdAndUpdate(userId, {
        refreshToken: credentials.refresh_token,
      });
      console.log(`[Email Service] Refresh token updated for user ${userId}`);
    }

    client.setCredentials(credentials);
    return client;
  } catch (error) {
    // Categorize token errors
    if (
      error.message?.includes('invalid_grant') ||
      error.message?.includes('Token has been expired or revoked')
    ) {
      const err = new Error(
        'Gmail access has been revoked. Please sign out and sign in again to reconnect.'
      );
      err.errorType = 'TOKEN_REVOKED';
      throw err;
    }
    throw error;
  }
};

// ─── Professional HTML Email Template ─────────────────────────────────────────

const buildEmailBody = (invoice) => {
  const senderName = invoice.from?.name || 'InvoiceGen';
  const invoiceNumber = invoice.invoiceNumber || 'N/A';
  const currency = invoice.currency || 'USD';

  // Calculate total
  const subtotal = (invoice.items || []).reduce(
    (sum, item) => sum + (item.quantity || 0) * (item.unit_cost || 0),
    0
  );
  const taxAmount = subtotal * ((invoice.taxRate || 0) / 100);
  const discountAmount = subtotal * ((invoice.discountRate || 0) / 100);
  const total = subtotal + taxAmount - discountAmount + (invoice.shipping || 0);

  const formatCurrency = (amount) => {
    try {
      return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency,
      }).format(amount || 0);
    } catch {
      return `$${(amount || 0).toFixed(2)}`;
    }
  };

  const formatDate = (date) => {
    if (!date) return '';
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  const issueDate = formatDate(invoice.issueDate || new Date());
  const dueDate = invoice.dueDate ? formatDate(invoice.dueDate) : '';

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin:0;padding:0;background-color:#f4f5f7;font-family:'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color:#f4f5f7;padding:32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="600" cellspacing="0" cellpadding="0" style="background-color:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.06);">

          <!-- Gradient Header -->
          <tr>
            <td style="background:linear-gradient(135deg,#3b82f6 0%,#6366f1 50%,#8b5cf6 100%);padding:32px 40px;text-align:center;">
              <h1 style="margin:0;color:#ffffff;font-size:28px;font-weight:800;letter-spacing:-0.5px;">INVOICE</h1>
              <p style="margin:8px 0 0;color:rgba(255,255,255,0.85);font-size:14px;font-weight:500;">#${invoiceNumber}</p>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:32px 40px;">

              <!-- Greeting -->
              <p style="margin:0 0 24px;color:#374151;font-size:15px;line-height:1.6;">
                Hello${invoice.to?.name ? ' <strong>' + invoice.to.name + '</strong>' : ''},
              </p>
              <p style="margin:0 0 28px;color:#374151;font-size:15px;line-height:1.6;">
                Please find attached the invoice from <strong>${senderName}</strong>. Below is a summary of the invoice details.
              </p>

              <!-- Invoice Summary Table -->
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color:#f9fafb;border-radius:8px;border:1px solid #e5e7eb;margin-bottom:28px;">
                <tr>
                  <td style="padding:16px 20px;border-bottom:1px solid #e5e7eb;">
                    <span style="color:#6b7280;font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:0.05em;">Invoice Number</span><br>
                    <span style="color:#111827;font-size:15px;font-weight:600;">#${invoiceNumber}</span>
                  </td>
                  <td style="padding:16px 20px;border-bottom:1px solid #e5e7eb;text-align:right;">
                    <span style="color:#6b7280;font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:0.05em;">Issue Date</span><br>
                    <span style="color:#111827;font-size:15px;font-weight:600;">${issueDate}</span>
                  </td>
                </tr>
                ${dueDate ? `
                <tr>
                  <td style="padding:16px 20px;border-bottom:1px solid #e5e7eb;">
                    <span style="color:#6b7280;font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:0.05em;">Due Date</span><br>
                    <span style="color:#111827;font-size:15px;font-weight:600;">${dueDate}</span>
                  </td>
                  <td style="padding:16px 20px;border-bottom:1px solid #e5e7eb;text-align:right;">
                    <span style="color:#6b7280;font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:0.05em;">Currency</span><br>
                    <span style="color:#111827;font-size:15px;font-weight:600;">${currency}</span>
                  </td>
                </tr>
                ` : ''}
                <tr>
                  <td colspan="2" style="padding:20px;text-align:center;background-color:#f3f4f6;">
                    <span style="color:#6b7280;font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:0.05em;">Amount Due</span><br>
                    <span style="color:#111827;font-size:28px;font-weight:800;letter-spacing:-0.5px;">${formatCurrency(total)}</span>
                  </td>
                </tr>
              </table>

              ${invoice.notes ? `
              <!-- Notes -->
              <div style="background-color:#eff6ff;border:1px solid #bfdbfe;border-radius:8px;padding:16px 20px;margin-bottom:28px;">
                <p style="margin:0 0 4px;color:#3b82f6;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;">Notes</p>
                <p style="margin:0;color:#374151;font-size:14px;line-height:1.5;">${invoice.notes}</p>
              </div>
              ` : ''}

              <!-- CTA -->
              <p style="margin:0 0 8px;color:#374151;font-size:15px;line-height:1.6;">
                The full invoice PDF is attached to this email for your records.
              </p>
              <p style="margin:0;color:#6b7280;font-size:13px;line-height:1.5;">
                If you have any questions about this invoice, please contact
                ${invoice.from?.email ? `<a href="mailto:${invoice.from.email}" style="color:#3b82f6;text-decoration:none;font-weight:500;">${invoice.from.email}</a>` : senderName}.
              </p>

            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding:20px 40px;border-top:1px solid #e5e7eb;text-align:center;">
              <p style="margin:0;color:#9ca3af;font-size:11px;font-weight:600;letter-spacing:0.1em;text-transform:uppercase;">
                Generated with InvoiceGen
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`.trim();
};

// ─── Build MIME Message ───────────────────────────────────────────────────────

const buildMimeMessage = ({ from, to, subject, htmlBody, pdfBuffer, filename }) => {
  const boundary = `boundary_${Date.now()}_${Math.random().toString(36).slice(2)}`;

  const mimeLines = [
    `From: ${from}`,
    `To: ${to}`,
    `Subject: ${subject}`,
    'MIME-Version: 1.0',
    `Content-Type: multipart/mixed; boundary="${boundary}"`,
    '',
    `--${boundary}`,
    'Content-Type: text/html; charset="UTF-8"',
    'Content-Transfer-Encoding: 7bit',
    '',
    htmlBody,
    '',
    `--${boundary}`,
    `Content-Type: application/pdf; name="${filename}"`,
    'Content-Transfer-Encoding: base64',
    `Content-Disposition: attachment; filename="${filename}"`,
    '',
    pdfBuffer.toString('base64'),
    '',
    `--${boundary}--`,
  ];

  // Encode to URL-safe base64
  return Buffer.from(mimeLines.join('\n'))
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
};

// ─── Categorize Email Errors ──────────────────────────────────────────────────

const categorizeError = (error) => {
  const message = error.message || '';
  const code = error.code || error.response?.status;

  if (
    message.includes('invalid_grant') ||
    message.includes('Token has been expired or revoked') ||
    error.errorType === 'TOKEN_REVOKED'
  ) {
    return {
      type: 'TOKEN_REVOKED',
      statusCode: 401,
      message: 'Gmail access has been revoked. Please sign out and sign in again.',
    };
  }

  if (code === 403 || message.includes('insufficient')) {
    return {
      type: 'PERMISSION_DENIED',
      statusCode: 403,
      message: 'Gmail send permission not granted. Please re-authenticate with Gmail access.',
    };
  }

  if (message.includes('Invalid to header') || message.includes('invalid_to')) {
    return {
      type: 'INVALID_RECIPIENT',
      statusCode: 400,
      message: 'Invalid recipient email address.',
    };
  }

  if (code === 429 || message.includes('rate limit')) {
    return {
      type: 'RATE_LIMIT',
      statusCode: 429,
      message: 'Gmail sending rate limit reached. Please try again later.',
    };
  }

  return {
    type: 'EMAIL_ERROR',
    statusCode: 500,
    message: `Failed to send email: ${message}`,
  };
};

// ─── Send Invoice Email ───────────────────────────────────────────────────────

/**
 * Send an invoice email with PDF attachment via Gmail API.
 *
 * @param {string} userId - User's MongoDB _id (for token refresh persistence)
 * @param {string} refreshToken - User's Google refresh token
 * @param {Object} options - { invoice, pdfBuffer, filename }
 * @returns {{ success, messageId?, error?, errorType? }}
 */
const sendInvoiceEmail = async (userId, refreshToken, { invoice, pdfBuffer, filename }) => {
  try {
    // ── 1. Validate inputs ───────────────────────────────────────────────
    if (!refreshToken) {
      return {
        success: false,
        errorType: 'TOKEN_REVOKED',
        error: 'Gmail is not connected. Please sign out and sign in again to authorize Gmail access.',
      };
    }

    if (!invoice.to?.email) {
      return {
        success: false,
        errorType: 'INVALID_RECIPIENT',
        error: 'Recipient email address is required.',
      };
    }

    // ── 2. Authenticate with token refresh ───────────────────────────────
    const authClient = await getAuthenticatedClient(userId, refreshToken);
    const gmail = google.gmail({ version: 'v1', auth: authClient });

    // ── 3. Build email content ───────────────────────────────────────────
    const senderName = invoice.from?.name || 'InvoiceGen';
    const senderEmail = invoice.from?.email || '';
    const invoiceNumber = invoice.invoiceNumber || '';

    const subject = invoiceNumber
      ? `Invoice #${invoiceNumber} from ${senderName}`
      : `Invoice from ${senderName}`;

    const htmlBody = buildEmailBody(invoice);

    const fromHeader = senderEmail
      ? `${senderName} <${senderEmail}>`
      : senderName;

    const encodedMessage = buildMimeMessage({
      from: fromHeader,
      to: invoice.to.email,
      subject,
      htmlBody,
      pdfBuffer,
      filename,
    });

    // ── 4. Send via Gmail API ────────────────────────────────────────────
    const result = await gmail.users.messages.send({
      userId: 'me',
      requestBody: {
        raw: encodedMessage,
      },
    });

    console.log(
      `[Email Service] Invoice email sent — messageId: ${result.data.id}, to: ${invoice.to.email}`
    );

    return {
      success: true,
      messageId: result.data.id,
    };
  } catch (error) {
    const categorized = categorizeError(error);
    console.error(`[Email Service] ${categorized.type}: ${categorized.message}`);

    return {
      success: false,
      errorType: categorized.type,
      error: categorized.message,
    };
  }
};

module.exports = { sendInvoiceEmail, buildEmailBody };
