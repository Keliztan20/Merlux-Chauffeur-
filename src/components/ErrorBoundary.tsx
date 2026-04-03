import React, { ReactNode, useState, useEffect } from 'react';

interface Props {
  children: ReactNode;
}

export function ErrorBoundary({ children }: Props) {
  const [hasError, setHasError] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const handleError = (event: ErrorEvent) => {
      setHasError(true);
      setError(event.error);
    };

    const handleRejection = (event: PromiseRejectionEvent) => {
      setHasError(true);
      setError(event.reason);
    };

    window.addEventListener('error', handleError);
    window.addEventListener('unhandledrejection', handleRejection);

    return () => {
      window.removeEventListener('error', handleError);
      window.removeEventListener('unhandledrejection', handleRejection);
    };
  }, []);

  if (hasError) {
    let errorMessage = 'Something went wrong.';
    try {
      const parsedError = JSON.parse(error?.message || '');
      if (parsedError.error) {
        errorMessage = `Firestore Error: ${parsedError.error}`;
      }
    } catch (e) {
      errorMessage = error?.message || errorMessage;
    }

    return (
      <div className="min-h-screen flex items-center justify-center bg-black p-6">
        <div className="glass p-8 max-w-md w-full text-center">
          <h2 className="text-2xl font-display text-gold mb-4">Application Error</h2>
          <p className="text-white/60 mb-6">{errorMessage}</p>
          <button
            onClick={() => window.location.reload()}
            className="btn-primary w-full"
          >
            Reload Application
          </button>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
