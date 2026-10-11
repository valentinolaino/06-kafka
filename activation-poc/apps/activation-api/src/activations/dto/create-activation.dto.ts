import { IsIn, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';
import { SimulateFailure } from '@activation-poc/contracts';

const SIMULATE_FAILURE_VALUES: SimulateFailure[] = ['none', 'billing', 'provisioning'];

/**
 * Body de POST /activations (RF-01): cliente, plan y un modo de fallo opcional.
 * Los decoradores de class-validator declaran las reglas; el ValidationPipe global
 * las aplica y responde 400 si el body no las cumple.
 */
export class CreateActivationDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(60)
  customerId: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(60)
  planId: string;

  /** Solo para la demo: le pide a billing o provisioning que fallen. Por defecto, "none". */
  @IsOptional()
  @IsIn(SIMULATE_FAILURE_VALUES)
  simulateFailure?: SimulateFailure;
}
