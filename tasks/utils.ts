import { AlgebraFactoryUpgradeable, AlgebraPool } from '@cryptoalgebra/integral-core/typechain';
import {
  BribeFactoryUpgradeable,
  FeesVaultFactoryUpgradeable,
  Fenix,
  GaugeFactoryUpgradeable,
  IBlastFull,
  MinimalLinearVestingUpgradeable,
  MinterUpgradeable,
  Pair,
  PairFactoryUpgradeable,
  VeBoostUpgradeable,
  VeFnxSplitMerklAidropUpgradeable,
  VoterUpgradeableV2,
  VotingEscrowUpgradeableV2,
} from '../typechain-types';
import { formatEther } from 'ethers';
import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { InstanceName } from '../utils/Names';
import { GaugeType } from '../utils/Constants';
import { bigint } from 'hardhat/internal/core/params/argumentTypes';

export type PairFactoryState = {
  address: string;
  protocolFee: bigint;
  protocolFeePercent: string;
  stableFee: bigint;
  stableFeePercent: string;
  volatilityFee: bigint;
  volatilityFeePercent: string;
  implementation: string;
  communityVaultFactory: string;
  rebasingTokensGovernor: string;
  defaultBlastGovernor: string;
  defaultBlastPoints: string;
  defaultBlastPointsOperator: string;
  isPaused: boolean;
  isPublicPoolCreationMode: boolean;
  pairs: string[];
  allPairsLength: bigint;
};

export type PairProtocolFeeState = {
  protocolFee: bigint;
  protocolFeePercent: string;
  isCustom: boolean;
};

export type PairState = {
  address: string;
  name: string;
  symbol: string;
  token0: string;
  token1: string;
  fees: string;
  reserve0: bigint;
  reserve1: bigint;
  stable: boolean;
  totalSupply: bigint;
  communityVault: string;
  protocolFeeState: PairProtocolFeeState;
  feesVaultInfo: FeesVaultInfo;
};

interface FeesVaultInfo {
  address: string;
  creator: string;
  distributionConfig: DistributionConfig;
}

interface DistributionConfig {
  toGaugeRate: bigint;
  recipients: string[];
  rates: bigint[];
}

export async function getPairState(
  pairFactory: PairFactoryUpgradeable,
  feesVaultFactory: FeesVaultFactoryUpgradeable,
  pair: Pair,
): Promise<PairState> {
  const [name, symbol, token0, token1, fees, reserves, stable, totalSupply, communityVault] = await Promise.all([
    pair.name(),
    pair.symbol(),
    pair.token0(),
    pair.token1(),
    pair.fees(),
    pair.getReserves(),
    pair.stable(),
    pair.totalSupply(),
    pair.communityVault(),
  ]);
  const standardProtocolFee = await pairFactory.protocolFee();
  const customFee = await pairFactory.getProtocolFee(pair.target);
  const isCustom = customFee !== standardProtocolFee;

  const vaultAddress = await feesVaultFactory.getVaultForPool(pair.target);
  const creator = await feesVaultFactory.getFeesVaultCreator(vaultAddress);
  const [toGaugeRate, recipients, rates] = await feesVaultFactory.getDistributionConfig(vaultAddress);

  return {
    address: pair.target.toString(),
    name,
    symbol,
    token0,
    token1,
    fees,
    reserve0: reserves[0],
    reserve1: reserves[1],
    stable,
    totalSupply,
    communityVault,
    protocolFeeState: {
      protocolFee: customFee,
      protocolFeePercent: Number(customFee) / 100 + '%',
      isCustom,
    },
    feesVaultInfo: {
      address: vaultAddress,
      creator,
      distributionConfig: { toGaugeRate, recipients, rates },
    },
  };
}

