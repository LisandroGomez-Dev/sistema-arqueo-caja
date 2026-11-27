import * as Sentry from '@sentry/react';

export function initSentry(): void {
  if (!import.meta.env.PROD) {
    return;
  }

  const dsn = import.meta.env.VITE_SENTRY_DSN?.trim();
  if (!dsn) {
    return;
  }

  const apiUrl = (import.meta.env.VITE_API_URL ?? '').trim();
  const tracePropagationTargets: (string | RegExp)[] = [/^\//];
  if (apiUrl) {
    tracePropagationTargets.push(apiUrl);
  }

  Sentry.init({
    dsn,
    integrations: [
      Sentry.browserTracingIntegration(),
      Sentry.replayIntegration({
        maskAllText: true,
        maskAllInputs: true,
        blockAllMedia: true,
      }),
    ],
    tracePropagationTargets,
    tracesSampleRate: 0.2,
    replaysSessionSampleRate: 0.1,
    replaysOnErrorSampleRate: 1.0,
  });

  if (
    typeof window !== 'undefined' &&
    new URLSearchParams(window.location.search).get('sentry-test') === '1'
  ) {
    Sentry.captureException(
      new Error('Prueba diagnóstica de Sentry en ArqueoCaja (?sentry-test=1)'),
    );
  }
}
