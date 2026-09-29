export interface VenueEmailBrand {
  name: string;
  logo_url?: string | null;
  primary_color?: string | null;
  address?: string | null;
  city?: string | null;
  state?: string | null;
}
export interface VenueEmailContent {
  subject: string;
  body: string;
  footer?: string;
  venueUrl: string;
  unsubscribeUrl?: string;
}
const escape = (value: string) =>
  value.replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ]!,
  );
function https(value?: string | null) {
  try {
    const u = new URL(value || "");
    return u.protocol === "https:" && !u.username && !u.password
      ? u.href
      : null;
  } catch {
    return null;
  }
}
export function renderVenueEmail(
  brand: VenueEmailBrand,
  content: VenueEmailContent,
) {
  const name = escape(brand.name),
    subject = escape(content.subject);
  const color = /^#[a-f\d]{6}$/i.test(brand.primary_color || "")
    ? brand.primary_color!
    : "#A9CF46";
  const logo = https(brand.logo_url),
    venueUrl = https(content.venueUrl) || "https://pulsepb.com";
  const unsubscribe = https(content.unsubscribeUrl);
  const address = [brand.address, brand.city, brand.state]
    .filter(Boolean)
    .join(", ");
  const body = escape(content.body).replace(/\r?\n/g, "<br>");
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${subject}</title></head><body style="margin:0;background:#f3f5f4;font-family:Arial,Helvetica,sans-serif;color:#15251d"><table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td style="padding:28px 12px"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;margin:auto;background:#ffffff;border-radius:20px;overflow:hidden;border:1px solid #dce3de"><tr><td style="height:8px;background:${color}"></td></tr><tr><td style="padding:32px 28px 8px">${logo ? `<img src="${escape(logo)}" alt="${name}" width="88" style="display:block;width:88px;height:auto;max-height:100px;object-fit:contain;margin-bottom:20px">` : ""}<p style="margin:0 0 20px;font-size:13px;font-weight:bold;letter-spacing:1px">${name}</p><h1 style="font-size:26px;line-height:1.25;margin:0 0 24px;overflow-wrap:anywhere">${subject}</h1><p style="font-size:16px;line-height:1.7;margin:0 0 28px;overflow-wrap:anywhere">${body}</p><a href="${escape(venueUrl)}" style="display:inline-block;background:#15251d;color:#ffffff;border:2px solid ${color};border-radius:10px;padding:14px 22px;text-decoration:none;font-weight:bold">Visit ${name}</a><p style="font-size:14px;line-height:1.6;margin:28px 0">${escape(content.footer || `See you on the courts,\n${brand.name}`).replace(/\n/g, "<br>")}</p></td></tr><tr><td style="border-top:1px solid #e4e9e5;padding:24px 28px;font-size:12px;color:#59655e;line-height:1.7">${name}${address ? `<br>${escape(address)}` : ""}<br>Sent with PULSE${unsubscribe ? `<br>You subscribed to email updates from this venue.<br><a href="${escape(unsubscribe)}" style="color:#34483b">Unsubscribe from this venue’s emails</a>` : "<br>This is a setup test requested by your venue account."}</td></tr></table></td></tr></table></body></html>`;
  const text = `${brand.name}\n\n${content.subject}\n\n${content.body}\n\nVisit ${brand.name}: ${venueUrl}\n\n${content.footer || `See you on the courts,\n${brand.name}`}\n\n${address}\nSent with PULSE${unsubscribe ? `\nUnsubscribe: ${unsubscribe}` : "\nThis is a setup test requested by your venue account."}`;
  return { html, text };
}
