import { Router } from 'express';
import { requireAuth } from '../auth/middleware.js';
import { meRouter } from './me.js';
import { accountsRouter } from './accounts.js';
import { categoriesRouter } from './categories.js';
import { tagsRouter } from './tags.js';
import { transactionsRouter } from './transactions.js';
import { presetsRouter } from './presets.js';
import { budgetsRouter } from './budgets.js';
import { savingsRouter } from './savings.js';
import { notesRouter } from './notes.js';
import { payReceiveRouter } from './payReceive.js';

/**
 * All authenticated API resources. requireAuth runs once here, so every mounted
 * router can assume req.auth is set and scope its queries to that user.
 */
export const apiRouter: Router = Router();

apiRouter.use(requireAuth);
apiRouter.use('/me', meRouter);
apiRouter.use('/accounts', accountsRouter);
apiRouter.use('/categories', categoriesRouter);
apiRouter.use('/tags', tagsRouter);
apiRouter.use('/transactions', transactionsRouter);
apiRouter.use('/presets', presetsRouter);
apiRouter.use('/budgets', budgetsRouter);
apiRouter.use('/savings', savingsRouter);
apiRouter.use('/notes', notesRouter);
apiRouter.use('/pay-receive', payReceiveRouter);
