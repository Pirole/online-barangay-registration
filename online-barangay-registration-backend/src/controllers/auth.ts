import { Request, Response, NextFunction } from 'express';
import { AppError } from '../middleware/errorHandler';
import { query } from '../config/database';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';

export const register = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { email, password, firstName, lastName } = req.body;

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Insert into DB
    const result = await query(
      `INSERT INTO users (email, password, role_id, is_active)
       VALUES ($1, $2, (SELECT id FROM roles WHERE name = 'Resident'), true)
       RETURNING id, email`,
      [email, hashedPassword]
    );

    const user = result.rows[0];

    // Insert profile
    await query(
      `INSERT INTO profiles (user_id, first_name, last_name)
       VALUES ($1, $2, $3)`,
      [user.id, firstName, lastName]
    );

    res.status(201).json({
      success: true,
      message: 'User registered successfully',
      user: { id: user.id, email: user.email },
    });
  } catch (error) {
    next(error);
  }
};
