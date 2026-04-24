import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { NotificationsService } from './notifications.service';
import { Notification } from '../entities/notification.entity';
import { NotificationsController } from './notifications.controller';
import { EmailModule } from '../email/email.module';

@Module({
  imports: [TypeOrmModule.forFeature([Notification]), EmailModule],
  providers: [NotificationsService],
  exports: [NotificationsService],
  controllers: [NotificationsController],
})
export class NotificationsModule {}
