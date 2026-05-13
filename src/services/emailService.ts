import { collection, query, where, getDocs, doc, getDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';

export interface EmailTemplate {
  id: string;
  name: string;
  subject: string;
  content: string;
  recipients: string[];
  active: boolean;
  event: string;
}

export interface EmailSettings {
  enabled: boolean;
  adminEmail: string;
}

export const emailService = {
  async getSettings(): Promise<EmailSettings | null> {
    const snap = await getDoc(doc(db, 'settings', 'email'));
    return snap.exists() ? (snap.data() as EmailSettings) : null;
  },

  async getTemplate(event: string): Promise<EmailTemplate | null> {
    const q = query(collection(db, 'email-templates'), where('event', '==', event), where('active', '==', true));
    const snap = await getDocs(q);
    return snap.empty ? null : { id: snap.docs[0].id, ...snap.docs[0].data() } as EmailTemplate;
  },

  isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  },

  async sendEmail(to: string | string[], subject: string, html: string) {
    if (!to || (Array.isArray(to) && to.length === 0)) return { success: false, error: 'No recipient email provided' };
    
    // Check if any provided emails are valid
    const emails = Array.isArray(to) ? to : [to];
    const validEmails = emails.filter(this.isValidEmail);
    if (validEmails.length === 0) {
      return { 
        success: false, 
        error: `Invalid email format for all recipients.` 
      };
    }

    try {
      const response = await fetch('/api/send-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ to: validEmails, subject, html })
      });
      return await response.json();
    } catch (error) {
      console.error('Failed to send Email:', error);
      return { success: false, error };
    }
  },

  async notify(eventName: string, data: any) {
    const settings = await this.getSettings();
    if (!settings?.enabled) {
      console.log('Email notifications are disabled globally');
      return;
    }

    const template = await this.getTemplate(eventName);
    if (!template) {
      console.log(`No active Email template found for event: ${eventName}`);
      return;
    }

    let subject = template.subject;
    let htmlContent = template.content;
    
    // Basic placeholder replacement for subject and content
    Object.keys(data).forEach(key => {
      const value = data[key] || '';
      const regex = new RegExp(`{${key}}`, 'g');
      subject = subject.replace(regex, String(value));
      htmlContent = htmlContent.replace(regex, String(value));
    });

    const promises = [];

    // Handle recipients
    if (template.recipients.includes('customer') && data.customerEmail) {
      promises.push(this.sendEmail(data.customerEmail, subject, htmlContent));
    }

    if (template.recipients.includes('admin') && settings.adminEmail) {
      promises.push(this.sendEmail(settings.adminEmail, subject, htmlContent));
    }
    
    if (template.recipients.includes('driver') && data.driverEmail) { // driverEmail might need to be resolved correctly from data or driver object
      promises.push(this.sendEmail(data.driverEmail, subject, htmlContent));
    }

    await Promise.all(promises);
  }
};
