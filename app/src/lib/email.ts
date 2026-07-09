import nodemailer from "nodemailer";

// Reuse a single transporter across requests (created lazily so it doesn't
// run at build time when env vars aren't available).
let transporter: nodemailer.Transporter | null = null;

function getTransporter() {
  if (!transporter) {
    transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: process.env.GMAIL_USER,       // your full gmail address
        pass: process.env.GMAIL_APP_PASSWORD, // 16-char app password
      },
    });
  }
  return transporter;
}

export async function sendVerificationCode(to: string, code: string) {
  const from = process.env.GMAIL_USER;

  await getTransporter().sendMail({
    from: `"Linguana" <${from}>`,
    to,
    subject: `Your Linguana verification code: ${code}`,
    text: `Your verification code is ${code}. It expires in 10 minutes.`,
    html: `
      <div style="font-family: sans-serif; max-width: 420px; margin: 0 auto; padding: 24px;">
        <h2 style="color: #4338CA; margin-bottom: 8px;">Verify your email</h2>
        <p style="color: #4b5563; font-size: 15px;">
          Enter this code in Linguana to finish signing in:
        </p>
        <div style="font-size: 34px; font-weight: 800; letter-spacing: 8px;
                    color: #22C55E; text-align: center; padding: 20px 0;">
          ${code}
        </div>
        <p style="color: #9ca3af; font-size: 13px;">
          This code expires in 10 minutes. If you didn't request it, you can ignore this email.
        </p>
      </div>
    `,
  });
}