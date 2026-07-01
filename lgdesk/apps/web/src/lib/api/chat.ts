'use client';

// STUB — Google Chat Spaces module. Listed "Out of Scope" in CLAUDE.md today;
// slot kept here per the data-fetching migration plan in case that changes in
// a later phase. Blocked pending Google credentials either way.
// Signatures only; no fetch logic yet.

export interface ChatSpace {
  id: string;
  entityType: 'Task' | 'Project' | 'Function' | 'Team';
  entityId: string;
  spaceUrl: string;
  createdAt: string;
}

export declare function useChatSpace(entityType: ChatSpace['entityType'], entityId: string | null): unknown;

export declare function useCreateChatSpace(): unknown;
