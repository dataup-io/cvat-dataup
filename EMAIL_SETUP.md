# Email Setup for CVAT Invitations

This guide explains how to configure email functionality in CVAT to enable organization invitations and user notifications.

## Overview

CVAT uses Django's email framework to send invitation emails when users are invited to organizations. By default, the email backend is set to console output (for development), but for production use, you need to configure an SMTP server.

## Configuration

### 1. Environment Variables

Create a `.env` file in your CVAT root directory with the following email configuration:

```bash
# SMTP Server Configuration
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USE_TLS=True
EMAIL_USE_SSL=False

# SMTP Authentication
EMAIL_HOST_USER=your-email@gmail.com
EMAIL_HOST_PASSWORD=your-app-password

# Email Addresses
DEFAULT_FROM_EMAIL=noreply@yourdomain.com
SERVER_EMAIL=admin@yourdomain.com

# Email Timeout (seconds)
EMAIL_TIMEOUT=60
```

### 2. Docker Compose Setup

CVAT provides a Docker Compose override file for email configuration:

```bash
# Start CVAT with email configuration
docker-compose -f docker-compose.yml -f tests/docker-compose.email.yml up
```

The `tests/docker-compose.email.yml` file configures both the CVAT server and the notifications worker (`cvat_worker_utils`) with email settings. This worker is responsible for processing invitation emails and other notifications.

#### Services Configured for Email

- **cvat_server**: Main CVAT application server
- **cvat_worker_utils**: Background worker that handles notifications and invitation emails

Both services use the `cvat.settings.email_settings` Django settings module and share the same email configuration.

### 3. Django Settings

The email configuration is handled in `cvat/settings/email_settings.py`. This file:
- Sets the email backend to SMTP
- Configures SMTP settings from environment variables
- Enables mandatory email verification
- Sets up proper email authentication

## Common SMTP Providers

### Gmail
```bash
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USE_TLS=True
EMAIL_HOST_USER=your-email@gmail.com
EMAIL_HOST_PASSWORD=your-app-password  # Use App Password, not regular password
```

**Note**: For Gmail, you need to:
1. Enable 2-factor authentication
2. Generate an App Password
3. Use the App Password instead of your regular password

### Outlook/Hotmail
```bash
EMAIL_HOST=smtp-mail.outlook.com
EMAIL_PORT=587
EMAIL_USE_TLS=True
EMAIL_HOST_USER=your-email@outlook.com
EMAIL_HOST_PASSWORD=your-password
```

### Yahoo
```bash
EMAIL_HOST=smtp.mail.yahoo.com
EMAIL_PORT=587
EMAIL_USE_TLS=True
EMAIL_HOST_USER=your-email@yahoo.com
EMAIL_HOST_PASSWORD=your-app-password
```

### Custom SMTP Server
```bash
EMAIL_HOST=mail.yourdomain.com
EMAIL_PORT=587
EMAIL_USE_TLS=True
EMAIL_HOST_USER=your-email@yourdomain.com
EMAIL_HOST_PASSWORD=your-password
```

## Testing Email Configuration

### 1. Automated Test Script

Use the provided test script to verify your email configuration:

```bash
# Run the email configuration test
python3 test_email_setup.py
```

This script will:
- Check all email configuration settings
- Send a test email
- Verify invitation functionality
- Provide troubleshooting guidance

### 2. Console Backend (Development)
For development/testing, you can use the console backend:
```bash
EMAIL_BACKEND=django.core.mail.backends.console.EmailBackend
```
This will print emails to the console instead of sending them.

### 3. Test Email Sending
To test if email is working:
1. Start CVAT with email configuration
2. Create an organization
3. Invite a user to the organization
4. Check if the invitation email is sent

### 4. Check Logs
If emails are not being sent, check the CVAT server logs:
```bash
docker compose logs cvat_server
```

Look for email-related errors or SMTP connection issues.

## Troubleshooting

### Common Issues

1. **SMTP Authentication Failed**
   - Verify username and password
   - For Gmail, ensure you're using an App Password
   - Check if 2FA is enabled and configured properly

2. **Connection Timeout**
   - Verify EMAIL_HOST and EMAIL_PORT
   - Check firewall settings
   - Ensure TLS/SSL settings are correct

3. **Emails Not Received**
   - Check spam/junk folders
   - Verify DEFAULT_FROM_EMAIL is a valid address
   - Check email provider's sending limits

4. **SSL/TLS Issues**
   - Use EMAIL_USE_TLS=True for port 587
   - Use EMAIL_USE_SSL=True for port 465
   - Don't use both TLS and SSL simultaneously

### Debug Mode
To debug email issues, you can temporarily use the console backend:
```bash
EMAIL_BACKEND=django.core.mail.backends.console.EmailBackend
```

## Security Considerations

1. **Never commit credentials**: Keep email passwords in environment variables, not in code
2. **Use App Passwords**: For providers like Gmail, use app-specific passwords
3. **Secure connections**: Always use TLS or SSL for SMTP connections
4. **Limit permissions**: Use dedicated email accounts with minimal permissions

## Email Templates

CVAT uses Django templates for email content. The invitation email template is located at:
`cvat/apps/organizations/templates/invitation/invitation_message.html`

You can customize this template to match your organization's branding.

## Environment Variables Reference

| Variable | Description | Default | Example |
|----------|-------------|---------|----------|
| EMAIL_HOST | SMTP server hostname | localhost | smtp.gmail.com |
| EMAIL_PORT | SMTP server port | 587 | 587 |
| EMAIL_USE_TLS | Use TLS encryption | True | True |
| EMAIL_USE_SSL | Use SSL encryption | False | False |
| EMAIL_HOST_USER | SMTP username | "" | user@gmail.com |
| EMAIL_HOST_PASSWORD | SMTP password | "" | app-password |
| DEFAULT_FROM_EMAIL | Default sender address | noreply@cvat.ai | noreply@company.com |
| SERVER_EMAIL | Server error email address | DEFAULT_FROM_EMAIL | admin@company.com |
| EMAIL_TIMEOUT | SMTP timeout in seconds | 60 | 60 |
| EMAIL_BACKEND | Email backend class | smtp.EmailBackend | console.EmailBackend |

## Next Steps

After configuring email:
1. Test the invitation functionality
2. Customize email templates if needed
3. Set up monitoring for email delivery
4. Configure email notifications for other CVAT features