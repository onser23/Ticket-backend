function otpTemplate({ firstName, code, purpose }) {
  const purposeText = purpose === 'register'
    ? 'Email ünvanınızı təsdiq etmək üçün'
    : 'Şifrənizi sıfırlamaq üçün';

  const subject = '[Ticket Sistemi] Email Təsdiq Kodu';

  const html = `
<!DOCTYPE html>
<html lang="az">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f3f4f6;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f3f4f6; padding: 40px 0;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="max-width: 600px; background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.08);">
          <tr>
            <td style="background: linear-gradient(135deg, #4f46e5 0%, #7c3aed 50%, #ec4899 100%); padding: 40px 30px; text-align: center;">
              <div style="background-color: rgba(255,255,255,0.15); display: inline-block; padding: 16px; border-radius: 16px; margin-bottom: 16px;">
                <span style="font-size: 32px;">📧</span>
              </div>
              <h1 style="color: #ffffff; margin: 0; font-size: 28px; font-weight: 700;">Ticket Sistemi</h1>
              <p style="color: rgba(255,255,255,0.9); margin: 8px 0 0; font-size: 14px;">Email Təsdiq Kodu</p>
            </td>
          </tr>
          <tr>
            <td style="padding: 40px 30px;">
              <p style="color: #1f2937; font-size: 16px; margin: 0 0 16px;">Hörmətli <strong>${firstName || 'İstifadəçi'}</strong>,</p>
              <p style="color: #4b5563; font-size: 15px; line-height: 1.6; margin: 0 0 32px;">
                ${purposeText} aşağıdakı kodu istifadə edin:
              </p>
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center" style="padding: 0 0 32px;">
                    <div style="display: inline-block; background: linear-gradient(135deg, #eef2ff 0%, #faf5ff 100%); border: 2px dashed #6366f1; border-radius: 16px; padding: 24px 40px;">
                      <span style="font-family: 'Courier New', monospace; font-size: 36px; font-weight: 700; color: #4338ca; letter-spacing: 8px;">${code}</span>
                    </div>
                  </td>
                </tr>
              </table>
              <p style="color: #6b7280; font-size: 14px; line-height: 1.6; margin: 0 0 8px;">
                Bu kod <strong>10 dəqiqə</strong> ərzində etibarlıdır.
              </p>
              <p style="color: #6b7280; font-size: 14px; line-height: 1.6; margin: 0;">
                Əgər bu tələbi siz etməmisinizsə, bu email-i nəzərə almayın.
              </p>
            </td>
          </tr>
          <tr>
            <td style="background-color: #f9fafb; padding: 24px 30px; text-align: center; border-top: 1px solid #e5e7eb;">
              <p style="color: #9ca3af; font-size: 12px; margin: 0;">
                © 2026 Ticket Sistemi · <a href="mailto:info@zootrend.az" style="color: #6366f1; text-decoration: none;">info@zootrend.az</a>
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  const text = `
Ticket Sistemi - Email Təsdiq Kodu

Hörmətli ${firstName || 'İstifadəçi'},

${purposeText} aşağıdakı kodu istifadə edin:

${code}

Bu kod 10 dəqiqə ərzində etibarlıdır.

© 2026 Ticket Sistemi
info@zootrend.az
`;

  return { subject, html, text };
}

function statusChangedTemplate({ firstName, ticket, frontendUrl = 'http://localhost:3000' }) {
  const statusLabel = {
    pending: 'Gözləyən',
    in_progress: 'İcradadır',
    resolved: 'Həll Edildi',
  }[ticket.status] || ticket.status;

  const priorityLabel = {
    low: 'Aşağı',
    medium: 'Orta',
    high: 'Yüksək',
  }[ticket.priority] || ticket.priority;

  const subject = `[Ticket Sistemi] Müraciətiniz ${statusLabel.toLowerCase()}: ${ticket.displayId}`;

  const html = `
<!DOCTYPE html>
<html lang="az">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f3f4f6;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f3f4f6; padding: 40px 0;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="max-width: 600px; background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.08);">
          <tr>
            <td style="background: linear-gradient(135deg, #10b981 0%, #059669 50%, #047857 100%); padding: 40px 30px; text-align: center;">
              <div style="background-color: rgba(255,255,255,0.15); display: inline-block; padding: 16px; border-radius: 16px; margin-bottom: 16px;">
                <span style="font-size: 32px;">✓</span>
              </div>
              <h1 style="color: #ffffff; margin: 0; font-size: 28px; font-weight: 700;">Müraciət ${statusLabel}</h1>
              <p style="color: rgba(255,255,255,0.9); margin: 8px 0 0; font-size: 14px;">${ticket.displayId}</p>
            </td>
          </tr>
          <tr>
            <td style="padding: 40px 30px;">
              <p style="color: #1f2937; font-size: 16px; margin: 0 0 24px;">Hörmətli <strong>${firstName || 'İstifadəçi'}</strong>,</p>
              <p style="color: #4b5563; font-size: 15px; line-height: 1.6; margin: 0 0 24px;">
                Müraciətinizin statusu yeniləndi. Təfərrüatlar aşağıdadır:
              </p>
              <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f9fafb; border-radius: 12px; padding: 20px; margin-bottom: 24px;">
                <tr>
                  <td style="padding: 8px 0; color: #6b7280; font-size: 13px; width: 120px;">ID</td>
                  <td style="padding: 8px 0; color: #1f2937; font-size: 14px; font-weight: 600;">${ticket.displayId}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; color: #6b7280; font-size: 13px;">Başlıq</td>
                  <td style="padding: 8px 0; color: #1f2937; font-size: 14px; font-weight: 600;">${ticket.title}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; color: #6b7280; font-size: 13px;">Prioritet</td>
                  <td style="padding: 8px 0; color: #1f2937; font-size: 14px;">${priorityLabel}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; color: #6b7280; font-size: 13px;">Status</td>
                  <td style="padding: 8px 0; color: #1f2937; font-size: 14px; font-weight: 600;">${statusLabel}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; color: #6b7280; font-size: 13px;">Tarix</td>
                  <td style="padding: 8px 0; color: #1f2937; font-size: 14px;">${new Date(ticket.createdAt).toLocaleDateString('az-AZ')}</td>
                </tr>
              </table>
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center" style="padding: 0 0 24px;">
                    <a href="${frontendUrl}/tickets/${ticket._id}" style="display: inline-block; background: linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%); color: #ffffff; text-decoration: none; padding: 14px 32px; border-radius: 12px; font-size: 15px; font-weight: 600; box-shadow: 0 4px 12px rgba(79, 70, 229, 0.3);">
                      Login ol və bax →
                    </a>
                  </td>
                </tr>
              </table>
              <p style="color: #6b7280; font-size: 13px; line-height: 1.6; margin: 0;">
                Əlavə sualınız varsa, bizimlə əlaqə saxlayın.
              </p>
            </td>
          </tr>
          <tr>
            <td style="background-color: #f9fafb; padding: 24px 30px; text-align: center; border-top: 1px solid #e5e7eb;">
              <p style="color: #9ca3af; font-size: 12px; margin: 0;">
                © 2026 Ticket Sistemi · <a href="mailto:info@zootrend.az" style="color: #6366f1; text-decoration: none;">info@zootrend.az</a>
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  const text = `
Ticket Sistemi - Müraciət ${statusLabel}

Hörmətli ${firstName || 'İstifadəçi'},

Müraciətinizin statusu yeniləndi.

ID: ${ticket.displayId}
Başlıq: ${ticket.title}
Prioritet: ${priorityLabel}
Status: ${statusLabel}
Tarix: ${new Date(ticket.createdAt).toLocaleDateString('az-AZ')}

Detallara baxmaq üçün: ${frontendUrl}/tickets/${ticket._id}

© 2026 Ticket Sistemi
info@zootrend.az
`;

  return { subject, html, text };
}

