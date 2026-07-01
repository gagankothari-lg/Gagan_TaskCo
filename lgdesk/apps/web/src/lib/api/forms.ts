'use client';

// STUB — Google Forms module. Listed "Out of Scope" in CLAUDE.md today; slot
// kept here per the data-fetching migration plan in case that changes in a
// later phase. Backs the (dashboard)/forms placeholder route.
// Signatures only; no fetch logic yet.

export interface CompanyForm {
  id: string;
  formId: string;
  title: string;
  description?: string;
  formUrl: string;
  createdAt: string;
}

export declare function useForms(): unknown;

export declare function useFormSubmission(): unknown;
