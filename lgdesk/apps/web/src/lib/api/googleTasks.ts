'use client';

// STUB — optional Google Tasks sync, blocked pending Google credentials in a
// later phase (see CLAUDE.md — "Never Google OAuth login" applies to auth
// only; a service-account Tasks sync may still land later). Signatures only.

export interface GoogleTaskSyncStatus {
  connected: boolean;
  lastSyncedAt?: string | null;
}

export declare function useGoogleTasksSyncStatus(): unknown;

export declare function useSyncGoogleTasks(): unknown;
