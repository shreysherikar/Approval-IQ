export function LoadingSpinner({ label = 'Loading…' }: { label?: string }): JSX.Element {
  return (
    <div role="status" aria-live="polite" className="flex items-center gap-2 text-gray-600">
      <span
        aria-hidden="true"
        className="inline-block h-5 w-5 animate-spin rounded-full border-2 border-gray-300 border-t-blue-600"
      />
      <span>{label}</span>
    </div>
  );
}

export function ErrorBanner({
  message,
  onRetry,
}: {
  message: string;
  onRetry?: () => void;
}): JSX.Element {
  return (
    <div role="alert" className="rounded-md border border-red-300 bg-red-50 p-4 text-red-800">
      <p className="font-medium">Something went wrong</p>
      <p className="mt-1 text-sm">{message}</p>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="mt-3 rounded bg-red-600 px-3 py-1 text-sm text-white hover:bg-red-700"
        >
          Retry
        </button>
      )}
    </div>
  );
}

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: JSX.Element;
}): JSX.Element {
  return (
    <div className="rounded-md border border-dashed border-gray-300 bg-gray-50 p-8 text-center">
      <p className="text-lg font-medium text-gray-800">{title}</p>
      {description && <p className="mt-1 text-sm text-gray-600">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
