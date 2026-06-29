import {
  BadRequestException,
  Body,
  Controller,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { ImportService, ImportRow } from './import.service';
import { PreviewSheetDto } from './dto/preview-sheet.dto';
import { MANAGER_ROLES } from '../common/constants';

interface AuthedUser {
  empId: string;
  role: string;
  team?: string;
}

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(...MANAGER_ROLES)
@Controller('import')
export class ImportController {
  constructor(private readonly importService: ImportService) {}

  @Post('preview-sheet')
  previewSheet(@CurrentUser() user: AuthedUser, @Body() dto: PreviewSheetDto) {
    return this.importService.previewFromSheet(dto, user.empId);
  }

  // V-06: cap upload size (5 MB) and accept only CSV-ish files.
  @Post('preview-csv')
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: 5 * 1024 * 1024 },
      fileFilter: (_req, file, cb) => {
        const f = file as { mimetype?: string; originalname?: string };
        const ok = /csv|excel|text\/plain|octet-stream/.test(f.mimetype ?? '') || /\.csv$/i.test(f.originalname ?? '');
        cb(ok ? null : new BadRequestException('Only CSV files are allowed'), ok);
      },
    }),
  )
  previewCsv(
    @CurrentUser() user: AuthedUser,
    @UploadedFile() file: { buffer: Buffer } | undefined,
    @Body() body: { projectId?: string },
  ) {
    if (!file) throw new BadRequestException('No CSV file uploaded');
    // projectId rides along on the multipart body; preview itself doesn't need it,
    // but we keep the signature symmetric with the sheet path.
    void body;
    return this.importService.previewFromCsv(file.buffer, user.empId);
  }

  @Post('execute')
  execute(
    @CurrentUser() user: AuthedUser,
    @Body() body: { rows: ImportRow[]; projectId?: string },
  ) {
    return this.importService.executeImport(body.rows, body.projectId, user.empId);
  }
}
