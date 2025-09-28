import { Router } from 'express';

const router = Router();

router.get('/ping', (req, res) => {
  res.json({ message: 'Registrations route works' });
});

export default router;
