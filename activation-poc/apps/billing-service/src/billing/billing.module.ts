import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BillingAccount } from './billing-account.entity';
import { BillingController } from './billing.controller';
import { BillingService } from './billing.service';

@Module({
  imports: [TypeOrmModule.forFeature([BillingAccount])],
  controllers: [BillingController],
  providers: [BillingService],
})
export class BillingModule {}
