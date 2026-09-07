import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { FunctionsService } from '../functions/functions.service';
import { TasksService } from '../tasks/tasks.service';
import { TASK_STATUSES } from '../common/constants';
import { TASK_PRIORITIES } from '../tasks/dto/create-task.dto';

export interface ImportRow {
  type: 'Function' | 'Sub-Fn' | 'Task';
  function: string;
  functionDescription?: string;
  subFunction?: string;
  subFunctionDescription?: string;
  taskTitle?: string;
  assigner?: string;
  assignees?: string[];
  status?: string;
  priority?: string;
  dueDate?: string;
  // Round5 add'l-3: reference (task-import.gs:226,229-230) carries Start Date
  // (Function/Sub-Function only — Task has no Start_Date column in either schema)
  // and Estimated Hours/Links (Task only, though Links also applies to
  // Function/Sub-Function) as columns distinct from Deadline/Due Date.
  startDate?: string;
  estimatedHours?: number;
  links?: string[];
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
  // Round5 add'l-4 / #5: names present in the file's "Given By"/assignee columns that
  // didn't resolve to a real active employee — surfaced so the user can see and correct
  // them before committing, mirroring task-import.gs's unmatchedAssigners/
  // unmatchedExecutors (getMigrationPreview, task-import.gs:420-423).
  unmatchedAssigners: string[];
  unmatchedAssignees: string[];
}

export interface ExecuteResult {
  created: number;
  errors: string[];
  // Non-fatal, per-row notices — e.g. an unrecognized Status/Priority value that was
  // defaulted, or a Function/Sub-Function's explicit fields that couldn't be applied
  // because that record was already created earlier in the same batch. These rows
  // still count toward `created`; they are NOT failures.
  warnings: string[];
}

// Status/Priority/Deadline/StartDate/Links for a structure-only (Function/Sub-Fn) row —
// applied only when the row itself creates the Function/Sub-Function record, never when
// a Task row is merely ensuring its parent hierarchy exists (mirrors `_migInsertRows`,
// task-import.gs:304-311). `description` is intentionally NOT part of this bucket: the
// reference applies a Function/Sub-Function's Description unconditionally whenever the
// record is first created — including via an implicit Task-row creation — so it's passed
// separately (see `ensureFunction`/`ensureSubFunction` below).
interface StructureFields {
  status?: string;
  priority?: string;
  deadline?: string;
  startDate?: string;
  links?: string[];
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

  async previewFromCsv(buffer: Buffer, _callerEmpId: string): Promise<PreviewResult> {
    return this.buildPreview(buffer.toString('utf8'));
  }

