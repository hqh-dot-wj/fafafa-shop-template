import { NotificationMessage, SendResult } from '../../interfaces/notification.types';

export interface SmsProvider {
  isConfigured(): boolean;
  send(target: string, message: NotificationMessage): Promise<SendResult>;
}
