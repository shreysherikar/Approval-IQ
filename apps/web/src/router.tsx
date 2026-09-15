import { createBrowserRouter } from 'react-router-dom';
import { Layout } from './Layout';
import { HomePage, LoginPage, RegisterPage } from './pages';
import {
  NotFoundPage,
  ProjectDocumentPage,
  ProjectInspectionsPage,
  ProjectProfilePage,
  ProjectRoadmapPage,
  ProjectsPage,
} from './project-pages';
import { EvaluationResultsPage } from './evaluation-results';

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
      { path: 'projects/:id/documents/:documentId', element: <ProjectDocumentPage /> },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
]);
