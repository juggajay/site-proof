import { Router, Request, Response } from 'express'
import { prisma } from '../../lib/prisma.js'
import { checkProjectAccess } from '../../lib/projectAccess.js'

const router = Router()

// GET /api/diary/:projectId/weather/:date - Get weather for project location
// Uses Open-Meteo API (free, no API key required)
router.get('/:projectId/weather/:date', async (req: Request, res: Response) => {
  try {
    const { projectId, date } = req.params
    const userId = req.user!.id

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' })
    }

    const hasAccess = await checkProjectAccess(userId, projectId)
    if (!hasAccess) {
      return res.status(403).json({ error: 'Access denied to this project' })
    }

    // Get project location
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: { latitude: true, longitude: true, state: true }
    })

    if (!project) {
      return res.status(404).json({ error: 'Project not found' })
    }

    let latitude = project.latitude ? Number(project.latitude) : null
    let longitude = project.longitude ? Number(project.longitude) : null

    // If no coordinates, use default coordinates based on Australian state
    if (!latitude || !longitude) {
      const stateCoords: Record<string, { lat: number; lon: number }> = {
        'NSW': { lat: -33.8688, lon: 151.2093 },    // Sydney
        'VIC': { lat: -37.8136, lon: 144.9631 },    // Melbourne
        'QLD': { lat: -27.4698, lon: 153.0251 },    // Brisbane
        'WA': { lat: -31.9505, lon: 115.8605 },     // Perth
        'SA': { lat: -34.9285, lon: 138.6007 },     // Adelaide
        'TAS': { lat: -42.8821, lon: 147.3272 },    // Hobart
        'NT': { lat: -12.4634, lon: 130.8456 },     // Darwin
        'ACT': { lat: -35.2809, lon: 149.1300 },    // Canberra
      }

      const state = project.state?.toUpperCase() || 'NSW'
      const coords = stateCoords[state] || stateCoords['NSW']
      latitude = coords.lat
      longitude = coords.lon
    }

    // Fetch weather from Open-Meteo API
    const weatherUrl = `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum&timezone=Australia%2FSydney&start_date=${date}&end_date=${date}`

    const weatherResponse = await fetch(weatherUrl)

    if (!weatherResponse.ok) {
      console.error('Weather API error:', weatherResponse.status, await weatherResponse.text())
      return res.status(502).json({ error: 'Failed to fetch weather data' })
    }

    const weatherData = await weatherResponse.json() as {
      daily?: {
        time?: string[]
        weather_code?: number[]
        temperature_2m_min?: number[]
        temperature_2m_max?: number[]
        precipitation_sum?: number[]
      }
    }

    if (!weatherData.daily || !weatherData.daily.time || weatherData.daily.time.length === 0) {
      return res.status(404).json({ error: 'No weather data available for this date' })
    }

    // Map WMO weather codes to conditions
    const weatherCodeMap: Record<number, string> = {
      0: 'Fine',
      1: 'Fine',
      2: 'Partly Cloudy',
      3: 'Cloudy',
      45: 'Fog',
      48: 'Fog',
      51: 'Rain',
      53: 'Rain',
      55: 'Rain',
      56: 'Rain',
      57: 'Rain',
      61: 'Rain',
      63: 'Rain',
      65: 'Heavy Rain',
      66: 'Rain',
      67: 'Heavy Rain',
      71: 'Rain',
      73: 'Rain',
      75: 'Heavy Rain',
      77: 'Rain',
      80: 'Rain',
      81: 'Rain',
      82: 'Heavy Rain',
      85: 'Rain',
      86: 'Heavy Rain',
      95: 'Storm',
      96: 'Storm',
      99: 'Storm',
    }

    const weatherCode = weatherData.daily.weather_code?.[0] ?? 0
    const weatherCondition = weatherCodeMap[weatherCode] || 'Partly Cloudy'

    res.json({
      date: weatherData.daily.time?.[0],
      weatherConditions: weatherCondition,
      temperatureMin: weatherData.daily.temperature_2m_min?.[0],
      temperatureMax: weatherData.daily.temperature_2m_max?.[0],
      rainfallMm: weatherData.daily.precipitation_sum?.[0] || 0,
      source: 'Open-Meteo',
      location: {
        latitude,
        longitude,
        fromProjectState: !project.latitude || !project.longitude
      }
    })
  } catch (error) {
    console.error('Error fetching weather:', error)
    res.status(500).json({ error: 'Failed to fetch weather data' })
  }
})

