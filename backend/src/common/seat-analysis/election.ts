import type { Ctx } from './seat';
import { SCHEMA_VERSION, type ElectionAnalysis, type SeatAnalysis } from './types';
export function analyseElection(ctx: Ctx, _seats: SeatAnalysis[]): ElectionAnalysis {
  return { schema_version: SCHEMA_VERSION, election_id: ctx.input.current.id, prev_election_id: null, prev_any_election_id: null, total_votes: 0,
    parties: [], families: [], flow: [], alliance: null, close_seats: [], narrowing_seats: [], bellwethers: [], breakdowns: { reserved: [], region: [], turnout: [] } };
}
