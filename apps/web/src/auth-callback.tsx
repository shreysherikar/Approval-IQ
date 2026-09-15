import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from './auth';
import { ErrorBanner, LoadingSpinner } from './components';

export function AuthCallbackPage(): JSX.Element {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { refreshSession } = useAuth();
  const [error, setError] = useState<string | null>(null);

  const errorParam = searchParams.get('error');

  useEffect(() => {
    if (errorParam) {
      setError(decodeURIComponent(errorParam));
      return;
    }

    let isMounted = true;
    refreshSession()
      .then(() => {
        if (isMounted) {
          void navigate('/projects', { replace: true });
        }
      })
      .catch((err: unknown) => {
        if (isMounted) {
          setError(
            err instanceof Error ? err.message : 'Google authentication succeeded, but failed to restore session.',
          );
        }
      });

    return () => {
      isMounted = false;
    };
  }, [errorParam, refreshSession, navigate]);

  return (
    <div className="mx-auto max-w-md space-y-4 py-8 text-center">
      {error ? (
        <div className="space-y-4 text-left">
          <ErrorBanner message={error} />
          <div className="text-center">
            <Link
              to="/login"
              className="inline-block rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
            >
              Return to Login
            </Link>
          </div>
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center space-y-3 py-6">
          <LoadingSpinner label="Authenticating with Google…" />
          <p className="text-sm text-gray-500">Completing secure sign in to ApprovalIQ...</p>
        </div>
      )}
    </div>
  );
}
