'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { signOut } from 'next-auth/react'

/**
 * Landing page for Google OAuth.
 * Google redirects here (callbackUrl) after authentication.
 * This page bridges the NextAuth session to the app's cookie auth,
 * then sends the user to the dashboard.
 */
export default function GoogleSyncPage() {
  const router = useRouter()
  const [error, setError] = useState('')

  useEffect(() => {
    async function sync() {
      try {
        const res = await fetch('/api/auth/google-sync', { method: 'POST' })
        const data = await res.json()
        if (!res.ok) {
          // e.g. pending approval — clear the NextAuth session so the
          // user isn't left half-logged-in, then show the message
          await signOut({ redirect: false })
          setError(data.error || 'Google sign-in failed')
          setTimeout(() => router.push('/login'), 3500)
          return
        }
        router.push('/dashboard')
      } catch {
        setError('Something went wrong. Redirecting to login...')
        setTimeout(() => router.push('/login'), 2500)
      }
    }
    sync()
  }, [router])

  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-5 bg-[#050914] text-white p-8">
      {!error ? (
        <>
          <div className="relative w-16 h-16">
            <div className="absolute inset-0 rounded-full border border-cyan-400/20" />
            <div className="absolute inset-0 rounded-full border-t-2 border-cyan-300 animate-spin" />
          </div>
          <p className="text-sm text-slate-400">Completing Google sign-in...</p>
        </>
      ) : (
        <div className="max-w-md text-center">
          <div className="bg-red-500/10 border border-red-500/30 text-red-200 px-5 py-4 rounded-xl text-sm">
            {error}
          </div>
          <p className="mt-4 text-xs text-slate-500">Redirecting to login...</p>
        </div>
      )}
    </div>
  )
}
