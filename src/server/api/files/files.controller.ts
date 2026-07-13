import { BadRequestException, Controller, Param, Post, Put, Body, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import { FilesService } from './files.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

const SAFE_FOLDER = /^(posts|capsules|avatars)$/;
const SAFE_FILENAME = /^[a-f0-9-]+\.[a-zA-Z0-9]+$/;

@Controller('files')
export class FilesController {
  constructor(private readonly filesService: FilesService) {}

  @UseGuards(JwtAuthGuard)
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

  // Cible du "uploadUrl" en mode stockage local (pas de credentials S3 configures) —
  // pas de JWT ici, la connaissance de l'URL (contenant un UUID) fait office de jeton, comme une URL S3 presignee.
  @Put('local-upload/:folder/:filename')
  localUpload(
    @Param('folder') folder: string,
    @Param('filename') filename: string,
    @Req() req: Request,
  ) {
    if (!SAFE_FOLDER.test(folder) || !SAFE_FILENAME.test(filename)) {
      throw new BadRequestException('Invalid upload path');
    }
    if (!Buffer.isBuffer(req.body)) {
      throw new BadRequestException('Expected raw file body');
    }
    this.filesService.saveLocalFile(`${folder}/${filename}`, req.body);
    return { ok: true };
  }
}
