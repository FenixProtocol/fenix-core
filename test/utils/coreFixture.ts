import {
  abi as FACTORY_ABI,
  bytecode as FACTORY_BYTECODE,
} from '@cryptoalgebra/integral-core/artifacts/contracts/AlgebraFactoryUpgradeable.sol/AlgebraFactoryUpgradeable.json';
import {
  abi as NonfungiblePositionManager_ABI,
  bytecode as NonfungiblePositionManager_BYTECODE,
} from '@cryptoalgebra/integral-periphery/artifacts/contracts/NonfungiblePositionManager.sol/NonfungiblePositionManager.json';
import {
  abi as SWAP_ROUTER_ABI,
  bytecode as SWAP_ROUTER_BYTECODE,
} from '@cryptoalgebra/integral-periphery/artifacts/contracts/SwapRouter.sol/SwapRouter.json';
import { HardhatEthersSigner } from '@nomicfoundation/hardhat-ethers/signers';
import { getCreateAddress } from 'ethers';
import { ethers } from 'hardhat';

import {
  abi as ALGEBRA_COMMUNITY_VAULT_ABI,
  bytecode as ALGEBRA_COMMUNITY_VAULT_BYTECODE,
} from '@cryptoalgebra/integral-core/artifacts/contracts/AlgebraCommunityVault.sol/AlgebraCommunityVault.json';
import {
  abi as POOL_DEPLOYER_ABI,
  bytecode as POOL_DEPLOYER_BYTECODE,
} from '@cryptoalgebra/integral-core/artifacts/contracts/AlgebraPoolDeployer.sol/AlgebraPoolDeployer.json';

import { NonfungiblePositionManager, SwapRouter } from '@cryptoalgebra/integral-periphery/typechain';
import { setCode } from '@nomicfoundation/hardhat-toolbox/network-helpers';
import { AlgebraCommunityVault, AlgebraFactoryUpgradeable, AlgebraPoolDeployer } from '../../lib/fenix-algebra/src/core/typechain';
import {
  BlastMock__factory,
  BlastPointsMock,
  BribeFactoryUpgradeable,
  BribeUpgradeable,
  CompoundEmissionExtensionUpgradeable,
  CompoundEmissionExtensionUpgradeableMock,
  CompoundVeFNXManagedNFTStrategyUpgradeable,
  ERC20Mock,
  ERC721PresetMinterPauserAutoId,
  FeesVaultFactoryUpgradeable,
  FeesVaultFactoryUpgradeable__factory,
  FeesVaultUpgradeable,
  Fenix,
  GaugeFactoryUpgradeable,
  GaugeUpgradeable,
  ManagedNFTManagerUpgradeable,
  MerklGaugeMiddleman,
  MerkleDistributionCreatorMock,
  MinterUpgradeable,
  Pair,
  PairFactoryUpgradeable,
  PairFactoryUpgradeable__factory,
  SingelTokenVirtualRewarderUpgradeable,
  TransparentUpgradeableProxy,
  VeArtProxy,
  VeBoostUpgradeable,
  VeFnxDistributorUpgradeable,
  VoterUpgradeableV2,
  VoterUpgradeableV2__factory,
  VotingEscrowUpgradeableV2,
} from '../../typechain-types';
import { ART_RPOXY_PARTS } from '../../utils/ArtProxy';
import { GaugeType } from './constants';

