import { Link } from 'react-router-dom';
import { EmptyState } from './components';

export function ProjectsPage(): JSX.Element {
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Projects</h1>
      <EmptyState
        title="No projects yet"
        description="Project intake lands in Phase 3. Once created, projects will appear here."
      />
    </div>
  );
}

export function ProjectProfilePage(): JSX.Element {
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Project profile</h1>
      <EmptyState
        title="No profile data yet"
        description="Business profile details land with the Phase 3 intake form."
      />
    </div>
  );
}

export function ProjectRoadmapPage(): JSX.Element {
  return <p className="text-gray-600">Coming in Phase 4</p>;
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
