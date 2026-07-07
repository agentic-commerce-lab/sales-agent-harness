# Security Policy

## Reporting a Vulnerability

Please do not report security vulnerabilities through public GitHub issues.

Report them to the Shopware security team instead:

- Email: security@shopware.com
- Details on responsible disclosure: https://www.shopware.com/en/security/

We will acknowledge your report, keep you informed of progress, and credit you
in the fix release unless you prefer to remain anonymous.

## Scope

This project is an experimental, demo-oriented MVP. It intentionally ships
without production authentication, rate limiting, or tenant isolation — see
"Known Non-Prod MVP Limits" in the README. Reports about those documented
limitations are out of scope; everything else (secret leakage, injection,
XSS, policy-check bypasses, checkout abuse) is very much in scope.
