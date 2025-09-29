// src/utils/sms.ts
import axios from 'axios';
import { logger } from './logger';

const TEXTBEE_API_KEY = process.env.TEXTBEE_API_KEY || '';

export const sendSMS = async (to: string, message: string): Promise<boolean> => {
  try {
    const res = await axios.post('https://api.textbee.io/send', {
      apiKey: TEXTBEE_API_KEY,
      to,
      message,
    });

    if (res.data.success) {
      logger.info(`SMS sent to ${to}`);
      return true;
    } else {
      logger.error(`Failed to send SMS: ${res.data.error}`);
      return false;
    }
  } catch (err) {
    logger.error('SMS send error:', err);
    return false;
  }
};