export type SignersList = {
  deployer: HardhatEthersSigner;
  blastGovernor: HardhatEthersSigner;
  fenixTeam: HardhatEthersSigner;
  proxyAdmin: HardhatEthersSigner;
  otherUser1: HardhatEthersSigner;
  otherUser2: HardhatEthersSigner;
  otherUser3: HardhatEthersSigner;
  otherUser4: HardhatEthersSigner;
  otherUser5: HardhatEthersSigner;
};
export type CoreFixtureDeployed = {
  signers: SignersList;
  voter: VoterUpgradeableV2;
  fenix: Fenix;
  minter: MinterUpgradeable;
  veArtProxy: VeArtProxy;
  votingEscrow: VotingEscrowUpgradeableV2;
  v2PairFactory: PairFactoryUpgradeable;
  v2PairImplementation: Pair;
  gaugeFactory: GaugeFactoryUpgradeable;
  gaugeImplementation: GaugeUpgradeable;
  bribeFactory: BribeFactoryUpgradeable;
  bribeImplementation: BribeUpgradeable;
  merklGaugeMiddleman: MerklGaugeMiddleman;
  merklDistributionCreator: MerkleDistributionCreatorMock;
  feesVaultImplementation: FeesVaultUpgradeable;
  feesVaultFactory: FeesVaultFactoryUpgradeable;
  veBoost: VeBoostUpgradeable;
  veFnxDistributor: VeFnxDistributorUpgradeable;
  blastPoints: BlastPointsMock;
  managedNFTManager: ManagedNFTManagerUpgradeable;
  compoundEmissionExtension: CompoundEmissionExtensionUpgradeableMock;
};

export async function mockBlast() {
  await setCode('0x4300000000000000000000000000000000000002', BlastMock__factory.bytecode);
  let blastPointsMock = (await ethers.deployContract('BlastPointsMock')) as any as BlastPointsMock;

  return blastPointsMock;
}
export async function deployERC721MockToken(
  deployer: HardhatEthersSigner,
  name: string,
  symbol: string,
): Promise<ERC721PresetMinterPauserAutoId> {
  const factory = await ethers.getContractFactory('ERC721PresetMinterPauserAutoId');
  return await factory.connect(deployer).deploy(name, symbol, '');
}

export async function deployERC20MockToken(
  deployer: HardhatEthersSigner,
  name: string,
  symbol: string,
  decimals: number,
): Promise<ERC20Mock> {
  const factory = await ethers.getContractFactory('ERC20Mock');
  return await factory.connect(deployer).deploy(name, symbol, decimals);
}

export async function deployMerklDistributionCreatorMock(deployer: HardhatEthersSigner): Promise<MerkleDistributionCreatorMock> {
  const factory = await ethers.getContractFactory('MerkleDistributionCreatorMock');
  return await factory.connect(deployer).deploy();
}

export async function deployTransaperntUpgradeableProxy(
  deployer: HardhatEthersSigner,
  proxyAdmin: string,
  implementation: string,
): Promise<TransparentUpgradeableProxy> {
  const factory = await ethers.getContractFactory('TransparentUpgradeableProxy');
  return (await factory.connect(deployer).deploy(implementation, proxyAdmin, '0x')) as any as TransparentUpgradeableProxy;
}

export async function deployVirtualRewarderWithoutInitialize(deployer: HardhatEthersSigner, proxyAdmin: string) {
  const factory = await ethers.getContractFactory('SingelTokenVirtualRewarderUpgradeable');
  const implementation = await factory.connect(deployer).deploy(deployer.address);
  const proxy = await deployTransaperntUpgradeableProxy(deployer, proxyAdmin, await implementation.getAddress());
  const attached = factory.attach(proxy.target) as any as SingelTokenVirtualRewarderUpgradeable;
  return attached;
}

export async function deployCompoundStrategyWithoutInitialize(deployer: HardhatEthersSigner, proxyAdmin: string) {
  const factory = await ethers.getContractFactory('CompoundVeFNXManagedNFTStrategyUpgradeable');
  const implementation = await factory.connect(deployer).deploy(deployer.address);
  const proxy = await deployTransaperntUpgradeableProxy(deployer, proxyAdmin, await implementation.getAddress());
  const attached = factory.attach(proxy.target) as any as CompoundVeFNXManagedNFTStrategyUpgradeable;
  return attached;
}

export async function deployMinter(
  deployer: HardhatEthersSigner,
  proxyAdmin: string,
  governor: string,
  voter: string,
  votingEscrow: string,
): Promise<MinterUpgradeable> {
  const factory = await ethers.getContractFactory('MinterUpgradeable');
  const implementation = await factory.connect(deployer).deploy(deployer.address);
  const proxy = await deployTransaperntUpgradeableProxy(deployer, proxyAdmin, await implementation.getAddress());
  const attached = factory.attach(proxy.target) as any as MinterUpgradeable;
  await attached.initialize(governor, voter, votingEscrow);
  return attached;
}

