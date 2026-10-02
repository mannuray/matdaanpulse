import { Body, Controller, Post, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { MediaService } from '../../media/media.service';
import { MAX_UPLOAD_BYTES } from '../../media/media-validation';
import { UploadMediaDto } from '../../media/dto/upload-media.dto';

@Controller('admin/media')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AdminMediaController {
  constructor(private readonly media: MediaService) {}

  /** One image (party logo / ECI symbol / person photo). Memory storage; per-kind limits are checked by the service. */
  @Post()
  @Roles('SUPER_ADMIN', 'EDITOR')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: MAX_UPLOAD_BYTES, files: 1 } }))
  upload(@UploadedFile() file: Express.Multer.File | undefined, @Body() body: UploadMediaDto) {
    return this.media.upload(file, body.kind, body.owner_id);
  }
}
