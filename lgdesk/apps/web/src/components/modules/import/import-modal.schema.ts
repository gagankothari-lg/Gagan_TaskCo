// Zod schemas for the Import modal's two input tabs (Google Sheet URL vs CSV upload).
// These are two independent forms (different required fields), matching
// apps/api/src/import/dto/preview-sheet.dto.ts (sheetUrl required) and the CSV upload
// contract used by usePreviewCsv (a File, sent as multipart/form-data).
import { z } from 'zod';

export const previewSheetSchema = z.object({
  sheetUrl: z.string().trim().min(1, 'Enter a Google Sheet URL or ID.'),
  tabName: z.string().optional(),
  projectId: z.string().optional(),
});

export type PreviewSheetFormValues = z.infer<typeof previewSheetSchema>;

export const previewCsvSchema = z.object({
  csvFile: z.instanceof(File, { message: 'Choose a CSV file first.' }),
  projectId: z.string().optional(),
});

export type PreviewCsvFormValues = z.infer<typeof previewCsvSchema>;
