import { PactV4 } from '@pact-foundation/pact';
import { config } from '../config';
import {
  GATEWAY_PACT,
  SERVICES,
  pactConsumerName,
  type ServiceId,
} from '../catalog/contracts';

function logLevel(): 'info' | 'debug' | 'warn' | 'error' {
  return (
    (process.env.PACT_LOG_LEVEL as 'info' | 'debug' | 'warn' | 'error') || 'warn'
  );
}

export function createPact(consumer: string, provider: string): PactV4 {
  return new PactV4({
    consumer,
    provider,
    dir: config.pactsDir,
    logLevel: logLevel(),
  });
}

/** MDM (consumer) → CLM (provider) for CT-00 */
export function createClmPact(): PactV4 {
  return createPact(config.clmMdm.consumer, config.clmMdm.provider);
}

/** Downstream consumer → MDM (provider) for CT-01…CT-04 */
export function createMdmPact(consumerName: string): PactV4 {
  return createPact(consumerName, config.mdm.provider);
}

export function createServicePairPact(
  consumerService: ServiceId,
  producerService: ServiceId
): PactV4 {
  return createPact(
    pactConsumerName(consumerService),
    SERVICES[producerService].pactProvider
  );
}

export function createGatewayPact(): PactV4 {
  return createPact(GATEWAY_PACT.consumer, GATEWAY_PACT.provider);
}
