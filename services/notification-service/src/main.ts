import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { Transport, MicroserviceOptions } from '@nestjs/microservices';
import { ValidationPipe, Logger } from '@nestjs/common';

async function bootstrap() {
  const logger = new Logger('Bootstrap');

  const app = await NestFactory.create(AppModule);

  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }),
  );

  // RabbitMQ microservice
  app.connectMicroservice<MicroserviceOptions>({
    transport: Transport.RMQ,
    options: {
      urls: [process.env.RABBITMQ_URL ?? 'amqp://guest:guest@localhost:5672'],
      queue: process.env.RABBITMQ_QUEUE ?? 'notifications',
      queueOptions: {
        durable: true,   // queue survives broker restart
      },
      noAck: false,      // manual acknowledgement
      prefetchCount: 10, // process up to 10 messages concurrently
    },
  });

  await app.startAllMicroservices();

  const port = process.env.PORT ?? 3004;
  await app.listen(port);
 
  logger.log(`Notification service running on port ${port}`);
  logger.log(`Consuming from queue: ${process.env.RABBITMQ_QUEUE ?? 'notifications'}`);
}
bootstrap();
