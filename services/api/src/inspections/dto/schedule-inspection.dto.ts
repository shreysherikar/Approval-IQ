import { IsArray, IsDateString, IsEnum, IsOptional, IsString } from 'class-validator';

export enum JointInspectionStageEnum {
  PRE_CONSTRUCTION = 'pre_construction',
  PLANT_READINESS = 'plant_readiness',
  PRE_COMMISSIONING = 'pre_commissioning',
  ANNUAL_COMPLIANCE = 'annual_compliance',
}

export class ScheduleInspectionDto {
  @IsDateString()
  scheduledDate!: string;

  @IsString()
  timeSlot!: string;

  @IsOptional()
  @IsString()
  premisesAddress?: string;

  @IsOptional()
  @IsString()
  leadAuthorityCode?: string;

  @IsOptional()
  @IsString()
  leadAuthorityName?: string;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsArray()
  readinessChecklist?: Array<{
    id: string;
    title: string;
    description: string;
    completed: boolean;
  }>;
}

export class CreateJointInspectionDto {
  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsEnum(JointInspectionStageEnum)
  stage?: JointInspectionStageEnum;

  @IsOptional()
  @IsString()
  premisesAddress?: string;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsArray()
  approvalCodes?: string[];
}
