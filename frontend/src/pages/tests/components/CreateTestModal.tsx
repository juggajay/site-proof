import React, { useState, useCallback, useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import type { Lot, CreateTestFormData } from '../types'
import {
  testTypeSpecs,
  stateTestMethods,
  stateSpecRefs,
  calculatePassFail,
  INITIAL_FORM_DATA,
} from '../constants'
import { Modal, ModalHeader, ModalBody, ModalFooter } from '@/components/ui/Modal'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { NativeSelect } from '@/components/ui/native-select'
import { Label } from '@/components/ui/label'

const createTestSchema = z.object({
  testType: z.string().min(1, 'Test type is required'),
  testMethod: z.string(),
  testRequestNumber: z.string(),
  laboratoryName: z.string(),
  laboratoryReportNumber: z.string(),
  nataSiteNumber: z.string(),
  sampleLocation: z.string(),
  sampleDepth: z.string(),
  materialType: z.string(),
  layerLift: z.string(),
  sampledBy: z.string(),
  sampleDate: z.string(),
  testDate: z.string(),
  resultDate: z.string(),
  lotId: z.string(),
  resultValue: z.string(),
  resultUnit: z.string(),
  specificationMin: z.string(),
  specificationMax: z.string(),
  specificationRef: z.string(),
  passFail: z.string(),
})

type CreateTestFormDataSchema = z.infer<typeof createTestSchema>

interface CreateTestModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: (formData: CreateTestFormData) => Promise<void>
  lots: Lot[]
  projectState: string
}