export async function getPairFactoryState(pairFactory: PairFactoryUpgradeable): Promise<PairFactoryState> {
  const [
    protocolFee,
    stableFee,
    volatilityFee,
    implementation,
    communityVaultFactory,
    rebasingTokensGovernor,
    isPaused,
    isPublicPoolCreationMode,
    allPairsLength,
    pairs,
    defaultBlastGovernor,
    defaultBlastPoints,
    defaultBlastPointsOperator,
  ] = await Promise.all([
    pairFactory.protocolFee(),
    pairFactory.stableFee(),
    pairFactory.volatileFee(),
    pairFactory.implementation(),
    pairFactory.communityVaultFactory(),
    pairFactory.rebasingTokensGovernor(),
    pairFactory.isPaused(),
    pairFactory.isPublicPoolCreationMode(),
    pairFactory.allPairsLength(),
    pairFactory.pairs(),
    pairFactory.defaultBlastGovernor(),
    pairFactory.defaultBlastPoints(),
    pairFactory.defaultBlastPointsOperator(),
  ]);

  return {
    address: pairFactory.target.toString(),
    protocolFee,
    protocolFeePercent: Number(protocolFee) / 100 + '%',
    stableFee,
    stableFeePercent: Number(stableFee) / 100 + '%',
    volatilityFee,
    volatilityFeePercent: Number(volatilityFee) / 100 + '%',
    implementation,
    communityVaultFactory,
    rebasingTokensGovernor,
    isPaused,
    isPublicPoolCreationMode,
    pairs,
    allPairsLength,
    defaultBlastGovernor,
    defaultBlastPoints,
    defaultBlastPointsOperator,
  };
}
export type BribeFactoryState = {
  address: string;
  owner: string;
  bribeOwner: string;
  voter: string;
  bribeImplementation: string;
  defaultBlastGovernor: string;
  defaultRewardTokens: string[];
  defaultRewardTokensSymbols: string[];
};

export async function getBribeFactoryState(
  hre: HardhatRuntimeEnvironment,
  bribeFactory: BribeFactoryUpgradeable,
): Promise<BribeFactoryState> {
  const [owner, bribeOwner, voter, bribeImplementation, defaultBlastGovernor, defaultRewardTokens] = await Promise.all([
    bribeFactory.owner(),
    bribeFactory.bribeOwner(),
    bribeFactory.voter(),
    bribeFactory.bribeImplementation(),
    bribeFactory.defaultBlastGovernor(),
    bribeFactory.getDefaultRewardTokens(),
  ]);

  const defaultRewardTokensSymbols = await Promise.all(
    defaultRewardTokens.map(async (token) => {
      const erc20 = await hre.ethers.getContractAt(['function symbol() view returns (string)'], token);
      return erc20.symbol();
    }),
  );

  return {
    address: bribeFactory.target.toString(),
    owner,
    bribeOwner,
    voter,
    bribeImplementation,
    defaultBlastGovernor,
    defaultRewardTokens,
    defaultRewardTokensSymbols,
  };
}

export type VeBoostState = {
  address: string;
  owner: string;
  minLockedTimeForBoost: bigint;
  minLockedTimeForBoostFormmated: string;
  boostFNXPercentage: bigint;
  boostFNXPercentageFormmated: string;
  priceProvider: string;
  minUSDAmount: bigint;
  minUSDAmountFormmated: string;
  priceProviderState: {
    address: string;
    fnx: string;
    usd: string;
    pool: string;
    usdToFnxPrice: bigint;
    usdToFnxPriceFormmated: string;
    currentTick: bigint;
  };
};
export async function getVeBoostState(hre: HardhatRuntimeEnvironment, veBoost: VeBoostUpgradeable): Promise<VeBoostState> {
  const [owner, minLockedTimeForBoost, boostFNXPercentage, priceProvider, minUSDAmount] = await Promise.all([
    veBoost.owner(),
    veBoost.getMinLockedTimeForBoost(),
    veBoost.getBoostFNXPercentage(),
    veBoost.priceProvider(),
    veBoost.minUSDAmount(),
  ]);

  let pp = await hre.ethers.getContractAt(InstanceName.AlgebraFNXPriceProviderUpgradeable, priceProvider);

  const [ppFNX, ppUSD, ppPool, usdToFnxPrice, currentTick] = await Promise.all([
    pp.FNX(),
    pp.USD(),
    pp.pool(),
    pp.getUsdToFNXPrice(),
    pp.currentTick(),
  ]);

  return {
    address: veBoost.target.toString(),
    owner,
    minLockedTimeForBoost,
    minLockedTimeForBoostFormmated: Number(minLockedTimeForBoost) / 86400 + ' days',
    boostFNXPercentage,
    boostFNXPercentageFormmated: Number(boostFNXPercentage) / 100 + '%',
    priceProvider,
    minUSDAmount,
    minUSDAmountFormmated: formatEther(minUSDAmount),
    priceProviderState: {
      address: pp.target.toString(),
      currentTick: currentTick,
      fnx: ppFNX,
      usd: ppUSD,
      pool: ppPool,
      usdToFnxPrice: usdToFnxPrice,
      usdToFnxPriceFormmated: formatEther(usdToFnxPrice),
    },
  };
}

