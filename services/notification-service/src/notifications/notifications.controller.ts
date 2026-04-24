import { Controller, Logger } from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { Ctx, EventPattern, Payload, RmqContext } from '@nestjs/microservices';

@Controller('notifications')
export class NotificationsController {
  private readonly logger = new Logger(NotificationsController.name);
 
  constructor(private readonly service: NotificationsService) {}
 
  /**
   * Single handler for all notification events.
   * The queue is bound with a wildcard routing key so every event published
   * by other services lands here. The service layer resolves the eventType.
   */
  @EventPattern('notifications')
  async handle(
    @Payload() data: Record<string, unknown>,
    @Ctx() ctx: RmqContext,
  ): Promise<void> {
    const channel = ctx.getChannelRef();
    const message = ctx.getMessage();
 
    this.logger.log(`Received event: ${data?.eventType}`);
 
    try {
      await this.service.handleEvent(data);
      channel.ack(message); // manual ack on success
    } catch (err) {
      this.logger.error('Unhandled error processing event — NACKing without requeue', err);
      channel.nack(message, false, false); // dead-letter after poison pill
    }
  }
}
