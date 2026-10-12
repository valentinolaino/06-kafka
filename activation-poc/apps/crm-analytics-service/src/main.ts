import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { MicroserviceOptions } from '@nestjs/microservices';
import { kafkaConsumerOptions } from '@activation-poc/kafka-toolkit';
import { AppModule } from './app.module';
import { config } from './config';

async function bootstrap(): Promise<void> {
  // crm-analytics no expone HTTP: es un microservicio que solo escucha Kafka.
  const app = await NestFactory.createMicroservice<MicroserviceOptions>(
    AppModule,
    kafkaConsumerOptions({ clientId: config.kafkaClientId, groupId: config.kafkaGroupId }),
  );

  app.enableShutdownHooks();

  await app.listen();
  Logger.log(`crm-analytics-service escuchando Kafka (group ${config.kafkaGroupId})`, 'Bootstrap');
}

void bootstrap();
