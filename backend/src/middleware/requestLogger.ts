// Feature #751: Enhanced request logging with performance monitoring
import type { Request, Response, NextFunction } from 'express'

// Performance metrics storage (in-memory for development, use Redis/external for production)
interface PerformanceMetrics {
  totalRequests: number
  avgResponseTime: number
  p95ResponseTime: number
  p99ResponseTime: number
  slowRequests: number // > 500ms
  errorCount: number
  byEndpoint: Map<string, EndpointMetrics>
  responseTimes: number[] // Keep last 1000 for percentile calc
}

interface EndpointMetrics {
  path: string
  method: string
  count: number
  avgResponseTime: number
  minResponseTime: number
  maxResponseTime: number
  errorCount: number
  lastResponseTime: number
}

// Global metrics store
const metrics: PerformanceMetrics = {
  totalRequests: 0,
  avgResponseTime: 0,
  p95ResponseTime: 0,
  p99ResponseTime: 0,
  slowRequests: 0,
  errorCount: 0,
  byEndpoint: new Map(),
  responseTimes: [],
}

// Max response times to keep for percentile calculation
const MAX_RESPONSE_TIMES = 1000
const SLOW_THRESHOLD_MS = 500

// Calculate percentile
function calculatePercentile(sortedArr: number[], percentile: number): number {
  if (sortedArr.length === 0) return 0
  const index = Math.ceil(sortedArr.length * (percentile / 100)) - 1
  return sortedArr[Math.max(0, index)]
}

// Update percentiles
function updatePercentiles() {
  if (metrics.responseTimes.length === 0) return

  const sorted = [...metrics.responseTimes].sort((a, b) => a - b)
  metrics.p95ResponseTime = calculatePercentile(sorted, 95)
  metrics.p99ResponseTime = calculatePercentile(sorted, 99)
}

// Normalize path for grouping (replace IDs with :id)
function normalizePath(path: string): string {
  return path
    .replace(/\/[a-f0-9-]{36}/gi, '/:id') // UUID
    .replace(/\/\d+/g, '/:id') // Numeric IDs
}

export function requestLogger(req: Request, res: Response, next: NextFunction) {
  const startHrTime = process.hrtime()

  res.on('finish', () => {
    const [seconds, nanoseconds] = process.hrtime(startHrTime)
    const durationMs = seconds * 1000 + nanoseconds / 1000000
    const duration = Math.round(durationMs)

    // Update global metrics
    metrics.totalRequests++
    metrics.responseTimes.push(duration)

    // Keep array bounded
    if (metrics.responseTimes.length > MAX_RESPONSE_TIMES) {
      metrics.responseTimes.shift()
    }

    // Update running average
    metrics.avgResponseTime = Math.round(
      (metrics.avgResponseTime * (metrics.totalRequests - 1) + duration) / metrics.totalRequests
    )

    // Track slow requests
    if (duration > SLOW_THRESHOLD_MS) {
      metrics.slowRequests++
    }

    // Track errors
    if (res.statusCode >= 400) {
      metrics.errorCount++
    }

    // Update percentiles every 100 requests
    if (metrics.totalRequests % 100 === 0) {
      updatePercentiles()
    }

    // Update endpoint-specific metrics
    const normalizedPath = normalizePath(req.path)
    const endpointKey = `${req.method}:${normalizedPath}`
    let endpointMetrics = metrics.byEndpoint.get(endpointKey)

    if (!endpointMetrics) {
      endpointMetrics = {
        path: normalizedPath,
        method: req.method,
        count: 0,
        avgResponseTime: 0,
        minResponseTime: Infinity,
        maxResponseTime: 0,
        errorCount: 0,
        lastResponseTime: duration,
      }
      metrics.byEndpoint.set(endpointKey, endpointMetrics)
    }

    endpointMetrics.count++
    endpointMetrics.avgResponseTime = Math.round(
      (endpointMetrics.avgResponseTime * (endpointMetrics.count - 1) + duration) / endpointMetrics.count
    )
    endpointMetrics.minResponseTime = Math.min(endpointMetrics.minResponseTime, duration)
    endpointMetrics.maxResponseTime = Math.max(endpointMetrics.maxResponseTime, duration)
    endpointMetrics.lastResponseTime = duration

    if (res.statusCode >= 400) {
      endpointMetrics.errorCount++
    }

    // Console log with color coding for slow requests
    const logLevel = res.statusCode >= 400 ? 'error' : duration > SLOW_THRESHOLD_MS ? 'warn' : 'info'
    const color = res.statusCode >= 500 ? '\x1b[31m' // Red
      : res.statusCode >= 400 ? '\x1b[33m' // Yellow
      : duration > SLOW_THRESHOLD_MS ? '\x1b[35m' // Magenta for slow
      : '\x1b[32m' // Green
    const reset = '\x1b[0m'

    console[logLevel === 'error' ? 'error' : logLevel === 'warn' ? 'warn' : 'log'](
      `${color}${req.method} ${req.originalUrl} ${res.statusCode} ${duration}ms${reset}`
    )
  })

  next()
}

// Export metrics getter for API endpoint
export function getPerformanceMetrics() {
  // Calculate current percentiles
  updatePercentiles()

  // Convert endpoint map to sorted array
  const endpointMetrics = Array.from(metrics.byEndpoint.values())
    .sort((a, b) => b.avgResponseTime - a.avgResponseTime)
    .slice(0, 20) // Top 20 slowest endpoints

  return {
    summary: {
      totalRequests: metrics.totalRequests,
      avgResponseTime: metrics.avgResponseTime,
      p95ResponseTime: metrics.p95ResponseTime,
      p99ResponseTime: metrics.p99ResponseTime,
      slowRequests: metrics.slowRequests,
      slowRequestRate: metrics.totalRequests > 0
        ? Math.round((metrics.slowRequests / metrics.totalRequests) * 10000) / 100
        : 0,
      errorCount: metrics.errorCount,
      errorRate: metrics.totalRequests > 0
        ? Math.round((metrics.errorCount / metrics.totalRequests) * 10000) / 100
        : 0,
    },
    slowestEndpoints: endpointMetrics,
    timestamp: new Date().toISOString(),
  }
}

// Reset metrics (useful for testing)
export function resetPerformanceMetrics() {
  metrics.totalRequests = 0
  metrics.avgResponseTime = 0
  metrics.p95ResponseTime = 0
  metrics.p99ResponseTime = 0
  metrics.slowRequests = 0
  metrics.errorCount = 0
  metrics.byEndpoint.clear()
  metrics.responseTimes = []
}
