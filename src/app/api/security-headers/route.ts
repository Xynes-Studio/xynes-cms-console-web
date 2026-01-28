import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export async function GET(request: NextRequest) {
  // This route is used to test security headers
  // The actual headers are set via next.config.ts, not in the route handler
  
  return NextResponse.json({ 
    message: 'Security headers test endpoint',
    timestamp: new Date().toISOString()
  });
}