import { createBrowserRouter } from 'react-router-dom';
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
import { OfficerApplicationPage, OfficerQueuePage } from './officer-pages';

export const router = createBrowserRouter([
  {
    path: '/',
    element: <Layout />,
    children: [
      { index: true, element: <HomePage /> },
      { path: 'login', element: <LoginPage /> },
      { path: 'register', element: <RegisterPage /> },
      { path: 'projects', element: <ProjectsPage /> },
      { path: 'projects/:id/profile', element: <ProjectProfilePage /> },
      { path: 'projects/:id/approvals', element: <EvaluationResultsPage /> },
      { path: 'projects/:id/roadmap', element: <ProjectRoadmapPage /> },
      { path: 'projects/:id/inspections', element: <ProjectInspectionsPage /> },
      { path: 'projects/:id/clarifications', element: <ProjectClarificationsPage /> },
      { path: 'projects/:id/documents/:documentId', element: <ProjectDocumentPage /> },
      { path: 'officer', element: <OfficerQueuePage /> },
      { path: 'officer/applications/:instanceId', element: <OfficerApplicationPage /> },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
]);
