import { Router } from 'express';
import { validateRequest } from '../middleware/validateRequest';
import * as otpController from '../controllers/otp';
import { OTPVerifySchema } from '../utils/validation';
import { authenticateToken } from '../middleware/auth';

const router = Router();

// Send OTP for a registration (server will create OtpRequest then send SMS)
router.post('/send', otpController.sendOtp);

// Verify OTP
router.post('/verify', validateRequest(OTPVerifySchema), otpController.verifyOtp);

// Optionally: resend
router.post('/resend', otpController.resendOtp);

export default router;
