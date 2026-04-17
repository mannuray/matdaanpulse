import { Controller } from '@nestjs/common';
import { ManifestsService } from './manifests.service';

@Controller('manifests')
export class ManifestsController {
  constructor(private readonly manifestsService: ManifestsService) {}
}
