import { Body, Controller, Post, Req } from '@nestjs/common';
import type { Request } from 'express';
import { FeedbackService } from './feedback.service';
import { CreateFeedbackDto } from './dto/feedback.dto';
import { FeedbackRateLimited } from '../../common/throttle/throttle.config';

/**
 * Public feedback form. No @CacheControl: a POST always gets `no-store`.
 * Throttled by both `public` and the strict `feedback` limiter (per req.ip,
 * the same client IP the throttler and logs use).
 */
@Controller('feedback')
@FeedbackRateLimited()
export class FeedbackController {
  constructor(private readonly feedbackService: FeedbackService) {}

  @Post()
  create(@Body() body: CreateFeedbackDto, @Req() req: Request) {
    const ua = req.headers['user-agent'];
    return this.feedbackService.submit(body, { ip: req.ip, userAgent: typeof ua === 'string' ? ua : undefined });
  }
}
