'use client';

import { ProjectGridView } from '../../../components/modules/projects/project-grid-view';

export default function ProjectsPage() {
  return <ProjectGridView scope="mine" title="My Projects" showStatusFilter={false} />;
}
