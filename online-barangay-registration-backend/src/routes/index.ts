// src/routes/index.ts
import { Router } from 'express';
import auth from './auth';
import events from './events';
import otp from './otp';
import registrations from './registrations';
import users from './users';
import admin from './admin';
import upload from './upload';
import customFields from './customFields';
import teams from './teams';
import categories from './categories';
import eventManagers from "./eventManagerRoutes";

const router = Router();

router.use('/auth', auth);
router.use('/events', events);
router.use('/otp', otp);
router.use('/registrations', registrations);
router.use('/users', users);
router.use('/admin', admin);    
router.use('/upload', upload);
router.use('/custom-fields', customFields);
router.use('/teams', teams);
router.use('/categories', categories);
router.use("/event-managers", eventManagers);

export default router;