export type TokenState = {
  address: string;
  name: string;
  symbol: string;
  totalSupply: string;
  totalSupplyFormmated: string;
  owner: string;
};
export async function getFenixState(fenix: Fenix): Promise<TokenState> {
  const [name, symbol, totalSupply, owner] = await Promise.all([fenix.name(), fenix.symbol(), fenix.totalSupply(), fenix.owner()]);
  return {
    address: fenix.target.toString(),
    name,
    symbol,
    totalSupply: totalSupply.toString(),
    totalSupplyFormmated: formatEther(totalSupply) + ' ' + symbol,
    owner,
  };
}

export type MinterState = {
  address: string;
  isFirstMint: boolean;
  isStarted: boolean;
  decayRate: bigint;
  decayRatePercent: string;
  inflationRate: bigint;
  inflationRatePercent: string;
  inflationPeriodCount: bigint;
  teamRate: bigint;
  teamRatePercent: string;
  weekly: bigint;
  weeklyFormmated: string;
  activePeriod: bigint;
  lastInflationPeriod: bigint;
  fenix: string;
  voter: string;
  ve: string;
  owner: string;
  check: boolean;
  period: bigint;
};
export async function getMinterState(minter: MinterUpgradeable): Promise<MinterState> {
  const [
    isFirstMint,
    isStarted,
    decayRate,
    inflationRate,
    inflationPeriodCount,
    teamRate,
    weekly,
    activePeriod,
    lastInflationPeriod,
    fenix,
    voter,
    ve,
    owner,
    check,
    period,
  ] = await Promise.all([
    minter.isFirstMint(),
    minter.isStarted(),
    minter.decayRate(),
    minter.inflationRate(),
    minter.inflationPeriodCount(),
    minter.teamRate(),
    minter.weekly(),
    minter.active_period(),
    minter.lastInflationPeriod(),
    minter.fenix(),
    minter.voter(),
    minter.ve(),
    minter.owner(),
    minter.check(),
    minter.period(),
  ]);

  return {
    address: minter.target.toString(),
    isFirstMint,
    isStarted,
    decayRate,
    decayRatePercent: Number(decayRate) / 100 + '%',
    inflationRate,
    inflationRatePercent: Number(inflationRate) / 100 + '%',
    inflationPeriodCount,
    teamRate,
    teamRatePercent: Number(teamRate) / 100 + '%',
    weekly,
    weeklyFormmated: formatEther(weekly) + ' FNX',
    activePeriod,
    lastInflationPeriod,
    fenix,
    voter,
    ve,
    owner,
    check,
    period,
  };
}

export type AlgebraFactoryState = {
  address: string;
  poolDeployer: string;
  defaultBlastGovernor: string;
  rebasingTokensGovernor: string;
  defaultBlastPoints: string;
  defaultBlastPointsOperator: string;
  isPublicPoolCreationMode: boolean;
  defaultCommunityFee: bigint;
  defaultCommunityFeeFormmated: string;
  defaultFee: bigint;
  defaultFeeFormmated: string;
  defaultTickspacing: bigint;
  renounceOwnershipStartTimestamp: bigint;
  defaultPluginFactory: string;
  vaultFactory: string;
  owner: string;
  pools: string[];
};

