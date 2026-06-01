import { describe, expect, it } from 'vitest';

import {
  buildDigestItemAddedResponse,
  buildDigestItemFromBody,
  buildDigestQueueResponse,
  buildDigestSentResponse,
} from './digestResponses.js';

describe('notification digest response helpers', () => {
  describe('buildDigestItemFromBody', () => {
    it('maps the required and optional string fields into a DigestItem', () => {
      const now = new Date('2026-06-01T12:00:00.000Z');

      expect(
        buildDigestItemFromBody(
          {
            type: 'ncr',
            title: 'NCR raised',
            message: 'Review NCR-1',
            projectName: 'Project Alpha',
            linkUrl: '/projects/1/ncrs/1',
          },
          now,
        ),
      ).toEqual({
        type: 'ncr',
        title: 'NCR raised',
        message: 'Review NCR-1',
        projectName: 'Project Alpha',
        linkUrl: '/projects/1/ncrs/1',
        timestamp: now,
      });
    });

    it('drops non-string optional projectName and linkUrl values', () => {
      const item = buildDigestItemFromBody(
        {
          type: 'ncr',
          title: 'NCR raised',
          message: 'Review NCR-1',
          projectName: null,
          linkUrl: 42,
        },
        new Date('2026-06-01T12:00:00.000Z'),
      );

      expect(item.projectName).toBeUndefined();
      expect(item.linkUrl).toBeUndefined();
    });

    it('throws the existing bad-request message when required fields are missing or empty', () => {
      expect(() =>
        buildDigestItemFromBody({
          type: 'ncr',
          title: '',
          message: 'Review NCR-1',
        }),
      ).toThrow('type, title, and message are required');
    });
  });

  it('builds the item-added response shape', () => {
    expect(buildDigestItemAddedResponse(3)).toEqual({
      success: true,
      message: 'Item added to digest',
      queuedItems: 3,
    });
  });

  it('builds the digest-sent response shape', () => {
    expect(
      buildDigestSentResponse({
        messageId: 'msg-123',
        sentTo: 'user@example.com',
        itemCount: 2,
      }),
    ).toEqual({
      success: true,
      message: 'Daily digest sent successfully',
      messageId: 'msg-123',
      sentTo: 'user@example.com',
      itemCount: 2,
    });
  });

  it('builds the digest queue response shape with count derived from the items', () => {
    const items = [
      {
        type: 'ncr',
        title: 'NCR raised',
        message: 'Review NCR-1',
        timestamp: new Date('2026-06-01T12:00:00.000Z'),
      },
    ];

    expect(buildDigestQueueResponse(items)).toEqual({ items, count: 1 });
  });
});