// Feature #242: GET /api/diary/project/:projectId/delays - Get all delays for a project
router.get('/project/:projectId/delays', async (req: Request, res: Response) => {
  try {
    const { projectId } = req.params
    const { delayType, startDate, endDate } = req.query
    const userId = req.user!.id

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' })
    }

    const hasAccess = await checkProjectAccess(userId, projectId)
    if (!hasAccess) {
      return res.status(403).json({ error: 'Access denied to this project' })
    }

    // Build date filter
    const dateFilter: { gte?: Date; lte?: Date } = {}
    if (startDate && typeof startDate === 'string') {
      dateFilter.gte = new Date(startDate)
    }
    if (endDate && typeof endDate === 'string') {
      dateFilter.lte = new Date(endDate)
    }

    // Get all diaries with delays
    const diaries = await prisma.dailyDiary.findMany({
      where: {
        projectId,
        ...(Object.keys(dateFilter).length > 0 ? { date: dateFilter } : {}),
      },
      include: {
        delays: true,
      },
    })

    // Flatten delays and add diary info
    let delays = diaries.flatMap(diary =>
      diary.delays.map(delay => ({
        id: delay.id,
        diaryId: diary.id,
        diaryDate: diary.date,
        diaryStatus: diary.status,
        delayType: delay.delayType,
        startTime: delay.startTime,
        endTime: delay.endTime,
        durationHours: delay.durationHours ? Number(delay.durationHours) : null,
        description: delay.description,
        impact: delay.impact,
      }))
    )

    // Filter by delay type if provided
    if (delayType && typeof delayType === 'string') {
      delays = delays.filter(d => d.delayType === delayType)
    }

    // Calculate summary by type
    const summaryByType: Record<string, { count: number; totalHours: number }> = {}
    for (const delay of delays) {
      if (!summaryByType[delay.delayType]) {
        summaryByType[delay.delayType] = { count: 0, totalHours: 0 }
      }
      summaryByType[delay.delayType].count++
      summaryByType[delay.delayType].totalHours += delay.durationHours || 0
    }

    // Calculate totals
    const totalDelays = delays.length
    const totalHours = delays.reduce((sum, d) => sum + (d.durationHours || 0), 0)

    res.json({
      delays: delays.sort((a, b) => new Date(b.diaryDate).getTime() - new Date(a.diaryDate).getTime()),
      summary: {
        totalDelays,
        totalHours,
        byType: summaryByType,
      },
    })
  } catch (error) {
    console.error('Error fetching delays:', error)
    res.status(500).json({ error: 'Failed to fetch delays' })
  }
})

// Feature #242: GET /api/diary/project/:projectId/delays/export - Export delays to CSV
router.get('/project/:projectId/delays/export', async (req: Request, res: Response) => {
  try {
    const { projectId } = req.params
    const { delayType, startDate, endDate } = req.query
    const userId = req.user!.id

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' })
    }

    const hasAccess = await checkProjectAccess(userId, projectId)
    if (!hasAccess) {
      return res.status(403).json({ error: 'Access denied to this project' })
    }

    // Build date filter
    const dateFilter: { gte?: Date; lte?: Date } = {}
    if (startDate && typeof startDate === 'string') {
      dateFilter.gte = new Date(startDate)
    }
    if (endDate && typeof endDate === 'string') {
      dateFilter.lte = new Date(endDate)
    }

    // Get all diaries with delays
    const diaries = await prisma.dailyDiary.findMany({
      where: {
        projectId,
        ...(Object.keys(dateFilter).length > 0 ? { date: dateFilter } : {}),
      },
      include: {
        delays: true,
      },
    })

    // Flatten delays
    let delays = diaries.flatMap(diary =>
      diary.delays.map(delay => ({
        diaryDate: diary.date,
        delayType: delay.delayType,
        startTime: delay.startTime,
        endTime: delay.endTime,
        durationHours: delay.durationHours ? Number(delay.durationHours) : null,
        description: delay.description,
        impact: delay.impact,
      }))
    )

    // Filter by delay type if provided
    if (delayType && typeof delayType === 'string') {
      delays = delays.filter(d => d.delayType === delayType)
    }

    // Sort by date descending
    delays.sort((a, b) => new Date(b.diaryDate).getTime() - new Date(a.diaryDate).getTime())

    // Generate CSV
    const csvHeaders = ['Date', 'Delay Type', 'Start Time', 'End Time', 'Duration (Hours)', 'Description', 'Impact']
    const csvRows = delays.map(d => [
      new Date(d.diaryDate).toLocaleDateString('en-AU'),
      d.delayType,
      d.startTime || '',
      d.endTime || '',
      d.durationHours?.toFixed(1) || '',
      `"${(d.description || '').replace(/"/g, '""')}"`,
      `"${(d.impact || '').replace(/"/g, '""')}"`,
    ])

    const csv = [csvHeaders.join(','), ...csvRows.map(r => r.join(','))].join('\n')

    res.setHeader('Content-Type', 'text/csv')
    res.setHeader('Content-Disposition', 'attachment; filename=delay-register.csv')
    res.send(csv)
  } catch (error) {
    console.error('Error exporting delays:', error)
    res.status(500).json({ error: 'Failed to export delays' })
  }
})

