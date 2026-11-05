/**
 * Central access to JSON under /testdata — example values for Pact matchers + Jest expects.
 */
import defaults from '../../testdata/common/defaults.json';
import envelope from '../../testdata/common/envelope.json';
import emptyPeer from '../../testdata/common/empty-peer.json';

import clmHealth from '../../testdata/clm/health.json';
import clmContractsCatalog from '../../testdata/clm/contracts-catalog.json';
import clmEngagementContext from '../../testdata/clm/engagement-context.json';
import clmDownstreamMdm from '../../testdata/clm/downstream-mdm.json';
import clmV2Status from '../../testdata/clm/v2-status.json';

import mdmHealth from '../../testdata/mdm/health.json';
import mdmCt01 from '../../testdata/mdm/ct-01-entities.json';
import mdmCt02 from '../../testdata/mdm/ct-02-tax-attributes.json';
import mdmCt03 from '../../testdata/mdm/ct-03-ownership.json';
import mdmCt04 from '../../testdata/mdm/ct-04-filing-meta.json';

import gatewayFiling from '../../testdata/gateway/filing-mutations.json';
import gatewayHealth from '../../testdata/gateway/health.json';
import gatewayFilingGets from '../../testdata/gateway/filing-gets.json';

import ct00 from '../../testdata/contracts/CT-00.json';
import ct01 from '../../testdata/contracts/CT-01.json';
import ct02 from '../../testdata/contracts/CT-02.json';
import ct03 from '../../testdata/contracts/CT-03.json';
import ct04 from '../../testdata/contracts/CT-04.json';
import ct05 from '../../testdata/contracts/CT-05.json';
import ct06 from '../../testdata/contracts/CT-06.json';
import ct07 from '../../testdata/contracts/CT-07.json';
import ct08 from '../../testdata/contracts/CT-08.json';
import ct09 from '../../testdata/contracts/CT-09.json';
import ct10 from '../../testdata/contracts/CT-10.json';
import ct11 from '../../testdata/contracts/CT-11.json';
import ct12 from '../../testdata/contracts/CT-12.json';
import ct13 from '../../testdata/contracts/CT-13.json';
import ct14 from '../../testdata/contracts/CT-14.json';
import ct15 from '../../testdata/contracts/CT-15.json';
import ct16 from '../../testdata/contracts/CT-16.json';
import ct17 from '../../testdata/contracts/CT-17.json';

export const testDefaults = defaults;
export const testEnvelope = envelope;
export const emptyPeerCases = emptyPeer;

export const clm = {
  health: clmHealth,
  contractsCatalog: clmContractsCatalog,
  engagementContext: clmEngagementContext,
  downstreamMdm: clmDownstreamMdm,
  v2Status: clmV2Status,
} as const;

export const mdm = {
  health: mdmHealth,
  ct01: mdmCt01,
  ct02: mdmCt02,
  ct03: mdmCt03,
  ct04: mdmCt04,
} as const;

export const gateway = {
  filing: gatewayFiling,
  health: gatewayHealth,
  filingGets: gatewayFilingGets,
} as const;

/** CT-00…CT-17 producer payload samples (no service envelope). */
export const contractPayloads: Record<string, Record<string, unknown>> = {
  'CT-00': ct00,
  'CT-01': ct01,
  'CT-02': ct02,
  'CT-03': ct03,
  'CT-04': ct04,
  'CT-05': ct05,
  'CT-06': ct06,
  'CT-07': ct07,
  'CT-08': ct08,
  'CT-09': ct09,
  'CT-10': ct10,
  'CT-11': ct11,
  'CT-12': ct12,
  'CT-13': ct13,
  'CT-14': ct14,
  'CT-15': ct15,
  'CT-16': ct16,
  'CT-17': ct17,
};
