// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { Input, Select, Textarea } from './Input';
import { Field, FormSection } from './Field';
import { Combobox } from './Combobox';

afterEach(cleanup);

describe('form primitives', () => {
  it('Field labels its control and shows the error inline', () => {
    render(<Field label="Name" error="Name is required"><Input invalid defaultValue="" /></Field>);
    const input = screen.getByLabelText('Name');
    expect(input.getAttribute('aria-invalid')).toBe('true');
    expect(screen.getByRole('alert').textContent).toBe('Name is required');
  });

  it('Select and Textarea are labelled by Field and fire change', () => {
    const onChange = vi.fn();
    render(
      <FormSection title="Details">
        <Field label="Gender"><Select value="" onChange={onChange}><option value="">Not specified</option><option value="Male">Male</option></Select></Field>
        <Field label="Bio"><Textarea defaultValue="x" /></Field>
      </FormSection>,
    );
    expect(screen.getByRole('heading', { name: 'Details' })).toBeTruthy();
    fireEvent.change(screen.getByLabelText('Gender'), { target: { value: 'Male' } });
    expect(onChange).toHaveBeenCalled();
    expect((screen.getByLabelText('Bio') as HTMLTextAreaElement).rows).toBe(4);
  });

  it('Combobox shows the selected label, filters by typing and picks with Enter', () => {
    const onChange = vi.fn();
    render(
      <Combobox label="Seat" value="a" onChange={onChange}
        options={[{ value: 'a', label: '1 Valmiki Nagar' }, { value: 'b', label: '142 Patna Sahib', hint: 'GEN' }]} />,
    );
    const input = screen.getByRole('combobox', { name: 'Seat' }) as HTMLInputElement;
    expect(input.value).toBe('1 Valmiki Nagar');
    fireEvent.focus(input);
    expect(input.getAttribute('aria-expanded')).toBe('true');
    fireEvent.change(input, { target: { value: 'patna' } });
    expect(screen.getAllByRole('option')).toHaveLength(1);
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(onChange).toHaveBeenCalledWith('b');
    expect(input.getAttribute('aria-expanded')).toBe('false');
  });

  it('Combobox Esc closes the list without picking', () => {
    const onChange = vi.fn();
    render(<Combobox label="Seat" value="a" onChange={onChange} options={[{ value: 'a', label: 'A' }, { value: 'b', label: 'B' }]} />);
    const input = screen.getByRole('combobox', { name: 'Seat' });
    fireEvent.focus(input);
    fireEvent.keyDown(input, { key: 'ArrowDown' });
    fireEvent.keyDown(input, { key: 'Escape' });
    expect(input.getAttribute('aria-expanded')).toBe('false');
    expect(onChange).not.toHaveBeenCalled();
  });
});