export async function getPools(graphUrl: string) {
  const query = `
  query MyQuery {
    pools(first: 1000, orderBy: createdAtTimestamp) {
      id
    }
  }
`;
  const response = await fetch(graphUrl, {
    method: 'POST',
    headers: {
      Accept: 'application/graphql-response+json, application/json, multipart/mixed',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      query: query,
      operationName: 'MyQuery',
      extensions: {},
    }),
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch data: ${response.statusText}`);
  }

  const result = await response.json();

  if (result.errors) {
    console.error('GraphQL Errors:', result.errors);
    throw new Error('GraphQL query failed');
  }

  return result.data.pools.map((t: any) => t.id);
}
export async function getAlgebraFactoryState(algebraFactory: AlgebraFactoryUpgradeable): Promise<AlgebraFactoryState> {
  const [
    poolDeployer,
    defaultBlastGovernor,
    rebasingTokensGovernor,
    defaultBlastPoints,
    defaultBlastPointsOperator,
    isPublicPoolCreationMode,
    defaultCommunityFee,
    defaultFee,
    defaultTickspacing,
    renounceOwnershipStartTimestamp,
    defaultPluginFactory,
    vaultFactory,
    owner,
  ] = await Promise.all([
    algebraFactory.poolDeployer(),
    algebraFactory.defaultBlastGovernor(),
    'not setup', //algebraFactory.rebasingTokensGovernor(),
    algebraFactory.defaultBlastPoints(),
    algebraFactory.defaultBlastPointsOperator(),
    algebraFactory.isPublicPoolCreationMode(),
    algebraFactory.defaultCommunityFee(),
    algebraFactory.defaultFee(),
    algebraFactory.defaultTickspacing(),
    algebraFactory.renounceOwnershipStartTimestamp(),
    algebraFactory.defaultPluginFactory(),
    algebraFactory.vaultFactory(),
    algebraFactory.owner(),
  ]);

  return {
    address: algebraFactory.target.toString(),
    poolDeployer,
    defaultBlastGovernor,
    rebasingTokensGovernor,
    defaultBlastPoints,
    defaultBlastPointsOperator,
    isPublicPoolCreationMode,
    defaultCommunityFee,
    defaultCommunityFeeFormmated: (Number(defaultCommunityFee) / 1e3) * 100 + '%',
    defaultFee,
    defaultFeeFormmated: (Number(defaultFee) / 1e6) * 100 + '%',
    defaultTickspacing,
    renounceOwnershipStartTimestamp,
    defaultPluginFactory,
    vaultFactory,
    owner,
    pools: [],
  };
}

export interface PoolState {
  address: string;
  name: string;
  initialized: boolean;
  price: bigint;
  tick: bigint;
  lastFee: bigint;
  lastFeePercent: string;
  pluginConfig: bigint;
  communityFee: bigint;
  communityFeePercent: string;
  unlocked: boolean;
  liquidity: bigint;
  totalFeeGrowth0Token: bigint;
  totalFeeGrowth1Token: bigint;
  communityFeePending0: bigint;
  communityFeePending1: bigint;
  token0: string;
  token1: string;
  plugin: string;
  communityVault: string;
  tickSpacing: bigint;
  protocolFeeState: PairProtocolFeeState;
  feesVaultInfo: FeesVaultInfo;
}

export async function getPoolState(
  hre: HardhatRuntimeEnvironment,
  algebraFactory: AlgebraFactoryUpgradeable,
  feesVaultFactory: FeesVaultFactoryUpgradeable,
  pool: AlgebraPool,
): Promise<PoolState> {
  const [
    { price, tick, lastFee, pluginConfig, communityFee, unlocked },
    totalFeeGrowth0Token,
    totalFeeGrowth1Token,
    [communityFeePending0, communityFeePending1],
    token0,
    token1,
    plugin,
    communityVault,
    liquidity,
    tickSpacing,
  ] = await Promise.all([
    pool.globalState(),
    pool.totalFeeGrowth0Token(),
    pool.totalFeeGrowth1Token(),
    pool.getCommunityFeePending(),
    pool.token0(),
    pool.token1(),
    pool.plugin(),
    pool.communityVault(),
    pool.liquidity(),
    pool.tickSpacing(),
  ]);

  const standardProtocolFee = await algebraFactory.defaultCommunityFee();
  const isCustom = communityFee !== standardProtocolFee;

  const vaultAddress = await feesVaultFactory.getVaultForPool(pool.target);
  const creator = await feesVaultFactory.getFeesVaultCreator(vaultAddress);
  const [toGaugeRate, recipients, rates] = await feesVaultFactory.getDistributionConfig(vaultAddress);

  const name =
    (await (await hre.ethers.getContractAt('ERC20', token0)).symbol()) +
    '/' +
    (await (await hre.ethers.getContractAt('ERC20', token1)).symbol());
  return {
    address: pool.target.toString(),
    name,
    initialized: price != 0n,
    price,
    tick,
    lastFee,
    lastFeePercent: (Number(lastFee) / 1e6) * 100 + '%',
    pluginConfig,
    communityFee,
    communityFeePercent: (Number(communityFee) / 1e3) * 100 + '%',
    unlocked,
    liquidity,
    totalFeeGrowth0Token,
    totalFeeGrowth1Token,
    communityFeePending0,
    communityFeePending1,
    token0,
    token1,
    plugin,
    communityVault,
    tickSpacing,
    protocolFeeState: {
      protocolFee: communityFee,
      protocolFeePercent: (Number(communityFee) / 1e3) * 100 + '%',
      isCustom,
    },
    feesVaultInfo: {
      address: vaultAddress,
      creator,
      distributionConfig: { toGaugeRate, recipients, rates },
    },
  };
}

export async function getBlastGovernor(blast: IBlastFull, list: string[]): Promise<{ [key: string]: any }> {
  const uniqueList = Array.from(new Set(list));
  const result: { [key: string]: any } = {};

  for (let i = 0; i < uniqueList.length; i++) {
    const address = uniqueList[i];
    try {
      const governor = await blast.governorMap(address);
      result[address] = governor;
    } catch (error) {
      console.error(`Failed to get governor for address ${address}:`, error);
    }
  }

  return result;
}

export type MinimalLinearVestingState = {
  address: string;
  owner: string;
  token: string;
  startTimestamp: bigint;
  startTimestampFormmated: string;
  duration: bigint;
  durationFormatted: string;
  totalAllocated: bigint;
  isClaimPhase: boolean;
};

export async function getMinimalLinearVestingState(
  minimalLinearVesting: MinimalLinearVestingUpgradeable,
): Promise<MinimalLinearVestingState> {
  const [owner, token, startTimestamp, duration, totalAllocated, isClaimPhase] = await Promise.all([
    minimalLinearVesting.owner(),
    minimalLinearVesting.token(),
    minimalLinearVesting.startTimestamp(),
    minimalLinearVesting.duration(),
    minimalLinearVesting.totalAllocated(),
    minimalLinearVesting.isClaimPhase(),
  ]);

  return {
    address: minimalLinearVesting.target.toString(),
    owner,
    token,
    startTimestamp,
    startTimestampFormmated: new Date(Number(startTimestamp) * 1000).toUTCString(),
    duration,
    durationFormatted: Number(duration) / 86400 + ' days',
    totalAllocated,
    isClaimPhase,
  };
}

export type VeFnxSplitMerklAidropState = {
  address: string;
  owner: string;
  token: string;
  votingEscrow: string;
  pureTokensRate: bigint;
  pureTokensRateFormatted: string;
  merklRoot: string;
  isPaused: boolean;
};
export async function getVeFnxSplitMerklAidropState(veFnxSplit: VeFnxSplitMerklAidropUpgradeable): Promise<VeFnxSplitMerklAidropState> {
  const [owner, token, votingEscrow, isPaused, merklRoot] = await Promise.all([
    veFnxSplit.owner(),
    veFnxSplit.token(),
    veFnxSplit.votingEscrow(),
    veFnxSplit.paused(),
    veFnxSplit.merklRoot(),
  ]);
  let pureTokensRate = 0n;
  try {
    pureTokensRate = await veFnxSplit.pureTokensRate();
  } catch {}

  return {
    address: veFnxSplit.target.toString(),
    owner,
    token,
    votingEscrow,
    pureTokensRate,
    pureTokensRateFormatted: formatEther(pureTokensRate * 100n) + '%',
    merklRoot,
    isPaused,
  };
}

export type VoterUpgradeableState = {
  address: string;
  votingEscrow: string;
  token: string;
  minter: string;
  bribeFactory: string;
  v2PoolFactory: string;
  v3PoolFactory: string;
  v2GaugeFactory: string;
  v3GaugeFactory: string;
  merklDistributor: string;
  veFnxMerklAidrop: string;
  index: bigint;
  voteDelay: bigint;
  distributionWindowDuration: bigint;
  v2Gauges: string[];
  v3Gauges: string[];
};

export async function getVoterState(voter: VoterUpgradeableV2): Promise<VoterUpgradeableState> {
  const [
    votingEscrow,
    token,
    minter,
    bribeFactory,
    v2PoolFactory,
    v3PoolFactory,
    v2GaugeFactory,
    v3GaugeFactory,
    merklDistributor,
    veFnxMerklAidrop,
    index,
    voteDelay,
    distributionWindowDuration,
  ] = await Promise.all([
    voter.votingEscrow(),
    voter.token(),
    voter.minter(),
    voter.bribeFactory(),
    voter.v2PoolFactory(),
    voter.v3PoolFactory(),
    voter.v2GaugeFactory(),
    voter.v3GaugeFactory(),
    voter.merklDistributor(),
    voter.veFnxMerklAidrop(),
    voter.index(),
    voter.voteDelay(),
    voter.distributionWindowDuration(),
  ]);

  let v2Gauges: string[] = [];
  let v3Gauges: string[] = [];

  let counter = await voter.poolsCounts();
  for (let i = 0; i < counter.v2PoolsCount; i++) {
    v2Gauges.push(await voter.poolToGauge(await voter.v2Pools(i)));
  }
  for (let i = 0; i < counter.v3PoolsCount; i++) {
    v3Gauges.push(await voter.poolToGauge(await voter.v3Pools(i)));
  }
  return {
    address: voter.target.toString(),
    votingEscrow,
    token,
    minter,
    bribeFactory,
    v2PoolFactory,
    v3PoolFactory,
    v2GaugeFactory,
    v3GaugeFactory,
    merklDistributor,
    veFnxMerklAidrop,
    index,
    voteDelay,
    distributionWindowDuration,
    v2Gauges,
    v3Gauges,
  };
}

export type VotingEscrowState = {
  address: string;
  owner: string;
  pendingOwner: string;
  token: string;
  voter: string;
  artProxy: string;
  veBoost: string;
  managedNFTManager: string;
  supply: bigint;
  permanentTotalSupply: bigint;
  epoch: bigint;
  lastMintedTokenId: bigint;
  votingPowerTotalSupply: bigint;
};

export async function getVotingEscrowState(votingEscrow: VotingEscrowUpgradeableV2): Promise<VotingEscrowState> {
  const [
    owner,
    pendingOwner,
    token,
    voter,
    artProxy,
    veBoost,
    managedNFTManager,
    supply,
    permanentTotalSupply,
    epoch,
    lastMintedTokenId,
    votingPowerTotalSupply,
  ] = await Promise.all([
    votingEscrow.owner(),
    votingEscrow.pendingOwner(),
    votingEscrow.token(),
    votingEscrow.voter(),
    votingEscrow.artProxy(),
    votingEscrow.veBoost(),
    votingEscrow.managedNFTManager(),
    votingEscrow.supply(),
    votingEscrow.permanentTotalSupply(),
    votingEscrow.epoch(),
    votingEscrow.lastMintedTokenId(),
    votingEscrow.votingPowerTotalSupply(),
  ]);

  return {
    address: votingEscrow.target.toString(),
    owner,
    pendingOwner,
    token,
    voter,
    artProxy,
    veBoost,
    managedNFTManager,
    supply,
    permanentTotalSupply,
    epoch,
    lastMintedTokenId,
    votingPowerTotalSupply,
  };
}

export type GaugeFactoryState = {
  address: string;
  owner: string;
  defaultBlastGovernor: string;
  gaugeImplementation: string;
  gaugeOwner: string;
  merklGaugeMiddleman: string;
  voter: string;
  last_gauge: string;
  gaugeImplementationType: bigint | string;
};

export async function getGaugeFactoryState(
  hre: HardhatRuntimeEnvironment,
  gaugeFactory: GaugeFactoryUpgradeable,
): Promise<GaugeFactoryState> {
  const [owner, defaultBlastGovernor, gaugeImplementation, gaugeOwner, merklGaugeMiddleman, voter, last_gauge] = await Promise.all([
    gaugeFactory.owner(),
    gaugeFactory.defaultBlastGovernor(),
    gaugeFactory.gaugeImplementation(),
    gaugeFactory.gaugeOwner(),
    gaugeFactory.merklGaugeMiddleman(),
    gaugeFactory.voter(),
    gaugeFactory.last_gauge(),
  ]);

  let gaugeImplementationType = 'not support';

  try {
    let Contract = await hre.ethers.getContractAt(['function gaugeType() view returns (uint8)'], gaugeImplementation);
    gaugeImplementationType = await Contract.gaugeType();
  } catch {}

  return {
    address: gaugeFactory.target.toString(),
    owner,
    defaultBlastGovernor,
    gaugeImplementation,
    gaugeOwner,
    merklGaugeMiddleman,
    voter,
    last_gauge,
    gaugeImplementationType,
  };
}
