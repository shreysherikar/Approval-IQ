import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';

export class RectifiedItemDto {
  @ApiProperty({ example: 'Main gate width >= 6.0 meters with minimum 5.0m vertical clearance' })
  @IsString()
  @IsNotEmpty()
  item!: string;

  @ApiProperty({ example: 'Widened security gate archway to 6.2 meters, overhead obstruction removed.' })
  @IsString()
  @IsNotEmpty()
  actionTaken!: string;

  @ApiProperty({ example: 'DOC-VERIFIED-GATE-01' })
  @IsOptional()
  @IsString()
  evidenceDocId?: string;

  @ApiProperty({ example: 'Photographic evidence attached with dimensional measurement tape overlay.' })
  @IsOptional()
  @IsString()
  notes?: string;
}

export class SubmitRectificationDto {
  @ApiProperty({ example: 'AUTH-FIRE' })
  @IsString()
  @IsNotEmpty()
  authorityCode!: string;

  @ApiProperty({ type: [RectifiedItemDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => RectifiedItemDto)
  itemsResolved!: RectifiedItemDto[];

  @ApiProperty({ example: 'I hereby confirm that all non-compliances flagged during the joint inspection have been rectified on site.' })
  @IsString()
  @IsNotEmpty()
  complianceDeclaration!: string;
}

export enum RectificationReviewStatus {
  SATISFACTORY = 'satisfactory',
  NEEDS_RECTIFICATION = 'needs_rectification',
}

export class ReviewRectificationDto {
  @ApiProperty({ example: 'AUTH-FIRE' })
  @IsString()
  @IsNotEmpty()
  authorityCode!: string;

  @ApiProperty({ enum: RectificationReviewStatus, example: RectificationReviewStatus.SATISFACTORY })
  @IsEnum(RectificationReviewStatus)
  status!: RectificationReviewStatus;

  @ApiProperty({ example: false })
  @IsBoolean()
  reInspectionRequired!: boolean;

  @ApiProperty({ example: 'Rectification photographic evidence verified and found compliant with fire access norms.' })
  @IsString()
  @IsNotEmpty()
  reviewNotes!: string;
}
