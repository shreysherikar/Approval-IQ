import { useState } from 'react';
import type { FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ApiError, authApi } from './api-client';
import { useAuth } from './auth';
import { ErrorBanner, LoadingSpinner } from './components';

export function HomePage(): JSX.Element {
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Welcome to ApprovalIQ</h1>
      <p className="text-gray-600">
        Industrial approvals, tracked end to end. Sign in to manage your projects.
      </p>
      <div className="flex gap-3">
        <Link to="/login" className="rounded bg-blue-600 px-4 py-2 text-white hover:bg-blue-700">
          Login
        </Link>
        <Link
          to="/register"
          className="rounded border border-blue-600 px-4 py-2 text-blue-700 hover:bg-blue-50"
        >
          Register
        </Link>
      </div>
    </div>
  );
}

export function LoginPage(): JSX.Element {
  const { login, isLoading, error: authError } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const error = formError ?? authError;

  const submit = async (e: FormEvent): Promise<void> => {
    e.preventDefault();
    setFormError(null);
    try {
      await login(email, password);
      void navigate('/projects');
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Login failed');
    }
  };

  return (
    <div className="mx-auto max-w-md space-y-4">
      <h1 className="text-2xl font-semibold">Login</h1>
      {error && <ErrorBanner message={error} />}
      <form onSubmit={(e) => void submit(e)} className="space-y-3">
        <label className="block">
          <span className="text-sm text-gray-700">Email</span>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="mt-1 w-full rounded border px-3 py-2"
            autoComplete="email"
          />
        </label>
        <label className="block">
          <span className="text-sm text-gray-700">Password</span>
          <input
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="mt-1 w-full rounded border px-3 py-2"
            autoComplete="current-password"
          />
        </label>
        <button
          type="submit"
          disabled={isLoading}
          className="w-full rounded bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {isLoading ? 'Signing in…' : 'Login'}
        </button>
      </form>
      {isLoading && <LoadingSpinner label="Signing you in…" />}
      <p className="text-sm text-gray-600">
        No account?{' '}
        <Link to="/register" className="text-blue-600 hover:underline">
          Register
        </Link>
      </p>
    </div>
  );
}

export function RegisterPage(): JSX.Element {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: FormEvent): Promise<void> => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);
    try {
      await authApi.register({ email, password, role: 'applicant' });
      void navigate('/login');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Registration failed');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="mx-auto max-w-md space-y-4">
      <h1 className="text-2xl font-semibold">Register</h1>
      {error && <ErrorBanner message={error} />}
      <form onSubmit={(e) => void submit(e)} className="space-y-3">
        <label className="block">
          <span className="text-sm text-gray-700">Email</span>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="mt-1 w-full rounded border px-3 py-2"
            autoComplete="email"
          />
        </label>
        <label className="block">
          <span className="text-sm text-gray-700">Password (min 8 characters)</span>
          <input
            type="password"
            required
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="mt-1 w-full rounded border px-3 py-2"
            autoComplete="new-password"
          />
        </label>
        <button
          type="submit"
          disabled={isLoading}
          className="w-full rounded bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {isLoading ? 'Creating account…' : 'Register'}
        </button>
      </form>
      {isLoading && <LoadingSpinner label="Creating your account…" />}
    </div>
  );
}
