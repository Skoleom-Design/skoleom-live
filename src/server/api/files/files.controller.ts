import { Controller, Post, Body, UseGuards } from '@nestjs/common';
import { FilesService } from './files.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('files')
@UseGuards(JwtAuthGuard)
export class FilesController {
  constructor(private readonly filesService: FilesService) {}

  @Post('upload-url')
  getUploadUrl(
    @Body() body: {
      folder: 'posts' | 'capsules' | 'avatars';
      mimeType: string;
      extension: string;
    },
  ) {
    return this.filesService.getUploadUrl(body.folder, body.mimeType, body.extension);
  }
}
