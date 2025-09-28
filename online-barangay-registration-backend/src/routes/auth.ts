import { Router } from 'express';

const router = Router();

// Test route
router.get('/ping', (req, res) => {
  res.json({ message: 'Auth route works' });
});

export default router;
