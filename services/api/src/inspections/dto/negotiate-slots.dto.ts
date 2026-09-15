import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';

export class SlotOptionDto {
  @ApiProperty({ example: 'slot-1' })
  @IsString()
  @IsNotEmpty()
  slotId!: string;

  @ApiProperty({ example: '2026-10-15' })
  @IsString()
  @IsNotEmpty()
  date!: string;

  @ApiProperty({ example: '10:00 AM - 01:00 PM (Morning Slot)' })
  @IsString()
  @IsNotEmpty()
  timeWindow!: string;

  @ApiProperty({ example: 'Preferred Option A (Primary)' })
  @IsOptional()
  @IsString()
  label?: string;
}

export class ProposeSlotsDto {
  @ApiProperty({ type: [SlotOptionDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SlotOptionDto)
  slots!: SlotOptionDto[];

  @ApiProperty({ example: 'Site team and electrical engineers available on both slots.' })
  @IsOptional()
  @IsString()
  applicantNotes?: string;
}

export enum SlotResponseStatus {
  CONFIRMED = 'confirmed',
  UNAVAILABLE = 'unavailable',
  ALTERNATE_PROPOSED = 'alternate_proposed',
}

export class RespondSlotDto {
  @ApiProperty({ example: 'AUTH-MPCB' })
  @IsString()
  @IsNotEmpty()
  authorityCode!: string;

  @ApiProperty({ example: 'slot-1' })
  @IsString()
  @IsNotEmpty()
  slotId!: string;

  @ApiProperty({ enum: SlotResponseStatus, example: SlotResponseStatus.CONFIRMED })
  @IsEnum(SlotResponseStatus)
  status!: SlotResponseStatus;

  @ApiProperty({ example: '2026-10-18' })
  @IsOptional()
  @IsString()
  alternateDate?: string;

  @ApiProperty({ example: 'Field inspector S. K. Deshmukh assigned for Slot A.' })
  @IsOptional()
  @IsString()
  officerNotes?: string;
}