export const CreateTestModal = React.memo(function CreateTestModal({
  isOpen,
  onClose,
  onSuccess,
  lots,
  projectState,
}: CreateTestModalProps) {
  const [creating, setCreating] = useState(false)

  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { errors },
  } = useForm<CreateTestFormDataSchema>({
    resolver: zodResolver(createTestSchema),
    mode: 'onBlur',
    defaultValues: { ...INITIAL_FORM_DATA },
  })

  const testType = watch('testType')
  const resultValue = watch('resultValue')
  const specificationMin = watch('specificationMin')
  const specificationMax = watch('specificationMax')
  const passFail = watch('passFail')

  useEffect(() => { if (isOpen) reset({ ...INITIAL_FORM_DATA }) }, [isOpen, reset])

  // Feature #198: Auto-populate spec values when test type changes
  useEffect(() => {
    if (!testType) return
    const normalizedType = testType.toLowerCase().replace(/\s+/g, '_')
    const specs = testTypeSpecs[normalizedType]
    if (specs) {
      setValue('testMethod', specs.method || '')
      setValue('specificationMin', specs.min)
      setValue('specificationMax', specs.max)
      setValue('resultUnit', specs.unit)
    }
  }, [testType, setValue])

  // Auto-calculate pass/fail when result value or spec bounds change
  useEffect(() => {
    const newPassFail = calculatePassFail(resultValue, specificationMin, specificationMax)
    if (newPassFail !== passFail) {
      setValue('passFail', newPassFail)
    }
  }, [resultValue, specificationMin, specificationMax, setValue, passFail])

  const onFormSubmit = useCallback(async (data: CreateTestFormDataSchema) => {
    setCreating(true)
    try {
      await onSuccess(data as CreateTestFormData)
      reset({ ...INITIAL_FORM_DATA })
    } catch {
      // Error handled by parent
    } finally {
      setCreating(false)
    }
  }, [onSuccess, reset])

  const handleClose = useCallback(() => {
    reset({ ...INITIAL_FORM_DATA })
    onClose()
  }, [onClose, reset])

  if (!isOpen) return null

  return (
    <Modal onClose={handleClose} className="max-w-lg">
      <ModalHeader>Add Test Result</ModalHeader>
      <ModalBody>
        <form id="create-test-form" onSubmit={handleSubmit(onFormSubmit)}>
          <div className="space-y-4">
            {/* Feature #198: Enhanced form with all fields */}
            <div>
              <Label>Test Type *</Label>
              <Input
                type="text"
                {...register('testType')}
                placeholder="e.g., Compaction, CBR, Grading"
                className={errors.testType ? 'border-destructive' : ''}
                list="test-types"
              />
              <datalist id="test-types">
                <optgroup label="Compaction/Density">
                  <option value="Density Ratio" />
                  <option value="Dry Density Ratio" />
                  <option value="Field Density Nuclear" />
                  <option value="Field Density Sand" />
                  <option value="MDD Standard" />
                  <option value="MDD Modified" />
                  <option value="Hilf Rapid" />
                </optgroup>
                <optgroup label="Strength">
                  <option value="CBR Laboratory" />
                  <option value="CBR 4Day Soaked" />
                  <option value="CBR Field DCP" />
                  <option value="UCS" />
                </optgroup>
                <optgroup label="Classification">
                  <option value="Particle Size Distribution" />
                  <option value="Liquid Limit" />
                  <option value="Plastic Limit" />
                  <option value="Plasticity Index" />
                  <option value="Linear Shrinkage" />
                  <option value="Moisture Content" />
                </optgroup>
                <optgroup label="Aggregate">
                  <option value="Flakiness Index" />
                  <option value="Los Angeles Abrasion" />
                  <option value="Aggregate Crushing Value" />
                  <option value="Wet Dry Strength" />
                </optgroup>
                <optgroup label="Concrete">
                  <option value="Concrete Slump" />
                  <option value="Concrete Strength" />
                </optgroup>
                <optgroup label="Asphalt">
                  <option value="Asphalt Density" />
                </optgroup>
              </datalist>
              {errors.testType && (
                <p className="text-sm text-destructive mt-1" role="alert">{errors.testType.message}</p>
              )}
              <p className="text-xs text-muted-foreground mt-1">Select a test type to auto-populate method & specs</p>
            </div>
            <div>
              <Label>Test Method/Standard</Label>
              <Input
                type="text"
                {...register('testMethod')}
                placeholder="e.g., AS 1289.5.4.1, TfNSW T111, TMR Q114A"
                list="test-methods"
              />
              <datalist id="test-methods">
                <optgroup label="Australian Standards">
                  <option value="AS 1289.2.1.1" />
                  <option value="AS 1289.3.1.1" />
                  <option value="AS 1289.3.2.1" />
                  <option value="AS 1289.3.3.1" />
                  <option value="AS 1289.3.4.1" />
                  <option value="AS 1289.5.1.1" />
                  <option value="AS 1289.5.2.1" />
                  <option value="AS 1289.5.3.1" />
                  <option value="AS 1289.5.4.1" />
                  <option value="AS 1289.5.7.1" />
                  <option value="AS 1289.5.8.1" />
                  <option value="AS 1289.6.1.1" />
                  <option value="AS 1289.6.7.1" />
                  <option value="AS 1141.11" />
                  <option value="AS 1141.15" />
                  <option value="AS 1141.23" />
                </optgroup>
                {stateTestMethods[projectState] && (
                  <optgroup label={stateTestMethods[projectState].label}>
                    {stateTestMethods[projectState].methods.map(method => (
                      <option key={method} value={method} />
                    ))}
                  </optgroup>
                )}
              </datalist>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Test Request Number</Label>
                <Input
                  type="text"
                  {...register('testRequestNumber')}
                  placeholder="e.g., TR-001"
                />
              </div>
              <div>
                <Label>Lab Report Number</Label>
                <Input
                  type="text"
                  {...register('laboratoryReportNumber')}
                  placeholder="e.g., LAB-2024-0001"
                />
              </div>
            </div>
            <div>
              <Label>Link to Lot</Label>
              <NativeSelect {...register('lotId')}>
                <option value="">No lot linked</option>
                {lots.map((lot) => (
                  <option key={lot.id} value={lot.id}>
                    {lot.lotNumber}
                  </option>
                ))}
              </NativeSelect>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Laboratory Name</Label>
                <Input
                  type="text"
                  {...register('laboratoryName')}
                  placeholder="e.g., ABC Testing Labs"
                />
              </div>
              <div>
                <Label>NATA Site Number</Label>
                <Input
                  type="text"
                  {...register('nataSiteNumber')}
                  placeholder="e.g., 12345"
                />
              </div>
            </div>
            <div>
              <Label>Material Type</Label>
              <NativeSelect {...register('materialType')}>
                <option value="">Select material type</option>
                <optgroup label="Fill Materials">
                  <option value="general_fill">General Fill</option>
                  <option value="select_fill">Select Fill</option>
                  <option value="structural_fill">Structural Fill</option>
                  <option value="rock_fill">Rock Fill</option>
                </optgroup>
                <optgroup label="Pavement Materials">
                  <option value="subgrade">Subgrade</option>
                  <option value="subbase">Subbase</option>
                  <option value="base">Base Course</option>
                  <option value="dgb20">DGB20</option>
                  <option value="dgs20">DGS20</option>
                  <option value="fcr">FCR (Fine Crushed Rock)</option>
                </optgroup>
                <optgroup label="Drainage">
                  <option value="drainage_10mm">Drainage Aggregate 10mm</option>
                  <option value="drainage_14mm">Drainage Aggregate 14mm</option>
                  <option value="drainage_20mm">Drainage Aggregate 20mm</option>
                  <option value="filter_sand">Filter Sand</option>
                </optgroup>
                <optgroup label="Stabilised">
                  <option value="lime_treated">Lime Treated</option>
                  <option value="cement_treated">Cement Treated</option>
                </optgroup>
                <optgroup label="Concrete">
                  <option value="concrete">Concrete</option>
                  <option value="lean_mix">Lean Mix Concrete</option>
                </optgroup>
                <optgroup label="Asphalt">
                  <option value="asphalt">Asphalt</option>
                </optgroup>
              </NativeSelect>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Sample Location</Label>
                <Input
                  type="text"
                  {...register('sampleLocation')}
                  placeholder="e.g., CH 1000+50, 2m LHS"
                />
              </div>
              <div>
                <Label>Sample Depth</Label>
                <NativeSelect {...register('sampleDepth')}>
                  <option value="">Select depth</option>
                  <option value="surface">Surface</option>
                  <option value="0-150">0-150mm</option>
                  <option value="150-300">150-300mm</option>
                  <option value="300-450">300-450mm</option>
                  <option value="450-600">450-600mm</option>
                  <option value="other">Other (specify in notes)</option>
                </NativeSelect>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Layer/Lift</Label>
                <NativeSelect {...register('layerLift')}>
                  <option value="">N/A</option>
                  <option value="1">Layer 1</option>
                  <option value="2">Layer 2</option>
                  <option value="3">Layer 3</option>
                  <option value="4">Layer 4</option>
                  <option value="5">Layer 5</option>
                </NativeSelect>
              </div>
              <div>
                <Label>Sampled By</Label>
                <Input
                  type="text"
                  {...register('sampledBy')}
                  placeholder="Technician name"
                />
              </div>
            </div>
            {/* Dates Section */}
            <div className="grid grid-cols-3 gap-4">
              <div>
                <Label>Sample Date</Label>
                <Input
                  type="date"
                  {...register('sampleDate')}
                />
              </div>
              <div>
                <Label>Test Date</Label>
                <Input
                  type="date"
                  {...register('testDate')}
                />
              </div>
              <div>
                <Label>Result Date</Label>
                <Input
                  type="date"
                  {...register('resultDate')}
                />
              </div>
            </div>
            {/* Result Section */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Result Value</Label>
                <Input
                  type="number"
                  step="any"
                  {...register('resultValue')}
                  placeholder="e.g., 98.5"
                />
              </div>
              <div>
                <Label>Unit</Label>
                <Input
                  type="text"
                  {...register('resultUnit')}
                  placeholder="e.g., %"
                />
              </div>
            </div>
            {/* Specification Section */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Spec Min</Label>
                <Input
                  type="number"
                  step="any"
                  {...register('specificationMin')}
                  placeholder="e.g., 95"
                />
              </div>
              <div>
                <Label>Spec Max</Label>
                <Input
                  type="number"
                  step="any"
                  {...register('specificationMax')}
                  placeholder="e.g., 100"
                />
              </div>
            </div>
            <div>
              <Label>Specification Reference</Label>
              <Input
                type="text"
                {...register('specificationRef')}
                placeholder="e.g., TfNSW R44 Table 10, MRTS04 Cl.5.3, AS 3798"
                list="spec-refs"
              />
              <datalist id="spec-refs">
                <optgroup label="National">
                  <option value="AS 3798" />
                  <option value="Austroads" />
                </optgroup>
                {stateSpecRefs[projectState] && (
                  <optgroup label={stateSpecRefs[projectState].label}>
                    {stateSpecRefs[projectState].specs.map(spec => (
                      <option key={spec} value={spec} />
                    ))}
                  </optgroup>
                )}
              </datalist>
            </div>
            {/* Pass/Fail with auto-calculated indicator */}
            <div>
              <Label>
                Pass/Fail Status
                {resultValue && (specificationMin || specificationMax) && (
                  <span className="ml-2 text-xs text-muted-foreground">(auto-calculated)</span>
                )}
              </Label>
              <NativeSelect
                {...register('passFail')}
                className={
                  passFail === 'pass' ? 'border-green-500 bg-green-50 dark:bg-green-900/20' :
                  passFail === 'fail' ? 'border-red-500 bg-red-50 dark:bg-red-900/20' :
                  ''
                }
              >
                <option value="pending">Pending</option>
                <option value="pass">Pass</option>
                <option value="fail">Fail</option>
              </NativeSelect>
            </div>
          </div>
        </form>
      </ModalBody>
      <ModalFooter>
        <Button variant="outline" type="button" onClick={handleClose}>
          Cancel
        </Button>
        <Button type="submit" form="create-test-form" disabled={creating}>
          {creating ? 'Creating...' : 'Create Test Result'}
        </Button>
      </ModalFooter>
    </Modal>
  )
})
