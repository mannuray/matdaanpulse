import { ExternalLink } from 'lucide-react';
import { usePartyEdit, type PartyForm } from '../../../hooks/usePartyEdit';
import { useUnsavedGuard } from '../../../hooks/useUnsavedGuard';
import { Sheet } from '../../ui/Sheet';
import { Field, FormSection } from '../../ui/Field';
import { Input, Textarea } from '../../ui/Input';
import { EmptyState } from '../../ui/EmptyState';
import { PanelFooter } from '../PanelFooter';
import { ColourField } from './ColourField';
import { SymbolField } from './SymbolField';

interface PartyPanelProps {
  id: string;
  /** From the list row; getParty does not return it. */
  candidateCount?: number;
  onClose: () => void;
  onSaved: () => void;
}

/** Party record: the whole profile as one form, plus logo / ECI symbol. The page keys it by id. */
export function PartyPanel({ id, candidateCount, onClose, onSaved }: PartyPanelProps) {
  const ed = usePartyEdit(id);
  const { party, form, setForm, fieldErrors } = ed;
  useUnsavedGuard(ed.dirty);

  const set = (patch: Partial<PartyForm>) => setForm({ ...form, ...patch });
  const nameError = form.name.trim() ? fieldErrors.name : 'Name is required';
  const save = async () => { if (await ed.handleSave()) onSaved(); };
  const subtitle = party
    ? [party.id, candidateCount !== undefined ? `${candidateCount.toLocaleString('en-IN')} candidates` : null].filter(Boolean).join(' · ')
    : undefined;
  const logo = form.symbol_url || form.eci_symbol_url;

  return (
    <Sheet
      open
      onRequestClose={onClose}
      title={party?.name ?? 'Party'}
      description={subtitle}
      footer={party ? <PanelFooter dirty={ed.dirty} saving={ed.saving} canSave={!!form.name.trim()} onCancel={ed.reset} onSave={save} /> : undefined}
    >
      {!party ? (
        ed.loading
          ? <p className="py-10 text-center text-sm text-muted">Loading party…</p>
          : <EmptyState title="Party not found" description="It may have been removed. Close this panel to go back to the list." />
      ) : (
        <div className="space-y-5">
          <div className="flex items-center gap-3">
            <span className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-card border border-line bg-card p-1.5">
              {logo
                ? <img src={logo} alt="" className="max-h-full max-w-full object-contain" />
                : <span className="text-sm font-semibold" style={{ color: form.color || undefined }}>{form.abbreviation || party.id.slice(0, 3)}</span>}
            </span>
            <div className="flex flex-wrap gap-3 text-xs">
              {form.website && (
                <a href={form.website} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-accent hover:underline">
                  Website <ExternalLink size={12} aria-hidden />
                </a>
              )}
              {form.wikipedia_url && (
                <a href={form.wikipedia_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-accent hover:underline">
                  Wikipedia <ExternalLink size={12} aria-hidden />
                </a>
              )}
            </div>
          </div>

          <FormSection title="Details">
            <Field label="Name" error={nameError}>
              <Input value={form.name} invalid={!!nameError} onChange={(e) => set({ name: e.target.value })} />
            </Field>
            {/* Single column (decisions.md): every field stacked, symbols below. */}
            <Field label="Abbreviation" error={fieldErrors.abbreviation}>
              <Input value={form.abbreviation} onChange={(e) => set({ abbreviation: e.target.value.toUpperCase() })} />
            </Field>
            <ColourField value={form.color} error={fieldErrors.color} onChange={(color) => set({ color })} />
            <Field label="Leader" error={fieldErrors.leader_name}>
              <Input value={form.leader_name} onChange={(e) => set({ leader_name: e.target.value })} />
            </Field>
            <Field label="Founded year" error={fieldErrors.founded_year}>
              <Input inputMode="numeric" value={form.founded_year} onChange={(e) => set({ founded_year: e.target.value })} />
            </Field>
            <Field label="Headquarters" error={fieldErrors.headquarters}>
              <Input value={form.headquarters} onChange={(e) => set({ headquarters: e.target.value })} />
            </Field>
            <Field label="Website" error={fieldErrors.website}>
              <Input value={form.website} placeholder="https://…" onChange={(e) => set({ website: e.target.value })} />
            </Field>
            <Field label="Wikipedia URL" error={fieldErrors.wikipedia_url}>
              <Input value={form.wikipedia_url} placeholder="https://en.wikipedia.org/wiki/…" onChange={(e) => set({ wikipedia_url: e.target.value })} />
            </Field>
            <Field label="Description" error={fieldErrors.description}>
              <Textarea rows={5} value={form.description} onChange={(e) => set({ description: e.target.value })} />
            </Field>
          </FormSection>

          <FormSection title="Symbols">
            <SymbolField label="Logo URL" url={form.symbol_url} error={fieldErrors.symbol_url} onChange={(symbol_url) => set({ symbol_url })} />
            <SymbolField label="ECI symbol URL" url={form.eci_symbol_url} error={fieldErrors.eci_symbol_url} onChange={(eci_symbol_url) => set({ eci_symbol_url })} />
          </FormSection>
        </div>
      )}
    </Sheet>
  );
}
