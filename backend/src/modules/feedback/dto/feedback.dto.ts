import { Transform } from 'class-transformer';
import { IsEmail, IsIn, IsOptional, IsString, Length, MaxLength } from 'class-validator';
import { FEEDBACK_STATUSES, FeedbackStatus } from '../../../common/dto/query.dto';

export const FEEDBACK_KINDS = ['bug', 'data_error', 'suggestion', 'other'] as const;
export type FeedbackKind = (typeof FEEDBACK_KINDS)[number];

export const FEEDBACK_MESSAGE_MIN = 5;
export const FEEDBACK_MESSAGE_MAX = 2000;

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);
/** Trimmed; an empty or whitespace-only string means "not sent". */
const trimToUndefined = ({ value }: { value: unknown }) => {
  if (typeof value !== 'string') return value;
  const t = value.trim();
  return t === '' ? undefined : t;
};

/** POST /feedback — public, unauthenticated. */
export class CreateFeedbackDto {
  @IsIn(FEEDBACK_KINDS)
  kind!: FeedbackKind;

  @Transform(trim) @IsString() @Length(FEEDBACK_MESSAGE_MIN, FEEDBACK_MESSAGE_MAX)
  message!: string;

  @IsOptional() @Transform(trimToUndefined) @IsEmail() @MaxLength(254)
  email?: string;

  /** URL path the viewer came from. */
  @IsOptional() @Transform(trimToUndefined) @IsString() @MaxLength(500)
  page?: string;

  /**
   * Honeypot: hidden in the form, so only bots fill it. A non-empty value gets
   * the normal success response but nothing is stored. No length limit here, so
   * a bot cannot tell it apart by a validation error.
   */
  @IsOptional() @IsString()
  website?: string;
}

/** PATCH /admin/feedback/:id */
export class UpdateFeedbackStatusDto {
  @IsIn(FEEDBACK_STATUSES)
  status!: FeedbackStatus;
}
