import { IsEmail, IsNotEmpty, IsString, MinLength, IsEnum, IsOptional } from 'class-validator';
import { user_role } from '@prisma/client';
import { PasswordMaxLength } from '../../../common/validation/dto-helpers';

export class CreateUserDto {
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(8)
  @PasswordMaxLength()
  password: string;

  @IsString()
  @IsNotEmpty()
  name: string;

  @IsEnum(user_role)
  @IsNotEmpty()
  role: user_role;
}

export class UpdateUserDto {
  @IsEmail()
  @IsOptional()
  email?: string;

  @IsString()
  @IsOptional()
  @MinLength(8)
  @PasswordMaxLength()
  password?: string;

  @IsString()
  @IsOptional()
  name?: string;

  @IsEnum(user_role)
  @IsOptional()
  role?: user_role;
}
