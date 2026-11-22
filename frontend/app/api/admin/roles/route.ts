import { NextResponse } from 'next/server';
import { clerkClient } from '@clerk/nextjs/server';
import { requireRole } from '@/lib/rbac';

export async function GET() {
  try {
    await requireRole('admin');

    const client = await clerkClient();
    const response = await client.users.getUserList({
      limit: 50,
      orderBy: '-created_at',
    });

    const users = response.data.map((u) => ({
      id: u.id,
      email: u.emailAddresses[0]?.emailAddress || '',
      firstName: u.firstName || '',
      lastName: u.lastName || '',
      imageUrl: u.imageUrl || '',
      role: (u.publicMetadata?.role as string) || 'student',
      createdAt: u.createdAt,
    }));

    return NextResponse.json({ users });
  } catch (error) {
    const err = error as Error;
    if (err.message === 'NEXT_REDIRECT') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    return NextResponse.json({ error: err.message || 'Failed to fetch users' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    await requireRole('admin');

    const body = await req.json();
    const { userId, role } = body;

    if (!userId || !role) {
      return NextResponse.json({ error: 'userId and role are required' }, { status: 400 });
    }

    if (!['admin', 'teacher', 'student'].includes(role)) {
      return NextResponse.json({ error: 'Invalid role' }, { status: 400 });
    }

    const client = await clerkClient();
    await client.users.updateUserMetadata(userId, {
      publicMetadata: {
        role,
      },
    });

    return NextResponse.json({ success: true, userId, role });
  } catch (error) {
    const err = error as Error;
    return NextResponse.json({ error: err.message || 'Failed to update role' }, { status: 500 });
  }
}
