import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { NotificationsModule } from './notifications/notifications.module';
import { config } from './config';

@Module({
  imports: [
    // Base propia de notification (notification_db la crea docker/init-databases.sql).
    TypeOrmModule.forRoot({
      type: 'postgres',
      url: config.databaseUrl,
      autoLoadEntities: true,
      synchronize: true,
    }),

    // A diferencia de billing y provisioning, este servicio no publica eventos:
    // solo consume activation.events y manda emails. Por eso no registra EventPublisherModule.
    NotificationsModule,
  ],
})
export class AppModule {}
