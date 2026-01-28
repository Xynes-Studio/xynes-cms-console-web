import { describe, it, expect } from 'vitest';
import { GET } from './route';

describe('Security Headers API Route', () => {
  it('should return a successful response', async () => {
    const request = new Request('http://localhost:3000/api/security-headers', {
      method: 'GET',
    });

    const response = await GET(request);

    expect(response.status).toBe(200);

    // Note: Security headers defined in next.config.ts are applied at the Next.js build/deployment level,
    // not when the route function is called directly in tests. These headers will be present when
    // the application is running in a real environment.
    // Note: X-XSS-Protection header was removed as it's deprecated and superseded by CSP.
  });
});