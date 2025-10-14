import express from 'express';
import * as otpController from '../controllers/otp';
import { validateRequest, OTPVerifySchema } from '../utils/validation';  // ✅ unified import

const router = express.Router();

router.post('/verify', validateRequest(OTPVerifySchema), otpController.verifyOtp);
// router.post('/resend', otpController.resendOtp);

export default router;
