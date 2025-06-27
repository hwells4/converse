import nodemailer from "nodemailer";

// Email transporter configuration
const createTransporter = () => {
  const emailConfig = {
    host: process.env.SMTP_HOST || "smtp.gmail.com",
    port: parseInt(process.env.SMTP_PORT || "587"),
    secure: process.env.SMTP_SECURE === "true", // true for 465, false for other ports
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  };

  return nodemailer.createTransport(emailConfig);
};

// Send password reset email
export async function sendPasswordResetEmail(
  email: string,
  username: string,
  resetToken: string
): Promise<void> {
  try {
    const transporter = createTransporter();
    
    // Check if email configuration is available
    if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
      console.warn("Email configuration not found. Skipping email send.");
      console.log(`Password reset token for ${username}: ${resetToken}`);
      return;
    }

    const resetUrl = `${process.env.CLIENT_URL || "http://localhost:5000"}/reset-password?token=${resetToken}`;
    
    const htmlContent = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Password Reset</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
            line-height: 1.6;
            color: #333;
            max-width: 600px;
            margin: 0 auto;
            padding: 20px;
        }
        .container {
            background: #f8f9fa;
            border-radius: 8px;
            padding: 30px;
            margin: 20px 0;
        }
        .header {
            text-align: center;
            margin-bottom: 30px;
        }
        .button {
            display: inline-block;
            background: #007bff;
            color: white;
            padding: 12px 24px;
            text-decoration: none;
            border-radius: 6px;
            font-weight: 500;
            margin: 20px 0;
        }
        .footer {
            margin-top: 30px;
            padding-top: 20px;
            border-top: 1px solid #e9ecef;
            font-size: 14px;
            color: #666;
        }
        .warning {
            background: #fff3cd;
            border: 1px solid #ffeaa7;
            border-radius: 4px;
            padding: 12px;
            margin: 20px 0;
            color: #856404;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>Password Reset Request</h1>
        </div>
        
        <p>Hello ${username},</p>
        
        <p>We received a request to reset your password. If you didn't make this request, you can safely ignore this email.</p>
        
        <p>To reset your password, click the button below:</p>
        
        <div style="text-align: center;">
            <a href="${resetUrl}" class="button">Reset Password</a>
        </div>
        
        <p>Or copy and paste this link into your browser:</p>
        <p style="word-break: break-all; background: #f8f9fa; padding: 10px; border-radius: 4px; font-family: monospace;">
            ${resetUrl}
        </p>
        
        <div class="warning">
            <strong>Security Notice:</strong> This password reset link will expire in 1 hour for your security.
        </div>
        
        <div class="footer">
            <p>If you're having trouble with the button above, copy and paste the URL into your web browser.</p>
            <p>This is an automated message, please do not reply to this email.</p>
        </div>
    </div>
</body>
</html>
    `;

    const textContent = `
Password Reset Request

Hello ${username},

We received a request to reset your password. If you didn't make this request, you can safely ignore this email.

To reset your password, visit this link:
${resetUrl}

This password reset link will expire in 1 hour for your security.

If you're having trouble, copy and paste the URL into your web browser.

This is an automated message, please do not reply to this email.
    `;

    const mailOptions = {
      from: `"${process.env.FROM_NAME || "Converse AI Hub"}" <${process.env.SMTP_USER}>`,
      to: email,
      subject: "Password Reset Request",
      text: textContent,
      html: htmlContent,
    };

    await transporter.sendMail(mailOptions);
    console.log(`Password reset email sent to: ${email}`);
  } catch (error) {
    console.error("Failed to send password reset email:", error);
    throw new Error("Failed to send password reset email");
  }
}

// Test email configuration
export async function testEmailConfiguration(): Promise<boolean> {
  try {
    if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
      console.warn("Email configuration not found");
      return false;
    }

    const transporter = createTransporter();
    await transporter.verify();
    console.log("Email configuration is valid");
    return true;
  } catch (error) {
    console.error("Email configuration test failed:", error);
    return false;
  }
}