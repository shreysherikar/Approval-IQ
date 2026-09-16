import React, { lazy, Suspense } from 'react';
import { createBrowserRouter, createHashRouter } from 'react-router-dom';
import { Layout } from './Layout';
import { LoadingSpinner } from './components';

// Code-split page components with dynamic imports
const HomePage = lazy(() => import('./pages').then((m) => ({ default: m.HomePage })));
const LoginPage = lazy(() => import('./pages').then((m) => ({ default: m.LoginPage })));
const RegisterPage = lazy(() => import('./pages').then((m) => ({ default: m.RegisterPage })));

const AboutPage = lazy(() => import('./landing/AboutPage').then((m) => ({ default: m.AboutPage })));
const ContactPage = lazy(() => import('./landing/ContactPage').then((m) => ({ default: m.ContactPage })));
const BusinessMapPage = lazy(() => import('./landing/BusinessMapPage').then((m) => ({ default: m.BusinessMapPage })));
const IntegrationsHubPage = lazy(() => import('./integrations-hub').then((m) => ({ default: m.IntegrationsHubPage })));
const AuthCallbackPage = lazy(() => import('./auth-callback').then((m) => ({ default: m.AuthCallbackPage })));

const ProjectsPage = lazy(() => import('./project-pages').then((m) => ({ default: m.ProjectsPage })));
const ProjectProfilePage = lazy(() => import('./project-pages').then((m) => ({ default: m.ProjectProfilePage })));
const EvaluationResultsPage = lazy(() => import('./evaluation-results').then((m) => ({ default: m.EvaluationResultsPage })));
const ProjectRoadmapPage = lazy(() => import('./project-pages').then((m) => ({ default: m.ProjectRoadmapPage })));
const ProjectInspectionsPage = lazy(() => import('./project-pages').then((m) => ({ default: m.ProjectInspectionsPage })));
const ProjectClarificationsPage = lazy(() => import('./project-pages').then((m) => ({ default: m.ProjectClarificationsPage })));
const ProjectGrievancesPage = lazy(() => import('./project-pages').then((m) => ({ default: m.ProjectGrievancesPage })));
const ProjectDocumentPage = lazy(() => import('./project-pages').then((m) => ({ default: m.ProjectDocumentPage })));
const NotFoundPage = lazy(() => import('./project-pages').then((m) => ({ default: m.NotFoundPage })));

const RegulatoryChangesListPage = lazy(() => import('./regulatory-changes').then((m) => ({ default: m.RegulatoryChangesListPage })));
const RegulatoryChangeDetailPage = lazy(() => import('./regulatory-changes').then((m) => ({ default: m.RegulatoryChangeDetailPage })));
const ImpactDashboardPage = lazy(() => import('./regulatory-changes').then((m) => ({ default: m.ImpactDashboardPage })));

const OfficerQueuePage = lazy(() => import('./officer-pages').then((m) => ({ default: m.OfficerQueuePage })));
const OfficerApplicationPage = lazy(() => import('./officer-pages').then((m) => ({ default: m.OfficerApplicationPage })));

function LazyRoute({ children }: { children: React.ReactNode }): JSX.Element {
  return (
    <Suspense
      fallback={
        <div className="min-h-[50vh] flex items-center justify-center">
          <LoadingSpinner label="Loading module..." />
        </div>
      }
    >
      {children}
    </Suspense>
  );
}

const isEmbedded =
  typeof window !== 'undefined' &&
  ('__TAURI_INTERNALS__' in window ||
    'Capacitor' in window ||
    import.meta.env.VITE_DESKTOP === 'true' ||
    import.meta.env.VITE_MOBILE === 'true' ||
    import.meta.env.VITE_ROUTER_MODE === 'hash');

const createRouter = isEmbedded ? createHashRouter : createBrowserRouter;

export const router = createRouter([
  {
    path: '/',
    element: <Layout />,
    children: [
      { index: true, element: <LazyRoute><HomePage /></LazyRoute> },
      { path: 'about', element: <LazyRoute><AboutPage /></LazyRoute> },
      { path: 'contact', element: <LazyRoute><ContactPage /></LazyRoute> },
      { path: 'business-map', element: <LazyRoute><BusinessMapPage /></LazyRoute> },
      { path: 'integrations', element: <LazyRoute><IntegrationsHubPage /></LazyRoute> },
      { path: 'login', element: <LazyRoute><LoginPage /></LazyRoute> },
      { path: 'register', element: <LazyRoute><RegisterPage /></LazyRoute> },
      { path: 'auth/callback', element: <LazyRoute><AuthCallbackPage /></LazyRoute> },
      { path: 'projects', element: <LazyRoute><ProjectsPage /></LazyRoute> },
      { path: 'projects/:id/profile', element: <LazyRoute><ProjectProfilePage /></LazyRoute> },
      { path: 'projects/:id/approvals', element: <LazyRoute><EvaluationResultsPage /></LazyRoute> },
      { path: 'projects/:id/roadmap', element: <LazyRoute><ProjectRoadmapPage /></LazyRoute> },
      { path: 'projects/:id/inspections', element: <LazyRoute><ProjectInspectionsPage /></LazyRoute> },
      { path: 'projects/:id/clarifications', element: <LazyRoute><ProjectClarificationsPage /></LazyRoute> },
      { path: 'projects/:id/grievances', element: <LazyRoute><ProjectGrievancesPage /></LazyRoute> },
      { path: 'projects/:id/documents/:documentId', element: <LazyRoute><ProjectDocumentPage /></LazyRoute> },
      { path: 'regulatory-changes', element: <LazyRoute><RegulatoryChangesListPage /></LazyRoute> },
      { path: 'regulatory-changes/:id', element: <LazyRoute><RegulatoryChangeDetailPage /></LazyRoute> },
      { path: 'regulatory-changes/:id/impacts', element: <LazyRoute><ImpactDashboardPage /></LazyRoute> },
      { path: 'officer', element: <LazyRoute><OfficerQueuePage /></LazyRoute> },
      { path: 'officer/applications/:instanceId', element: <LazyRoute><OfficerApplicationPage /></LazyRoute> },
      { path: '*', element: <LazyRoute><NotFoundPage /></LazyRoute> },
    ],
  },
]);
