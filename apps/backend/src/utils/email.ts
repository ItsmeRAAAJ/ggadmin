import { env } from "../config/env.js";

type BrevoEmailRecipient = {
  email: string;
  name?: string;
};

/**
 * Send a transactional email through Brevo. Throws on failure so callers can react
 * (e.g. roll back an OTP that never reached the user).
 */
export async function sendEmail({
  to,
  subject,
  htmlContent,
}: {
  to: BrevoEmailRecipient[];
  subject: string;
  htmlContent: string;
}): Promise<void> {
  if (!env.BREVO_API_KEY) {
    if (env.NODE_ENV === "production") {
      throw new Error("Email delivery is not configured (BREVO_API_KEY missing)");
    }
    // Development fallback — log instead of sending
    console.log("[EMAIL:dev] Would send email:", { to, subject });
    const otpMatch = htmlContent.match(/data-otp="(\d+)"/);
    if (otpMatch) console.log(`[EMAIL:dev] OTP for ${to.map((t) => t.email).join(", ")}: ${otpMatch[1]}`);
    return;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10_000);
  try {
    const response = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      signal: controller.signal,
      headers: {
        "api-key": env.BREVO_API_KEY,
        accept: "application/json",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        sender: { email: env.BREVO_SENDER_EMAIL, name: env.BREVO_SENDER_NAME },
        to,
        subject,
        htmlContent,
      }),
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`Brevo API error ${response.status}: ${body.slice(0, 300)}`);
    }
  } finally {
    clearTimeout(timeout);
  }
}

export function buildOtpEmail(otp: string, purpose: string, username: string = "Student"): string {
  const purposeLabel =
    purpose === "FIRST_LOGIN" ? "activate your account" : "reset your password";

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Verify Your Email - My GGITS</title>
</head>
<body style="margin:0;padding:0;background-color:#F8FAFC;font-family:'Segoe UI',Tahoma,Geneva,Verdana,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#F8FAFC;padding:40px 0;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color:#FFFFFF;border-radius:16px;border:1px solid #E2E8F0;overflow:hidden;max-width:600px;width:100%;">
          
          <!-- Header -->
          <tr>
            <td style="background:linear-gradient(135deg,#3B82F6 0%,#1D4ED8 100%);padding:36px 40px;text-align:center;">
              <p style="margin:0 0 4px 0;font-size:11px;font-weight:700;letter-spacing:3px;text-transform:uppercase;color:rgba(255,255,255,0.7);">Gyan Ganga Training &amp; Placement</p>
              <h1 style="margin:0;font-size:26px;font-weight:800;color:#FFFFFF;letter-spacing:-0.5px;">My GGITS</h1>
              <p style="margin:8px 0 0 0;font-size:13px;color:rgba(255,255,255,0.8);">Student Portal</p>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:40px;">
              <p style="margin:0 0 8px 0;font-size:14px;color:#94A3B8;text-transform:uppercase;letter-spacing:1px;font-weight:600;">Hello,</p>
              <h2 style="margin:0 0 20px 0;font-size:22px;font-weight:700;color:#0F172A;">${username} 👋</h2>

              <p style="margin:0 0 28px 0;font-size:15px;color:#475569;line-height:1.7;">
                Welcome to the My GGITS App! You&apos;re just one step away. 
                Use the OTP below to ${purposeLabel}.
              </p>

              <!-- OTP Box -->
              <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:28px;">
                <tr>
                  <td align="center">
                    <div style="display:inline-block;background:linear-gradient(135deg,#EFF6FF 0%,#DBEAFE 100%);border:2px dashed #3B82F6;border-radius:12px;padding:24px 40px;">
                      <p style="margin:0 0 8px 0;font-size:11px;font-weight:700;letter-spacing:2px;color:#3B82F6;text-transform:uppercase;">Your OTP Code</p>
                      <p data-otp="${otp}" style="margin:0;font-size:42px;font-weight:900;letter-spacing:16px;color:#1D4ED8;font-family:'Courier New',monospace;">${otp}</p>
                    </div>
                  </td>
                </tr>
              </table>

              <!-- Warning -->
              <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:28px;">
                <tr>
                  <td style="background-color:#FEF2F2;border-left:4px solid #EF4444;border-radius:0 8px 8px 0;padding:14px 16px;">
                    <p style="margin:0;font-size:13px;color:#DC2626;line-height:1.6;">
                      <strong>⚠️ Note :</strong> This OTP is valid for <strong>10 minutes</strong>. 
                      Do not share it with anyone.
                    </p>
                  </td>
                </tr>
              </table>

              <p style="margin:0;font-size:13px;color:#94A3B8;line-height:1.6;text-align:center;">
                If you did not request this, you can safely ignore this email.
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color:#F8FAFC;border-top:1px solid #E2E8F0;padding:24px 40px;text-align:center;">
              <p style="margin:0 0 6px 0;font-size:13px;font-weight:700;color:#0F172A;">Training &amp; Placement Cell</p>
              <p style="margin:0;font-size:12px;color:#94A3B8;">Gyan Ganga Institute of Technology &amp; Sciences, Jabalpur</p>
              <p style="margin:12px 0 0 0;font-size:11px;color:#CBD5E1;">© 2026 GGITS. Officially backed by the Training & Placement Cell, Gyan Ganga.</p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `;
}
