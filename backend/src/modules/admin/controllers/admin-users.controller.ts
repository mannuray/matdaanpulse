import { Controller, Get, Post, Patch, Delete, Body, Param, UseGuards, UseInterceptors, HttpCode } from '@nestjs/common';
import { UserService } from '../user.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { MapToDtoInterceptor } from '../../common/interceptors/map-to-dto.interceptor';
import { AdminUserDto } from '../dto/admin-response.dto';
import { CreateUserDto, UpdateUserDto } from '../dto/user.dto';

@Controller('admin')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AdminUsersController {
  constructor(private readonly userService: UserService) {}

  @Get('users')
  @Roles('SUPER_ADMIN')
  @UseInterceptors(new MapToDtoInterceptor(AdminUserDto))
  getUsers() {
    return this.userService.getAll();
  }

  @Post('users')
  @Roles('SUPER_ADMIN')
  @UseInterceptors(new MapToDtoInterceptor(AdminUserDto))
  createUser(@Body() body: CreateUserDto) {
    return this.userService.create(body);
  }

  @Patch('users/:id')
  @Roles('SUPER_ADMIN')
  @UseInterceptors(new MapToDtoInterceptor(AdminUserDto))
  updateUser(@Param('id') id: string, @Body() body: UpdateUserDto) {
    return this.userService.update(id, body);
  }

  @Delete('users/:id')
  @Roles('SUPER_ADMIN')
  @HttpCode(204)
  async deleteUser(@Param('id') id: string) {
    await this.userService.delete(id);
  }
}
