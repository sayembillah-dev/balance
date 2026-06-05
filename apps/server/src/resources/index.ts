import { Router } from 'express';
import { requireAuth } from '../auth/middleware.js';
import { accountsRouter } from './accounts.js';
import { categoriesRouter } from './categories.js';
import { tagsRouter } from './tags.js';
import { transactionsRouter } from './transactions.js';
import { presetsRouter } from './presets.js';

/**
 * All authenticated API resources. requireAuth runs once here, so every mounted
 * router can assume req.auth is set and scope its queries to that user.
 */
export const apiRouter: Router = Router();

apiRouter.use(requireAuth);
apiRouter.use('/accounts', accountsRouter);
apiRouter.use('/categories', categoriesRouter);
apiRouter.use('/tags', tagsRouter);
apiRouter.use('/transactions', transactionsRouter);
apiRouter.use('/presets', presetsRouter);
