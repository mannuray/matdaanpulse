import type { SeoApi } from '../api';
import type { Route } from '../routes';
import type { SeoPage } from '../types';
import { constituencyPage } from './constituency';
import { electionPage } from './election';
import { partyPage } from './party';
import { personPage } from './person';
import { aboutPage, homePage, notFoundPage } from './simple';

/** API failures propagate (the handler turns NotFound into a 404 and anything else into the fallback). */
export function buildPage(route: Route, api: SeoApi): Promise<SeoPage> {
  switch (route.kind) {
    case 'home': return homePage(api);
    case 'about': return Promise.resolve(aboutPage());
    case 'election': return electionPage(api, route.electionId);
    case 'constituency': return constituencyPage(api, route.electionId, route.constId);
    case 'person': return personPage(api, route.personId);
    case 'party': return partyPage(api, route.partyId, route.state);
    default: return Promise.resolve(notFoundPage());
  }
}
