import { Type } from 'class-transformer';
import {
  ArrayMaxSize, ArrayMinSize, IsArray, IsBoolean, IsInt, IsNumber, IsObject, IsOptional, IsString, Matches, Max,
  MaxLength, Min, ValidateBy, ValidateNested, ValidationOptions, buildMessage,
} from 'class-validator';
import { IsSafeUrl, isSafeUrl } from '../../../common/validation/safe-url';

/**
 * The admin manifest draft (PUT /admin/elections/:id/manifest), validated before it is stored and later published
 * into `elections.manifest_url`. Mirrors what the public site reads (frontend ManifestData), the seat analysis reads
 * (common/manifest.ts: alliances, government, vote_splits, leaders, cabinet) and what the seeds and the admin editor
 * write (government, delimitation_era, live_tabs, geo.hex_url). Unknown keys are refused at every level
 * (forbidNonWhitelisted); arrays and strings are capped. No property initializers: they would add keys.
 */

const ID = 64;      // party / alliance / person / seat ids
const TEXT = 200;   // names, labels, roles
const LIST = 200;   // id lists (tracked, alliance parties)

/** A site-relative path (/geo/x.geojson) or an https URL; never javascript:, data:, http: or //host. */
export function isMapUrl(value: unknown): boolean {
  return isSafeUrl(value, true) && ((value as string).startsWith('/') || /^https:\/\//i.test(value as string));
}

function IsMapUrl(validationOptions?: ValidationOptions): PropertyDecorator {
  return ValidateBy({
    name: 'isMapUrl',
    validator: {
      validate: isMapUrl,
      defaultMessage: buildMessage((each) => `${each}$property must be a path starting with / or an https URL`, validationOptions),
    },
  }, validationOptions);
}

const isPlainObject = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const isText = (v: unknown, max = TEXT) => typeof v === 'string' && v.length <= max;
const exactKeys = (o: Record<string, unknown>, keys: string[]) => Object.keys(o).every((k) => keys.includes(k));

/** A map (object) of at most `maxKeys` entries, keys up to 100 chars, each value accepted by `value`. */
function IsBoundedMap(maxKeys: number, value: (v: unknown) => boolean, shape: string, validationOptions?: ValidationOptions): PropertyDecorator {
  return ValidateBy({
    name: 'isBoundedMap',
    validator: {
      validate: (m: unknown) => isPlainObject(m)
        && Object.keys(m).length <= maxKeys
        && Object.entries(m).every(([k, v]) => k.length <= 100 && value(v)),
      defaultMessage: buildMessage(() => `$property must be an object of at most ${maxKeys} entries of ${shape}`, validationOptions),
    },
  }, validationOptions);
}

const isVipSeat = (v: unknown) => isPlainObject(v) && exactKeys(v, ['label', 'candidate']) && isText(v.label) && isText(v.candidate);
const isCount = (n: unknown) => typeof n === 'number' && Number.isFinite(n);
/** const_no → [pre, post] (seeds) or { pre, post } (older admin JSON). */
const isRevisionRow = (v: unknown) => (Array.isArray(v) && v.length === 2 && v.every(isCount))
  || (isPlainObject(v) && exactKeys(v, ['pre', 'post']) && isCount(v.pre) && isCount(v.post));

export class ManifestAllianceDto {
  @IsString() @MaxLength(ID) id: string;
  @IsString() @MaxLength(TEXT) name: string;
  @IsString() @Matches(/^#[0-9a-f]{3,8}$/i, { message: 'color must be a hex colour like #f97316' }) color: string;
  @IsArray() @ArrayMaxSize(LIST) @IsString({ each: true }) @MaxLength(ID, { each: true }) parties: string[];
}

/** A leader / cabinet / watchlist entry. The admin creates empty rows ('' fields) while editing, so they are optional. */
export class ManifestPersonEntryDto {
  @IsOptional() @IsString() @MaxLength(TEXT) name?: string;
  @IsOptional() @IsString() @MaxLength(TEXT) role?: string;
  @IsOptional() @IsString() @MaxLength(ID) party_id?: string;
  @IsOptional() @IsString() @MaxLength(100) const_id?: string;
  @IsOptional() @IsString() @MaxLength(ID) person_id?: string | null;
}

export class ManifestWatchlistDto {
  @IsString() @MaxLength(ID) id: string;
  @IsString() @MaxLength(TEXT) name: string;
  @IsArray() @ArrayMaxSize(1000) @ValidateNested({ each: true }) @Type(() => ManifestPersonEntryDto) entries: ManifestPersonEntryDto[];
}

export class ManifestMilestoneDto {
  @IsString() @MaxLength(TEXT) label: string;
  @IsInt() @Min(0) @Max(100_000) value: number;
}

export class ManifestVoteSplitDto {
  @IsString() @MaxLength(ID) spoiler: string;
  @IsString() @MaxLength(ID) hurts: string;
  @IsOptional() @IsString() @MaxLength(TEXT) label?: string;
}

export class ManifestGeoDto {
  @IsOptional() @IsMapUrl() map_url?: string;
  @IsOptional() @IsMapUrl() hex_url?: string;
  @IsOptional() @IsArray() @ArrayMinSize(2) @ArrayMaxSize(2) @IsNumber({ allowNaN: false, allowInfinity: false }, { each: true }) center?: [number, number];
  @IsOptional() @IsNumber({ allowNaN: false, allowInfinity: false }) @Min(0) @Max(30) zoom?: number;
}

export class ManifestRevisionDto {
  @IsOptional() @IsString() @MaxLength(TEXT) label?: string;
  @IsBoundedMap(1000, isRevisionRow, '[pre, post] or { pre, post } counts') data: Record<string, [number, number] | { pre: number; post: number }>;
}

export class ManifestGovernmentDto {
  @IsArray() @ArrayMaxSize(50) @IsString({ each: true }) @MaxLength(ID, { each: true }) parties: string[];
  @IsOptional() @IsString() @MaxLength(TEXT) label?: string;
  @IsOptional() @IsSafeUrl() source?: string;
}

export class ManifestLiveTabDto {
  @IsString() @MaxLength(TEXT) label: string;
  @IsArray() @ArrayMaxSize(1000) @IsInt({ each: true }) const_nos: number[];
}

export class ManifestDraftDto {
  @IsOptional() @IsArray() @ArrayMaxSize(50) @ValidateNested({ each: true }) @Type(() => ManifestAllianceDto) alliances?: ManifestAllianceDto[];
  @IsOptional() @IsArray() @ArrayMaxSize(200) @ValidateNested({ each: true }) @Type(() => ManifestPersonEntryDto) leaders?: ManifestPersonEntryDto[];
  @IsOptional() @IsArray() @ArrayMaxSize(200) @ValidateNested({ each: true }) @Type(() => ManifestPersonEntryDto) cabinet?: ManifestPersonEntryDto[];
  @IsOptional() @IsArray() @ArrayMaxSize(20) @ValidateNested({ each: true }) @Type(() => ManifestWatchlistDto) watchlists?: ManifestWatchlistDto[];
  @IsOptional() @IsArray() @ArrayMaxSize(LIST) @IsString({ each: true }) @MaxLength(ID, { each: true }) tracked?: string[];
  @IsOptional() @IsBoundedMap(500, isVipSeat, '{ label, candidate }') vip_seats?: Record<string, { label: string; candidate: string }>;
  @IsOptional() @IsArray() @ArrayMaxSize(20) @ValidateNested({ each: true }) @Type(() => ManifestMilestoneDto) milestones?: ManifestMilestoneDto[];
  @IsOptional() @IsBoolean() no_majority?: boolean;
  @IsOptional() @IsArray() @ArrayMaxSize(20) @IsString({ each: true }) @MaxLength(ID, { each: true }) compare_with?: string[];
  @IsOptional() @IsArray() @ArrayMaxSize(20) @ValidateNested({ each: true }) @Type(() => ManifestVoteSplitDto) vote_splits?: ManifestVoteSplitDto[];
  @IsOptional() @IsArray() @ArrayMaxSize(50) @IsString({ each: true }) @MaxLength(ID, { each: true }) history?: string[];
  @IsOptional() @IsArray() @ArrayMaxSize(50) @IsInt({ each: true }) history_years?: number[];
  @IsOptional() @IsObject() @ValidateNested() @Type(() => ManifestGeoDto) geo?: ManifestGeoDto;
  @IsOptional() @IsObject() @ValidateNested() @Type(() => ManifestRevisionDto) revision?: ManifestRevisionDto;
  @IsOptional() @IsObject() @ValidateNested() @Type(() => ManifestGovernmentDto) government?: ManifestGovernmentDto;
  @IsOptional() @IsString() @MaxLength(16) delimitation_era?: string;
  @IsOptional() @IsArray() @ArrayMaxSize(50) @ValidateNested({ each: true }) @Type(() => ManifestLiveTabDto) live_tabs?: ManifestLiveTabDto[];
}

/** The validated draft as plain JSON (class instances → objects) for the JSONB column. */
export function manifestDraftToJson(dto: ManifestDraftDto): Record<string, unknown> {
  return JSON.parse(JSON.stringify(dto));
}
