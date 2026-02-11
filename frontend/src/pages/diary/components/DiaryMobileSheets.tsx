import { AddActivitySheet } from '@/components/foreman/sheets/AddActivitySheet'
import { AddDelaySheet } from '@/components/foreman/sheets/AddDelaySheet'
import { AddDeliverySheet } from '@/components/foreman/sheets/AddDeliverySheet'
import { AddEventSheet } from '@/components/foreman/sheets/AddEventSheet'
import { AddManualLabourPlantSheet } from '@/components/foreman/sheets/AddManualLabourPlantSheet'
import { AddWeatherSheet } from '@/components/foreman/sheets/AddWeatherSheet'
import type { QuickAddType } from '@/components/foreman/DiaryQuickAddBar'
import type { Lot, DailyDiary, WeatherFormState } from '../types'

interface DiaryMobileSheetsProps {
  activeSheet: QuickAddType | 'weather' | null
  onCloseSheet: () => void
  editingEntry: any
  setEditingEntry: (entry: any) => void
  activeLotId: string | null
  lots: Lot[]
  diary: DailyDiary | null
  weatherForm: WeatherFormState
  onAddActivity: (data: { description: string; lotId?: string; quantity?: number; unit?: string; notes?: string }) => Promise<void>
  onAddDelay: (data: { delayType: string; description: string; durationHours?: number; impact?: string; lotId?: string }) => Promise<void>
  onAddDelivery: (data: { description: string; supplier?: string; docketNumber?: string; quantity?: number; unit?: string; lotId?: string; notes?: string }) => Promise<void>
  onAddEvent: (data: { eventType: string; description: string; notes?: string; lotId?: string }) => Promise<void>
  onDeleteEntry: (entry: { id: string; type: string }) => Promise<void>
  onSavePersonnel: (data: any) => Promise<void>
  onSavePlant: (data: any) => Promise<void>
  onSaveWeather: (data: { conditions: string; temperatureMin: string; temperatureMax: string; rainfallMm: string }) => Promise<void>
}

export function DiaryMobileSheets({
  activeSheet,
  onCloseSheet,
  editingEntry,
  setEditingEntry,
  activeLotId,
  lots,
  diary,
  weatherForm,
  onAddActivity,
  onAddDelay,
  onAddDelivery,
  onAddEvent,
  onDeleteEntry,
  onSavePersonnel,
  onSavePlant,
  onSaveWeather,
}: DiaryMobileSheetsProps) {
  return (
    <>
      {activeSheet === 'activity' && (
        <AddActivitySheet
          isOpen
          onClose={onCloseSheet}
          onSave={async (data) => {
            if (editingEntry) { await onDeleteEntry(editingEntry); setEditingEntry(null) }
            await onAddActivity({ ...data, lotId: data.lotId || activeLotId || undefined })
          }}
          defaultLotId={activeLotId}
          lots={lots}
          initialData={editingEntry?.type === 'activity' ? {
            description: editingEntry.description,
            quantity: editingEntry.data?.quantity,
            unit: editingEntry.data?.unit,
            notes: editingEntry.data?.notes,
            lotId: editingEntry.data?.lotId,
          } : undefined}
        />
      )}
      {activeSheet === 'delay' && (
        <AddDelaySheet
          isOpen
          onClose={onCloseSheet}
          onSave={async (data) => {
            if (editingEntry) { await onDeleteEntry(editingEntry); setEditingEntry(null) }
            await onAddDelay({ ...data, lotId: data.lotId || activeLotId || undefined })
          }}
          defaultLotId={activeLotId}
          lots={lots}
          initialData={editingEntry?.type === 'delay' ? {
            delayType: editingEntry.data?.delayType,
            description: editingEntry.description,
            durationHours: editingEntry.data?.durationHours,
            impact: editingEntry.data?.impact,
            lotId: editingEntry.data?.lotId,
          } : undefined}
        />
      )}
      {activeSheet === 'delivery' && (
        <AddDeliverySheet
          isOpen
          onClose={onCloseSheet}
          onSave={async (data) => {
            if (editingEntry) { await onDeleteEntry(editingEntry); setEditingEntry(null) }
            await onAddDelivery({ ...data, lotId: data.lotId || activeLotId || undefined })
          }}
          defaultLotId={activeLotId}
          lots={lots}
          initialData={editingEntry?.type === 'delivery' ? {
            description: editingEntry.description,
            supplier: editingEntry.data?.supplier,
            docketNumber: editingEntry.data?.docketNumber,
            quantity: editingEntry.data?.quantity,
            unit: editingEntry.data?.unit,
            lotId: editingEntry.data?.lotId,
            notes: editingEntry.data?.notes,
          } : undefined}
        />
      )}
      {activeSheet === 'event' && (
        <AddEventSheet
          isOpen
          onClose={onCloseSheet}
          onSave={async (data) => {
            if (editingEntry) { await onDeleteEntry(editingEntry); setEditingEntry(null) }
            await onAddEvent({ ...data, lotId: data.lotId || activeLotId || undefined })
          }}
          defaultLotId={activeLotId}
          lots={lots}
          initialData={editingEntry?.type === 'event' ? {
            eventType: editingEntry.data?.eventType,
            description: editingEntry.description,
            notes: editingEntry.data?.notes,
            lotId: editingEntry.data?.lotId,
          } : undefined}
        />
      )}
      {activeSheet === 'manual' && (
        <AddManualLabourPlantSheet
          isOpen
          onClose={onCloseSheet}
          onSavePersonnel={onSavePersonnel}
          onSavePlant={onSavePlant}
          defaultLotId={activeLotId}
          lots={lots}
        />
      )}
      {activeSheet === 'weather' && (
        <AddWeatherSheet
          isOpen
          onClose={onCloseSheet}
          onSave={onSaveWeather}
          initialData={diary ? {
            conditions: diary.weatherConditions || '',
            temperatureMin: diary.temperatureMin?.toString() || '',
            temperatureMax: diary.temperatureMax?.toString() || '',
            rainfallMm: diary.rainfallMm?.toString() || '',
          } : weatherForm.weatherConditions ? {
            conditions: weatherForm.weatherConditions,
            temperatureMin: weatherForm.temperatureMin,
            temperatureMax: weatherForm.temperatureMax,
            rainfallMm: weatherForm.rainfallMm,
          } : null}
        />
      )}
    </>
  )
}
