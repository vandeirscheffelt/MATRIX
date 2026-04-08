export { createClient } from './client'
// Server-only exports: import from '@boilerplate/auth/server' instead
export { updateSession } from './middleware'
export { signUp, signIn, signOut, resetPassword, updatePassword, getUser } from './actions'
export type {
  AuthUser,
  AuthSession,
  SignUpParams,
  SignInParams,
  ResetPasswordParams,
  UpdatePasswordParams,
  AuthResult,
} from './types'
