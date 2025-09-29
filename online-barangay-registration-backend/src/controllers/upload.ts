import { Router } from 'express';

const router = Router();

router.get('/ping', (req, res) => {
  res.json({ message: 'Upload route works' });
});

export default router;
