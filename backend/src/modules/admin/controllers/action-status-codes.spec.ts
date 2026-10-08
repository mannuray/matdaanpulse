import 'reflect-metadata';
import { HTTP_CODE_METADATA } from '@nestjs/common/constants';
import { AuthController } from '../../auth/auth.controller';
import { AdminPersonsController } from './admin-persons.controller';
import { AdminCandidatesController } from './admin-candidates.controller';
import { AdminConstituenciesController } from './admin-constituencies.controller';
import { AdminElectionsController } from './admin-elections.controller';

const code = (ctrl: { prototype: object }, method: string) =>
  Reflect.getMetadata(HTTP_CODE_METADATA, (ctrl.prototype as Record<string, object>)[method]);

describe('action POSTs answer 200, not 201 (they create no resource at their URL)', () => {
  it.each([
    ['POST /auth/login', AuthController, 'login'],
    ['POST /admin/persons/merge', AdminPersonsController, 'mergePersons'],
    ['POST /admin/persons/merges/:id/undo', AdminPersonsController, 'undoMerge'],
    ['POST /admin/candidates/:id/split', AdminCandidatesController, 'split'],
    ['POST /admin/constituencies/bulk-tag', AdminConstituenciesController, 'bulkTag'],
    ['POST /admin/constituencies/analysis/compute/:electionId', AdminConstituenciesController, 'computeAnalysis'],
    ['POST /admin/elections/:id/finalize', AdminElectionsController, 'finalizeElection'],
    ['POST /admin/elections/:id/reopen', AdminElectionsController, 'reopenElection'],
    ['POST /admin/elections/:id/manifest/publish', AdminElectionsController, 'publishManifest'],
  ])('%s', (_route, ctrl, method) => {
    expect(code(ctrl, method)).toBe(200);
  });

  it('creating POSTs keep 201', () => {
    expect(code(AdminPersonsController, 'createPerson')).toBeUndefined();
    expect(code(AdminCandidatesController, 'create')).toBeUndefined();
    expect(code(AdminElectionsController, 'createElection')).toBeUndefined();
  });
});
