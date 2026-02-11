import React, { useState, useCallback } from 'react'
import type { Lot, CreateTestFormData } from '../types'
import {
  testTypeSpecs,
  stateTestMethods,
  stateSpecRefs,
  calculatePassFail,
  INITIAL_FORM_DATA,
} from '../constants'

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
  const [formData, setFormData] = useState<CreateTestFormData>({ ...INITIAL_FORM_DATA })
  const [creating, setCreating] = useState(false)

  // Feature #198: Auto-populate spec values when test type changes
  const handleTestTypeChange = useCallback((testType: string) => {
    const normalizedType = testType.toLowerCase().replace(/\s+/g, '_')
    const specs = testTypeSpecs[normalizedType]

    if (specs) {
      setFormData(prev => ({
        ...prev,
        testType,
        testMethod: specs.method || '',
        specificationMin: specs.min,
        specificationMax: specs.max,
        resultUnit: specs.unit,
      }))
    } else {
      setFormData(prev => ({ ...prev, testType }))
    }
  }, [])

  const handleResultValueChange = useCallback((value: string) => {
    setFormData(prev => {
      const passFail = calculatePassFail(value, prev.specificationMin, prev.specificationMax)
      return { ...prev, resultValue: value, passFail }
    })
  }, [])

  const handleSubmit = useCallback(async () => {
    if (!formData.testType) {
      alert('Test type is required')
      return
    }

    setCreating(true)
    try {
      await onSuccess(formData)
      setFormData({ ...INITIAL_FORM_DATA })
    } catch {
      // Error handled by parent
    } finally {
      setCreating(false)
    }
  }, [formData, onSuccess])

  const handleClose = useCallback(() => {
    setFormData({ ...INITIAL_FORM_DATA })
    onClose()
  }, [onClose])

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-background rounded-lg shadow-xl w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <h2 className="text-xl font-bold mb-4">Add Test Result</h2>
          <div className="space-y-4">
            {/* Feature #198: Enhanced form with all fields */}
            <div>
              <label className="block text-sm font-medium mb-1">Test Type *</label>
              <input
                type="text"
                value={formData.testType}
                onChange={(e) => handleTestTypeChange(e.target.value)}
                placeholder="e.g., Compaction, CBR, Grading"
                className="w-full rounded-lg border px-3 py-2"
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
              <p className="text-xs text-muted-foreground mt-1">Select a test type to auto-populate method & specs</p>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Test Method/Standard</label>
              <input
                type="text"
                value={formData.testMethod}
                onChange={(e) => setFormData({ ...formData, testMethod: e.target.value })}
                placeholder="e.g., AS 1289.5.4.1, TfNSW T111, TMR Q114A"
                className="w-full rounded-lg border px-3 py-2"
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
                <label className="block text-sm font-medium mb-1">Test Request Number</label>
                <input
                  type="text"
                  value={formData.testRequestNumber}
                  onChange={(e) => setFormData({ ...formData, testRequestNumber: e.target.value })}
                  placeholder="e.g., TR-001"
                  className="w-full rounded-lg border px-3 py-2"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Lab Report Number</label>
                <input
                  type="text"
                  value={formData.laboratoryReportNumber}
                  onChange={(e) => setFormData({ ...formData, laboratoryReportNumber: e.target.value })}
                  placeholder="e.g., LAB-2024-0001"
                  className="w-full rounded-lg border px-3 py-2"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Link to Lot</label>
              <select
                value={formData.lotId}
                onChange={(e) => setFormData({ ...formData, lotId: e.target.value })}
                className="w-full rounded-lg border px-3 py-2"
              >
                <option value="">No lot linked</option>
                {lots.map((lot) => (
                  <option key={lot.id} value={lot.id}>
                    {lot.lotNumber}
                  </option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">Laboratory Name</label>
                <input
                  type="text"
                  value={formData.laboratoryName}
                  onChange={(e) => setFormData({ ...formData, laboratoryName: e.target.value })}
                  placeholder="e.g., ABC Testing Labs"
                  className="w-full rounded-lg border px-3 py-2"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">NATA Site Number</label>
                <input
                  type="text"
                  value={formData.nataSiteNumber}
                  onChange={(e) => setFormData({ ...formData, nataSiteNumber: e.target.value })}
                  placeholder="e.g., 12345"
                  className="w-full rounded-lg border px-3 py-2"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Material Type</label>
              <select
                value={formData.materialType}
                onChange={(e) => setFormData({ ...formData, materialType: e.target.value })}
                className="w-full rounded-lg border px-3 py-2"
              >
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
              </select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">Sample Location</label>
                <input
                  type="text"
                  value={formData.sampleLocation}
                  onChange={(e) => setFormData({ ...formData, sampleLocation: e.target.value })}
                  placeholder="e.g., CH 1000+50, 2m LHS"
                  className="w-full rounded-lg border px-3 py-2"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Sample Depth</label>
                <select
                  value={formData.sampleDepth}
                  onChange={(e) => setFormData({ ...formData, sampleDepth: e.target.value })}
                  className="w-full rounded-lg border px-3 py-2"
                >
                  <option value="">Select depth</option>
                  <option value="surface">Surface</option>
                  <option value="0-150">0-150mm</option>
                  <option value="150-300">150-300mm</option>
                  <option value="300-450">300-450mm</option>
                  <option value="450-600">450-600mm</option>
                  <option value="other">Other (specify in notes)</option>
                </select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">Layer/Lift</label>
                <select
                  value={formData.layerLift}
                  onChange={(e) => setFormData({ ...formData, layerLift: e.target.value })}
                  className="w-full rounded-lg border px-3 py-2"
                >
                  <option value="">N/A</option>
                  <option value="1">Layer 1</option>
                  <option value="2">Layer 2</option>
                  <option value="3">Layer 3</option>
                  <option value="4">Layer 4</option>
                  <option value="5">Layer 5</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Sampled By</label>
                <input
                  type="text"
                  value={formData.sampledBy}
                  onChange={(e) => setFormData({ ...formData, sampledBy: e.target.value })}
                  placeholder="Technician name"
                  className="w-full rounded-lg border px-3 py-2"
                />
              </div>
            </div>
            {/* Dates Section */}
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">Sample Date</label>
                <input
                  type="date"
                  value={formData.sampleDate}
                  onChange={(e) => setFormData({ ...formData, sampleDate: e.target.value })}
                  className="w-full rounded-lg border px-3 py-2"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Test Date</label>
                <input
                  type="date"
                  value={formData.testDate}
                  onChange={(e) => setFormData({ ...formData, testDate: e.target.value })}
                  className="w-full rounded-lg border px-3 py-2"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Result Date</label>
                <input
                  type="date"
                  value={formData.resultDate}
                  onChange={(e) => setFormData({ ...formData, resultDate: e.target.value })}
                  className="w-full rounded-lg border px-3 py-2"
                />
              </div>
            </div>
            {/* Result Section */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">Result Value</label>
                <input
                  type="number"
                  step="any"
                  value={formData.resultValue}
                  onChange={(e) => handleResultValueChange(e.target.value)}
                  placeholder="e.g., 98.5"
                  className="w-full rounded-lg border px-3 py-2"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Unit</label>
                <input
                  type="text"
                  value={formData.resultUnit}
                  onChange={(e) => setFormData({ ...formData, resultUnit: e.target.value })}
                  placeholder="e.g., %"
                  className="w-full rounded-lg border px-3 py-2"
                />
              </div>
            </div>
            {/* Specification Section */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">Spec Min</label>
                <input
                  type="number"
                  step="any"
                  value={formData.specificationMin}
                  onChange={(e) => {
                    const newMin = e.target.value
                    const passFail = calculatePassFail(formData.resultValue, newMin, formData.specificationMax)
                    setFormData({ ...formData, specificationMin: newMin, passFail })
                  }}
                  placeholder="e.g., 95"
                  className="w-full rounded-lg border px-3 py-2"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Spec Max</label>
                <input
                  type="number"
                  step="any"
                  value={formData.specificationMax}
                  onChange={(e) => {
                    const newMax = e.target.value
                    const passFail = calculatePassFail(formData.resultValue, formData.specificationMin, newMax)
                    setFormData({ ...formData, specificationMax: newMax, passFail })
                  }}
                  placeholder="e.g., 100"
                  className="w-full rounded-lg border px-3 py-2"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Specification Reference</label>
              <input
                type="text"
                value={formData.specificationRef}
                onChange={(e) => setFormData({ ...formData, specificationRef: e.target.value })}
                placeholder="e.g., TfNSW R44 Table 10, MRTS04 Cl.5.3, AS 3798"
                className="w-full rounded-lg border px-3 py-2"
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
              <label className="block text-sm font-medium mb-1">
                Pass/Fail Status
                {formData.resultValue && (formData.specificationMin || formData.specificationMax) && (
                  <span className="ml-2 text-xs text-muted-foreground">(auto-calculated)</span>
                )}
              </label>
              <select
                value={formData.passFail}
                onChange={(e) => setFormData({ ...formData, passFail: e.target.value })}
                className={`w-full rounded-lg border px-3 py-2 ${
                  formData.passFail === 'pass' ? 'border-green-500 bg-green-50 dark:bg-green-900/20' :
                  formData.passFail === 'fail' ? 'border-red-500 bg-red-50 dark:bg-red-900/20' :
                  ''
                }`}
              >
                <option value="pending">Pending</option>
                <option value="pass">Pass</option>
                <option value="fail">Fail</option>
              </select>
            </div>
          </div>
          <div className="flex justify-end gap-3 mt-6">
            <button
              onClick={handleClose}
              className="px-4 py-2 text-sm rounded-lg border hover:bg-muted"
            >
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              disabled={creating}
              className="px-4 py-2 text-sm rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            >
              {creating ? 'Creating...' : 'Create Test Result'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
})
