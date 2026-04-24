import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Notification } from '../entities/notification.entity';
import { ApplicationEventDto, JobEventDto } from './dto/event.dto';
import { EmailService } from '../email/email.service';
import { NotificationEventType, NotificationStatus } from '../entities/notification.enum';
import * as templates from './notification.template';
import { validate } from 'class-validator';
import { ClassConstructor, plainToInstance } from 'class-transformer';

type EventDto = ApplicationEventDto | JobEventDto;

@Injectable()
export class NotificationsService {
	private readonly logger = new Logger(NotificationsService.name);
	constructor(
		@InjectRepository(Notification)
		private readonly notificationsRepository: Repository<Notification>,
	    private readonly emailService: EmailService,

	) {}

	// ─── Public entry point called by the RabbitMQ consumer ──────────────────
	
	async handleEvent(raw: Record<string, unknown>): Promise<void> {
		const eventType = raw.eventType as NotificationEventType;
	
		if (!eventType) {
		this.logger.warn('Received event with no eventType — discarding');
		return;
		}
	
		const { dto, errors } = await this.parseAndValidate(eventType, raw);
	
		if (errors.length) {
		this.logger.error(`Invalid payload for ${eventType}: ${errors.join(', ')}`);
		return;
		}
	
		await this.dispatch(eventType, dto!, raw);
	}
	
	// Route event type → template → send
	
	private async dispatch(
		eventType: NotificationEventType,
		dto: EventDto,
		raw: Record<string, unknown>,
	): Promise<void> {
		const jobs: Array<{ to: string; subject: string; html: string }> = [];
	
		switch (eventType) {
		case NotificationEventType.APPLICATION_SUBMITTED: {
			const d = dto as ApplicationEventDto;
			jobs.push({ to: d.candidateEmail, ...templates.applicationSubmittedTemplate(d) });
			if (d.employerEmail) {
			jobs.push({ to: d.employerEmail, ...templates.newApplicantTemplate(d) });
			}
			break;
		}
		case NotificationEventType.APPLICATION_SCREENED: {
			const d = dto as ApplicationEventDto;
			jobs.push({ to: d.candidateEmail, ...templates.applicationScreenedTemplate(d) });
			break;
		}
		case NotificationEventType.APPLICATION_INTERVIEW: {
			const d = dto as ApplicationEventDto;
			jobs.push({ to: d.candidateEmail, ...templates.applicationInterviewTemplate(d) });
			break;
		}
		case NotificationEventType.APPLICATION_HIRED: {
			const d = dto as ApplicationEventDto;
			jobs.push({ to: d.candidateEmail, ...templates.applicationHiredTemplate(d) });
			break;
		}
		case NotificationEventType.APPLICATION_REJECTED: {
			const d = dto as ApplicationEventDto;
			jobs.push({ to: d.candidateEmail, ...templates.applicationRejectedTemplate(d) });
			break;
		}
		case NotificationEventType.JOB_PUBLISHED: {
			const d = dto as JobEventDto;
			jobs.push({ to: d.employerEmail, ...templates.jobPublishedTemplate(d) });
			break;
		}
		case NotificationEventType.JOB_PAYMENT_FAILED: {
			const d = dto as JobEventDto;
			jobs.push({ to: d.employerEmail, ...templates.jobPaymentFailedTemplate(d) });
			break;
		}
		case NotificationEventType.NEW_APPLICANT: {
			const d = dto as ApplicationEventDto;
			if (d.employerEmail) {
			jobs.push({ to: d.employerEmail, ...templates.newApplicantTemplate(d) });
			}
			break;
		}
		default:
			this.logger.warn(`Unhandled event type: ${eventType}`);
		}
	
		// Send each email and persist the result
		await Promise.all(jobs.map((job) => this.sendAndPersist(eventType, job, raw)));
	}
	
	// ─── Send + persist in one shot ──────────────────────────────────────────
	
	private async sendAndPersist(
		eventType: NotificationEventType,
		job: { to: string; subject: string; html: string },
		raw: Record<string, unknown>,
	): Promise<void> {
		const record = this.notificationsRepository.create({
			eventType,
			recipientEmail: job.to,
			subject: job.subject,
			body: job.html,
			status: NotificationStatus.PENDING,
			payload: raw,
		});
	
		await this.notificationsRepository.save(record);
	
		try {
			await this.emailService.send({ to: job.to, subject: job.subject, html: job.html });
			await this.notificationsRepository.update(record.id, { status: NotificationStatus.SENT });
		} catch (err) {
		const message = err instanceof Error ? err.message : String(err);
		this.logger.error(`Failed to send email to ${job.to}: ${message}`);
		await this.notificationsRepository.update(record.id, {
			status: NotificationStatus.FAILED,
			errorMessage: message,
		});
		// Don't rethrow — a single failed email shouldn't NACK the whole message
		}
	}
	
	// Validate payload against the right DTO class
	
	private async parseAndValidate(
		eventType: NotificationEventType,
		raw: Record<string, unknown>,
	): Promise<{ dto: EventDto | null; errors: string[] }> {
		const isJobEvent = [
			NotificationEventType.JOB_PUBLISHED,
			NotificationEventType.JOB_PAYMENT_FAILED,
		].includes(eventType);
	
		const DtoClass: ClassConstructor<EventDto> = isJobEvent
			? JobEventDto
			: ApplicationEventDto;
		const dto = plainToInstance(DtoClass, raw);
		const violations = await validate(dto, { whitelist: true });
	
		if (violations.length) {
		const errors = violations.flatMap((v) => Object.values(v.constraints ?? {}));
		return { dto: null, errors };
		}
	
		return { dto, errors: [] };
	}

}
