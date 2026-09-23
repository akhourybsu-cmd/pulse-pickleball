/** Email-safe table layout; no external fonts, scripts or tracking pixels. */
export function mfaEmail(code: string, purpose: 'sign_in' | 'enroll') {
  if (!/^\d{6}$/.test(code)) throw new Error('Invalid verification code');
  const heading = purpose === 'enroll' ? 'Protect your PULSE account' : 'Your next step starts here';
  const message = purpose === 'enroll' ? 'Enter this code in PULSE to turn on email verification for your account.' : 'Enter this code in PULSE to finish signing in. Your assessment will be waiting when you return.';
  return {
    from: 'PULSE <support@pulsepb.com>',
    reply_to: 'support@pulsepb.com',
    subject: 'Your PULSE verification code',
    text: `${heading}\n\n${message}\n\n${code}\n\nThis code expires in 10 minutes and works only in the session that requested it. Never share it. If you did not request this code, you can ignore this email.\n\nPULSE Pickleball · https://pulsepb.com\nNeed help? support@pulsepb.com`,
    html: `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>PULSE verification</title></head>
<body style="margin:0;background:#f5f1e7;color:#1b1d21;font-family:Arial,Helvetica,sans-serif">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0"><tr><td align="center" style="padding:32px 16px">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;background:#ffffff;border-radius:20px;overflow:hidden">
<tr><td style="padding:28px 28px 24px;background:#1b1d21;color:#f5f1e7;border-bottom:4px solid #d8a643">
<img src="https://pulsepb.com/pulse-icon.jpg" width="56" height="56" alt="PULSE heartbeat logo" style="display:block;border:0;border-radius:12px;margin-bottom:16px">
<p style="font-size:28px;font-weight:bold;letter-spacing:5px;margin:0">PULSE</p><p style="font-size:12px;letter-spacing:3px;margin:6px 0 0;color:#dfbb73">PICKLEBALL</p></td></tr>
<tr><td style="padding:28px"><h1 style="font-size:25px;line-height:1.3;margin:0 0 18px">${heading}</h1>
<p style="font-size:16px;line-height:1.6;margin:0 0 24px">${message}</p>
<p style="font-family:Consolas,monospace;font-size:36px;letter-spacing:7px;font-weight:bold;text-align:center;background:#f5f1e7;border:1px solid #d8a643;border-radius:12px;padding:22px 10px;margin:0 0 24px">${code}</p>
<p style="font-size:14px;line-height:1.6;color:#555b61;margin:0 0 16px">Expires in <strong>10 minutes</strong>. Use it only in the sign-in session that requested it. Never share your code.</p>
<p style="font-size:14px;line-height:1.6;color:#555b61;margin:0">Didn’t request this code? You can ignore this email.</p></td></tr></table>
<p style="font-size:13px;line-height:1.8;color:#555b61">Know your game. Keep growing.<br><a href="https://pulsepb.com" style="color:#1b1d21">PULSE Pickleball</a> · <a href="mailto:support@pulsepb.com" style="color:#1b1d21">Get help</a></p>
</td></tr></table></body></html>`,
  };
}
