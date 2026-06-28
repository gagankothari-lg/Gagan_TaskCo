import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { parseIds } from '../common/constants';

const GEMINI_MODEL = 'gemini-2.5-flash';
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

@Injectable()
export class WeeklySummaryService {
  private readonly logger = new Logger(WeeklySummaryService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  // ─── GET ────────────────────────────────────────────────
  async getWeeklySummary(empId: string, weekStartStr: string) {
    const weekStart = this.mondayUtc(weekStartStr);
    const row = await this.prisma.weeklySummary.findUnique({ where: { empId_weekStart: { empId, weekStart } } });
    if (!row || !row.content) return { found: false, weekStart: this.iso(weekStart), bullets: [] as string[] };
    return {
      found: true,
      weekStart: this.iso(weekStart),
      bullets: this.toBullets(row.content),
      content: row.content,
      isEdited: row.isEdited,
      generatedAt: row.generatedAt?.toISOString() ?? null,
      editedAt: row.editedAt?.toISOString() ?? null,
      aiModel: row.aiModel,
    };
  }

  // ─── SAVE (edited bullets) ──────────────────────────────
  // Bullets are stored newline-delimited WITHOUT the leading "• " (rule §16.4).
  async saveWeeklySummary(empId: string, weekStartStr: string, bullets: string[]) {
    const weekStart = this.mondayUtc(weekStartStr);
    const content = (bullets ?? []).map((b) => b.replace(/^[•\-*]\s*/, '').trim()).filter(Boolean).join('\n');
    const row = await this.prisma.weeklySummary.upsert({
      where: { empId_weekStart: { empId, weekStart } },
      create: { empId, weekStart, content, isEdited: true, editedAt: new Date(), editedBy: empId },
      update: { content, isEdited: true, editedAt: new Date(), editedBy: empId },
    });
    return { ok: true, bullets: this.toBullets(row.content ?? '') };
  }

  // ─── GENERATE NOW (on-demand AI) ────────────────────────
  async generateMyWeeklySummary(empId: string, weekStartStr: string) {
    const weekStart = this.mondayUtc(weekStartStr);
    const weekEnd = new Date(weekStart.getTime());
    weekEnd.setUTCDate(weekEnd.getUTCDate() + 7);

    const dayText = await this.buildWeekText(empId, weekStart, weekEnd);
    if (!dayText) throw new BadRequestException('No work logs for this week — fill in your work log first.');

    const bullets = await this.callGemini(dayText);
    const content = bullets.join('\n');
    await this.prisma.weeklySummary.upsert({
      where: { empId_weekStart: { empId, weekStart } },
      create: { empId, weekStart, content, isEdited: false, generatedAt: new Date(), aiModel: GEMINI_MODEL },
      update: { content, isEdited: false, generatedAt: new Date(), aiModel: GEMINI_MODEL },
    });
    return { found: true, weekStart: this.iso(weekStart), bullets, generatedAt: new Date().toISOString(), isEdited: false };
  }

  // ═══════════════════════════════════════════════ helpers
  private async buildWeekText(empId: string, start: Date, end: Date): Promise<string> {
    const [logs, internLogs] = await Promise.all([
      this.prisma.workLog.findMany({ where: { empId, date: { gte: start, lt: end } }, orderBy: { date: 'asc' } }),
      this.prisma.internWorkLog.findMany({ where: { empId, date: { gte: start, lt: end } }, orderBy: { date: 'asc' } }),
    ]);
    const lines: string[] = [];
    const fmt = (d: Date) => d.toISOString().slice(0, 10);
    for (const l of logs) {
      const work = [...parseIds(l.work1stHalf ?? ''), ...parseIds(l.work2ndHalf ?? '')].join('; ');
      if (!work && !l.remark) continue;
      lines.push(`${fmt(l.date)} [${l.attendance}]: ${work}${l.extraHours ? ` (+${l.extraHours}h OT)` : ''}${l.remark ? ` — ${l.remark}` : ''}`);
    }
    for (const l of internLogs) {
      const work = [...parseIds(l.work1stHalf ?? ''), ...parseIds(l.work2ndHalf ?? '')].join('; ');
      if (!work && !l.remark) continue;
      lines.push(`${fmt(l.date)} [${l.attendance}]: ${work}${l.remark ? ` — ${l.remark}` : ''}`);
    }
    return lines.join('\n');
  }

  private async callGemini(weekText: string): Promise<string[]> {
    const key = this.config.get<string>('GEMINI_API_KEY');
    if (!key) throw new BadRequestException('AI summary is not configured (GEMINI_API_KEY missing).');

    const prompt =
      `You are writing a concise weekly work summary for an internal MIS report. ` +
      `From the daily work logs below, produce 5 to 10 short, past-tense bullet points describing what was accomplished this week. ` +
      `Each bullet on its own line, prefixed with "• ". Be specific and professional; do not invent work that is not in the logs.\n\n` +
      `Daily work logs:\n${weekText}`;

    try {
      const res = await fetch(`${GEMINI_URL}?key=${encodeURIComponent(key)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.4, maxOutputTokens: 2048 },
        }),
      });
      if (!res.ok) {
        const body = await res.text();
        this.logger.error(`Gemini ${res.status}: ${body.slice(0, 300)}`);
        throw new BadRequestException('AI generation failed. Please try again.');
      }
      const data = (await res.json()) as { candidates?: { content?: { parts?: { text?: string }[] } }[] };
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
      const bullets = text
        .split('\n')
        .map((l) => l.replace(/^[•\-*]\s*/, '').trim())
        .filter(Boolean);
      if (bullets.length === 0) throw new BadRequestException('AI returned no summary. Please try again.');
      return bullets;
    } catch (e) {
      if (e instanceof BadRequestException) throw e;
      this.logger.error(`Gemini call error: ${(e as Error).message}`);
      throw new BadRequestException('AI generation failed. Please try again.');
    }
  }

  // Bullets stored without prefix; surface them prefix-free (UI adds "• ").
  private toBullets(content: string): string[] {
    return content.split('\n').map((l) => l.replace(/^[•\-*]\s*/, '').trim()).filter(Boolean);
  }

  // Normalize any date to the Monday (00:00 UTC) of its ISO week (rule §19).
  private mondayUtc(dateStr: string): Date {
    const d = new Date(dateStr);
    if (Number.isNaN(d.getTime())) throw new BadRequestException('Invalid weekStart date');
    const dow = (d.getUTCDay() + 6) % 7; // 0 = Monday
    return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() - dow));
  }
  private iso(d: Date): string { return d.toISOString().slice(0, 10); }
}
