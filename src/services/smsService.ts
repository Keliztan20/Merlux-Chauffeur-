import { collection, query, where, getDocs, doc, getDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';

export interface SMSTemplate {
  id: string;
  name: string;
  content: string;
  recipients: string[];
  active: boolean;
}

export interface SMSSettings {
  enabled: boolean;
  adminPhone: string;
}

export const smsService = {
  async getSettings(): Promise<SMSSettings | null> {
    const snap = await getDoc(doc(db, 'settings', 'sms'));
    return snap.exists() ? (snap.data() as SMSSettings) : null;
  },

  async getTemplate(event: string): Promise<SMSTemplate | null> {
    const q = query(collection(db, 'sms-templates'), where('event', '==', event), where('active', '==', true));
    const snap = await getDocs(q);
    return snap.empty ? null : { id: snap.docs[0].id, ...snap.docs[0].data() } as SMSTemplate;
  },

  isValidPhone(phone: string): boolean {
    const e164Regex = /^\+[1-9]\d{1,14}$/;
    return e164Regex.test(phone);
  },

  async sendSMS(to: string, message: string) {
    if (!to) return { success: false, error: 'No recipient phone number provided' };
    if (!this.isValidPhone(to)) {
      return { 
        success: false, 
        error: `Invalid phone format: ${to}. Numbers must be in E.164 format (e.g., +1234567890).` 
      };
    }
    try {
      const response = await fetch('/api/send-sms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ to, message })
      });
      return await response.json();
    } catch (error) {
      console.error('Failed to send SMS:', error);
      return { success: false, error };
    }
  },

  async notify(eventName: string, data: any) {
    const settings = await this.getSettings();
    if (!settings?.enabled) {
      console.log('SMS notifications are disabled globally');
      return;
    }

    const template = await this.getTemplate(eventName);
    if (!template) {
      console.log(`No active SMS template found for event: ${eventName}`);
      return;
    }

    let message = template.content;
    // Basic placeholder replacement
    Object.keys(data).forEach(key => {
      const value = data[key] || '';
      message = message.replace(new RegExp(`{${key}}`, 'g'), String(value));
    });

    const promises = [];

    // Handle recipients
    if (template.recipients.includes('customer') && data.customerPhone) {
      promises.push(this.sendSMS(data.customerPhone, message));
    }

    if (template.recipients.includes('admin') && settings.adminPhone) {
      promises.push(this.sendSMS(settings.adminPhone, message));
    }
    
    if (template.recipients.includes('driver') && data.driverPhone) {
      promises.push(this.sendSMS(data.driverPhone, message));
    }

    await Promise.all(promises);
  }
};
