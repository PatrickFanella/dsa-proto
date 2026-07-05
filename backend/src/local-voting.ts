import { randomUUID } from 'node:crypto';
import type { DirectoryRepository } from './server.js';

export const syntheticVoters = ['member-alpha', 'member-beta', 'member-gamma'] as const;
export type SyntheticVoterKey = typeof syntheticVoters[number];

export type LocalVotingStatus = { prototype: true; nonProduction: true; eligible: boolean; credentialAvailable: boolean; credentialIssued: boolean; caveat: string };
export type LocalVotingCredentialResponse = { credential: string; expiresAt: string; caveat: string };
export type LocalVotingBallotResponse = { receipt: string; caveat: string };

type IssuedCredential = { credential: string; voterKey: SyntheticVoterKey; proposalUri: string; expiresAt: string; consumed: boolean; locked?: boolean };
type AnonymousBallot = { ballotId: string; proposalUri: string; choiceUri: string };

const LOCAL_CAVEAT = 'Local-only non-production prototype. No real auth, no binding to identity, no cryptographic secrecy, and no revoting.';

export function createLocalVotingService(repository: DirectoryRepository) {
  const issuedCredentials = new Map<string, IssuedCredential>();
  const activeCredentialByScope = new Map<string, string>();
  const votedScopes = new Set<string>();
  const ballots: AnonymousBallot[] = [];

  const makeScope = (voterKey: string, proposalUri: string) => `${voterKey}::${proposalUri}`;

  return {
    async getStatus(voterKey: string | undefined, proposalUri: string | undefined): Promise<LocalVotingStatus> {
      const eligible = Boolean(voterKey && proposalUri && syntheticVoters.includes(voterKey as SyntheticVoterKey) && await repository.getVoteProposal(proposalUri));
      const scope = voterKey && proposalUri ? makeScope(voterKey, proposalUri) : '';
      return { prototype: true, nonProduction: true, eligible, credentialAvailable: Boolean(eligible && scope && !votedScopes.has(scope)), credentialIssued: Boolean(scope && activeCredentialByScope.has(scope)), caveat: LOCAL_CAVEAT };
    },
    async issueCredential(voterKey: string, proposalUri: string): Promise<LocalVotingCredentialResponse | { error: string }> {
      if (!syntheticVoters.includes(voterKey as SyntheticVoterKey)) return { error: 'ineligible_voter' };
      const proposal = await repository.getVoteProposal(proposalUri);
      if (!proposal) return { error: 'proposal_not_found' };
      const scope = makeScope(voterKey, proposalUri);
      if (votedScopes.has(scope)) return { error: 'already_voted' };
      const existing = activeCredentialByScope.get(scope);
      if (existing) {
        const credential = issuedCredentials.get(existing);
        if (credential && !credential.consumed && new Date(credential.expiresAt) > new Date()) return { credential: credential.credential, expiresAt: credential.expiresAt, caveat: LOCAL_CAVEAT };
      }
      const credential = `lv_${randomUUID()}`;
      const expiresAt = new Date(Date.now() + 30 * 60 * 1000).toISOString();
      issuedCredentials.set(credential, { credential, voterKey: voterKey as SyntheticVoterKey, proposalUri, expiresAt, consumed: false });
      activeCredentialByScope.set(scope, credential);
      return { credential, expiresAt, caveat: LOCAL_CAVEAT };
    },
    async submitBallot(credential: string, proposalUri: string, choiceUri: string): Promise<LocalVotingBallotResponse | { error: string }> {
      const issued = issuedCredentials.get(credential);
      if (!issued) return { error: 'invalid_credential' };
      if (issued.consumed) return { error: 'credential_consumed' };
      if (issued.locked) return { error: 'credential_consumed' };
      if (new Date(issued.expiresAt) <= new Date()) return { error: 'credential_expired' };
      if (issued.proposalUri !== proposalUri) return { error: 'proposal_mismatch' };
      issued.locked = true;
      const proposal = await repository.getVoteProposal(proposalUri);
      const choice = await repository.getVoteChoice(choiceUri);
      if (!proposal || !choice || choice.proposalUri !== proposalUri) { issued.locked = false; return { error: 'invalid_choice' }; }
      issued.consumed = true;
      issued.locked = false;
      votedScopes.add(makeScope(issued.voterKey, proposalUri));
      const ballot: AnonymousBallot = { ballotId: `ballot_${randomUUID()}`, proposalUri, choiceUri };
      ballots.push(ballot);
      return { receipt: `receipt_${randomUUID()}`, caveat: LOCAL_CAVEAT };
    },
    getAnonymousBallots() { return ballots.map((ballot) => ({ ...ballot })); },
  };
}
