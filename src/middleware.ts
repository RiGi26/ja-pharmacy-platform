import { NextResponse, type NextRequest } from 'next/server'
import { updateSession } from '@/lib/supabase/middleware'

const PUBLIC_ROUTES = ['/login', '/not-found', '/_next', '/favicon.ico', '/api/webhooks']
const SUPERADMIN_SUBDOMAIN = 'admin'

export async function middleware(request: NextRequest) {
  const url = request.nextUrl.clone()
  const hostname = request.headers.get('host') ?? ''
  const domain = process.env.NEXT_PUBLIC_APP_DOMAIN ?? 'japanarenacorp.com'

  // Extract subdomain
  const subdomain = hostname.replace(`.${domain}`, '').split(':')[0]
  const isMainDomain = subdomain === domain.split(':')[0] || hostname === domain || hostname.startsWith('localhost')

  // Refresh Supabase session
  const { supabaseResponse, user } = await updateSession(request)

  const pathname = url.pathname
  const isPublic = PUBLIC_ROUTES.some(r => pathname.startsWith(r))

  // Allow webhook endpoints without auth
  if (pathname.startsWith('/api/webhooks')) {
    return NextResponse.next()
  }

  // Handle superadmin subdomain
  if (subdomain === SUPERADMIN_SUBDOMAIN) {
    if (!user) {
      url.pathname = '/login'
      return NextResponse.redirect(url)
    }
    return supabaseResponse
  }

  // Handle localhost dev — skip subdomain resolution
  if (isMainDomain || hostname.startsWith('localhost') || hostname.startsWith('127.0.0.1')) {
    if (!isPublic && !user) {
      url.pathname = '/login'
      return NextResponse.redirect(url)
    }
    return supabaseResponse
  }

  // Validate tenant from subdomain
  const tenantSlug = subdomain
  if (!tenantSlug || tenantSlug === 'www') {
    url.pathname = '/not-found'
    return NextResponse.redirect(url)
  }

  // Inject tenant context headers
  const response = supabaseResponse
  response.headers.set('x-tenant-slug', tenantSlug)

  if (!isPublic && !user) {
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }

  return response
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
