import { Controller, Post, Body, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AuthService } from './auth.service';
import { LoginDto, RegisterDto } from './dto/auth.dto';
import { AuthRateLimited } from '../../common/throttle/throttle.config';

/** Every route here counts against the strict `auth` throttler (THROTTLE_AUTH_PER_MIN, default 5/min per IP). */
@Controller('auth')
@AuthRateLimited()
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly config: ConfigService,
  ) {}

  @Post('login')
  login(@Body() body: LoginDto) {
    return this.authService.login(body.email, body.password);
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
