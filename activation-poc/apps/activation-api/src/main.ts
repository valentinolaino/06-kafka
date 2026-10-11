import { Logger, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { MicroserviceOptions } from '@nestjs/microservices';
import { kafkaConsumerOptions } from '@activation-poc/kafka-toolkit';
import { AppModule } from './app.module';
import { config } from './config';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);

  // Permite que Nest cierre la conexión con Kafka al apagar el servicio (Ctrl+C).
  app.enableShutdownHooks();

  // Valida automáticamente el body de cada request contra el DTO correspondiente.
  //  - whitelist: descarta los campos que el DTO no declara.
  //  - transform: convierte el JSON recibido en una instancia real del DTO.
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));

  // activation-api es una app "híbrida": atiende HTTP (POST/GET /activations) y, a la vez,
  // escucha Kafka (los resultados de billing y provisioning).
  app.connectMicroservice<MicroserviceOptions>(
    kafkaConsumerOptions({ clientId: config.kafkaClientId, groupId: config.kafkaGroupId }),
  );
  await app.startAllMicroservices();

  await app.listen(config.port);
  Logger.log(`activation-api escuchando en http://localhost:${config.port}`, 'Bootstrap');
  Logger.log(`activation-api escuchando Kafka (group ${config.kafkaGroupId})`, 'Bootstrap');
}

void bootstrap();
