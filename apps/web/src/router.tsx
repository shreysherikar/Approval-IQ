import { createBrowserRouter, createHashRouter } from 'react-router-dom';
import { Layout } from './Layout';
import { HomePage, LoginPage, RegisterPage } from './pages';
import {
  NotFoundPage,
  ProjectDocumentPage,
  ProjectInspectionsPage,
  ProjectClarificationsPage,
  ProjectProfilePage,
  ProjectRoadmapPage,
  ProjectsPage,
} from './project-pages';
import { EvaluationResultsPage } from './evaluation-results';
import { AuthCallbackPage } from './auth-callback';
import { AboutPage } from './landing/AboutPage';
import { ContactPage } from './landing/ContactPage';
import { BusinessMapPage } from './landing/BusinessMapPage';
import { OfficerApplicationPage, OfficerQueuePage } from './officer-pages';
import { RegulatoryChangesListPage, RegulatoryChangeDetailPage, ImpactDashboardPage } from './regulatory-changes';

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
      { index: true, element: <HomePage /> },
      { path: 'about', element: <AboutPage /> },
      { path: 'contact', element: <ContactPage /> },
      { path: 'business-map', element: <BusinessMapPage /> },
      { path: 'login', element: <LoginPage /> },
      { path: 'register', element: <RegisterPage /> },
      { path: 'auth/callback', element: <AuthCallbackPage /> },
      { path: 'projects', element: <ProjectsPage /> },
      { path: 'projects/:id/profile', element: <ProjectProfilePage /> },
      { path: 'projects/:id/approvals', element: <EvaluationResultsPage /> },
      { path: 'projects/:id/roadmap', element: <ProjectRoadmapPage /> },
      { path: 'projects/:id/inspections', element: <ProjectInspectionsPage /> },
      { path: 'projects/:id/clarifications', element: <ProjectClarificationsPage /> },
      { path: 'projects/:id/documents/:documentId', element: <ProjectDocumentPage /> },
      { path: 'regulatory-changes', element: <RegulatoryChangesListPage /> },
      { path: 'regulatory-changes/:id', element: <RegulatoryChangeDetailPage /> },
      { path: 'regulatory-changes/:id/impacts', element: <ImpactDashboardPage /> },
      { path: 'officer', element: <OfficerQueuePage /> },
      { path: 'officer/applications/:instanceId', element: <OfficerApplicationPage /> },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
]);
