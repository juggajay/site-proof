// POST /api/copilot/chat — Jack, the company-level chat copilot. Company-level
// (not project-scoped) so he works on the dashboard before any project exists;
// a projectId is optional and, when given, gates on internal project access
// (404 on no-access, matching the copilot reads). Rate-limited per user.

import { Router } from 'express';
import { z } from 'zod';

import { AppError } from '../../lib/AppError.js';
import { asyncHandler } from '../../lib/asyncHandler.js';
import { requireAuth } from '../../middleware/authMiddleware.js';
import { chatRateLimiter } from '../../middleware/rateLimiter.js';
import { isAnthropicConfigured } from '../testResults/certificateExtraction.js';
import { buildChatContext } from './chat/context.js';
import { runChatModelLoop } from './chat/loop.js';
import { JACK_SYSTEM_PROMPT } from './chat/prompt.js';
import { hasInternalProjectAccess } from './chat/projectStatus.js';
import { CHAT_TOOLS, createChatToolExecutor } from './chat/tools.js';

const chatBodySchema = z.object({
  projectId: z.string().trim().min(1).max(120).optional(),
  messages: z
    .array(
      z.object({
        role: z.enum(['user', 'assistant']),
        content: z.string().min(1).max(2000),
      }),
    )
    .min(1)
    .max(20)
    .refine((messages) => messages[messages.length - 1]?.role === 'user', {
      message: 'The last message must be from the user.',
    }),
});

const chatRouter = Router();

// Jack is for the office roles — owner, admin, project manager (owner
// decision 2026-07-16): field roles get the mobile shells, not the chat
// copilot. Mirrors JACK_ROLES in the frontend JackWidget — this is the
// server-side enforcement of that gate.
const JACK_CHAT_ROLES = new Set(['owner', 'admin', 'project_manager']);

// Route-wide auth: satisfies routeAuthCoverage and gives chatRateLimiter a
// req.user to key on.
chatRouter.use(requireAuth);

chatRouter.post(
  '/chat',
  chatRateLimiter,
  asyncHandler(async (req, res) => {
    const parsed = chatBodySchema.safeParse(req.body);
    if (!parsed.success) {
      throw AppError.fromZodError(parsed.error);
    }
    const { projectId, messages } = parsed.data;
    const user = req.user!;

    if (!JACK_CHAT_ROLES.has(user.roleInCompany || '')) {
      throw AppError.forbidden('The AI assistant is available to owner and admin accounts.');
    }

    if (!isAnthropicConfigured()) {
      throw new AppError(503, 'The AI assistant is not available right now.', 'AI_UNAVAILABLE');
    }

    if (projectId && !(await hasInternalProjectAccess(user, projectId))) {
      // 404 (not 403) so we don't leak the existence of projects the user
      // can't see.
      throw AppError.notFound('Project');
    }

    const contextText = await buildChatContext(user, projectId);
    const system = `${JACK_SYSTEM_PROMPT}\n\n<current_state>\n${contextText}\n</current_state>`;
    const model = process.env.ANTHROPIC_MODEL || 'claude-3-5-haiku-20241022';

    const { message, actions } = await runChatModelLoop({
      model,
      system,
      messages,
      tools: CHAT_TOOLS,
      executeTool: createChatToolExecutor(user),
    });

    res.json({ message, actions });
  }),
);

export { chatRouter };
