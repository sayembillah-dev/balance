import type { UserRole } from '@balance/shared';

// Attached by requireAuth once a request is authenticated. `userId` is the
// tenancy boundary every query scopes to.
declare global {
  namespace Express {
    interface Request {
      auth?: { userId: string; role: UserRole };
    }
  }
}

export {};
