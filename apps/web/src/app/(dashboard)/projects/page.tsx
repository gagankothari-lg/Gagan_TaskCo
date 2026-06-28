'use client';

import { ProjectGridView } from '../../../components/modules/projects/project-grid-view';

export default function ProjectsPage() {
  return <ProjectGridView scope="mine" title="Projects" subtitle="Projects you own or are assigned to" />;
}