  private async buildPreview(csvText: string): Promise<PreviewResult> {
    const rows = this.parseRows(csvText);
    // Round5 add'l-4 / #5: resolve against the same employee map executeImport will use,
    // so what the preview banner claims is unmatched is guaranteed consistent with what
    // actually happens on commit.
    const empMap = await this.buildEmpMap();
    const unmatchedAssigners = new Set<string>();
    const unmatchedAssignees = new Set<string>();
    for (const r of rows) {
      if (r.assigner && !this.resolveName(empMap, r.assigner)) unmatchedAssigners.add(r.assigner);
      for (const a of r.assignees ?? []) {
        if (a && !this.resolveName(empMap, a)) unmatchedAssignees.add(a);
      }
    }
    return {
      rows,
      stats: this.computeStats(rows),
      unmatchedAssigners: [...unmatchedAssigners],
      unmatchedAssignees: [...unmatchedAssignees],
    };
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

    // Alias sets widened to match the reference's `ALIASES` map (task-import.gs:129-159) —
    // see AUDIT_REPORT.md A2 "Fuzzy header matching" (Fix A). Aliases are written in already-
    // normalized form (uppercase, underscores collapsed to spaces) since `normalizeHeader` never
    // leaves an underscore in a header value.
    const iType = col('TYPE');
    const iFn = col('FUNCTION', 'FUNCTIONS', 'FN', 'FUNC');
    const iFnDesc = col('FUNCTION DESCRIPTION', 'FN DESCRIPTION', 'FN DESC', 'FUNCTION DESC');
    const iSub = col(
      'SUBFUNCTION',
      'SUBFUNCTIONS',
      'SUB-FUNCTION',
      'SUB-FUNCTIONS',
      'SUB FUNCTION',
      'SUB FUNCTIONS',
      'SUB - FUNCTION',
      'SUB - FUNCTIONS',
      'SF',
      'SUBFN',
    );
    const iSubDesc = col('SUB-FUNCTION DESCRIPTION', 'SUB FUNCTION DESCRIPTION', 'SUBFN DESCRIPTION', 'SF DESCRIPTION', 'SUB-FN DESC');
    const iTitle = col('TASKTITLE', 'TASK TITLE', 'TASK', 'TASKS', 'TASK NAME', 'TITLE');
    const iAssigner = col('ASSIGNER', 'GIVEN BY', 'ASSIGNED BY', 'CREATED BY');
    const iAssignees = col('ASSIGNEES', 'ASSIGNEE', 'TASK EXECUTOR', 'ASSIGNED TO', 'EXECUTOR');
    const iStatus = col('STATUS', 'TASK STATUS');
    const iPriority = col('PRIORITY', 'TASK PRIORITY');
    const iDate = col('DUEDATE', 'DUE DATE', 'DUE', 'TASK DUE DATE', 'DEADLINE', 'END DATE', 'DATE');
    const iStartDate = col('START DATE', 'STARTDATE');
    const iEstHours = col('ESTIMATED HOURS', 'EST HOURS', 'EST. HOURS', 'HOURS');
    const iLinks = col('LINKS', 'LINK', 'RELATED LINKS', 'URL', 'URLS', 'FILE LINK', 'ATTACHMENT');

    const get = (cells: string[], idx: number): string => (idx >= 0 && idx < cells.length ? cells[idx].trim() : '');

    const rows: ImportRow[] = [];
    for (let r = 1; r < grid.length; r++) {
      const cells = grid[r];
      const fn = get(cells, iFn);
      const functionDescription = get(cells, iFnDesc) || undefined;
      const subFunction = get(cells, iSub) || undefined;
      const subFunctionDescription = get(cells, iSubDesc) || undefined;
      const taskTitle = get(cells, iTitle) || undefined;
      const assigner = get(cells, iAssigner) || undefined;
      const assigneesRaw = get(cells, iAssignees);
      const assignees = assigneesRaw
        ? assigneesRaw.split(/[,;]/).map((s) => s.trim()).filter(Boolean)
        : undefined;
      const status = get(cells, iStatus) || undefined;
      const priority = get(cells, iPriority) || undefined;
      const dueDate = get(cells, iDate) || undefined;
      const startDate = get(cells, iStartDate) || undefined;
      const estHoursRaw = get(cells, iEstHours);
      const estimatedHours = estHoursRaw ? parseFloat(estHoursRaw) : undefined;
      // Newline-separated, matching the reference's `_migNormaliseLinks`
      // (task-import.gs:558-561) and the rebuild's own existing Links convention
      // (CLAUDE.md "Recent Change #31" — newline-separated URLs).
      const linksRaw = get(cells, iLinks);
      const links = linksRaw
        ? linksRaw.split('\n').map((s) => s.trim()).filter(Boolean)
        : undefined;

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
        functionDescription,
        subFunction,
        subFunctionDescription,
        taskTitle,
        assigner,
        assignees,
        status,
        priority,
        dueDate,
        startDate,
        estimatedHours: estimatedHours !== undefined && !isNaN(estimatedHours) ? estimatedHours : undefined,
        links,
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
    const warnings: string[] = [];
    let created = 0;

    // Round5 #5: resolve "Given By" against the same active-employee map used for
    // assignee resolution below — built once per execute call (not per row).
    const empMap = await this.buildEmpMap();

    // functionName -> { functionId, fields the record was actually created with } (top-level
    // functions created/seen this run)
    const fnByName = new Map<string, { id: string; fields: StructureFields }>();
    // "fn|||subfn" -> { functionId, fields } (sub-functions created/seen this run)
    const subByKey = new Map<string, { id: string; fields: StructureFields }>();

    const subKey = (fn: string, sub: string): string => `${fn.toLowerCase()}|||${sub.toLowerCase()}`;

    const hasAnyField = (f?: StructureFields): boolean =>
      !!(f && (f.status || f.priority || f.deadline || f.startDate || (f.links && f.links.length)));
    const fieldsDiffer = (a?: StructureFields, b?: StructureFields): boolean =>
      (a?.status ?? undefined) !== (b?.status ?? undefined) ||
      (a?.priority ?? undefined) !== (b?.priority ?? undefined) ||
      (a?.deadline ?? undefined) !== (b?.deadline ?? undefined) ||
      (a?.startDate ?? undefined) !== (b?.startDate ?? undefined) ||
      (a?.links?.join('\n') ?? undefined) !== (b?.links?.join('\n') ?? undefined);

    const ensureFunction = async (
      name: string,
      assignerId: string,
      fields?: StructureFields,
      description?: string,
      rowLabel?: string,
    ): Promise<string> => {
      const key = name.toLowerCase();
      const existing = fnByName.get(key);
      if (existing) {
        // On a cache hit, this row's own explicit Status/Priority/Deadline/Start Date/Links
        // (if any) are NOT applied to the already-created record — surface that clearly
        // instead of silently dropping them behind an ordinary success count. (Description
        // is deliberately excluded from this diff check — see StructureFields' doc comment.)
        if (rowLabel && hasAnyField(fields) && fieldsDiffer(fields, existing.fields)) {
          warnings.push(
            `${rowLabel}: Function "${name}" already created earlier in this batch — Status/Priority/Deadline/Start Date/Links from this row were not applied.`,
          );
        }
        return existing.id;
      }
      const fn = await this.functions.createFunction(
        {
          name,
          projId: projectId,
          description,
          status: fields?.status,
          priority: fields?.priority,
          deadline: fields?.deadline,
          startDate: fields?.startDate,
          links: fields?.links,
        },
        callerEmpId,
        assignerId,
      );
      fnByName.set(key, { id: fn.functionId, fields: fields ?? {} });
      return fn.functionId;
    };

    const ensureSubFunction = async (
      parentName: string,
      subName: string,
      assignerId: string,
      fields?: StructureFields,
      description?: string,
      rowLabel?: string,
    ): Promise<string> => {
      const key = subKey(parentName, subName);
      const existing = subByKey.get(key);
      if (existing) {
        if (rowLabel && hasAnyField(fields) && fieldsDiffer(fields, existing.fields)) {
          warnings.push(
            `${rowLabel}: Sub-Function "${subName}" (under "${parentName}") already created earlier in this batch — Status/Priority/Deadline/Start Date/Links from this row were not applied.`,
          );
        }
        return existing.id;
      }
      // Parent function creation always uses this same row's resolved assignerId,
      // matching task-import.gs's single per-row `assignerId` used for every record
      // that row's processing happens to create.
      const parentId = await ensureFunction(parentName, assignerId);
      const fn = await this.functions.createFunction(
        {
          name: subName,
          parentFnId: parentId,
          projId: projectId,
          description,
          status: fields?.status,
          priority: fields?.priority,
          deadline: fields?.deadline,
          startDate: fields?.startDate,
          links: fields?.links,
        },
        callerEmpId,
        assignerId,
      );
      subByKey.set(key, { id: fn.functionId, fields: fields ?? {} });
      return fn.functionId;
    };

    for (let i = 0; i < selected.length; i++) {
      const row = selected[i];
      const rowLabel = `Row ${i + 1}`;
      try {
        // Round5 #5: resolve this row's "Given By" name against a real active employee;
        // fall back to the importing caller only when unmatched (task-import.gs:260) —
        // this is server-side name resolution against verified records, never a raw
        // body-supplied assignerId.
        const assignerId = (row.assigner && this.resolveName(empMap, row.assigner)) || callerEmpId;

        if (row.type === 'Function') {
          if (!row.function) throw new Error('Function name is required');
          await ensureFunction(
            row.function,
            assignerId,
            {
              status: this.cleanStatus(row.status, warnings, rowLabel),
              priority: this.cleanPriority(row.priority, warnings, rowLabel),
              deadline: this.parseDate(row.dueDate),
              startDate: this.parseDate(row.startDate),
              links: row.links,
            },
            row.functionDescription,
            rowLabel,
          );
          created++;
        } else if (row.type === 'Sub-Fn') {
          if (!row.function) throw new Error('Parent function name is required');
          if (!row.subFunction) throw new Error('Sub-function name is required');
          await ensureSubFunction(
            row.function,
            row.subFunction,
            assignerId,
            {
              status: this.cleanStatus(row.status, warnings, rowLabel),
              priority: this.cleanPriority(row.priority, warnings, rowLabel),
              deadline: this.parseDate(row.dueDate),
              startDate: this.parseDate(row.startDate),
              links: row.links,
            },
            row.subFunctionDescription,
            rowLabel,
          );
          created++;
        } else {
          // Task
          if (!row.taskTitle) throw new Error('Task title is required');
          // functionId always points at the top-level parent Function; subFnId (if any)
          // points at the chosen Sub-Function — matching every other task-creation path
          // (task-edit-modal.tsx, task-list-view.tsx's batch row), which always sets both
          // together rather than putting the sub-function's id into functionId.
          let functionId: string | undefined;
          let subFnId: string | undefined;
          if (row.subFunction) {
            // A Task row's own Function/Sub-Function Description columns (if present)
            // still apply if this row is the one that first creates that record — matching
            // the reference's unconditional-on-creation Description semantics (see
            // StructureFields' doc comment). Structure fields (status/priority/deadline/
            // startDate/links) are NOT passed here — undefined `fields` preserves the
            // existing "don't stomp a real structure row's values with a Task row's
            // implicit defaults" behavior.
            functionId = await ensureFunction(row.function, assignerId, undefined, row.functionDescription);
            subFnId = await ensureSubFunction(row.function, row.subFunction, assignerId, undefined, row.subFunctionDescription);
          } else if (row.function) {
            functionId = await ensureFunction(row.function, assignerId, undefined, row.functionDescription);
          }

          const assigneeNames = row.assignees ?? [];
          const assigneeIds = await this.resolveEmpIds(assigneeNames);

          await this.tasks.createTask(
            {
              title: row.taskTitle,
              functionId,
              subFnId,
              projId: projectId,
              assigneeIds: assigneeIds.length ? assigneeIds : undefined,
              status: this.cleanStatus(row.status, warnings, rowLabel),
              priority: this.cleanPriority(row.priority, warnings, rowLabel),
              dueDate: this.parseDate(row.dueDate),
              estimatedHours: row.estimatedHours,
              links: row.links,
            },
            callerEmpId,
            assignerId,
          );
          created++;
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        errors.push(`Row ${i + 1}: ${message}`);
      }
    }

    return { created, errors, warnings };
  }

  // Builds the same active-employee name→empId lookup the reference's `_migBuildEmpMap`
  // (task-import.gs:527-545) builds — full name, reversed full name, first name alone,
  // last name alone, email, first-match-wins for ambiguous keys — shared by assigner
  // resolution (Round5 #5) and assignee resolution (`resolveEmpIds`) so both use
  // identical matching rules. Excludes deactivated employees so a deactivated user's
  // name can never silently resolve during import.
  private async buildEmpMap(): Promise<Map<string, string>> {
    const users = await this.prisma.user.findMany({
      where: { isActive: true },
      select: { empId: true, firstName: true, lastName: true, email: true },
    });

    const empMap = new Map<string, string>();
    const claim = (key: string, empId: string) => {
      const k = key.trim().toLowerCase();
      if (k && !empMap.has(k)) empMap.set(k, empId);
    };
    for (const u of users) {
      claim(`${u.firstName} ${u.lastName}`, u.empId); // full name
      claim(`${u.lastName} ${u.firstName}`, u.empId); // reversed full name
      claim(u.firstName, u.empId); // first name alone
      claim(u.lastName, u.empId); // last name alone
      claim(u.email, u.empId); // email
      claim(u.empId, u.empId); // rebuild-only extra: raw empId token
    }
    return empMap;
  }

  private resolveName(empMap: Map<string, string>, name: string): string | undefined {
    return empMap.get(name.trim().toLowerCase());
  }

  // Resolve a list of "First Last" / email tokens to empIds (case-insensitive).
  // AUDIT_REPORT.md A2 "Employee-name resolution" (Fix C): widen matching to the reference's
  // full variant set — see `buildEmpMap` above.
  private async resolveEmpIds(names: string[]): Promise<string[]> {
    const wanted = names.map((n) => n.trim()).filter(Boolean);
    if (!wanted.length) return [];

    const empMap = await this.buildEmpMap();
    const out: string[] = [];
    for (const name of wanted) {
      const empId = this.resolveName(empMap, name);
      if (empId && !out.includes(empId)) out.push(empId);
    }
    return out;
  }

  // Unlike every other task/function-creation path — which runs through a class-validator DTO
  // (`CreateTaskDto`/`CreateFunctionDto`, `@IsIn([...TASK_STATUSES])`/`@IsIn([...TASK_PRIORITIES])`)
  // enforced by Nest's ValidationPipe — rows here are built into plain object literals and passed
  // straight into `FunctionsService`/`TasksService` methods, bypassing the HTTP validation pipeline
  // entirely. So an arbitrary spreadsheet string (e.g. "In Progress", which is not a real status)
  // would otherwise persist verbatim. Validate here instead: match case-insensitively against the
  // real enum, fall back to a sensible default on a miss, and record a per-row warning rather than
  // silently accepting or silently dropping the value.
  private cleanStatus(s: string | undefined, warnings: string[], rowLabel: string): string | undefined {
    const v = s?.trim();
    if (!v) return undefined;
    const match = (TASK_STATUSES as readonly string[]).find((t) => t.toLowerCase() === v.toLowerCase());
    if (match) return match;
    warnings.push(`${rowLabel}: Status "${v}" is not a recognized status — defaulted to "Not Started".`);
    return 'Not Started';
  }

  private cleanPriority(p: string | undefined, warnings: string[], rowLabel: string): string | undefined {
    const v = p?.trim();
    if (!v) return undefined;
    const match = TASK_PRIORITIES.find((t) => t.toLowerCase() === v.toLowerCase());
    if (match) return match;
    warnings.push(`${rowLabel}: Priority "${v}" is not a recognized priority — defaulted to "Medium".`);
    return 'Medium';
  }

  // Accept ISO and common date strings; return ISO-8601 or undefined.
  private parseDate(raw?: string): string | undefined {
    const v = raw?.trim();
    if (!v) return undefined;
    const d = new Date(v);
    if (isNaN(d.getTime())) return undefined;
    const iso = d.toISOString();
    // AUDIT_REPORT.md A2 "Date sanitization" (Fix D): Google Sheets' epoch-zero placeholder for
    // an empty date cell (`1899-12-30` / `12/30/1899`) parses as a valid JS Date — without this
    // check it would be imported as a real (bogus) due date instead of left blank, unlike the
    // reference's `_migNormaliseDate` (task-import.gs:547-556), which explicitly rejects it.
    if (iso.startsWith('1899-12-30')) return undefined;
    return iso;
  }
}
