import { Router } from 'express';
import { validateRequest } from '../middleware/validateRequest';
import * as qrController from '../controllers/qr';
import { ScanQRSchema } from '../utils/validation';
import { authenticateToken, authorize } from '../middleware/auth';

const router = Router();

// Generate QR for a registration (protected — admins/managers)
router.post('/generate', authenticateToken, authorize('SUPER_ADMIN', 'EVENT_MANAGER'), qrController.generateQr);

// Scan QR (public endpoint used by scanner UI) — scanning device will call backend to validate
router.post('/scan', validateRequest(ScanQRSchema), authenticateToken, authorize('SUPER_ADMIN', 'EVENT_MANAGER', 'STAFF'), qrController.scanQr);

// Download QR image by id (protected)
router.get('/download/:id', authenticateToken, authorize('SUPER_ADMIN', 'EVENT_MANAGER'), qrController.downloadQrImage);

export default router;
