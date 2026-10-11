import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EventPublisherModule } from '@activation-poc/kafka-toolkit';
import { ActivationsModule } from './activations/activations.module';
import { config } from './config';

@Module({
  imports: [
    // Conexión a PostgreSQL (la base activation_db la crea docker/init-databases.sql).
    TypeOrmModule.forRoot({
      type: 'postgres',
      url: config.databaseUrl,
      // Registra solas las entidades declaradas con TypeOrmModule.forFeature().
      autoLoadEntities: true,
      // Crea/actualiza las tablas a partir de las entidades. Cómodo para una POC;
      // en producción se usan migraciones.
      synchronize: true,
    }),

    // Cliente Kafka para publicar eventos (disponible en todo el servicio).
    EventPublisherModule.register({ clientId: config.kafkaClientId }),

    ActivationsModule,
  ],
})
export class AppModule {}
