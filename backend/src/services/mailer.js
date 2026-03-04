const nodemailer = require('nodemailer');

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
    subject,
    html,
  };
  if (inReplyTo) {
    mailOptions.inReplyTo = inReplyTo;
    mailOptions.references = inReplyTo;
  }

  if (!mailEnabled) {
    console.log(`[MAIL SIMULATED] assistenza@ → ${to} — ${subject}`);
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
  const fromAddr = NOREPLY_USER || 'noreply@stmdomotica.it';
  const mailOptions = {
    from: `"STM Domotica" <${fromAddr}>`,
    to,
    subject,
    html,
  };

  const transporter = noreplyTransporter || ticketingTransporter;

  if (!mailEnabled || !transporter) {
    console.log(`[MAIL SIMULATED] noreply@ → ${to} — ${subject}`);
    return { messageId: `<simulated-${Date.now()}@ticketing.local>` };
  }

  const info = await transporter.sendMail(mailOptions);
  console.log(`[MAIL SENT] noreply@ → ${to} — ${subject} (${info.messageId})`);
  return { messageId: info.messageId };
}

module.exports = { sendTicketingEmail, sendAssistenzaEmail, sendNoreplyEmail, mailEnabled };
