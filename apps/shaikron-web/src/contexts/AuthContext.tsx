import React, { createContext, useContext, useState, useEffect } from 'react'
import type { Session, User } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'

const ADMIN_EMAIL = 'vandeir.professor@gmail.com'

interface AuthState {
  isLoggedIn: boolean
  user: User | null
  session: Session | null
  isNewUser: boolean
  isAdmin: boolean
  login: (email: string, password: string) => Promise<void>
  logout: () => Promise<void>
  markConfigured: () => void
}

const AuthContext = createContext<AuthState>({
  isLoggedIn: false,
  user: null,
  session: null,
  isNewUser: false,
  isAdmin: false,
  login: async () => {},
  logout: async () => {},
  markConfigured: () => {},
})

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [session, setSession] = useState<Session | null>(null)
  const [isNewUser, setIsNewUser] = useState(false)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setReady(true)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s)
    })

    return () => subscription.unsubscribe()
  }, [])

  const login = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) throw error
    const hasConfig = localStorage.getItem('schaikron_configured') === 'true'
    setIsNewUser(!hasConfig)
  }

  const logout = async () => {
    await supabase.auth.signOut()
  }

  const markConfigured = () => {
    localStorage.setItem('schaikron_configured', 'true')
    setIsNewUser(false)
  }

  if (!ready) return null

  return (
    <AuthContext.Provider value={{
      isLoggedIn: !!session,
      user: session?.user ?? null,
      session,
      isNewUser,
      isAdmin: session?.user?.email === ADMIN_EMAIL,
      login,
      logout,
      markConfigured,
    }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
