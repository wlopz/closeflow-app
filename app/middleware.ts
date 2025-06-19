import { createMiddlewareClient } from '@supabase/auth-helpers-nextjs';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export async function middleware(req: NextRequest) {
  const res = NextResponse.next();
  
  try {
    const supabase = createMiddlewareClient({ req, res });

    const {
      data: { session },
    } = await supabase.auth.getSession();

    // Protect dashboard routes
    if (req.nextUrl.pathname.startsWith('/dashboard')) {
      if (!session) {
        return NextResponse.redirect(new URL('/auth/login', req.url));
      }
    }

    // Redirect authenticated users away from auth pages
    if (req.nextUrl.pathname.startsWith('/auth/')) {
      if (session) {
        return NextResponse.redirect(new URL('/dashboard', req.url));
      }
    }

    return res;
  } catch (error) {
    // If there's an error with Supabase, allow the request to continue
    console.error('Middleware error:', error);
    return res;
  }
}

export const config = {
  matcher: ['/dashboard/:path*', '/auth/:path*'],
};