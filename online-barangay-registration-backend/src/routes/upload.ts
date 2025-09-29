import { Router } from 'express';
import { upload } from '../middleware/upload';
import * as uploadController from '../controllers/upload';
import { authenticateToken } from '../middleware/auth';

const router = Router();

// Upload a temporary photo (e.g., camera capture). returns temp id / stored reference.
// field name: 'photo'
router.post('/photo', authenticateToken, upload.single('photo'), uploadController.uploadPhoto);

// Optionally accept multiple
router.post('/photos', authenticateToken, upload.array('photos', 5), uploadController.uploadMultiplePhotos);

export default router;
