import { IsEmail, IsNotEmpty, IsString, MinLength, IsOptional, IsEnum } from 'class-validator';
import { user_role } from '@prisma/client';
import { PasswordMaxLength } from '../../../common/validation/dto-helpers';

export class LoginDto {
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(8)
  @PasswordMaxLength()
  password: string;
}

export class RegisterDto {
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(8, { message: 'Password must be at least 8 characters long' })
  @PasswordMaxLength()
  password: string;

  @IsString()
  @IsNotEmpty()
  name: string;

  @IsEnum(user_role)
  @IsOptional()
  role?: user_role;
}
