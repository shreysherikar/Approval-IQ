import { IsEmail, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class LoginDto {
  @ApiProperty({ example: 'applicant@example.com' })
  @IsEmail()
  email!: string;

  @ApiProperty({ example: 's3cret-p@ssw0rd' })
  @IsString()
  password!: string;
}
