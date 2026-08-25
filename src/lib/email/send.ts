// No real email provider is wired up yet (Gmail/Resend/SMTP — pick one when
// ready). Everything upstream of this function — the approval step, the
// notification, the audit-trail Activity — is fully built; swapping this
// body for a real provider is the only change needed to actually deliver.

export type SendEmailInput = {
  to: string;
  subject: string;
  text: string;
};

export type SendEmailResult = {
  delivered: boolean;
  simulated: boolean;
};

export async function sendEmail(input: SendEmailInput): Promise<SendEmailResult> {
  console.log(`[simulated email — not actually sent] to=${input.to} subject="${input.subject}"`);
  return { delivered: false, simulated: true };
}