export async function deployVeFnxDistributor(
  deployer: HardhatEthersSigner,
  proxyAdmin: string,
  governor: string,
  fenix: string,
  votingEscrow: string,
): Promise<VeFnxDistributorUpgradeable> {
  const factory = await ethers.getContractFactory('VeFnxDistributorUpgradeable');
  const implementation = await factory.connect(deployer).deploy(deployer.address);
  const proxy = await deployTransaperntUpgradeableProxy(deployer, proxyAdmin, await implementation.getAddress());
  const attached = factory.attach(proxy.target) as any as VeFnxDistributorUpgradeable;
  await attached.initialize(governor, fenix, votingEscrow);
  return attached;
}

export async function deployFenixToken(deployer: HardhatEthersSigner, governor: string, minter: string): Promise<Fenix> {
  const factory = await ethers.getContractFactory('Fenix');
  return await factory.connect(deployer).deploy(governor, minter);
}

export async function deployArtProxy(deployer: HardhatEthersSigner, votingEscrow: string, managedNFTManager: string): Promise<VeArtProxy> {
  const staticProxy = await ethers.deployContract('VeArtProxyStatic', [
    ART_RPOXY_PARTS.lockedIcon,
    ART_RPOXY_PARTS.unlockedIcon,
    ART_RPOXY_PARTS.transferablePart,
    ART_RPOXY_PARTS.notTransferablePart,
  ]);
  await staticProxy.setStartPart(ART_RPOXY_PARTS.startPart);
  await staticProxy.setEndPart(ART_RPOXY_PARTS.endPart);
  const factory = await ethers.getContractFactory('VeArtProxy');
  return await factory.connect(deployer).deploy(staticProxy.target, votingEscrow, managedNFTManager);
}

export async function deployVotingEscrow(
  deployer: HardhatEthersSigner,
  proxyAdmin: string,
  governor: string,
  tokenAddr: string,
  veArtProxy: string,
): Promise<VotingEscrowUpgradeableV2> {
  const factory = await ethers.getContractFactory('VotingEscrowUpgradeableV2');
  const implementation = await factory.connect(deployer).deploy(deployer.address);
  const proxy = await deployTransaperntUpgradeableProxy(deployer, proxyAdmin, await implementation.getAddress());
  const attached = factory.attach(proxy.target) as any as VotingEscrowUpgradeableV2;

  await attached.initialize(governor, tokenAddr);
  await attached.updateAddress('artProxy', veArtProxy);
  return attached;
}

export async function deployVoterWithoutInitialize(deployer: HardhatEthersSigner, proxyAdmin: string): Promise<VoterUpgradeableV2> {
  const factory = (await ethers.getContractFactory('VoterUpgradeableV2')) as VoterUpgradeableV2__factory;
  const implementation = await factory.connect(deployer).deploy(deployer.address);
  const proxy = await deployTransaperntUpgradeableProxy(deployer, proxyAdmin, await implementation.getAddress());
  return factory.attach(proxy.target) as any as VoterUpgradeableV2;
}
export async function deployVoter(
  deployer: HardhatEthersSigner,
  proxyAdmin: string,
  governor: string,
  votingEscrow: string,
  v2PairFactory: string,
  v2GaugeFactory: string,
  bribeFactory: string,
): Promise<VoterUpgradeableV2> {
  const factory = (await ethers.getContractFactory('VoterUpgradeableV2')) as VoterUpgradeableV2__factory;
  const implementation = await factory.connect(deployer).deploy(deployer.address);
  const proxy = await deployTransaperntUpgradeableProxy(deployer, proxyAdmin, await implementation.getAddress());
  const attached = factory.attach(proxy.target) as any as VoterUpgradeableV2;
  await attached.initialize(governor, votingEscrow);
  await attached.grantRole(ethers.id('GOVERNANCE_ROLE'), deployer.address);
  await attached.grantRole(ethers.id('VOTER_ADMIN_ROLE'), deployer.address);
  await attached.updateAddress('v2PoolFactory', v2PairFactory);
  await attached.updateAddress('v2GaugeFactory', v2GaugeFactory);
  await attached.updateAddress('bribeFactory', bribeFactory);

  return attached;
}

