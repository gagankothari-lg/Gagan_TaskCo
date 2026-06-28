import {
  Body,
  Controller,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { ImportService, ImportRow } from './import.service';
import { PreviewSheetDto } from './dto/preview-sheet.dto';

interface AuthedUser {
  empId: string;
  role: string;
  team?: string;
}

@UseGuards(JwtAuthGuard)
@Controller('import')
export class ImportController {
  constructor(private readonly importService: ImportService) {}

  @Post('preview-sheet')
  previewSheet(@CurrentUser() user: AuthedUser, @Body() dto: PreviewSheetDto) {
    return this.importService.previewFromSheet(dto, user.empId);
  }

  @Post('preview-csv')
  @UseInterceptors(FileInterceptor('file'))
  previewCsv(
    @CurrentUser() user: AuthedUser,
    @UploadedFile() file: { buffer: Buffer },
    @Body() body: { projectId?: string },
  ) {
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
