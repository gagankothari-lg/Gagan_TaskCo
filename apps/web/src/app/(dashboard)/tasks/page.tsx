'use client';

import { TaskListView } from '../../../components/modules/tasks/task-list-view';

export default function MyTasksPage() {
  return <TaskListView scope="mine" title="My Tasks" subtitle="Tasks assigned to or by you" showOwnershipTabs />;
}
