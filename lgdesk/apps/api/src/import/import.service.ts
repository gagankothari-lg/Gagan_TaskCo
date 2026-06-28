import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { FunctionsService } from '../functions/functions.service';
import { TasksService } from '../tasks/tasks.service';

export interface ImportRow {
  type: 'Function' | 'Sub-Fn' | 'Task';
  function: string;
  subFunction?: string;
  taskTitle?: string;
  assigner?: string;
  assignees?: string[];
  status?: string;
  priority?: string;
  dueDate?: string;
  selected: boolean;
}

export interface ImportStats {
  functions: number;
  subFunctions: number;
  tasks: number;
  total: number;
}

export interface PreviewResult {
  rows: ImportRow[];
  stats: ImportStats;
}

export interface ExecuteResult {
  created: number;
  errors: string[];
}

@Injectable()
export class ImportService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly functions: FunctionsService,
    private readonly tasks: TasksService,
  ) {}

  // ─────────────────────────────────────────────── preview
  async previewFromSheet(
    dto: { sheetUrl: string; tabName?: string; projectId?: string },
    _callerEmpId: string,
  ): Promise<PreviewResult> {
    const id = this.extractSheetId(dto.sheetUrl);
    let url = `https://docs.google.com/spreadsheets/d/${id}/gviz/tq?tqx=out:csv`;
    if (dto.tabName) url += `&sheet=${encodeURIComponent(dto.tabName)}`;

    let res: Response;
    try {
      res = await fetch(url);
    } catch {
      throw new BadRequestException(
        "Couldn't read that sheet — make sure it's shared as 'anyone with the link (Viewer)' or use the CSV upload tab.",
      );
    }
    if (!res.ok) {
      throw new BadRequestException(
        "Couldn't read that sheet — make sure it's shared as 'anyone with the link (Viewer)' or use the CSV upload tab.",
      );
    }
    const text = await res.text();
    return this.buildPreview(text);
  }

  previewFromCsv(buffer: Buffer, _callerEmpId: string): PreviewResult {
    return this.buildPreview(buffer.toString('utf8'));
  }

  private buildPreview(csvText: string): PreviewResult {
    const rows = this.parseRows(csvText);
    return { rows, stats: this.computeStats(rows) };
  }

  private computeStats(rows: ImportRow[]): ImportStats {
    let functions = 0;
    let subFunctions = 0;
    let tasks = 0;
    for (const r of rows) {
      if (r.type === 'Function') functions++;
      else if (r.type === 'Sub-Fn') subFunctions++;
      else if (r.type === 'Task') tasks++;
    }
    return { functions, subFunctions, tasks, total: rows.length };
  }

  private extractSheetId(sheetUrl: string): string {
    const match = sheetUrl.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
    return match ? match[1] : sheetUrl.trim();
  }

  // ─────────────────────────────────────────────── CSV parsing
  // Minimal robust RFC-4180-ish parser: handles quoted fields containing
  // commas and newlines, and "" as an escaped quote inside a quoted field.
  private parseCsv(text: string): string[][] {
    const rows: string[][] = [];
    let field = '';
    let row: string[] = [];
    let inQuotes = false;
    const clean = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

    for (let i = 0; i < clean.length; i++) {
      const c = clean[i];
      if (inQuotes) {
        if (c === '"') {
          if (clean[i + 1] === '"') {
            field += '"';
            i++;
          } else {
            inQuotes = false;
          }
        } else {
          field += c;
        }
      } else if (c === '"') {
        inQuotes = true;
      } else if (c === ',') {
        row.push(field);
        field = '';
      } else if (c === '\n') {
        row.push(field);
        rows.push(row);
        field = '';
        row = [];
      } else {
        field += c;
      }
    }
    // Flush the trailing field/row (unless the input ended on a clean newline).
    if (field.length > 0 || row.length > 0) {
      row.push(field);
      rows.push(row);
    }
    return rows;
  }

  parseRows(csvText: string): ImportRow[] {
    const grid = this.parseCsv(csvText).filter((r) => r.some((c) => c.trim() !== ''));
    if (grid.length === 0) return [];

    const headers = grid[0].map((h) => this.normalizeHeader(h));
    const col = (...aliases: string[]): number => {
      for (const a of aliases) {
        const idx = headers.indexOf(a);
        if (idx !== -1) return idx;
      }
      return -1;
    };

    const iType = col('TYPE');
    const iFn = col('FUNCTION');
    const iSub = col('SUBFUNCTION', 'SUB-FUNCTION', 'SUB_FUNCTION', 'SUBFN');
    const iTitle = col('TASKTITLE', 'TASK TITLE', 'TASK', 'TITLE');
    const iAssigner = col('ASSIGNER');
    const iAssignees = col('ASSIGNEES', 'ASSIGNEE');
    const iStatus = col('STATUS');
    const iPriority = col('PRIORITY');
    const iDate = col('DUEDATE', 'DUE DATE', 'DATE');

    const get = (cells: string[], idx: number): string => (idx >= 0 && idx < cells.length ? cells[idx].trim() : '');

    const rows: ImportRow[] = [];
    for (let r = 1; r < grid.length; r++) {
      const cells = grid[r];
      const fn = get(cells, iFn);
      const subFunction = get(cells, iSub) || undefined;
      const taskTitle = get(cells, iTitle) || undefined;
      const assigner = get(cells, iAssigner) || undefined;
      const assigneesRaw = get(cells, iAssignees);
      const assignees = assigneesRaw
        ? assigneesRaw.split(/[,;]/).map((s) => s.trim()).filter(Boolean)
        : undefined;
      const status = get(cells, iStatus) || undefined;
      const priority = get(cells, iPriority) || undefined;
      const dueDate = get(cells, iDate) || undefined;

      let type = this.normalizeType(get(cells, iType));
      if (!type) {
        if (taskTitle) type = 'Task';
        else if (subFunction) type = 'Sub-Fn';
        else type = 'Function';
      }

      // Skip wholly empty rows (no function, no sub-fn, no task).
      if (!fn && !subFunction && !taskTitle) continue;

      rows.push({
        type,
        function: fn,
        subFunction,
        taskTitle,
        assigner,
        assignees,
        status,
        priority,
        dueDate,
        selected: true,
      });
    }
    return rows;
  }

  private normalizeHeader(h: string): string {
    return h.trim().toUpperCase().replace(/[_\s]+/g, ' ').trim();
  }

  private normalizeType(raw: string): ImportRow['type'] | null {
    const v = raw.trim().toLowerCase().replace(/[\s_-]+/g, '');
    if (!v) return null;
    if (v === 'task') return 'Task';
    if (v === 'subfn' || v === 'subfunction' || v === 'sub') return 'Sub-Fn';
    if (v === 'function' || v === 'fn') return 'Function';
    return null;
  }

  // ─────────────────────────────────────────────── execute
  async executeImport(
    rows: ImportRow[],
    projectId: string | undefined,
    callerEmpId: string,
  ): Promise<ExecuteResult> {
    const selected = (rows ?? []).filter((r) => r && r.selected);
    const errors: string[] = [];
    let created = 0;

    // functionName -> functionId (top-level functions created/seen this run)
    const fnByName = new Map<string, string>();
    // "fn|||subfn" -> functionId (sub-functions created/seen this run)
    const subByKey = new Map<string, string>();

    const subKey = (fn: string, sub: string): string => `${fn.toLowerCase()}|||${sub.toLowerCase()}`;

    const ensureFunction = async (name: string): Promise<string> => {
      const key = name.toLowerCase();
      const existing = fnByName.get(key);
      if (existing) return existing;
      const fn = await this.functions.createFunction({ name, projId: projectId }, callerEmpId);
      fnByName.set(key, fn.functionId);
      return fn.functionId;
    };

    const ensureSubFunction = async (parentName: string, subName: string): Promise<string> => {
      const key = subKey(parentName, subName);
      const existing = subByKey.get(key);
      if (existing) return existing;
      const parentId = await ensureFunction(parentName);
      const fn = await this.functions.createFunction(
        { name: subName, parentFnId: parentId, projId: projectId },
        callerEmpId,
      );
      subByKey.set(key, fn.functionId);
      return fn.functionId;
    };

    for (let i = 0; i < selected.length; i++) {
      const row = selected[i];
      try {
        if (row.type === 'Function') {
          if (!row.function) throw new Error('Function name is required');
          await ensureFunction(row.function);
          created++;
        } else if (row.type === 'Sub-Fn') {
          if (!row.function) throw new Error('Parent function name is required');
          if (!row.subFunction) throw new Error('Sub-function name is required');
          await ensureSubFunction(row.function, row.subFunction);
          created++;
        } else {
          // Task
          if (!row.taskTitle) throw new Error('Task title is required');
          let functionId: string | undefined;
          if (row.subFunction) functionId = await ensureSubFunction(row.function, row.subFunction);
          else if (row.function) functionId = await ensureFunction(row.function);

          const assigneeNames = row.assignees ?? [];
          const assigneeIds = await this.resolveEmpIds(assigneeNames);

          await this.tasks.createTask(
            {
              title: row.taskTitle,
              functionId,
              projId: projectId,
              assigneeIds: assigneeIds.length ? assigneeIds : undefined,
              status: this.cleanStatus(row.status),
              priority: this.cleanPriority(row.priority),
              dueDate: this.parseDate(row.dueDate),
            },
            // assigner defaults to the caller (set from JWT inside createTask).
            callerEmpId,
          );
          created++;
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        errors.push(`Row ${i + 1}: ${message}`);
      }
    }

    return { created, errors };
  }

  // Resolve a list of "First Last" / email tokens to empIds (case-insensitive).
  private async resolveEmpIds(names: string[]): Promise<string[]> {
    const wanted = names.map((n) => n.trim()).filter(Boolean);
    if (!wanted.length) return [];

    const users = await this.prisma.user.findMany({
      select: { empId: true, firstName: true, lastName: true, email: true },
    });

    const out: string[] = [];
    for (const name of wanted) {
      const lc = name.toLowerCase();
      const match = users.find((u) => {
        const full = `${u.firstName} ${u.lastName}`.toLowerCase();
        return full === lc || u.email.toLowerCase() === lc || u.empId.toLowerCase() === lc;
      });
      if (match && !out.includes(match.empId)) out.push(match.empId);
    }
    return out;
  }

  private cleanStatus(s?: string): string | undefined {
    const v = s?.trim();
    return v ? v : undefined;
  }

  private cleanPriority(p?: string): string | undefined {
    const v = p?.trim();
    return v ? v : undefined;
  }

  // Accept ISO and common date strings; return ISO-8601 or undefined.
  private parseDate(raw?: string): string | undefined {
    const v = raw?.trim();
    if (!v) return undefined;
    const d = new Date(v);
    if (isNaN(d.getTime())) return undefined;
    return d.toISOString();
  }
}
