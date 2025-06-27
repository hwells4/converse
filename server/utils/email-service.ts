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

// Send invitation email
export async function sendInvitationEmail(
  email: string,
  invitationToken: string,
  invitedBy?: string
): Promise<void> {
  try {
    const transporter = createTransporter();
    
    // Check if email configuration is available
    if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
      console.warn("Email configuration not found. Skipping email send.");
      console.log(`Invitation token for ${email}: ${invitationToken}`);
      return;
    }

    const signupUrl = `${process.env.CLIENT_URL || "http://localhost:5000"}/sign-up?token=${invitationToken}`;
    
    const htmlContent = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Invitation to Converse AI Hub</title>
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
        .logo {
            background: #007bff;
            color: white;
            width: 60px;
            height: 60px;
            border-radius: 12px;
            display: inline-flex;
            align-items: center;
            justify-content: center;
            font-size: 24px;
            font-weight: bold;
            margin-bottom: 20px;
        }
        .button {
            display: inline-block;
            background: #007bff;
            color: white;
            padding: 14px 28px;
            text-decoration: none;
            border-radius: 6px;
            font-weight: 500;
            margin: 20px 0;
            font-size: 16px;
        }
        .token-box {
            background: #e3f2fd;
            border: 1px solid #90caf9;
            border-radius: 6px;
            padding: 15px;
            margin: 20px 0;
            font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
            font-size: 14px;
            word-break: break-all;
            text-align: center;
            color: #1565c0;
            font-weight: bold;
        }
        .footer {
            margin-top: 30px;
            padding-top: 20px;
            border-top: 1px solid #e9ecef;
            font-size: 14px;
            color: #666;
        }
        .highlight {
            background: #fff3cd;
            border-left: 4px solid #ffc107;
            padding: 12px 16px;
            margin: 20px 0;
            border-radius: 0 4px 4px 0;
        }
        .features {
            background: white;
            border-radius: 6px;
            padding: 20px;
            margin: 20px 0;
        }
        .feature-item {
            margin: 10px 0;
            display: flex;
            align-items: center;
        }
        .feature-icon {
            background: #e8f5e8;
            color: #2e7d32;
            width: 24px;
            height: 24px;
            border-radius: 50%;
            display: inline-flex;
            align-items: center;
            justify-content: center;
            margin-right: 12px;
            font-size: 14px;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <div class="logo">🤖</div>
            <h1>You're Invited to Converse AI Hub!</h1>
        </div>
        
        <p>Hello,</p>
        
        <p>You've been invited to join <strong>Converse AI Hub</strong>, our AI-powered document processing platform.${invitedBy ? ` This invitation was sent by ${invitedBy}.` : ''}</p>
        
        <div class="features">
            <h3 style="margin-top: 0; color: #1565c0;">What you can do with Converse AI Hub:</h3>
            <div class="feature-item">
                <span class="feature-icon">📄</span>
                <span>Upload and process insurance commission statements</span>
            </div>
            <div class="feature-item">
                <span class="feature-icon">🔍</span>
                <span>Extract data from PDFs automatically with AI</span>
            </div>
            <div class="feature-item">
                <span class="feature-icon">📊</span>
                <span>Generate structured CSV reports</span>
            </div>
            <div class="feature-item">
                <span class="feature-icon">⚡</span>
                <span>Integrate with Salesforce seamlessly</span>
            </div>
        </div>
        
        <p>To get started, click the button below to create your account:</p>
        
        <div style="text-align: center;">
            <a href="${signupUrl}" class="button">Create Your Account</a>
        </div>
        
        <div class="highlight">
            <strong>Your Invitation Token:</strong><br>
            If the button doesn't work, you can manually enter this token on the sign-up page:
        </div>
        
        <div class="token-box">
            ${invitationToken}
        </div>
        
        <p>Or copy and paste this link into your browser:</p>
        <p style="word-break: break-all; background: #f8f9fa; padding: 10px; border-radius: 4px; font-family: monospace; font-size: 12px;">
            ${signupUrl}
        </p>
        
        <div class="footer">
            <p><strong>Important:</strong> This invitation is unique to you and can only be used once. It will expire in 30 days.</p>
            <p>If you're having trouble with the button above, copy and paste the signup URL into your web browser.</p>
            <p>Welcome to the future of intelligent document processing!</p>
            <hr style="border: none; border-top: 1px solid #e9ecef; margin: 20px 0;">
            <p style="font-size: 12px; color: #999;">This is an automated message, please do not reply to this email.</p>
        </div>
    </div>
</body>
</html>
    `;

    const textContent = `
You're Invited to Converse AI Hub!

Hello,

You've been invited to join Converse AI Hub, our AI-powered document processing platform.${invitedBy ? ` This invitation was sent by ${invitedBy}.` : ''}

What you can do with Converse AI Hub:
• Upload and process insurance commission statements
• Extract data from PDFs automatically with AI  
• Generate structured CSV reports
• Integrate with Salesforce seamlessly

To get started, visit this link to create your account:
${signupUrl}

Your Invitation Token: ${invitationToken}

If the link doesn't work, go to the sign-up page and enter your invitation token manually.

Important: This invitation is unique to you and can only be used once. It will expire in 30 days.

Welcome to the future of intelligent document processing!

This is an automated message, please do not reply to this email.
    `;

    const mailOptions = {
      from: `"${process.env.FROM_NAME || "Converse AI Hub"}" <${process.env.SMTP_USER}>`,
      to: email,
      subject: "🎫 You're Invited to Converse AI Hub - AI-Powered Document Processing",
      text: textContent,
      html: htmlContent,
    };

    await transporter.sendMail(mailOptions);
    console.log(`Invitation email sent to: ${email}`);
  } catch (error) {
    console.error("Failed to send invitation email:", error);
    throw new Error("Failed to send invitation email");
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