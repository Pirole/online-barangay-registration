
import { Request, Response, NextFunction } from 'express';
import { ZodSchema } from 'zod';
import { AppError } from '../middleware/errorHandler';

export const validateRequest = (schema: ZodSchema, property: 'body' | 'query' | 'params' = 'body') => {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      const validated = schema.parse(req[property]);
      req[property] = validated;
      next();
    } catch (error) {
      next(error);
    }
  };
};

export const validatePhoneNumber = (phone: string): string => {
  // Normalize phone number to +63 format
  if (phone.startsWith('0')) {
    return '+63' + phone.substring(1);
  } else if (phone.startsWith('63')) {
    return '+' + phone;
  } else if (phone.startsWith('+63')) {
    return phone;
  } else if (phone.startsWith('9')) {
    return '+63' + phone;
  }
  
  throw new AppError('Invalid phone number format', 400);
};

export const validateAge = (age: number, event: any): boolean => {
  if (event.age_min && age < event.age_min) {
    return false;
  }
  if (event.age_max && age > event.age_max) {
    return false;
  }
  return true;
};

export const validateCustomFields = (values: any, fields: any[]): { isValid: boolean; errors: string[] } => {
  const errors: string[] = [];
  
  for (const field of fields) {
    const value = values[field.key];
    
    if (field.required && (!value || (typeof value === 'string' && value.trim() === ''))) {
      errors.push(`${field.label} is required`);
      continue;
    }
    
    if (value && field.validation) {
      const { min, max, regex, message } = field.validation;
      
      if (field.type === 'number') {
        const numValue = Number(value);
        if (isNaN(numValue)) {
          errors.push(`${field.label} must be a number`);
          continue;
        }
        if (min !== undefined && numValue < min) {
          errors.push(`${field.label} must be at least ${min}`);
        }
        if (max !== undefined && numValue > max) {
          errors.push(`${field.label} must be at most ${max}`);
        }
      } else if (field.type === 'text' || field.type === 'textarea') {
        const strValue = String(value);
        if (min !== undefined && strValue.length < min) {
          errors.push(`${field.label} must be at least ${min} characters`);
        }
        if (max !== undefined && strValue.length > max) {
          errors.push(`${field.label} must be at most ${max} characters`);
        }
        if (regex && !new RegExp(regex).test(strValue)) {
          errors.push(message || `${field.label} format is invalid`);
        }
      }
    }
  }
  
  return { isValid: errors.length === 0, errors };
};