function adminReplyTemplate({ firstName, ticket, commentText, frontendUrl = 'http://localhost:3000' }) {
  const subject = `[Ticket Sistemi] Admin cavab yazdı: ${ticket.displayId}`;

  const preview = commentText.length > 200
    ? commentText.substring(0, 200) + '...'
    : commentText;

  const html = `
<!DOCTYPE html>
<html lang="az">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f3f4f6;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f3f4f6; padding: 40px 0;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="max-width: 600px; background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.08);">
          <tr>
            <td style="background: linear-gradient(135deg, #4f46e5 0%, #7c3aed 50%, #ec4899 100%); padding: 40px 30px; text-align: center;">
              <div style="background-color: rgba(255,255,255,0.15); display: inline-block; padding: 16px; border-radius: 16px; margin-bottom: 16px;">
                <span style="font-size: 32px;">💬</span>
              </div>
              <h1 style="color: #ffffff; margin: 0; font-size: 28px; font-weight: 700;">Yeni Cavab</h1>
              <p style="color: rgba(255,255,255,0.9); margin: 8px 0 0; font-size: 14px;">${ticket.displayId}</p>
            </td>
          </tr>
          <tr>
            <td style="padding: 40px 30px;">
              <p style="color: #1f2937; font-size: 16px; margin: 0 0 24px;">Hörmətli <strong>${firstName || 'İstifadəçi'}</strong>,</p>
              <p style="color: #4b5563; font-size: 15px; line-height: 1.6; margin: 0 0 24px;">
                Müraciətinizə admin cavab yazdı:
              </p>
              <div style="background: linear-gradient(135deg, #f9fafb 0%, #f3f4f6 100%); border-left: 4px solid #4f46e5; border-radius: 8px; padding: 20px; margin-bottom: 24px;">
                <p style="color: #6b7280; font-size: 12px; margin: 0 0 8px; font-weight: 600;">Admin Cavabı:</p>
                <p style="color: #1f2937; font-size: 14px; line-height: 1.6; margin: 0; white-space: pre-wrap;">${preview.replace(/\n/g, '<br>')}</p>
              </div>
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center" style="padding: 0 0 24px;">
                    <a href="${frontendUrl}/tickets/${ticket._id}" style="display: inline-block; background: linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%); color: #ffffff; text-decoration: none; padding: 14px 32px; border-radius: 12px; font-size: 15px; font-weight: 600; box-shadow: 0 4px 12px rgba(79, 70, 229, 0.3);">
                      Login ol və cavabla →
                    </a>
                  </td>
                </tr>
              </table>
              <p style="color: #6b7280; font-size: 13px; line-height: 1.6; margin: 0;">
                Bu email-ə cavab verməyin — cavab yazmaq üçün sistemə daxil olun.
              </p>
            </td>
          </tr>
          <tr>
            <td style="background-color: #f9fafb; padding: 24px 30px; text-align: center; border-top: 1px solid #e5e7eb;">
              <p style="color: #9ca3af; font-size: 12px; margin: 0;">
                © 2026 Ticket Sistemi · <a href="mailto:info@zootrend.az" style="color: #6366f1; text-decoration: none;">info@zootrend.az</a>
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  const text = `
Ticket Sistemi - Admin Cavab

Hörmətli ${firstName || 'İstifadəçi'},

Müraciətinizə admin cavab yazdı:

${preview}

Detallara baxmaq üçün: ${frontendUrl}/tickets/${ticket._id}

© 2026 Ticket Sistemi
info@zootrend.az
`;

  return { subject, html, text };
}

module.exports = { otpTemplate, statusChangedTemplate, adminReplyTemplate };
