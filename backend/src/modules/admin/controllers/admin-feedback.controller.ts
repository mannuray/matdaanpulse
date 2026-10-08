import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Query, Req, UseGuards } from '@nestjs/common';
import { FeedbackService } from '../../feedback/feedback.service';
import { UpdateFeedbackStatusDto } from '../../feedback/dto/feedback.dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { AdminFeedbackQueryDto } from '../../../common/dto/query.dto';

@Controller('admin/feedback')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AdminFeedbackController {
  constructor(private readonly feedbackService: FeedbackService) {}

  @Get()
  @Roles('SUPER_ADMIN', 'EDITOR')
  list(@Query() { page, limit, status }: AdminFeedbackQueryDto) {
    return this.feedbackService.list(page ?? 1, limit ?? 50, status);
  }

  @Patch(':id')
  @Roles('SUPER_ADMIN', 'EDITOR')
  updateStatus(@Param('id', ParseUUIDPipe) id: string, @Body() { status }: UpdateFeedbackStatusDto, @Req() req: any) {
    return this.feedbackService.updateStatus(id, status, req.user?.id);
  }
}
