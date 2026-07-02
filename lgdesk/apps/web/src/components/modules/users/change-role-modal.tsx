'use client';

import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../../ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '../../ui/form';
import { Spinner } from '../../ui/spinner';
import { rolePillClass } from '../../../lib/utils';
import { apiErrorMessage } from '../../../lib/api/client';
import { useChangeRole } from '../../../lib/api/teamMembers';
import { allowedNewRoles } from '../../../lib/rbac';
import { toast } from '../../../lib/toast';
import { changeRoleSchema, type ChangeRoleFormValues } from './change-role-modal.schema';
import type { User } from '../../../lib/types';

interface ChangeRoleModalProps {
  /** The member whose role is being changed, or null to keep the dialog closed. */
  member: User | null;
  actorRole: string;
  onClose: () => void;
}

const selectClass =
  'w-full bg-surface border border-border text-text rounded-[8px] px-3 py-2 text-sm focus:border-p2 focus:outline-none';

/**
 * Real "Change Role" form (shadcn Dialog + RHF/Zod), replacing the former
 * `toast('Role change coming soon')` stub. Options are populated from
 * lib/rbac.ts `allowedNewRoles(actorRole, targetRole)` — the exact mirror of
 * UsersService.changeRole's matrix (TF: no branch, never rendered; TC:
 * own-team TM/Intern only, per the page-level gate in members-view.tsx;
 * Admin/SA: everyone except each other/self).
 */
export function ChangeRoleModal({ member, actorRole, onClose }: ChangeRoleModalProps) {
  const changeRole = useChangeRole();
  const [error, setError] = useState<string | null>(null);
  const options = member ? allowedNewRoles(actorRole, member.role) : [];

  const form = useForm<ChangeRoleFormValues>({
    resolver: zodResolver(changeRoleSchema),
    defaultValues: { newRole: member?.role ?? '' },
  });

  // Re-seed the form whenever a different member is opened.
  useEffect(() => {
    if (member) {
      form.reset({ newRole: member.role });
      setError(null);
    }
  }, [member, form]);

  async function onSubmit(values: ChangeRoleFormValues) {
    if (!member) return;
    setError(null);
    try {
      await changeRole.mutateAsync({ empId: member.empId, newRole: values.newRole });
      toast(`Role updated to ${values.newRole}.`, 'success');
      onClose();
    } catch (err) {
      setError(apiErrorMessage(err, 'Unable to update role'));
    }
  }

  function handleOpenChange(next: boolean) {
    if (!next) onClose();
  }

  const memberName = member ? `${member.firstName} ${member.lastName}`.trim() : '';

  return (
    <Dialog open={!!member} onOpenChange={handleOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Change Role</DialogTitle>
        </DialogHeader>
        {member && (
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)}>
              <div className="space-y-3 px-5 py-4">
                <div className="flex items-center gap-2 text-sm text-text">
                  <span className="font-semibold">{memberName}</span>
                  <span className={rolePillClass(member.role)}>{member.role}</span>
                </div>
                <FormField
                  control={form.control}
                  name="newRole"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="mb-1 block text-xs text-muted">New role</FormLabel>
                      <FormControl>
                        <select className={selectClass} {...field}>
                          {options.map((r) => (
                            <option key={r} value={r}>{r}</option>
                          ))}
                        </select>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                {error && <div className="rounded-[8px] border border-danger/40 bg-[#fce8e8] px-3 py-2 text-sm text-danger">{error}</div>}
              </div>
              <DialogFooter>
                <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
                <button type="submit" disabled={changeRole.isPending} className="btn btn-primary disabled:opacity-60">
                  {changeRole.isPending && <Spinner size={14} />} Save Role
                </button>
              </DialogFooter>
            </form>
          </Form>
        )}
      </DialogContent>
    </Dialog>
  );
}

export default ChangeRoleModal;
