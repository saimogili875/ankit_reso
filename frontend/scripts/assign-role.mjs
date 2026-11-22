#!/usr/bin/env node

/**
 * CLI script to assign a role to a Clerk user.
 * Usage:
 *   node scripts/assign-role.mjs <email_or_userId> <admin|teacher|student>
 */

import { createClerkClient } from '@clerk/backend';
import fs from 'fs';
import path from 'path';

// Read CLERK_SECRET_KEY from .env.local if not in process.env
let secretKey = process.env.CLERK_SECRET_KEY;
if (!secretKey) {
  const envPath = path.resolve(process.cwd(), '.env.local');
  if (fs.existsSync(envPath)) {
    const lines = fs.readFileSync(envPath, 'utf8').split('\n');
    for (const line of lines) {
      const match = line.match(/^CLERK_SECRET_KEY\s*=\s*(.+)$/);
      if (match) {
        secretKey = match[1].trim();
        break;
      }
    }
  }
}

if (!secretKey) {
  console.error('Error: CLERK_SECRET_KEY not found in environment or .env.local');
  process.exit(1);
}

const clerk = createClerkClient({ secretKey });

const [,, targetUser, targetRole] = process.argv;

if (!targetUser || !targetRole) {
  console.log('Usage: node scripts/assign-role.mjs <email_or_userId> <admin|teacher|student>');
  process.exit(1);
}

const validRoles = ['admin', 'teacher', 'student'];
if (!validRoles.includes(targetRole.toLowerCase())) {
  console.error(`Invalid role: ${targetRole}. Must be one of: ${validRoles.join(', ')}`);
  process.exit(1);
}

async function main() {
  try {
    let user;
    if (targetUser.startsWith('user_')) {
      user = await clerk.users.getUser(targetUser);
    } else {
      const users = await clerk.users.getUserList({
        emailAddress: [targetUser],
      });
      user = users.data?.[0];
    }

    if (!user) {
      console.error(`No Clerk user found matching identifier: ${targetUser}`);
      process.exit(1);
    }

    const previousRole = user.publicMetadata?.role || 'student (default)';
    const newRole = targetRole.toLowerCase();

    await clerk.users.updateUserMetadata(user.id, {
      publicMetadata: {
        ...user.publicMetadata,
        role: newRole,
      },
    });

    console.log(`Success! Updated user:`);
    console.log(`  ID:    ${user.id}`);
    console.log(`  Email: ${user.emailAddresses?.[0]?.emailAddress || 'N/A'}`);
    console.log(`  Name:  ${user.firstName || ''} ${user.lastName || ''}`);
    console.log(`  Role:  ${previousRole} -> ${newRole}`);
  } catch (err) {
    console.error('Error assigning role:', err.message || err);
    process.exit(1);
  }
}

main();
