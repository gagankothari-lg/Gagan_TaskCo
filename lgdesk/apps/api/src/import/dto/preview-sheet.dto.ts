import { IsArray, IsOptional, IsString } from 'class-validator';
import type { ImportRow } from '../import.service';

export class PreviewSheetDto {
  @IsString() sheetUrl!: string;
  @IsString() @IsOptional() tabName?: string;
  @IsString() @IsOptional() projectId?: string;
}

export class ExecuteImportDto {
  // Rows come from our own /preview response; validated structurally in the service.
  @IsArray() rows!: ImportRow[];
  @IsString() @IsOptional() projectId?: string;
}
