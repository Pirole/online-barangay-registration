import express from 'express';
import * as otpController from '../controllers/otp';
import { validateRequest } from '../middleware/validateRequest';
import { OTPVerifySchema } from '../utils/validation';

const router = express.Router();

router.post('/verify', validateRequest(OTPVerifySchema), otpController.verifyOtp);
router.post('/resend', otpController.resendOtp);

export default router;
