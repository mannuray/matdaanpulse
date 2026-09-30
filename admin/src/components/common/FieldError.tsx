import { createContext, useContext } from 'react';

/** Field-level errors (field name -> message) from the last failed save; provided per form page. */
export const FormErrorsContext = createContext<Record<string, string>>({});

export function FieldError({ name }: { name: string }) {
  const message = useContext(FormErrorsContext)[name];
  if (!message) return null;
  return (
    <div role="alert" data-field-error={name} style={{ color: 'var(--color-danger, #c0392b)', fontSize: 12, marginTop: 4 }}>
      {message}
    </div>
  );
}
