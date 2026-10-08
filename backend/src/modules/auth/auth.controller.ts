import { Controller, Post, Body, NotFoundException, HttpCode, Req, UseGuards } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AuthService } from './auth.service';
import { LoginDto, RegisterDto } from './dto/auth.dto';
import { AuthRateLimited } from '../../common/throttle/throttle.config';
import { JwtAuthGuard } from './guards/jwt-auth.guard';

/** Every route here counts against the strict `auth` throttler (THROTTLE_AUTH_PER_MIN, default 5/min per IP). */
@Controller('auth')
@AuthRateLimited()
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly config: ConfigService,
  ) {}

  @Post('login')
  @HttpCode(200)
  login(@Body() body: LoginDto) {
    return this.authService.login(body.email, body.password);
  }

  /** Revokes every session token of the caller (all devices); the admin also clears its local copy. */
  @Post('logout')
  @UseGuards(JwtAuthGuard)
  @HttpCode(204)
  async logout(@Req() req: { user: { id: string } }) {
    await this.authService.logout(req.user.id);
  }

  /**
   * Public self-registration is off unless ALLOW_REGISTRATION=true (review S-M1):
   * VIEWER accounts have no product use. Admins create users via /admin/users.
   */
  @Post('register')
  register(@Body() body: RegisterDto) {
    if (this.config.get<string>('ALLOW_REGISTRATION') !== 'true') {
      throw new NotFoundException();
    }
    // Explicitly force 'VIEWER' role for public registration to prevent privilege escalation
    return this.authService.register(body.email, body.password, body.name, 'VIEWER');
  }
}
