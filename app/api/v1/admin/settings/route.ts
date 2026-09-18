import { NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '../../../../../lib/prisma';
import { isAdmin } from '../../../../../lib/admin-auth';
const schema=z.object({websiteName:z.string().trim().min(1).max(80),websiteUrl:z.string().trim().url().max(500).optional().or(z.literal('')),websiteLogoUrl:z.string().trim().url().max(500).optional().or(z.literal('')),showPlayerBrand:z.boolean(),playerBrandPosition:z.enum(['top','bottom']),brandTextSize:z.number().int().min(7).max(16)});
export async function GET(){if(!(await isAdmin()))return NextResponse.json({error:'Unauthorized'},{status:401});return NextResponse.json(await db.siteSettings.findUnique({where:{id:1}}));}
export async function PUT(req:Request){if(!(await isAdmin()))return NextResponse.json({error:'Unauthorized'},{status:401});const parsed=schema.safeParse(await req.json());if(!parsed.success)return NextResponse.json({error:'Invalid settings'},{status:400});const d=parsed.data;const s=await db.siteSettings.upsert({where:{id:1},create:{id:1,...d},update:d});return NextResponse.json(s);}
