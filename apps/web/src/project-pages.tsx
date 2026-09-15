import { Link, useParams } from 'react-router-dom';
import { DocumentDetailPage } from './document-detail';
import { ApplicantClarificationsPage } from './clarifications';
import { ApiError, projectsApi } from './api-client';
import { EmptyState, ErrorBanner } from './components';
import { RoadmapPage } from './roadmap';
import { ProfileIntakeForm } from './profile-form';

export { ProjectsOnboardingPage as ProjectsPage } from './projects/ProjectsOnboardingPage';

export function ProjectProfilePage(): JSX.Element {
  const { id } = useParams<{ id: string }>();
  if (id === undefined) {
    return <EmptyState title="Project not found" description="No project id in the URL." />;
  }
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">Business profile</h1>
        <p className="text-sm text-gray-600">
          Project <span className="font-mono text-xs">{id}</span> ·{' '}
          <Link to="/projects" className="text-blue-600 hover:underline">
            all projects
          </Link>
        </p>
      </div>
      <ProfileIntakeForm projectId={id} />
    </div>
  );
}


import { JointInspectionsPage } from './inspections';

export function ProjectRoadmapPage(): JSX.Element {
  return <RoadmapPage />;
}

export function ProjectInspectionsPage(): JSX.Element {
  return <JointInspectionsPage />;
}

export function ProjectDocumentPage(): JSX.Element {
  const { id, documentId } = useParams<{ id: string; documentId: string }>();
  if (!id || !documentId) {
    return <EmptyState title="Document not found" description="Missing project or document id in the URL." />;
  }
  return <DocumentDetailPage projectId={id} documentId={documentId} />;
}

export function ProjectClarificationsPage(): JSX.Element {
  const { id } = useParams<{ id: string }>();
  if (!id) {
    return <EmptyState title="Project not found" description="No project id in the URL." />;
  }
  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-600">
        <Link to={`/projects/${id}/roadmap`} className="text-blue-600 hover:underline">
          ← Back to roadmap
        </Link>
      </p>
      <ApplicantClarificationsPage projectId={id} />
    </div>
  );
}

export function NotFoundPage(): JSX.Element {
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Page not found</h1>
      <Link to="/" className="text-blue-600 hover:underline">
        Back to home
      </Link>
    </div>
  );
}
