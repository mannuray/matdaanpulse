import { IsIn, IsNotEmpty, IsString, MaxLength } from 'class-validator';
import { MEDIA_KINDS, MAX_OWNER_ID, type MediaKind } from '../media-validation';

export class UploadMediaDto {
  @IsIn(MEDIA_KINDS as unknown as string[]) kind: MediaKind;
  @IsString() @IsNotEmpty() @MaxLength(MAX_OWNER_ID) owner_id: string;
}
