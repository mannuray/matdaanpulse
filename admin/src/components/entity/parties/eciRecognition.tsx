import { Badge, type Tone } from '../../ui/Badge';
import type { EciRecognition } from '../../../types';

/** `parties.eci_recognition` values, in select order (null = not set). */
export const ECI_RECOGNITIONS: EciRecognition[] = ['National', 'State', 'Unrecognised'];

/** List filter: everything, one recognition, or 'none' for parties with none set. */
export type EciFilter = 'all' | EciRecognition | 'none';
export const isEciFilter = (v: unknown): v is EciFilter => v === 'all' || v === 'none' || ECI_RECOGNITIONS.includes(v as EciRecognition);

const TONE: Record<EciRecognition, Tone> = { National: 'accent', State: 'ok', Unrecognised: 'muted' };

export function EciRecognitionBadge({ value }: { value: EciRecognition }) {
  return <Badge tone={TONE[value]}>{value}</Badge>;
}
