import { IsEmail, IsEnum, IsString, IsUUID, IsOptional, IsNumber } from 'class-validator';
import { NotificationEventType } from '../../entities/notification.enum';

export class BaseEventDto {
  @IsEnum(NotificationEventType)
  eventType: NotificationEventType;
}

export class ApplicationEventDto extends BaseEventDto {
  @IsUUID()
  applicationId: string;

  @IsUUID()
  jobId: string;

  @IsString()
  jobTitle: string;

  @IsEmail()
  candidateEmail: string;

  @IsString()
  candidateName: string;

  @IsEmail()
  @IsOptional()
  employerEmail?: string;

  @IsString()
  @IsOptional()
  employerCompany?: string;
}

export class JobEventDto extends BaseEventDto {
  @IsUUID()
  jobId: string;

  @IsString()
  jobTitle: string;

  @IsEmail()
  employerEmail: string;

  @IsString()
  @IsOptional()
  employerName?: string;

  @IsNumber()
  @IsOptional()
  amount?: number;

  @IsString()
  @IsOptional()
  failureReason?: string;
}