import { BadRequestException, PipeTransform } from '@nestjs/common';

/** One string route param checked against an id shape (common/validation/ids): a malformed one is a 400 before any query. */
export class IdParamPipe implements PipeTransform<unknown, string> {
  constructor(private readonly re: RegExp, private readonly max: number, private readonly label: string) {}

  transform(value: unknown): string {
    if (typeof value !== 'string' || value.length === 0 || value.length > this.max || !this.re.test(value)) {
      throw new BadRequestException(`Invalid ${this.label}`);
    }
    return value;
  }
}