// GET /api/diary/project/:projectId/docket-summary/:date - Get docket summary for a date
router.get('/project/:projectId/docket-summary/:date', async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id
    if (!userId) return res.status(401).json({ error: 'Unauthorized' })
    const { projectId, date } = req.params

    const hasAccess = await checkProjectAccess(userId, projectId)
    if (!hasAccess) return res.status(403).json({ error: 'Access denied' })

    const targetDate = new Date(date)
    const nextDate = new Date(date)
    nextDate.setDate(nextDate.getDate() + 1)

    const dockets = await prisma.dailyDocket.findMany({
      where: {
        projectId,
        date: { gte: targetDate, lt: nextDate },
      },
      include: {
        subcontractorCompany: { select: { id: true, companyName: true } },
        labourEntries: {
          include: {
            employee: { select: { id: true, name: true, role: true } },
          },
        },
        plantEntries: {
          include: {
            plant: { select: { id: true, type: true, description: true, idRego: true } },
          },
        },
      },
    })

    const approved = dockets.filter(d => d.status === 'approved')
    const pending = dockets.filter(d => d.status === 'pending_approval')

    const summary = {
      approvedDockets: approved.map(d => ({
        id: d.id,
        subcontractor: d.subcontractorCompany.companyName,
        subcontractorId: d.subcontractorCompany.id,
        workerCount: d.labourEntries.length,
        totalLabourHours: d.labourEntries.reduce((sum, e) => sum + (Number(e.approvedHours || e.submittedHours) || 0), 0),
        machineCount: d.plantEntries.length,
        totalPlantHours: d.plantEntries.reduce((sum, e) => sum + (Number(e.hoursOperated) || 0), 0),
        workers: d.labourEntries.map(e => ({
          name: e.employee.name,
          role: e.employee.role,
          hours: Number(e.approvedHours || e.submittedHours) || 0,
        })),
        machines: d.plantEntries.map(e => ({
          type: e.plant.type,
          description: e.plant.description,
          idRego: e.plant.idRego,
          hours: Number(e.hoursOperated) || 0,
        })),
      })),
      pendingCount: pending.length,
      pendingDockets: pending.map(d => ({
        id: d.id,
        subcontractor: d.subcontractorCompany.companyName,
      })),
      totals: {
        workers: approved.reduce((sum, d) => sum + d.labourEntries.length, 0),
        labourHours: approved.reduce((sum, d) => sum + d.labourEntries.reduce((s, e) => s + (Number(e.approvedHours || e.submittedHours) || 0), 0), 0),
        machines: approved.reduce((sum, d) => sum + d.plantEntries.length, 0),
        plantHours: approved.reduce((sum, d) => sum + d.plantEntries.reduce((s, e) => s + (Number(e.hoursOperated) || 0), 0), 0),
      },
    }

    res.json(summary)
  } catch (error) {
    console.error('Get docket summary error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// GET /api/diary/:diaryId/timeline - Get merged chronological timeline
router.get('/:diaryId/timeline', async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id
    if (!userId) return res.status(401).json({ error: 'Unauthorized' })
    const { diaryId } = req.params

    const diary = await prisma.dailyDiary.findUnique({
      where: { id: diaryId },
      include: {
        personnel: { include: { lot: { select: { id: true, lotNumber: true } } } },
        plant: { include: { lot: { select: { id: true, lotNumber: true } } } },
        activities: { include: { lot: { select: { id: true, lotNumber: true } } } },
        delays: { include: { lot: { select: { id: true, lotNumber: true } } } },
        deliveries: { include: { lot: { select: { id: true, lotNumber: true } } } },
        events: { include: { lot: { select: { id: true, lotNumber: true } } } },
      },
    })

    if (!diary) return res.status(404).json({ error: 'Diary not found' })

    const hasAccess = await checkProjectAccess(userId, diary.projectId)
    if (!hasAccess) return res.status(403).json({ error: 'Access denied' })

    const timeline = [
      ...diary.activities.map(a => ({
        id: a.id, type: 'activity' as const, createdAt: a.createdAt,
        description: a.description, lot: a.lot, data: a,
      })),
      ...diary.delays.map(d => ({
        id: d.id, type: 'delay' as const, createdAt: d.createdAt,
        description: d.description, lot: d.lot, data: d,
      })),
      ...diary.deliveries.map(d => ({
        id: d.id, type: 'delivery' as const, createdAt: d.createdAt,
        description: d.description, lot: d.lot, data: d,
      })),
      ...diary.events.map(e => ({
        id: e.id, type: 'event' as const, createdAt: e.createdAt,
        description: e.description, lot: e.lot, data: e,
      })),
      ...diary.personnel.filter(p => p.source === 'manual').map(p => ({
        id: p.id, type: 'personnel' as const, createdAt: p.createdAt || diary.createdAt,
        description: `${p.name} — ${p.role || 'Worker'}`, lot: p.lot, data: p,
      })),
      ...diary.plant.filter(p => p.source === 'manual').map(p => ({
        id: p.id, type: 'plant' as const, createdAt: p.createdAt || diary.createdAt,
        description: p.description, lot: p.lot, data: p,
      })),
    ].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())

    res.json({ timeline })
  } catch (error) {
    console.error('Get timeline error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

export { router as diaryReportingRouter }
