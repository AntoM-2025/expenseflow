import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'

import App from './App.tsx'

type User = {
  id: string
  name: string
  username: string
  email: string
}

type AuthResponse = {
  user?: User
  message?: string
  error?: string
}

type AuthMode = 'login' | 'register'

function AuthGate() {
  const [user, setUser] = useState<User | null>(null)
  const [checkingSession, setCheckingSession] = useState(true)

  const [mode, setMode] = useState<AuthMode>('login')

  const [name, setName] = useState('')
  const [username, setUsername] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')

  const [submitting, setSubmitting] = useState(false)
  const [loggingOut, setLoggingOut] = useState(false)

  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  // ==========================================
  // CHECK SESSION ON STARTUP
  // ==========================================

  useEffect(() => {
    const controller = new AbortController()

    async function checkSession() {
      try {
        const response = await fetch('/api/auth/me', {
          credentials: 'include',
          signal: controller.signal,
        })

        if (response.ok) {
          const data: AuthResponse = await response.json()

          if (!controller.signal.aborted && data.user) {
            setUser(data.user)
          }
        } else if (response.status !== 401) {
          throw new Error('Unable to verify the session')
        }
      } catch (err) {
        if (!controller.signal.aborted) {
          setError(
            err instanceof Error
              ? err.message
              : 'Connection error'
          )
        }
      } finally {
        if (!controller.signal.aborted) {
          setCheckingSession(false)
        }
      }
    }

    void checkSession()

    return () => controller.abort()
  }, [])

  // ==========================================
  // LOGIN AND REGISTRATION
  // ==========================================

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    setError(null)
    setSuccess(null)

    if (mode === 'register' && password !== confirmPassword) {
      setError('Passwords do not match')
      return
    }

    setSubmitting(true)

    try {
      const endpoint =
        mode === 'login'
          ? '/api/auth/login'
          : '/api/auth/register'

      const body =
        mode === 'login'
          ? { username, password }
          : { name, username, email, password }

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify(body),
      })

      const data: AuthResponse = await response.json()

      if (!response.ok) {
        throw new Error(
          data.error ?? 'Operation failed'
        )
      }

      if (mode === 'register') {
        setSuccess(
          'Account created successfully! You can now log in.'
        )

        setMode('login')
        setPassword('')
        setConfirmPassword('')
      } else {
        if (!data.user) {
          throw new Error('Invalid server response')
        }

        setUser(data.user)
        setPassword('')
      }
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'An error occurred'
      )
    } finally {
      setSubmitting(false)
    }
  }

  // ==========================================
  // LOGOUT
  // ==========================================

  async function handleLogout() {
    setLoggingOut(true)
    setError(null)

    try {
      const response = await fetch('/api/auth/logout', {
        method: 'POST',
        credentials: 'include',
      })

      if (!response.ok) {
        throw new Error('Unable to log out')
      }

      setUser(null)
      setPassword('')
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Error logging out'
      )
    } finally {
      setLoggingOut(false)
    }
  }

  // ==========================================
  // SWITCH LOGIN / REGISTRATION
  // ==========================================

  function changeMode() {
    setMode((current) =>
      current === 'login' ? 'register' : 'login'
    )

    setError(null)
    setSuccess(null)
    setPassword('')
    setConfirmPassword('')
  }

  // ==========================================
  // LOADING
  // ==========================================

  if (checkingSession) {
    return (
      <main className="dashboard">
        <p role="status">Checking session...</p>
      </main>
    )
  }

  // ==========================================
  // AUTHENTICATED DASHBOARD
  // ==========================================

  if (user) {
    return (
      <>
        <div
          style={{
            display: 'flex',
            justifyContent: 'flex-end',
            alignItems: 'center',
            gap: '16px',
            padding: '16px 24px',
          }}
        >
          <span>Hello, {user.name}!</span>

          <button
            type="button"
            onClick={() => void handleLogout()}
            disabled={loggingOut}
          >
            {loggingOut ? 'Logging out...' : 'Logout'}
          </button>
        </div>

        {error && (
          <p className="error-message" role="alert">
            {error}
          </p>
        )}

        <App />
      </>
    )
  }

  // ==========================================
  // LOGIN / REGISTRATION
  // ==========================================

  return (
    <main className="dashboard">
      <header className="dashboard-header">
        <div>
          <span className="subtitle">PERSONAL FINANCE</span>
          <h1>ExpenseFlow</h1>
          <p>
            {mode === 'login'
              ? 'Log in to your account.'
              : 'Create your personal account.'}
          </p>
        </div>
      </header>

      <section className="add-expense-section">
        <h2>
          {mode === 'login' ? 'Log in' : 'Sign up'}
        </h2>

        <form onSubmit={(event) => void handleSubmit(event)}>
          <div className="form-grid">
            {mode === 'register' && (
              <div className="form-field">
                <label htmlFor="auth-name">Name</label>

                <input
                  id="auth-name"
                  type="text"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  autoComplete="name"
                  maxLength={100}
                  required
                />
              </div>
            )}

            <div className="form-field">
              <label htmlFor="auth-username">Username</label>

              <input
                id="auth-username"
                type="text"
                value={username}
                onChange={(event) =>
                  setUsername(event.target.value.toLowerCase())
                }
                autoComplete="username"
                required
              />
            </div>

            {mode === 'register' && (
              <div className="form-field">
                <label htmlFor="auth-email">Email</label>

                <input
                  id="auth-email"
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  autoComplete="email"
                  required
                />
              </div>
            )}

            <div className="form-field">
              <label htmlFor="auth-password">Password</label>

              <input
                id="auth-password"
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                autoComplete={
                  mode === 'login'
                    ? 'current-password'
                    : 'new-password'
                }
                minLength={mode === 'register' ? 8 : 1}
                maxLength={128}
                required
              />
            </div>

            {mode === 'register' && (
              <div className="form-field">
                <label htmlFor="auth-confirm-password">
                  Confirm password
                </label>

                <input
                  id="auth-confirm-password"
                  type="password"
                  value={confirmPassword}
                  onChange={(event) =>
                    setConfirmPassword(event.target.value)
                  }
                  autoComplete="new-password"
                  required
                />
              </div>
            )}
          </div>

          {error && (
            <p className="error-message" role="alert">
              {error}
            </p>
          )}

          {success && (
            <p className="success-message" role="status">
              {success}
            </p>
          )}

          <button
            className="submit-button"
            type="submit"
            disabled={submitting}
          >
            {submitting
              ? 'Please wait...'
              : mode === 'login'
                ? 'Log in'
                : 'Create account'}
          </button>
        </form>

        <p style={{ marginTop: '20px' }}>
          {mode === 'login'
            ? 'Need an account?'
            : 'Already have an account?'}
        </p>

        <button
          type="button"
          onClick={changeMode}
          disabled={submitting}
        >
          {mode === 'login'
            ? 'Sign up'
            : 'Back to login'}
        </button>
      </section>
    </main>
  )
}

export default AuthGate
