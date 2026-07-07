import { expect, test } from 'bun:test';
import { checkoutResumeHtml } from '../../src/app/checkout-resume-page.js';

const config = {
  shopwareBaseUrl: 'https://shop.example.test',
  shopwareAccessKey: 'store-api-access-key',
};

test('checkoutResumeHtml embeds the token and config as inline script values', () => {
  const html = checkoutResumeHtml('context-token-1', config);

  expect(html).toContain('const TOKEN = "context-token-1"');
  expect(html).toContain('const BASE = "https://shop.example.test"');
  expect(html).toContain('const KEY  = "store-api-access-key"');
});

test('checkoutResumeHtml escapes script-breaking characters in the token', () => {
  const html = checkoutResumeHtml('</script><script>alert(1)</script>', config);

  expect(html).not.toContain('</script><script>alert(1)');
  expect(html).toContain('\\u003c/script>\\u003cscript>alert(1)\\u003c/script>');
});

test('checkoutResumeHtml escapes script-breaking characters in the config values', () => {
  const html = checkoutResumeHtml('context-token-1', {
    shopwareBaseUrl: 'https://shop.example.test/</script>',
    shopwareAccessKey: '</script>key',
  });

  expect(html).not.toContain('</script>key');
  expect(html).not.toContain('https://shop.example.test/</script>');
});
