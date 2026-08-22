const sgMail = require('@sendgrid/mail');

sgMail.setApiKey(process.env.SENDGRID_API_KEY || '');

async function sendVerificationEmail(email, verificationToken) {
  const verificationUrl = `http://localhost:5173/verify-email?token=${verificationToken}`;

  const msg = {
    to: email,
    from: 'noreply@tremega.com',
    subject: 'Verify your Tremega account',
    html: `
      <h1>Welcome to Tremega</h1>
      <p>Click the link below to verify your email address:</p>
      <a href="${verificationUrl}" style="padding: 10px 20px; background: #3B2F8A; color: white; text-decoration: none; border-radius: 5px;">
        Verify Email
      </a>
      <p>Or copy this link: ${verificationUrl}</p>
      <p>This link expires in 24 hours.</p>
    `,
  };

  try {
    await sgMail.send(msg);
    return { success: true };
  } catch (error) {
    console.error('Email send error:', error);
    throw error;
  }
}

module.exports = { sendVerificationEmail };