export async function deployCommunityVaultFeeImplementation(deployer: HardhatEthersSigner): Promise<FeesVaultUpgradeable> {
  const factory = await ethers.getContractFactory('FeesVaultUpgradeable');
  return await factory.connect(deployer).deploy(deployer.address);
}

export async function deployCommunityVaultFeeFactory(
  deployer: HardhatEthersSigner,
  proxyAdmin: string,
  governor: string,
  blastPoints: string,
  blastPointsOperator: string,
  voter: string,
  communityFeeVaultImplementation: string,
): Promise<FeesVaultFactoryUpgradeable> {
  const factory = (await ethers.getContractFactory('FeesVaultFactoryUpgradeable')) as FeesVaultFactoryUpgradeable__factory;
  const implementation = await factory.connect(deployer).deploy(deployer.address);
  const proxy = await deployTransaperntUpgradeableProxy(deployer, proxyAdmin, await implementation.getAddress());
  const attached = factory.attach(proxy.target) as any as FeesVaultFactoryUpgradeable;
  await attached.connect(deployer).initialize(governor, blastPoints, blastPointsOperator, voter, communityFeeVaultImplementation, {
    toGaugeRate: 10000,
    recipients: [],
    rates: [],
  });

  return attached;
}

export async function deployV2PairFactory(
  deployer: HardhatEthersSigner,
  proxyAdmin: string,
  governor: string,
  blastPoints: string,
  blastPointsOperator: string,
  pairImplementation: string,
  communityVaultFeeFactory: string,
): Promise<PairFactoryUpgradeable> {
  const factory = (await ethers.getContractFactory('PairFactoryUpgradeable')) as PairFactoryUpgradeable__factory;
  const implementation = await factory.connect(deployer).deploy(deployer.address);
  const proxy = await deployTransaperntUpgradeableProxy(deployer, proxyAdmin, await implementation.getAddress());
  const attached = factory.attach(proxy.target) as any as PairFactoryUpgradeable;
  await attached.connect(deployer).initialize(governor, blastPoints, blastPointsOperator, pairImplementation, communityVaultFeeFactory);

  return attached;
}

export async function deployGaugeImplementation(deployer: HardhatEthersSigner, gaugeType: number): Promise<GaugeUpgradeable> {
  const factory = await ethers.getContractFactory('GaugeUpgradeable');
  return await factory.connect(deployer).deploy(deployer.address, gaugeType);
}

export async function deployBribeImplementation(deployer: HardhatEthersSigner): Promise<BribeUpgradeable> {
  const factory = await ethers.getContractFactory('BribeUpgradeable');
  return await factory.connect(deployer).deploy(deployer.address);
}

