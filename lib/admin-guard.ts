import { NextResponse } from 'next/server';
import { isAdmin } from '@/lib/admin-auth';
export async function adminGuard(){if(!(await isAdmin())) return NextResponse.json({error:'Unauthorized'},{status:401});return null;}
