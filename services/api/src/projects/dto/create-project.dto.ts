import { IsIn, IsString, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

/**
 * Minimal Phase-3 project creation. Full business/premises/membership
 * modeling (blueprint Section 4) arrives in Phase 4+.
 */
export class CreateProjectDto {
  @ApiProperty({ example: 'Pune brewery expansion' })
  @IsString()
  @MinLength(1)
  name!: string;

  @ApiProperty({ example: 'brewery' })
  @IsIn(['brewery'])
  industry!: string;

  @ApiProperty({ example: 'biz_123' })
  @IsString()
  @MinLength(1)
  businessId!: string;
}