export async function deployManagedNFTManager(
  deployer: HardhatEthersSigner,
  proxyAdmin: string,
  governor: string,
  votingEscrow: string,
  voter: string,
) {
  const factory = await ethers.getContractFactory('ManagedNFTManagerUpgradeable');
  const implementation = await factory.connect(deployer).deploy(deployer.address);
  const proxy = await deployTransaperntUpgradeableProxy(deployer, proxyAdmin, await implementation.getAddress());
  const attached = factory.attach(proxy.target) as ManagedNFTManagerUpgradeable;
  await attached.connect(deployer).initialize(governor, votingEscrow, voter);
  return attached;
}
export async function deployBribeFactory(
  deployer: HardhatEthersSigner,
  proxyAdmin: string,
  governor: string,
  voter: string,
  bribeImplementation: string,
): Promise<BribeFactoryUpgradeable> {
  const factory = await ethers.getContractFactory('BribeFactoryUpgradeable');
  const implementation = await factory.connect(deployer).deploy(deployer.address);
  const proxy = await deployTransaperntUpgradeableProxy(deployer, proxyAdmin, await implementation.getAddress());
  const attached = factory.attach(proxy.target) as BribeFactoryUpgradeable;
  await attached.connect(deployer).initialize(governor, voter, bribeImplementation);
  return attached;
}
export async function deployV2PairImplementation(deployer: HardhatEthersSigner): Promise<Pair> {
  return await ethers.deployContract('Pair', [deployer.address]);
}
export async function deployGaugeFactory(
  deployer: HardhatEthersSigner,
  proxyAdmin: string,
  governor: string,
  voter: string,
  gaugeImplementation: string,
  merklGaugeMiddleman: string,
): Promise<GaugeFactoryUpgradeable> {
  const factory = await ethers.getContractFactory('GaugeFactoryUpgradeable');
  const implementation = await factory.connect(deployer).deploy(deployer.address);
  const proxy = await deployTransaperntUpgradeableProxy(deployer, proxyAdmin, await implementation.getAddress());
  const attached = factory.attach(proxy.target) as any as GaugeFactoryUpgradeable;
  await attached.connect(deployer).initialize(governor, voter, gaugeImplementation, merklGaugeMiddleman);
  return attached;
}

export async function deployCompoundEmissionExtension(
  deployer: HardhatEthersSigner,
  proxyAdmin: string,
  blastGovenor: string,
  voter: string,
  token: string,
  votingEscrow: string,
): Promise<CompoundEmissionExtensionUpgradeable> {
  const factory = await ethers.getContractFactory('CompoundEmissionExtensionUpgradeableMock');
  const implementation = await factory.connect(deployer).deploy(blastGovenor);
  const proxy = await deployTransaperntUpgradeableProxy(deployer, proxyAdmin, await implementation.getAddress());
  const attached = factory.attach(proxy.target) as any as CompoundEmissionExtensionUpgradeableMock;
  await attached.connect(deployer).initialize(blastGovenor, voter, token, votingEscrow);
  return attached;
}

export async function deployMerklGaugeMiddleman(
  deployer: HardhatEthersSigner,
  governor: string,
  fenix: string,
  merklDistributionCreator: string,
): Promise<MerklGaugeMiddleman> {
  const factory = await ethers.getContractFactory('MerklGaugeMiddleman');
  return await factory.connect(deployer).deploy(governor, fenix, merklDistributionCreator);
}

export async function getSigners() {
  const signers = await ethers.getSigners();

  return {
    deployer: signers[0],
    blastGovernor: signers[1],
    fenixTeam: signers[2],
    proxyAdmin: signers[3],
    otherUser1: signers[4],
    otherUser2: signers[5],
    otherUser3: signers[6],
    otherUser4: signers[7],
    otherUser5: signers[8],
  };
}

export interface FactoryFixture {
  factory: AlgebraFactoryUpgradeable;
  vault: AlgebraCommunityVault;
  router: SwapRouter;
  manager: NonfungiblePositionManager;
}

