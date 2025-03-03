import { task } from 'hardhat/config';
import type { HardhatRuntimeEnvironment, TaskArguments } from 'hardhat/types';
import { getDeployedContractsAddressList } from '../utils/Utils';
import { AliasDeployedContracts, InstanceName } from '../utils/Names';
import {
  getAlgebraFactoryState,
  getBlastGovernor,
  getFenixState,
  getMinterState,
  getPairFactoryState,
  getPairState,
  getPools,
  getPoolState,
  getVeBoostState,
  getBribeFactoryState,
  getVeFnxSplitMerklAidropState,
  getMinimalLinearVestingState,
  getVoterState,
  getVotingEscrowState,
  getGaugeFactoryState,
} from './utils';
import AlgebraFactory_Artifact from '@cryptoalgebra/integral-core/artifacts/contracts/AlgebraFactoryUpgradeable.sol/AlgebraFactoryUpgradeable.json';
import AlgebraPool_Artifact from '@cryptoalgebra/integral-core/artifacts/contracts/AlgebraPool.sol/AlgebraPool.json';

import { AlgebraFactoryUpgradeable, AlgebraPool } from '@cryptoalgebra/integral-core/typechain';

import AllConfigs from './config';
import { THIRD_PART_CONTRACTS } from '../utils/Constants';
const Config = AllConfigs['get-state'];

