import { clerkMiddleware } from '@clerk/nextjs/server'

export default clerkMiddleware(async (auth, req) => {
  const { userId, redirectToSignIn } = await auth()

  // Redirect all requests to sign-in if the user is not authenticated
  if (!userId) {
    return redirectToSignIn()
  }
})

export const config = {
  matcher: [
    // Match all routes except static files and Next.js internals
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    // Match API and TRPC routes
    '/(api|trpc)(.*)',
  ],
}
