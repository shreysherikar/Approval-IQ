import { useState } from 'react';
import type { FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ApiError, projectsApi } from './api-client';
import { EmptyState, ErrorBanner } from './components';
import { RoadmapPage } from './roadmap';
import { ProfileIntakeForm } from './profile-form';
import { useAuth } from './auth';

/**
 * Projects list + creation (minimal Phase-3 skeleton). Full business /
 * premises / membership modeling arrives in Phase 4+; today an applicant only
 * needs a project to anchor profile versions against.
 */
export function ProjectsPage(): JSX.Element {
  const navigate = useNavigate();
  const { accessToken } = useAuth();
  const [name, setName] = useState('');
  const [businessId, setBusinessId] = useState('');
  const [industry, setIndustry] = useState('brewery');
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: FormEvent): Promise<void> => {
    e.preventDefault();
    setIsCreating(true);
    setError(null);
    try {
      const project = await projectsApi.create(
        {
          name: name.trim(),
          industry,
          businessId: businessId.trim(),
        },
        accessToken ?? undefined,
      );
      void navigate(`/projects/${project.id}/profile`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not create the project.');
      setIsCreating(false);
    }
  };

  const inputClass =
    'mt-1 w-full rounded border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none';

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Projects</h1>
        <p className="text-sm text-gray-600">
          Create a project, then fill in your business profile to see which approvals apply.
        </p>
      </div>

      <form onSubmit={(e) => void submit(e)} className="space-y-4 rounded-md border border-gray-200 bg-white p-4" noValidate>
        <p className="text-sm font-semibold text-gray-800">New project</p>
        {error && <ErrorBanner message={error} />}
        <div className="grid gap-4 sm:grid-cols-3">
          <label className="block sm:col-span-2">
            <span className="text-sm font-medium text-gray-700">Project name</span>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Pune brewery expansion"
              className={inputClass}
            />
          </label>
          <label className="block">
            <span className="text-sm font-medium text-gray-700">Industry</span>
            <select
              value={industry}
              onChange={(e) => setIndustry(e.target.value)}
              className={inputClass}
            >
              <option value="brewery">Brewery</option>
            </select>
          </label>
        </div>
        <label className="block">
          <span className="text-sm font-medium text-gray-700">Business ID</span>
          <input
            type="text"
            required
            value={businessId}
            onChange={(e) => setBusinessId(e.target.value)}
            placeholder="e.g. my-business-01"
            className={inputClass}
          />
          <span className="mt-1 block text-xs text-gray-500">
            A reference for your business — full business profiles arrive in Phase 4.
          </span>
        </label>
        <button
          type="submit"
          disabled={isCreating}
          className="rounded bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {isCreating ? 'Creating…' : 'Create project and fill profile'}
        </button>
      </form>

      <EmptyState
        title="No project list yet"
        description="Listing existing projects needs a projects read endpoint — coming in a later phase."
      />
    </div>
  );
}

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


export function ProjectRoadmapPage(): JSX.Element {
  return <RoadmapPage />;
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
