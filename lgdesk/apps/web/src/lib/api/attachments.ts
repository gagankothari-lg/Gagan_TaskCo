'use client';

// STUB — attachments backing store is Google Drive (googleapis), blocked pending
// Google credentials being wired up in a later phase (apps/api/src/attachments).
// Business rule: soft-delete only (isDeleted=true) — the file stays in Drive.
// Signatures only; no fetch logic yet. Fill in once credentials land.

export interface Attachment {
  id: string;
  attId: string;
  entityType: 'Task' | 'Project' | 'Function';
  entityId: string;
  fileName: string;
  driveFileId: string;
  driveUrl: string;
  uploadedBy: string;
  isDeleted: boolean;
  createdAt: string;
}

export declare function useAttachments(entityType: Attachment['entityType'], entityId: string | null): unknown;

export declare function useUploadAttachment(): unknown;

export declare function useDeleteAttachment(): unknown;