export async function deployAlgebraCore(blastPoints: string): Promise<FactoryFixture> {
  const signers = await getSigners();

  const poolDeployerAddress = getCreateAddress({
    from: signers.deployer.address,
    nonce: (await ethers.provider.getTransactionCount(signers.deployer.address)) + 3,
  });
  const factoryFactory = await ethers.getContractFactory(FACTORY_ABI, FACTORY_BYTECODE);
  const factoryImplementation = await factoryFactory.deploy(signers.deployer.address);

  const factory = factoryFactory.attach(
    (await deployTransaperntUpgradeableProxy(signers.deployer, signers.proxyAdmin.address, await factoryImplementation.getAddress()))
      .target,
  ) as any;

  await factory.initialize(signers.blastGovernor.address, blastPoints, signers.blastGovernor.address, poolDeployerAddress);

  const poolDeployerFactory = await ethers.getContractFactory(POOL_DEPLOYER_ABI, POOL_DEPLOYER_BYTECODE);
  const poolDeployer = (await poolDeployerFactory.deploy(signers.blastGovernor.address, factory)) as any as AlgebraPoolDeployer;

  const vaultFactory = await ethers.getContractFactory(ALGEBRA_COMMUNITY_VAULT_ABI, ALGEBRA_COMMUNITY_VAULT_BYTECODE);
  const vault = (await vaultFactory.deploy(
    signers.blastGovernor.address,
    factory,
    signers.deployer.address,
  )) as any as AlgebraCommunityVault;

  const swapRouterFactory = await ethers.getContractFactory(SWAP_ROUTER_ABI, SWAP_ROUTER_BYTECODE);
  const NonfungiblePositionManagerFactory = await ethers.getContractFactory(
    NonfungiblePositionManager_ABI,
    NonfungiblePositionManager_BYTECODE,
  );
  const WETH = await ethers.deployContract('WETH9');

  let manager = (await NonfungiblePositionManagerFactory.deploy(
    signers.blastGovernor.address,
    factory.target,
    WETH.target,
    ethers.ZeroAddress,
    poolDeployer.target,
  )) as any as NonfungiblePositionManager;

  let router = (await swapRouterFactory.deploy(
    signers.blastGovernor.address,
    factory.target,
    WETH.target,
    poolDeployer.target,
  )) as any as SwapRouter;

  return { factory, vault, router, manager };
}

