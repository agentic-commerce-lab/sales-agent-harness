import { expect, test } from 'bun:test';

import { createOpenApiDocument } from '../../src/app/openapi-document.js';

test('OpenAPI doc describes /commerce/a2a with all capabilities', () => {
  const doc = createOpenApiDocument('https://harness.example.test');

  expect(doc).toMatchObject({
    openapi: '3.1.0',
    servers: [{ url: 'https://harness.example.test' }],
    paths: { '/commerce/a2a': { post: {} } },
  });

  const json = JSON.stringify(doc);
  for (const capability of [
    'searchProducts',
    'getProductDetails',
    'createCart',
    'updateCart',
    'getCartSummary',
    'prepareCheckoutHandoff',
    'completeCheckout',
  ]) {
    expect(json).toContain(capability);
  }
});
