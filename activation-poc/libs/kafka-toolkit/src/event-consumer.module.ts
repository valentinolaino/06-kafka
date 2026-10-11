import { DynamicModule, Global, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EVENT_CONSUMER_OPTIONS, EventConsumer, EventConsumerOptions } from './event-consumer';
import { ProcessedEvent } from './processed-event.entity';

/**
 * Cada servicio que CONSUME eventos lo importa una vez en su AppModule, después de
 * TypeOrmModule.forRoot(...) y EventPublisherModule.register(...):
 *
 *   EventConsumerModule.register({ groupId: config.kafkaGroupId })
 *
 * Registra la tabla processed_events en la base del servicio y expone EventConsumer.
 */
@Global()
@Module({})
export class EventConsumerModule {
  static register(options: EventConsumerOptions): DynamicModule {
    return {
      module: EventConsumerModule,
      imports: [TypeOrmModule.forFeature([ProcessedEvent])],
      providers: [{ provide: EVENT_CONSUMER_OPTIONS, useValue: options }, EventConsumer],
      exports: [EventConsumer],
    };
  }
}
