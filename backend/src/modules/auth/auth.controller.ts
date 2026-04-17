import { Controller, Post, Body } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { AuthService } from './auth.service';
import { LoginDto, RegisterDto } from './dto/auth.dto';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  @Throttle({ default: { limit: 5, ttl: 60000 } }) // Stricter limit for login
  login(@Body() body: LoginDto) {
    return this.authService.login(body.email, body.password);
  }

  @Post('register')
  @Throttle({ default: { limit: 3, ttl: 60000 } }) // Even stricter for registration
  register(@Body() body: RegisterDto) {
    // Explicitly force 'VIEWER' role for public registration to prevent privilege escalation
    return this.authService.register(body.email, body.password, body.name, 'VIEWER');
  }
}
