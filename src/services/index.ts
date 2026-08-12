export class SmtpService {
  async sendMail(to: string, subject: string, body: string): Promise<void> {
    console.log(`[SMTP] Sending email to: ${to} | Subject: ${subject}`);
  }
}

export class ImapService {
  async fetchMails(): Promise<void> {
    console.log('[IMAP] Fetching incoming emails...');
  }
}

export * as campanaService from './campanaService.js';
