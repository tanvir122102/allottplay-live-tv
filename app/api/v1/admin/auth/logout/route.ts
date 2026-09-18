import { NextResponse } from 'next/server';
import { adminCookieName } from '@/lib/admin-auth';
export async function POST(){const r=NextResponse.json({ok:true});r.cookies.set({name:adminCookieName,value:'',httpOnly:true,secure:process.env.NODE_ENV==='production',sameSite:'lax',path:'/',maxAge:0});return r;}
