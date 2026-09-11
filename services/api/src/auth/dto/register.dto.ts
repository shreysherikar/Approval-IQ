import { IsIn, IsEmail, IsString, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import type { UserRole } from '../../common/decorators/roles.decorator';
import { USER_ROLES } from '../../common/decorators/roles.decorator';

export class RegisterDto {
  @ApiProperty({ example: 'applicant@example.com' })
  @IsEmail()
  email!: string;

  @ApiProperty({ example: 's3cret-p@ssw0rd', minLength: 8 })
  @IsString()
  @MinLength(8)
  password!: string;

  @ApiProperty({ enum: ['applicant', 'officer', 'admin'], example: 'applicant' })
  @IsIn(USER_ROLES)
  role!: UserRole;
}
