import { IsIn, Matches } from 'class-validator';
import { MEDIA_KINDS, OWNER_ID, type MediaKind } from '../media-validation';

export class UploadMediaDto {
  @IsIn(MEDIA_KINDS as unknown as string[]) kind: MediaKind;
  @Matches(OWNER_ID) owner_id: string;
}
