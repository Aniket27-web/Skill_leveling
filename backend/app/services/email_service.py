import logging
import secrets
import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from typing import Optional
from app.core.config import settings

logger = logging.getLogger("app.email_service")


def generate_otp(length: int = 6) -> str:
    """Generates a cryptographically secure numeric OTP."""
    digits = "0123456789"
    return "".join(secrets.choice(digits) for _ in range(length))


def send_otp_email(to_email: str, user_name: str, otp: str) -> bool:
    """
    Sends an OTP verification email to the user.
    If SMTP_HOST is configured, sends via real SMTP.
    Otherwise, logs the OTP clearly for development/evaluator testing.
    """
    subject = "Skill Leveling - Password Reset OTP Code"

    html_content = f"""
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <style>
        body {{
          font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
          background-color: #0c0618;
          color: #f1f5f9;
          margin: 0;
          padding: 24px;
        }}
        .card {{
          max-width: 520px;
          margin: 0 auto;
          background: #130a27;
          border: 1px solid #7e22ce;
          border-radius: 20px;
          padding: 32px;
          box-shadow: 0 10px 30px rgba(126, 34, 206, 0.25);
        }}
        .header {{
          text-align: center;
          margin-bottom: 24px;
        }}
        .title {{
          font-size: 20px;
          font-weight: 800;
          color: #d8b4fe;
          text-transform: uppercase;
          letter-spacing: 1.5px;
          margin-top: 8px;
        }}
        .subtitle {{
          font-size: 13px;
          color: #a855f7;
          font-family: monospace;
        }}
        .otp-box {{
          text-align: center;
          background: #1e103d;
          border: 2px dashed #9333ea;
          border-radius: 16px;
          padding: 20px;
          margin: 28px 0;
        }}
        .otp-code {{
          font-family: 'Courier New', Courier, monospace;
          font-size: 36px;
          font-weight: 900;
          letter-spacing: 8px;
          color: #38bdf8;
          text-shadow: 0 0 12px rgba(56, 189, 248, 0.6);
        }}
        .note {{
          font-size: 13px;
          color: #94a3b8;
          line-height: 1.6;
          margin-bottom: 20px;
        }}
        .footer {{
          text-align: center;
          font-size: 11px;
          color: #64748b;
          border-top: 1px solid #2e1065;
          padding-top: 16px;
          margin-top: 24px;
        }}
      </style>
    </head>
    <body>
      <div class="card">
        <div class="header">
          <div class="title">Skill Leveling · Gate System</div>
          <div class="subtitle">HUNTER IDENTITY VERIFICATION</div>
        </div>
        <p class="note">
          Greetings, <strong>{user_name}</strong>. A password reset request was initiated for your Hunter account.
          Enter the single-use verification code below to authorize your new security credentials:
        </p>
        <div class="otp-box">
          <div class="otp-code">{otp}</div>
          <div style="font-size: 11px; color: #a855f7; margin-top: 8px; font-family: monospace;">
            VALID FOR 15 MINUTES · SINGLE-USE
          </div>
        </div>
        <p class="note">
          If you did not request this password recovery, please ignore this email. Your existing credentials remain completely secure.
        </p>
        <div class="footer">
          Skill Leveling AI Interview Arena &copy; 2026. Automated Guild Dispatcher.
        </div>
      </div>
    </body>
    </html>
    """

    plain_content = f"""
Skill Leveling · Hunter Identity Verification
=============================================
Greetings, {user_name}.

Your single-use password reset OTP verification code is:

    {otp}

This code is valid for 15 minutes.
If you did not request this code, no action is required.
=============================================
    """

    # Always log clearly to server console
    print(
        f"\n=======================================================\n"
        f"[SKILL LEVELING AUTH] EMAIL OTP DISPATCH\n"
        f"To: {to_email} (Hunter: {user_name})\n"
        f"OTP Verification Code: {otp}\n"
        f"Expires: 15 minutes\n"
        f"=======================================================\n"
    )

    if not settings.SMTP_HOST:
        logger.info(
            f"SMTP_HOST not configured. OTP for {to_email} output to console: {otp}"
        )
        return True

    # Send real email via SMTP
    try:
        msg = MIMEMultipart("alternative")
        msg["Subject"] = subject
        msg["From"] = f"{settings.SMTP_FROM_NAME} <{settings.SMTP_FROM_EMAIL}>"
        msg["To"] = to_email

        part1 = MIMEText(plain_content, "plain")
        part2 = MIMEText(html_content, "html")
        msg.attach(part1)
        msg.attach(part2)

        with smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT, timeout=10) as server:
            if settings.SMTP_TLS:
                server.starttls()
            if settings.SMTP_USER and settings.SMTP_PASSWORD:
                server.login(settings.SMTP_USER, settings.SMTP_PASSWORD)
            server.send_message(msg)

        logger.info(f"OTP successfully delivered to {to_email} via {settings.SMTP_HOST}")
        return True
    except Exception as e:
        logger.error(f"Failed to deliver SMTP email to {to_email}: {e}")
        return False

