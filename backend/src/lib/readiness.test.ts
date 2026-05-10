import express from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createReadinessHandler } from './readiness.js';
import { prisma } from './prisma.js';

vi.mock('./prisma.js', () => ({
  prisma: {
    $queryRaw: vi.fn(),
  },
}));

const queryRawMock = vi.mocked(prisma.$queryRaw);

function createApp(isShuttingDown = false) {
  const app = express();
  app.get(
    '/ready',
    createReadinessHandler(() => isShuttingDown),
  );
  return app;
}

describe('readiness', () => {
  beforeEach(() => {
    queryRawMock.mockReset();
    queryRawMock.mockResolvedValue([{ '?column?': 1 }] as never);
  });

  it('returns ready after the database responds', async () => {
    const res = await request(createApp()).get('/ready');

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: 'ready' });
    expect(queryRawMock).toHaveBeenCalledTimes(1);
  });

  it('returns unavailable without touching the database during shutdown', async () => {
    const res = await request(createApp(true)).get('/ready');

    expect(res.status).toBe(503);
    expect(res.body).toEqual({
      status: 'shutting_down',
      message: 'Server is shutting down',
    });
    expect(queryRawMock).not.toHaveBeenCalled();
  });

  it('returns a generic unavailable response when the database fails', async () => {
    queryRawMock.mockRejectedValueOnce(new Error('connection refused') as never);

    const res = await request(createApp()).get('/ready');

    expect(res.status).toBe(503);
    expect(res.body).toEqual({
      status: 'unready',
      message: 'Database unavailable',
    });
  });
});
