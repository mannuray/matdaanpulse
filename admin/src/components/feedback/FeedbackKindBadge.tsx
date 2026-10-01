import { Badge } from '../ui/Badge';
import { kindMeta } from '../../utils/feedback';

export function FeedbackKindBadge({ kind }: { kind: string }) {
  const { label, tone } = kindMeta(kind);
  return <Badge tone={tone}>{label}</Badge>;
}
