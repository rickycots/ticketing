<?php
/**
 * PHPMailer wrapper — replaces Node.js mailer.js
 * Three accounts: ticketing@, assistenza@, noreply@
 */
use PHPMailer\PHPMailer\PHPMailer;

class Mailer {

    private static function createTransport(string $user, string $pass): ?PHPMailer {
        if (!$user || !$pass) return null;

        $mail = new PHPMailer(true);
        $mail->isSMTP();
        $mail->Host = MAIL_SMTP_HOST;
        $mail->Port = MAIL_SMTP_PORT;
        $mail->SMTPAuth = true;
        $mail->SMTPSecure = PHPMailer::ENCRYPTION_SMTPS;
        $mail->Username = $user;
        $mail->Password = $pass;
        $mail->setFrom($user, 'STM Domotica');
        $mail->CharSet = 'UTF-8';
        $mail->isHTML(true);

        return $mail;
    }

    private static function send(string $user, string $pass, string $to, string $subject, string $html, ?string $inReplyTo = null, ?string $bcc = null): ?string {
        $mail = self::createTransport($user, $pass);
        if (!$mail) {
            error_log("[MAIL] No credentials for {$user} — logging: To={$to} Subject={$subject}");
            return null;
        }

        try {
            // Handle multiple recipients
            $recipients = array_map('trim', explode(',', $to));
            foreach ($recipients as $addr) {
                if ($addr) $mail->addAddress($addr);
            }

            $mail->Subject = $subject;
            $mail->Body = $html;
            $mail->AltBody = strip_tags($html);

            if ($bcc) $mail->addBCC($bcc);

            if ($inReplyTo) {
                $mail->addCustomHeader('In-Reply-To', $inReplyTo);
                $mail->addCustomHeader('References', $inReplyTo);
            }

            // Embed logo if exists
            $logoPath = UPLOAD_DIR . '/LogoSTM.png';
            if (file_exists($logoPath)) {
                $mail->addEmbeddedImage($logoPath, 'logo-stm', 'LogoSTM.png');
            }

            $mail->send();
            return $mail->getLastMessageID();
        } catch (\Exception $e) {
            error_log("[MAIL] Send error: " . $e->getMessage());
            return null;
        }
    }

    public static function sendTicketing(string $to, string $subject, string $html, ?string $inReplyTo = null): ?string {
        return self::send(MAIL_TICKETING_USER, MAIL_TICKETING_PASS, $to, $subject, $html, $inReplyTo);
    }

    public static function sendAssistenza(string $to, string $subject, string $html, ?string $inReplyTo = null): ?string {
        return self::send(MAIL_ASSISTENZA_USER, MAIL_ASSISTENZA_PASS, $to, $subject, $html, $inReplyTo, 'riccardo@stmdomotica.it');
    }

    public static function sendNoreply(string $to, string $subject, string $html): ?string {
        return self::send(MAIL_NOREPLY_USER, MAIL_NOREPLY_PASS, $to, $subject, $html);
    }

    /**
     * Wrap HTML content in email template
     */
    public static function wrapEmailTemplate(string $content): string {
        return '<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#f4f4f4;font-family:Arial,Helvetica,sans-serif">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f4;padding:20px 0">
<tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08)">
<tr><td style="background:#1a1a2e;padding:20px 30px;text-align:center">
<img src="cid:logo-stm" alt="STM Domotica" style="height:40px;width:auto" />
</td></tr>
<tr><td style="padding:30px;font-size:14px;color:#333;line-height:1.6">' . $content . '</td></tr>
<tr><td style="background:#f8f8f8;padding:15px 30px;text-align:center;font-size:11px;color:#999;border-top:1px solid #eee">
&copy; ' . date('Y') . ' STM Domotica Corporation S.r.l. — Tutti i diritti riservati
</td></tr>
</table>
</td></tr>
</table>
</body>
</html>';
    }
}
