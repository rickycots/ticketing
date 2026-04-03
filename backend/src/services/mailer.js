const nodemailer = require('nodemailer');
const path = require('path');

const LOGO_PATH = path.join(__dirname, '..', '..', 'uploads', 'LogoSTM.png');

const TICKETING_USER = process.env.MAIL_TICKETING_USER;
const TICKETING_PASS = process.env.MAIL_TICKETING_PASS;
const ASSISTENZA_USER = process.env.MAIL_ASSISTENZA_USER;
const ASSISTENZA_PASS = process.env.MAIL_ASSISTENZA_PASS;
const SMTP_HOST = process.env.MAIL_SMTP_HOST;
const SMTP_PORT = parseInt(process.env.MAIL_SMTP_PORT) || 465;

const mailEnabled = !!(TICKETING_USER && TICKETING_PASS && SMTP_HOST);

const NOREPLY_USER = process.env.MAIL_NOREPLY_USER;
const NOREPLY_PASS = process.env.MAIL_NOREPLY_PASS;

let ticketingTransporter = null;
let assistenzaTransporter = null;
let noreplyTransporter = null;

if (mailEnabled) {
  ticketingTransporter = nodemailer.createTransport({
    host: SMTP_HOST,
    port: SMTP_PORT,
    secure: true,
    auth: { user: TICKETING_USER, pass: TICKETING_PASS },
  });

  assistenzaTransporter = nodemailer.createTransport({
    host: SMTP_HOST,
    port: SMTP_PORT,
    secure: true,
    auth: { user: ASSISTENZA_USER || TICKETING_USER, pass: ASSISTENZA_PASS || TICKETING_PASS },
  });

  if (NOREPLY_USER && NOREPLY_PASS) {
    noreplyTransporter = nodemailer.createTransport({
      host: SMTP_HOST,
      port: SMTP_PORT,
      secure: true,
      auth: { user: NOREPLY_USER, pass: NOREPLY_PASS },
    });
  }

  console.log('[MAIL] SMTP configurato — invio email reali attivo');
} else {
  console.log('[MAIL] Credenziali SMTP mancanti — fallback a console.log');
}

/**
 * Send email via ticketing@ transporter
 * @returns {{ messageId: string }}
 */
async function sendTicketingEmail(to, subject, html, inReplyTo) {
  const mailOptions = {
    from: `"Ticketing STM" <${TICKETING_USER}>`,
    to,
    subject,
    html,
    attachments: [{ filename: 'LogoSTM.png', path: LOGO_PATH, cid: 'logo' }],
  };
  if (inReplyTo) {
    mailOptions.inReplyTo = inReplyTo;
    mailOptions.references = inReplyTo;
  }

  if (!mailEnabled) {
    console.log(`[MAIL SIMULATED] ticketing@ → ${to} — ${subject}`);
    return { messageId: `<simulated-${Date.now()}@ticketing.local>` };
  }

  const info = await ticketingTransporter.sendMail(mailOptions);
  console.log(`[MAIL SENT] ticketing@ → ${to} — ${subject} (${info.messageId})`);
  return { messageId: info.messageId };
}

/**
 * Send email via assistenzatecnica@ transporter
 * @returns {{ messageId: string }}
 */
async function sendAssistenzaEmail(to, subject, html, inReplyTo) {
  const mailOptions = {
    from: `"Assistenza Tecnica STM" <${ASSISTENZA_USER}>`,
    to,
    bcc: 'riccardo@stmdomotica.it',
    subject,
    html,
    attachments: [{ filename: 'LogoSTM.png', path: LOGO_PATH, cid: 'logo' }],
  };
  if (inReplyTo) {
    mailOptions.inReplyTo = inReplyTo;
    mailOptions.references = inReplyTo;
  }

  if (!mailEnabled) {
    console.log(`[MAIL SIMULATED] assistenza@ → ${to} (bcc: riccardo@stmdomotica.it) — ${subject}`);
    return { messageId: `<simulated-${Date.now()}@ticketing.local>` };
  }

  const info = await assistenzaTransporter.sendMail(mailOptions);
  console.log(`[MAIL SENT] assistenza@ → ${to} — ${subject} (${info.messageId})`);
  return { messageId: info.messageId };
}

/**
 * Send email via noreply@ transporter (falls back to ticketing@ if noreply not configured)
 * @returns {{ messageId: string }}
 */
async function sendNoreplyEmail(to, subject, html) {
  const fromAddr = TICKETING_USER || 'ticketing@stmdomotica.it';
  const mailOptions = {
    from: `"Noreply STM Domotica" <${fromAddr}>`,
    to,
    subject,
    html,
    attachments: [{
      filename: 'LogoSTM.png',
      path: LOGO_PATH,
      cid: 'logo',
    }],
  };

  const transporter = ticketingTransporter;

  if (!mailEnabled || !transporter) {
    console.log(`[MAIL SIMULATED] noreply(ticketing@) → ${to} — ${subject}`);
    return { messageId: `<simulated-${Date.now()}@ticketing.local>` };
  }

  const info = await transporter.sendMail(mailOptions);
  console.log(`[MAIL SENT] noreply@ → ${to} — ${subject} (${info.messageId})`);
  return { messageId: info.messageId };
}

/**
 * Wrap content in the standard STM email template with logo header and privacy footer
 */
function wrapEmailTemplate(bodyHtml) {
  return `<div style="font-family:Arial,Helvetica,sans-serif;max-width:600px;margin:0 auto">
<div style="border-bottom:2px solid #0066cc;padding:16px 0;margin-bottom:20px;text-align:center">
<img src="cid:logo" alt="STM Domotica" style="height:50px;width:auto" />
</div>
${bodyHtml}
<hr style="margin:20px 0;border:none;border-top:1px solid #ccc">
<p style="text-align:center"><b>This e-mail has been sent automatically from STM Domotica support portal.</b></p>
<p style="font-size:10px;color:#999;text-align:center;line-height:1.4;margin-top:16px">This message and any attachments are confidential and intended solely for the addressee. If you have received this e-mail in error, please notify the sender immediately and delete it. Any unauthorized use, disclosure, copying or distribution is strictly prohibited. This e-mail does not constitute a binding agreement. Stmdomotica Corporation Srl — Via Aldo Moro 15, 26839 Zelo Buon Persico (LO), Italy.</p>
</div>`;
}

const logoAttachment = { filename: 'LogoSTM.png', path: LOGO_PATH, cid: 'logo' };

module.exports = { sendTicketingEmail, sendAssistenzaEmail, sendNoreplyEmail, mailEnabled, wrapEmailTemplate, logoAttachment };