task('get-state', 'Get all relevant state information including PairFactory, pairs, fenix, minter, and fees vaults')
  .addOptionalParam('output', 'File path to save the output')
  .setAction(async function (taskArguments: TaskArguments, hre: HardhatRuntimeEnvironment) {
    const deployData = await getDeployedContractsAddressList(hre);
    const [deployer] = await hre.ethers.getSigners();
    const PairFactory = await hre.ethers.getContractAt(
      InstanceName.PairFactoryUpgradeable,
      deployData[AliasDeployedContracts.PairFactoryUpgradeable_Proxy],
    );
    const FeesVaultFactoryUpgradeable = await hre.ethers.getContractAt(
      InstanceName.FeesVaultFactoryUpgradeable,
      deployData[AliasDeployedContracts.FeesVaultFactoryUpgradeable_Proxy],
    );
    const Fenix = await hre.ethers.getContractAt(InstanceName.Fenix, deployData[AliasDeployedContracts.Fenix]);
    const MinterUpgradeable = await hre.ethers.getContractAt(
      InstanceName.MinterUpgradeable,
      deployData[AliasDeployedContracts.MinterUpgradeable_Proxy],
    );
    const VeBoostUpgradeable = await hre.ethers.getContractAt(
      InstanceName.VeBoostUpgradeable,
      deployData[AliasDeployedContracts.VeBoostUpgradeable_Proxy],
    );
    const BribeFactoryUpgradeable = await hre.ethers.getContractAt(
      InstanceName.BribeFactoryUpgradeable,
      deployData[AliasDeployedContracts.BribeFactoryUpgradeable_Proxy],
    );
    const VeFnxSplitMerklAidropUpgradeable = await hre.ethers.getContractAt(
      InstanceName.VeFnxSplitMerklAidropUpgradeable,
      deployData[AliasDeployedContracts.VeFnxSplitMerklAidropUpgradeable_Proxy],
    );
    const VoterUpgradeable = await hre.ethers.getContractAt(
      InstanceName.VoterUpgradeable,
      deployData[AliasDeployedContracts.VoterUpgradeable_Proxy],
    );
    const VotingEscrowUpgradeable = await hre.ethers.getContractAt(
      InstanceName.VotingEscrowUpgradeable,
      deployData[AliasDeployedContracts.VotingEscrowUpgradeable_Proxy],
    );
    const GaugeFactory_V2Pools_Proxy = await hre.ethers.getContractAt(
      InstanceName.GaugeFactoryUpgradeable,
      deployData[AliasDeployedContracts.GaugeFactory_V2Pools_Proxy],
    );
    const GaugeFactory_V3Pools_Proxy = await hre.ethers.getContractAt(
      InstanceName.GaugeFactoryUpgradeable,
      deployData[AliasDeployedContracts.GaugeFactory_V3Pools_Proxy],
    );

    console.log('Start getting data....');

    const gaugeFactoryV2PoolsState = await getGaugeFactoryState(hre, GaugeFactory_V2Pools_Proxy);
    const gaugeFactoryV3PoolsState = await getGaugeFactoryState(hre, GaugeFactory_V3Pools_Proxy);

    const votingEscrowState = await getVotingEscrowState(VotingEscrowUpgradeable);

    console.log('getVoterState data....');

    const voterState = await getVoterState(VoterUpgradeable);
    const veFnxSplitMerklAidropState = await getVeFnxSplitMerklAidropState(VeFnxSplitMerklAidropUpgradeable);

    const veBoostState = await getVeBoostState(hre, VeBoostUpgradeable);

    console.log('getPairFactoryState data....');

    const pairFactoryState = await getPairFactoryState(PairFactory);
    const pairsInfo = await Promise.all(
      pairFactoryState.pairs.map(async (pair) => {
        return getPairState(PairFactory, FeesVaultFactoryUpgradeable, await hre.ethers.getContractAt(InstanceName.Pair, pair));
      }),
    );
    const fenixState = await getFenixState(Fenix);
    let minimalLinearVestingState = {};
    try {
      const MinimalLinearVestingUpgradeable = await hre.ethers.getContractAt(
        InstanceName.MinimalLinearVestingUpgradeable,
        deployData[AliasDeployedContracts.MinimalLinearVestingUpgradeable_Proxy],
      );
      minimalLinearVestingState = await getMinimalLinearVestingState(MinimalLinearVestingUpgradeable);
    } catch {}

    console.log('getMinterState data....');

    const minterState = await getMinterState(MinterUpgradeable);
    const bribeFactoryState = await getBribeFactoryState(hre, BribeFactoryUpgradeable);

    const AlgebraFactory = (await hre.ethers.getContractAtFromArtifact(
      AlgebraFactory_Artifact,
      deployData[AliasDeployedContracts.AlgebraFactory_Proxy],
    )) as any as AlgebraFactoryUpgradeable;

    const algebraFactoryState = await getAlgebraFactoryState(AlgebraFactory);
    console.log('theGraphUrl data....');

    const theGraphUrl = Config.chains[hre.network.name].algebraTheGraph;
    let poolsInfo: any[] = [];
    if (theGraphUrl) {
      const pools = await getPools(theGraphUrl);
      algebraFactoryState.pools = pools;

      poolsInfo = await Promise.all(
        algebraFactoryState.pools.map(async (pool) => {
          return getPoolState(
            hre,
            AlgebraFactory,
            FeesVaultFactoryUpgradeable,
            (await hre.ethers.getContractAtFromArtifact(AlgebraPool_Artifact, pool)) as any as AlgebraPool,
          );
        }),
      );
    }

    const Blast = await hre.ethers.getContractAt(InstanceName.Blast, THIRD_PART_CONTRACTS.Blast);
    const listAddresses = [
      ...pairsInfo.map((t) => t.fees),
      ...pairsInfo.map((t) => t.address),
      ...pairsInfo.map((t) => t.feesVaultInfo.address),
      ...poolsInfo.map((t) => t.address),
      ...poolsInfo.map((t) => t.feesVaultInfo.address),
      ...poolsInfo.map((t) => t.plugin),
      ...Object.values(deployData),
      ...(Config.governoMapAdditionalAddress || []),
    ];
    const governorMap = await getBlastGovernor(Blast, listAddresses);
    const result = {
      fenixState,
      minterState,
      veBoostState,
      voterState,
      votingEscrowState,
      gaugeFactoryV2PoolsState,
      gaugeFactoryV3PoolsState,
      veFnxSplitMerklAidropState,
      minimalLinearVestingState,
      bribeFactoryState,
      pairFactoryState,
      pairsInfo,
      algebraFactoryState,
      poolsInfo,
      governorMap,
    };

    console.log(JSON.stringify(result, (key, value) => (typeof value === 'bigint' ? value.toString() : value), 2));
  });
