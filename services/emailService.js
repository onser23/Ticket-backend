const transporter = require('../config/mailer');

async function sendEmail({ to, subject, html, text }) {
  try {
    await transporter.sendMail({
      from: `"${process.env.MAIL_FROM_NAME || 'Ticket Sistemi'}" <${process.env.MAIL_USER}>`,
      to,
      subject,
      text,
      html,
    });
    return { success: true };
  } catch (err) {
    console.error(`[EMAIL FAIL] to: ${to}, subject: ${subject}`, err.message);
    return { success: false, error: err.message };
  }
}

async function sendOtpEmail({ to, firstName, code, purpose }) {
  const { otpTemplate } = require('./emailTemplates');
  const { subject, html, text } = otpTemplate({ firstName, code, purpose });
  return sendEmail({ to, subject, html, text });
}

async function sendStatusChangedEmail({ to, firstName, ticket, frontendUrl }) {
  const { statusChangedTemplate } = require('./emailTemplates');
  const url = frontendUrl || process.env.FRONTEND_URL || 'http://localhost:3000';
  const { subject, html, text } = statusChangedTemplate({ firstName, ticket, frontendUrl: url });
  return sendEmail({ to, subject, html, text });
}

async function sendAdminReplyEmail({ to, firstName, ticket, commentText, frontendUrl }) {
  const { adminReplyTemplate } = require('./emailTemplates');
  const url = frontendUrl || process.env.FRONTEND_URL || 'http://localhost:3000';
  const { subject, html, text } = adminReplyTemplate({ firstName, ticket, commentText, frontendUrl: url });
  return sendEmail({ to, subject, html, text });
}

module.exports = { sendEmail, sendOtpEmail, sendStatusChangedEmail, sendAdminReplyEmail };
