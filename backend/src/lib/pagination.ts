import { z } from 'zod'

/**
 * Zod schema for pagination query parameters
 */
export const paginationSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  sortBy: z.string().optional(),
  sortOrder: z.enum(['asc', 'desc']).default('desc')
})

export type PaginationParams = z.infer<typeof paginationSchema>

/**
 * Generate pagination metadata for response
 */
export function getPaginationMeta(total: number, page: number, limit: number) {
  return {
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
    hasNextPage: page * limit < total,
    hasPrevPage: page > 1
  }
}

/**
 * Convert page/limit to Prisma skip/take
 */
export function getPrismaSkipTake(page: number, limit: number) {
  return {
    skip: (page - 1) * limit,
    take: limit
  }
}

/**
 * Parse pagination from request query with defaults
 */
export function parsePagination(query: unknown): PaginationParams {
  const result = paginationSchema.safeParse(query)
  if (!result.success) {
    return { page: 1, limit: 20, sortOrder: 'desc' }
  }
  return result.data
}
