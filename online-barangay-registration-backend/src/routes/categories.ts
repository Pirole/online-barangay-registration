// routes/categories.ts
import { Router } from 'express';
import * as categoriesController from '../controllers/categories';

const router = Router();
router.get('/', categoriesController.listCategories);

export default router;