export async function completeFixture(): Promise<CoreFixtureDeployed> {
  let mockBlastPoints = await mockBlast();

  const signers = await getSigners();

  const fenix = await deployFenixToken(signers.deployer, signers.blastGovernor.address, signers.deployer.address);

  const voter = await deployVoterWithoutInitialize(signers.deployer, signers.proxyAdmin.address);

  const votingEscrow = await deployVotingEscrow(
    signers.deployer,
    signers.proxyAdmin.address,
    signers.blastGovernor.address,
    await fenix.getAddress(),
    ethers.ZeroAddress,
  );

  const minter = await deployMinter(
    signers.deployer,
    signers.proxyAdmin.address,
    signers.blastGovernor.address,
    await voter.getAddress(),
    await votingEscrow.getAddress(),
  );
  await votingEscrow.updateAddress('voter', voter.target);

  const communityFeeVaultImplementation = await deployCommunityVaultFeeImplementation(signers.deployer);

  const feesVaultFactory = await deployCommunityVaultFeeFactory(
    signers.deployer,
    signers.proxyAdmin.address,
    signers.blastGovernor.address,
    await mockBlastPoints.getAddress(),
    signers.blastGovernor.address,
    await voter.getAddress(),
    await communityFeeVaultImplementation.getAddress(),
  );

  const v2PairImplementation = await deployV2PairImplementation(signers.deployer);

  const v2PairFactory = await deployV2PairFactory(
    signers.deployer,
    signers.proxyAdmin.address,
    signers.blastGovernor.address,
    await mockBlastPoints.getAddress(),
    signers.blastGovernor.address,
    await v2PairImplementation.getAddress(),
    await feesVaultFactory.getAddress(),
  );

  const bribeImplementation = await deployBribeImplementation(signers.deployer);
  const bribeFactory = await deployBribeFactory(
    signers.deployer,
    signers.proxyAdmin.address,
    signers.blastGovernor.address,
    await voter.getAddress(),
    await bribeImplementation.getAddress(),
  );

  const merklDistributionCreator = await deployMerklDistributionCreatorMock(signers.deployer);
  const merklGaugeMiddleman = await deployMerklGaugeMiddleman(
    signers.deployer,
    signers.blastGovernor.address,
    await fenix.getAddress(),
    await merklDistributionCreator.getAddress(),
  );
  const gaugeImplementation = await deployGaugeImplementation(signers.deployer, GaugeType.V2PairsGauge);
  const gaugeFactory = await deployGaugeFactory(
    signers.deployer,
    signers.proxyAdmin.address,
    signers.blastGovernor.address,
    await voter.getAddress(),
    await gaugeImplementation.getAddress(),
    await merklGaugeMiddleman.getAddress(),
  );
  await voter.connect(signers.deployer).initialize(signers.blastGovernor.address, await votingEscrow.getAddress());
  await voter.grantRole(await voter.DEFAULT_ADMIN_ROLE(), signers.deployer.address);
  await voter.grantRole(ethers.id('GOVERNANCE_ROLE'), signers.deployer.address);
  await voter.grantRole(ethers.id('VOTER_ADMIN_ROLE'), signers.deployer.address);
  await voter.updateAddress('v2PoolFactory', v2PairFactory.target);
  await voter.updateAddress('v2GaugeFactory', gaugeFactory.target);
  await voter.updateAddress('bribeFactory', bribeFactory.target);
  await voter.updateAddress('minter', minter.target);

  await minter.start();
  await fenix.transferOwnership(minter.target);
  await feesVaultFactory.grantRole(await feesVaultFactory.WHITELISTED_CREATOR_ROLE(), v2PairFactory.target);

  await v2PairFactory.grantRole(await v2PairFactory.PAIRS_CREATOR_ROLE(), signers.deployer.address);
  await v2PairFactory.grantRole(await v2PairFactory.PAIRS_ADMINISTRATOR_ROLE(), signers.deployer.address);
  await v2PairFactory.grantRole(await v2PairFactory.FEES_MANAGER_ROLE(), signers.deployer.address);

  let veBoostImpl = await (await ethers.getContractFactory('VeBoostUpgradeable')).deploy(signers.blastGovernor.address);
  let veBoost = (await ethers.getContractFactory('VeBoostUpgradeable')).attach(
    await deployTransaperntUpgradeableProxy(signers.blastGovernor, signers.proxyAdmin.address, await veBoostImpl.getAddress()),
  ) as VeBoostUpgradeable;

  let veFnxDistributor = await deployVeFnxDistributor(
    signers.deployer,
    signers.proxyAdmin.address,
    signers.blastGovernor.address,
    await fenix.getAddress(),
    await votingEscrow.getAddress(),
  );

  let managedNFTManager = await deployManagedNFTManager(
    signers.deployer,
    signers.proxyAdmin.address,
    signers.blastGovernor.address,
    await votingEscrow.getAddress(),
    await voter.getAddress(),
  );

  await votingEscrow.updateAddress('managedNFTManager', managedNFTManager);

  await voter.updateAddress('managedNFTManager', managedNFTManager);

  const resultArtProxy = await deployArtProxy(signers.deployer, votingEscrow.target.toString(), managedNFTManager.target.toString());

  let compoundEmissionExtension = await deployCompoundEmissionExtension(
    signers.deployer,
    signers.proxyAdmin.address,
    signers.blastGovernor.address,
    await voter.getAddress(),
    await fenix.getAddress(),
    await votingEscrow.getAddress(),
  );

  await voter.updateAddress('compoundEmissionExtension', compoundEmissionExtension.target);
  return {
    signers: signers,
    voter: voter,
    fenix: fenix,
    minter: minter,
    veArtProxy: resultArtProxy,
    votingEscrow: votingEscrow,
    v2PairFactory: v2PairFactory,
    v2PairImplementation: v2PairImplementation,
    gaugeFactory: gaugeFactory,
    gaugeImplementation: gaugeImplementation,
    bribeFactory: bribeFactory,
    bribeImplementation: bribeImplementation,
    merklGaugeMiddleman: merklGaugeMiddleman,
    merklDistributionCreator: merklDistributionCreator,
    feesVaultImplementation: communityFeeVaultImplementation,
    feesVaultFactory: feesVaultFactory,
    veBoost: veBoost,
    veFnxDistributor: veFnxDistributor,
    blastPoints: mockBlastPoints,
    managedNFTManager: managedNFTManager,
    compoundEmissionExtension: compoundEmissionExtension,
  };
}

export default completeFixture;
