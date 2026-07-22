import { LangChainInstrumentation } from '@arizeai/openinference-instrumentation-langchain';
import * as CallbackManagerModule from '@langchain/core/callbacks/manager';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-proto';
import { resourceFromAttributes } from '@opentelemetry/resources';
import { BatchSpanProcessor, NodeTracerProvider } from '@opentelemetry/sdk-trace-node';

import type { LangfuseTracingConfig } from '../env/observability-config.js';

let initialized = false;

export function initLangfuseTracing(config: LangfuseTracingConfig | undefined): void {
  if (!config || initialized) {
    return;
  }

  initialized = true;

  const authHeader = `Basic ${Buffer.from(`${config.publicKey}:${config.secretKey}`).toString('base64')}`;
  const exporter = new OTLPTraceExporter({
    url: `${config.baseUrl}/api/public/otel/v1/traces`,
    headers: { Authorization: authHeader },
  });
  const provider = new NodeTracerProvider({
    resource: resourceFromAttributes({ 'service.name': 'sales-agent-harness' }),
    spanProcessors: [new BatchSpanProcessor(exporter)],
  });
  provider.register();

  new LangChainInstrumentation().manuallyInstrument(CallbackManagerModule);
}
