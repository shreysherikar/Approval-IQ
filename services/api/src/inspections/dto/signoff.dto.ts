import { IsArray, IsEnum, IsOptional, IsString } from 'class-validator';

export enum InspectorSignoffStatusEnum {
  PENDING = 'pending',
  SATISFACTORY = 'satisfactory',
  NEEDS_RECTIFICATION = 'needs_rectification',
  REJECTED = 'rejected',
}

export class ChecklistItemDto {
  @IsString()
  item!: string;

  @IsEnum(['pass', 'fail', 'na', 'pending'])
  status!: 'pass' | 'fail' | 'na' | 'pending';

  @IsOptional()
  @IsString()
  remarks?: string;
}

export class SignoffChecklistDto {
  @IsOptional()
  @IsString()
  inspectorName?: string;

  @IsOptional()
  @IsString()
  inspectorDesignation?: string;

  @IsEnum(InspectorSignoffStatusEnum)
  status!: InspectorSignoffStatusEnum;

  @IsArray()
  items!: ChecklistItemDto[];

  @IsOptional()
  @IsString()
  findingsNotes?: string;
}

export class CompleteInspectionDto {
  @IsString()
  jointReportSummary!: string;
}
