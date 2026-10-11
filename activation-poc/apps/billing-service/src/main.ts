import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { MicroserviceOptions } from '@nestjs/microservices';
import { kafkaConsumerOptions } from '@activation-poc/kafka-toolkit';
import { AppModule } from './app.module';
import { config } from './config';

async function bootstrap(): Promise<void> {
  // billing-service no expone HTTP: es un "microservicio" que solo escucha Kafka.
  const app = await NestFactory.createMicroservice<MicroserviceOptions>(
    AppModule,
    kafkaConsumerOptions({ clientId: config.kafkaClientId, groupId: config.kafkaGroupId }),
  );

  // Permite cerrar las conexiones con Kafka y la base al apagar el servicio (Ctrl+C).
  app.enableShutdownHooks();

  await app.listen();
  Logger.log(`billing-service escuchando Kafka (group ${config.kafkaGroupId})`, 'Bootstrap');
}

void bootstrap();
