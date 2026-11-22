import { auth, clerkClient } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';

export type UserRole = 'admin' | 'teacher' | 'student';

export interface RoleClaims {
  role?: UserRole;
  [key: string]: unknown;
}

/**
 * Extract role from sessionClaims or default to 'student'
 */
export function extractRoleFromClaims(sessionClaims: unknown): UserRole {
  if (!sessionClaims || typeof sessionClaims !== 'object') {
    return 'student';
  }
  const claims = sessionClaims as {
    metadata?: { role?: string };
    publicMetadata?: { role?: string };
    role?: string;
  };

  const role =
    claims.metadata?.role ||
    claims.publicMetadata?.role ||
    claims.role;

  if (role === 'admin' || role === 'teacher' || role === 'student') {
    return role;
  }
  return 'student';
}

/**
 * Checks whether userRole meets the requirement for allowedRoles.
 * Admin has access to all roles.
 * Teacher has access to teacher and student.
 * Student only has access to student.
 */
export function hasRole(userRole: UserRole, allowed: UserRole | UserRole[]): boolean {
  const allowedList = Array.isArray(allowed) ? allowed : [allowed];

  if (userRole === 'admin') return true;
  if (userRole === 'teacher') {
    return allowedList.includes('teacher') || allowedList.includes('student');
  }
  return allowedList.includes(userRole);
}

/**
 * Get current authenticated user's role on the server.
 */
export async function getServerUserRole(): Promise<UserRole | null> {
  const { userId, sessionClaims } = await auth();
  if (!userId) return null;
  return extractRoleFromClaims(sessionClaims);
}

/**
 * Server guard: Enforce role requirements in Server Components and Route Handlers.
 * - If user is unauthenticated -> redirects to /sign-in
 * - If user lacks role -> redirects to /403
 */
export async function requireRole(allowedRoles: UserRole | UserRole[]): Promise<{ userId: string; role: UserRole }> {
  const { userId, sessionClaims } = await auth();

  if (!userId) {
    redirect('/sign-in');
  }

  const role = extractRoleFromClaims(sessionClaims);

  if (!hasRole(role, allowedRoles)) {
    redirect('/403');
  }

  return { userId, role };
}

/**
 * Assign a role to a Clerk user in their publicMetadata.
 */
export async function assignUserRole(userId: string, role: UserRole): Promise<void> {
  const client = await clerkClient();
  await client.users.updateUserMetadata(userId, {
    publicMetadata: {
      role,
    },
  });
}
