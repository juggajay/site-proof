import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { AddEmployeeModal, AddPlantModal } from './MyCompanyFormModals';
import type { EmployeeFormState, PlantFormState } from './MyCompanyFormModals';

const EMPLOYEE_FORM: EmployeeFormState = {
  name: 'Sam Labourer',
  phone: '0412 345 678',
  role: 'Labourer',
  hourlyRate: '85',
};

const PLANT_FORM: PlantFormState = {
  type: 'Excavator',
  description: '20T Excavator',
  idRego: 'EXC-001',
  dryRate: '150',
  wetRate: '200',
};

function renderEmployeeModal(overrides: Partial<Parameters<typeof AddEmployeeModal>[0]> = {}) {
  const props = {
    employeeForm: EMPLOYEE_FORM,
    setEmployeeForm: vi.fn(),
    saving: false,
    onClose: vi.fn(),
    onAddEmployee: vi.fn(),
    ...overrides,
  };

  render(<AddEmployeeModal {...props} />);
  return props;
}

function renderPlantModal(overrides: Partial<Parameters<typeof AddPlantModal>[0]> = {}) {
  const props = {
    plantForm: PLANT_FORM,
    setPlantForm: vi.fn(),
    saving: false,
    onClose: vi.fn(),
    onAddPlant: vi.fn(),
    ...overrides,
  };

  render(<AddPlantModal {...props} />);
  return props;
}

describe('AddEmployeeModal', () => {
  it('renders the employee form with the existing approval copy', () => {
    renderEmployeeModal();

    expect(screen.getByRole('dialog', { name: 'Add Employee' })).toBeInTheDocument();
    expect(screen.getByLabelText('Name *')).toHaveValue('Sam Labourer');
    expect(screen.getByLabelText('Phone')).toHaveValue('0412 345 678');
    expect(screen.getByLabelText('Role *')).toHaveValue('Labourer');
    expect(screen.getByLabelText('Proposed Hourly Rate *')).toHaveValue(85);
    expect(
      screen.getByText('Rate requires approval from head contractor before use'),
    ).toBeInTheDocument();
  });

  it('reports employee field changes through the page-owned setter', () => {
    let updatedForm: EmployeeFormState | null = null;
    const setEmployeeForm = vi.fn((update) => {
      updatedForm = typeof update === 'function' ? update(EMPLOYEE_FORM) : update;
    });
    const props = renderEmployeeModal({ setEmployeeForm });

    fireEvent.change(screen.getByLabelText('Role *'), { target: { value: 'Operator' } });

    expect(props.setEmployeeForm).toHaveBeenCalledTimes(1);
    expect(updatedForm).toEqual({ ...EMPLOYEE_FORM, role: 'Operator' });
  });

  it('disables employee submission until required fields are present', () => {
    renderEmployeeModal({ employeeForm: { ...EMPLOYEE_FORM, hourlyRate: '' } });

    expect(screen.getByRole('button', { name: 'Add Employee' })).toBeDisabled();
  });

  it('submits and closes through page-owned callbacks', () => {
    const props = renderEmployeeModal();

    fireEvent.click(screen.getByRole('button', { name: 'Add Employee' }));
    fireEvent.click(screen.getByRole('button', { name: 'Close add employee' }));

    expect(props.onAddEmployee).toHaveBeenCalledTimes(1);
    expect(props.onClose).toHaveBeenCalledTimes(1);
  });
});

describe('AddPlantModal', () => {
  it('renders the plant form with dry and wet rate fields', () => {
    renderPlantModal();

    expect(screen.getByRole('dialog', { name: 'Add Plant' })).toBeInTheDocument();
    expect(screen.getByLabelText('Type *')).toHaveValue('Excavator');
    expect(screen.getByLabelText('Description *')).toHaveValue('20T Excavator');
    expect(screen.getByLabelText('ID/Rego')).toHaveValue('EXC-001');
    expect(screen.getByLabelText('Dry Rate *')).toHaveValue(150);
    expect(screen.getByLabelText('Wet Rate')).toHaveValue(200);
    expect(
      screen.getByText('Rates require approval from head contractor before use'),
    ).toBeInTheDocument();
  });

  it('reports plant field changes through the page-owned setter', () => {
    let updatedForm: PlantFormState | null = null;
    const setPlantForm = vi.fn((update) => {
      updatedForm = typeof update === 'function' ? update(PLANT_FORM) : update;
    });
    const props = renderPlantModal({ setPlantForm });

    fireEvent.change(screen.getByLabelText('Type *'), { target: { value: 'Roller' } });

    expect(props.setPlantForm).toHaveBeenCalledTimes(1);
    expect(updatedForm).toEqual({ ...PLANT_FORM, type: 'Roller' });
  });

  it('disables plant submission until required fields are present', () => {
    renderPlantModal({ plantForm: { ...PLANT_FORM, description: '' } });

    expect(screen.getByRole('button', { name: 'Add Plant' })).toBeDisabled();
  });

  it('submits and closes through page-owned callbacks', () => {
    const props = renderPlantModal();

    fireEvent.click(screen.getByRole('button', { name: 'Add Plant' }));
    fireEvent.click(screen.getByRole('button', { name: 'Close add plant' }));

    expect(props.onAddPlant).toHaveBeenCalledTimes(1);
    expect(props.onClose).toHaveBeenCalledTimes(1);
  });
});
