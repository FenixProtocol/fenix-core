import { HardhatEthersSigner } from '@nomicfoundation/hardhat-ethers/signers';
import { loadFixture, time } from '@nomicfoundation/hardhat-toolbox/network-helpers';
import { expect, use } from 'chai';
import { ethers } from 'hardhat';
import {
  CompoundVeFNXManagedNFTStrategyFactoryUpgradeable,
  CompoundVeFNXManagedNFTStrategyFactoryUpgradeable__factory,
  CompoundVeFNXManagedNFTStrategyUpgradeable,
  ManagedNFTManagerMock__factory,
  ManagedNFTManagerUpgradeable,
  RouterV2,
  RouterV2PathProviderUpgradeable,
  SingelTokenVirtualRewarderUpgradeable,
} from '../../typechain-types';
import { ERRORS, WETH_PREDEPLOYED_ADDRESS, ZERO, ZERO_ADDRESS } from '../utils/constants';
import completeFixture, {
  CoreFixtureDeployed,
  SignersList,
  deployERC20MockToken,
  deployERC721MockToken,
  deployTransaperntUpgradeableProxy,
} from '../utils/coreFixture';
import { ContractTransactionResponse } from 'ethers';

describe('CompoundVeFNXManagedStrategy Contract', function () {
  const _WEEK = 86400 * 7;

  async function currentEpoch() {
    return Math.floor(Math.floor((await time.latest()) / _WEEK) * _WEEK);
  }

  async function nextEpoch() {
    return Math.floor((await currentEpoch()) + _WEEK);
  }

  let signers: SignersList;
  let deployed: CoreFixtureDeployed;

  let factory: CompoundVeFNXManagedNFTStrategyFactoryUpgradeable__factory;
  let strategyFactory: CompoundVeFNXManagedNFTStrategyFactoryUpgradeable;
  let strategyImplementation: CompoundVeFNXManagedNFTStrategyUpgradeable;
  let virtualRewarderImplementation: SingelTokenVirtualRewarderUpgradeable;
  let managedNFTManager: ManagedNFTManagerUpgradeable;
  let routerV2PathProvider: RouterV2PathProviderUpgradeable;

  let firstStrategy: CompoundVeFNXManagedNFTStrategyUpgradeable;
  let virtualRewarder: SingelTokenVirtualRewarderUpgradeable;

  let managedNftId: bigint;
  let userNftId: bigint;
  let routerV2: RouterV2;

  async function deployStrategyFactory(
    deployer: HardhatEthersSigner,
    proxyAdmin: string,
  ): Promise<CompoundVeFNXManagedNFTStrategyFactoryUpgradeable> {
    const factory = await ethers.getContractFactory('CompoundVeFNXManagedNFTStrategyFactoryUpgradeable');
    const implementation = await factory.connect(deployer).deploy(deployer.address);
    const proxy = await deployTransaperntUpgradeableProxy(deployer, proxyAdmin, await implementation.getAddress());
    const attached = factory.attach(proxy.target) as CompoundVeFNXManagedNFTStrategyFactoryUpgradeable;
    return attached;
  }

  beforeEach(async function () {
    deployed = await loadFixture(completeFixture);
    signers = deployed.signers;
    managedNFTManager = deployed.managedNFTManager;

    let routerV2Impl = await ethers.deployContract('RouterV2PathProviderUpgradeable', [signers.blastGovernor.address]);
    const proxy = await deployTransaperntUpgradeableProxy(signers.deployer, signers.proxyAdmin.address, await routerV2Impl.getAddress());
    routerV2PathProvider = (await ethers.getContractFactory('RouterV2PathProviderUpgradeable')).attach(
      proxy.target,
    ) as RouterV2PathProviderUpgradeable;

    factory = (await ethers.getContractFactory(
      'CompoundVeFNXManagedNFTStrategyFactoryUpgradeable',
    )) as any as CompoundVeFNXManagedNFTStrategyFactoryUpgradeable__factory;
    strategyFactory = await deployStrategyFactory(signers.deployer, signers.proxyAdmin.address);

    strategyImplementation = await ethers.deployContract('CompoundVeFNXManagedNFTStrategyUpgradeable', [signers.blastGovernor.address]);
    virtualRewarderImplementation = await ethers.deployContract('SingelTokenVirtualRewarderUpgradeable', [signers.blastGovernor.address]);
    routerV2 = await ethers.deployContract('RouterV2', [
      signers.blastGovernor.address,
      deployed.v2PairFactory.target,
      WETH_PREDEPLOYED_ADDRESS,
    ]);

    await routerV2PathProvider.initialize(signers.blastGovernor.address, deployed.v2PairFactory.target, routerV2.target);
    await strategyFactory.initialize(
      signers.blastGovernor.address,
      strategyImplementation.target,
      virtualRewarderImplementation.target,
      managedNFTManager.target,
      routerV2PathProvider.target,
    );

    await strategyFactory.grantRole(await strategyFactory.STRATEGY_CREATOR_ROLE(), signers.deployer.address);

    let strategyAddress = await strategyFactory.createStrategy.staticCall('VeMax');
    await strategyFactory.createStrategy('VeMax');

    firstStrategy = await ethers.getContractAt('CompoundVeFNXManagedNFTStrategyUpgradeable', strategyAddress);

    virtualRewarder = await ethers.getContractAt('SingelTokenVirtualRewarderUpgradeable', await firstStrategy.virtualRewarder());

    managedNftId = await managedNFTManager.createManagedNFT.staticCall(firstStrategy.target);

    await managedNFTManager.createManagedNFT(firstStrategy.target);

    await deployed.fenix.approve(deployed.votingEscrow.target, ethers.parseEther('10000'));

    userNftId = await deployed.votingEscrow.createLockFor.staticCall(
      ethers.parseEther('1'),
      182 * 86400,
      signers.otherUser1.address,
      true,
      false,
      0,
    );
    await deployed.votingEscrow.createLockFor(ethers.parseEther('1'), 182 * 86400, signers.otherUser1.address, true, false, 0);
  });

  describe('Deployment', async function () {
    it('Should fail if try second time to initialize', async function () {
      await expect(
        firstStrategy.initialize(
          signers.blastGovernor.address,
          managedNFTManager.target,
          ZERO_ADDRESS,
          routerV2PathProvider.target,
          'VeMax',
        ),
      ).to.be.revertedWith(ERRORS.Initializable.Initialized);
    });

    it('Should correct set initial settings', async function () {
      expect(await firstStrategy.fenix()).to.be.equal(deployed.fenix.target);
      expect(await firstStrategy.routerV2PathProvider()).to.be.equal(routerV2PathProvider.target);
      expect(await firstStrategy.managedNFTManager()).to.be.equal(managedNFTManager.target);
      expect(await firstStrategy.virtualRewarder()).to.be.not.equal(ZERO_ADDRESS);
    });
  });

  describe('#setRouterV2PathProvider', async () => {
    it('fails if caller not DEFAULT_ADMIN_ROLE', async () => {
      await expect(
        firstStrategy.connect(signers.otherUser1).setRouterV2PathProvider(signers.otherUser1.address),
      ).to.be.revertedWithCustomError(firstStrategy, 'AccessDenied');
    });
    it('fails if try set ZERO_ADDRESS', async () => {
      await managedNFTManager.grantRole(await managedNFTManager.DEFAULT_ADMIN_ROLE(), signers.deployer.address);
      await expect(firstStrategy.setRouterV2PathProvider(ZERO_ADDRESS)).to.be.revertedWithCustomError(firstStrategy, 'AddressZero');
    });
    it('success set new default blast governor address and emit event', async () => {
      await managedNFTManager.grantRole(await managedNFTManager.DEFAULT_ADMIN_ROLE(), signers.deployer.address);

      expect(await firstStrategy.routerV2PathProvider()).to.be.eq(routerV2PathProvider.target);

      await expect(firstStrategy.connect(signers.deployer).setRouterV2PathProvider(signers.otherUser1.address))
        .to.be.emit(firstStrategy, 'SetRouterV2PathProvider')
        .withArgs(routerV2PathProvider.target, signers.otherUser1.address);

      expect(await firstStrategy.routerV2PathProvider()).to.be.eq(signers.otherUser1.address);
    });
  });

  describe('#onAttach', async () => {
    it('fails if caller not managed nft manager', async () => {
      await expect(firstStrategy.connect(signers.otherUser1).onAttach(1, 1)).to.be.revertedWithCustomError(firstStrategy, 'AccessDenied');
    });
    it('success store user attached nft balance like deposit in virtual rewarder', async () => {
      expect(await deployed.votingEscrow.balanceOfNFT(managedNftId)).to.be.eq(ZERO);
      expect(await virtualRewarder.totalSupply()).to.be.eq(ZERO);
      expect(await firstStrategy.totalSupply()).to.be.eq(ZERO);

      let tx = await deployed.voter.connect(signers.otherUser1).attachToManagedNFT(userNftId, managedNftId);
      await expect(tx).to.be.emit(firstStrategy, 'OnAttach').withArgs(userNftId, ethers.parseEther('1'));
      await expect(tx)
        .to.be.emit(virtualRewarder, 'Deposit')
        .withArgs(userNftId, ethers.parseEther('1'), await currentEpoch());

      expect(await virtualRewarder.totalSupply()).to.be.eq(ethers.parseEther('1'));
      expect(await virtualRewarder.balanceOf(userNftId)).to.be.eq(ethers.parseEther('1'));
      expect(await firstStrategy.totalSupply()).to.be.eq(ethers.parseEther('1'));
      expect(await firstStrategy.balanceOf(userNftId)).to.be.eq(ethers.parseEther('1'));
    });
  });

  describe('#onDettach', async () => {
    it('fails if caller not managed nft manager', async () => {
      await expect(firstStrategy.connect(signers.otherUser1).onDettach(1, 1)).to.be.revertedWithCustomError(firstStrategy, 'AccessDenied');
    });
    it('success remove user balance from virtual rewarder without rewards', async () => {
      await deployed.voter.connect(signers.otherUser1).attachToManagedNFT(userNftId, managedNftId);

      expect(await virtualRewarder.totalSupply()).to.be.eq(ethers.parseEther('1'));
      expect(await virtualRewarder.balanceOf(userNftId)).to.be.eq(ethers.parseEther('1'));
      expect(await firstStrategy.totalSupply()).to.be.eq(ethers.parseEther('1'));
      expect(await firstStrategy.balanceOf(userNftId)).to.be.eq(ethers.parseEther('1'));

      let tx = await deployed.voter.connect(signers.otherUser1).dettachFromManagedNFT(userNftId);
      await expect(tx).to.be.emit(firstStrategy, 'OnDettach').withArgs(userNftId, ethers.parseEther('1'), ZERO);
      await expect(tx)
        .to.be.emit(virtualRewarder, 'Withdraw')
        .withArgs(userNftId, ethers.parseEther('1'), await currentEpoch());

      expect(await virtualRewarder.totalSupply()).to.be.eq(ZERO);
      expect(await virtualRewarder.balanceOf(userNftId)).to.be.eq(ZERO);
      expect(await firstStrategy.totalSupply()).to.be.eq(ZERO);
      expect(await firstStrategy.balanceOf(userNftId)).to.be.eq(ZERO);
    });

    it('success remove user balance from virtual rewarder with rewards', async () => {
      await deployed.voter.connect(signers.otherUser1).attachToManagedNFT(userNftId, managedNftId);

      expect(await virtualRewarder.totalSupply()).to.be.eq(ethers.parseEther('1'));
      expect(await virtualRewarder.balanceOf(userNftId)).to.be.eq(ethers.parseEther('1'));

      expect(await virtualRewarder.calculateAvailableRewardsAmount(userNftId)).to.be.eq(ZERO);
      expect(await firstStrategy.getLockedRewardsBalance(userNftId)).to.be.eq(ZERO);

      await time.increaseTo(await nextEpoch());

      await deployed.fenix.transfer(firstStrategy.target, ethers.parseEther('22'));

      await firstStrategy.compound();

      expect(await virtualRewarder.calculateAvailableRewardsAmount(userNftId)).to.be.eq(ethers.parseEther('22'));
      expect(await firstStrategy.getLockedRewardsBalance(userNftId)).to.be.eq(ethers.parseEther('22'));

      await time.increase(3600);

      let tx = await deployed.voter.connect(signers.otherUser1).dettachFromManagedNFT(userNftId);
      await time.increase(3600);
      await expect(tx).to.be.emit(firstStrategy, 'OnDettach').withArgs(userNftId, ethers.parseEther('1'), ethers.parseEther('22'));
      await expect(tx)
        .to.be.emit(virtualRewarder, 'Withdraw')
        .withArgs(userNftId, ethers.parseEther('1'), await currentEpoch());
      await expect(tx)
        .to.be.emit(virtualRewarder, 'Harvest')
        .withArgs(userNftId, ethers.parseEther('22'), await currentEpoch());
      expect(await virtualRewarder.totalSupply()).to.be.eq(ZERO);
      expect(await virtualRewarder.balanceOf(userNftId)).to.be.eq(ZERO);
    });
  });

  describe('#compound', async () => {
    it('should fail if try called by anyone without public flag', async () => {
      expect(await managedNFTManager.getStrategyFlags(firstStrategy)).to.be.eq(0);
      await expect(firstStrategy.connect(signers.otherUser1).compound()).to.be.revertedWithCustomError(firstStrategy, 'AccessDenied');
    });

    it('can be called by anyone and not revert if zero fenix balance, if flag setup', async () => {
      await managedNFTManager.setStrategyFlags(firstStrategy, 4);
      await firstStrategy.connect(signers.otherUser1).compound();
    });

    it('should add all fenix balance to balance ManagedVeNft and notify reward in virtual rewarder', async () => {
      await deployed.fenix.transfer(firstStrategy.target, ethers.parseEther('55'));

      expect(await virtualRewarder.rewardsPerEpoch(await currentEpoch())).to.be.eq(ZERO);

      expect(await deployed.fenix.balanceOf(firstStrategy.target)).to.be.eq(ethers.parseEther('55'));
      expect(await deployed.votingEscrow.balanceOfNFT(managedNftId)).to.be.eq(ZERO);
      await managedNFTManager.setStrategyFlags(firstStrategy, 4);

      let tx = await firstStrategy.connect(signers.otherUser1).compound();
      await expect(tx)
        .to.be.emit(virtualRewarder, 'NotifyReward')
        .withArgs(ethers.parseEther('55'), await currentEpoch());
      await expect(tx).to.be.emit(firstStrategy, 'Compound').withArgs(signers.otherUser1.address, ethers.parseEther('55'));
      expect(await virtualRewarder.rewardsPerEpoch(await currentEpoch())).to.be.eq(ethers.parseEther('55'));

      expect(await deployed.fenix.balanceOf(firstStrategy.target)).to.be.eq(ZERO);
      expect(await deployed.votingEscrow.balanceOfNFT(managedNftId)).to.be.eq(ethers.parseEther('55'));
      expect(await deployed.fenix.balanceOf(deployed.votingEscrow.target)).to.be.eq(ethers.parseEther('56')); // 55 for managed + 1 from user nft id
    });
  });

  describe('#compoundVeNFTs', async () => {
    describe('Should fail if', async () => {
      it('user try call compound buy flag for public compound not setup', async () => {
        await expect(firstStrategy.connect(signers.otherUser1).compoundVeNFTs([])).to.be.revertedWithCustomError(
          firstStrategy,
          'AccessDenied',
        );
      });
      it('try compound managed nft id', async () => {
        await expect(firstStrategy.connect(signers.deployer).compoundVeNFTs([managedNftId])).to.be.revertedWithCustomError(
          firstStrategy,
          'NotAllowedActionWithManagedTokenId',
        );
      });

      it('provide empty tokens array', async () => {
        await expect(firstStrategy.connect(signers.deployer).compoundVeNFTs([])).to.be.revertedWithCustomError(
          firstStrategy,
          'ZeroCompoundVeNFTsReward',
        );
      });

      it('try compound not own strategy veNFTs', async () => {
        await expect(firstStrategy.connect(signers.deployer).compoundVeNFTs([userNftId])).to.be.revertedWithCustomError(
          firstStrategy,
          'InvalidVeNFTTokenIds',
        );
      });

      it('try compound, but any of token not attached to nest lock', async () => {
        await deployed.fenix.approve(deployed.votingEscrow.target, ethers.parseEther('100'));
        await deployed.votingEscrow.createLockFor(ethers.parseEther('1'), 0, firstStrategy, false, true, 0);

        await expect(firstStrategy.connect(signers.deployer).compoundVeNFTs([userNftId + 1n])).to.be.revertedWithCustomError(
          deployed.votingEscrow,
          'TokenNotExist',
        );
      });
    });
    describe('success compound part of avialbale veNFT to managed nft id', async () => {
      let tx: ContractTransactionResponse;

      beforeEach(async () => {
        // user1 attach to nest
        await deployed.voter.connect(signers.otherUser1).attachToManagedNFT(userNftId, managedNftId);

        await time.increase(86400 * 7);
        expect((await deployed.votingEscrow.getNftState(managedNftId)).locked.amount).to.be.eq(ethers.parseEther('1'));

        await deployed.fenix.approve(deployed.votingEscrow.target, ethers.parseEther('100'));

        await deployed.votingEscrow.createLockFor(ethers.parseEther('1'), 0, firstStrategy, false, true, 0);
        await deployed.votingEscrow.createLockFor(ethers.parseEther('2'), 0, firstStrategy, false, true, 0);
        await deployed.votingEscrow.createLockFor(ethers.parseEther('3'), 0, firstStrategy, false, true, 0);
        await deployed.votingEscrow.createLockFor(ethers.parseEther('4'), 0, signers.deployer, false, true, 0);

        await deployed.votingEscrow['safeTransferFrom(address,address,uint256)'](signers.deployer, firstStrategy, 6);

        expect(await deployed.votingEscrow.balanceOf(firstStrategy)).to.be.eq(5);
        expect(await deployed.votingEscrow.balanceOf(signers.otherUser2)).to.be.eq(0);
        expect(await deployed.votingEscrow.balanceOf(signers.fenixTeam)).to.be.eq(0);
        expect(await deployed.votingEscrow.ownerOf(1)).to.be.eq(firstStrategy);
        expect(await deployed.votingEscrow.ownerOf(2)).to.be.eq(signers.otherUser1);
        expect(await deployed.votingEscrow.ownerOf(3)).to.be.eq(firstStrategy);
        expect(await deployed.votingEscrow.ownerOf(4)).to.be.eq(firstStrategy);
        expect(await deployed.votingEscrow.ownerOf(5)).to.be.eq(firstStrategy);
        expect(await deployed.votingEscrow.ownerOf(6)).to.be.eq(firstStrategy);

        tx = await firstStrategy.compoundVeNFTs([3, 4, 5]);
      });

      it('emit events', async () => {
        let block = await tx.getBlock();
        let currentEpoch = Math.floor(block!.timestamp / (86400 * 7)) * (86400 * 7);

        await expect(tx).to.be.emit(firstStrategy, 'Compound').withArgs(signers.deployer, ethers.parseEther('6'));
        await expect(tx).to.be.emit(virtualRewarder, 'NotifyReward').withArgs(ethers.parseEther('6'), currentEpoch);
        await expect(tx).to.be.emit(deployed.votingEscrow, 'Merge').withArgs(firstStrategy, 3, 1);
        await expect(tx).to.be.emit(deployed.votingEscrow, 'Merge').withArgs(firstStrategy, 4, 1);
        await expect(tx).to.be.emit(deployed.votingEscrow, 'Merge').withArgs(firstStrategy, 5, 1);
      });

      it('success merge all tokens to managedNfToken', async () => {
        await expect(deployed.votingEscrow.ownerOf(3)).to.be.revertedWith('ERC721: invalid token ID');
        await expect(deployed.votingEscrow.ownerOf(4)).to.be.revertedWith('ERC721: invalid token ID');
        await expect(deployed.votingEscrow.ownerOf(5)).to.be.revertedWith('ERC721: invalid token ID');

        expect(await deployed.votingEscrow.balanceOf(firstStrategy)).to.be.eq(2);
        expect(await deployed.votingEscrow.balanceOf(signers.otherUser2)).to.be.eq(0);
        expect(await deployed.votingEscrow.balanceOf(signers.fenixTeam)).to.be.eq(0);
        expect(await deployed.votingEscrow.ownerOf(1)).to.be.eq(firstStrategy);
        expect(await deployed.votingEscrow.ownerOf(2)).to.be.eq(signers.otherUser1);
        expect(await deployed.votingEscrow.ownerOf(6)).to.be.eq(firstStrategy);

        expect((await deployed.votingEscrow.getNftState(managedNftId)).locked.amount).to.be.eq(ethers.parseEther('7'));
      });

      it('check another states', async () => {
        expect(await firstStrategy.balanceOf(userNftId)).to.be.eq(ethers.parseEther('1'));
        expect(await firstStrategy.totalSupply()).to.be.eq(ethers.parseEther('1'));
      });

      it('success add rewards to epoch', async () => {
        let block = await tx.getBlock();
        let currentEpoch = Math.floor(block!.timestamp / (86400 * 7)) * (86400 * 7);
        expect(await virtualRewarder.rewardsPerEpoch(currentEpoch)).to.be.eq(ethers.parseEther('6'));
      });

      describe('success compound rest part of veNFts', async () => {
        beforeEach(async () => {
          tx = await firstStrategy.compoundVeNFTs([6]);
        });

        it('emit events', async () => {
          let block = await tx.getBlock();
          let currentEpoch = Math.floor(block!.timestamp / (86400 * 7)) * (86400 * 7);

          await expect(tx).to.be.emit(firstStrategy, 'Compound').withArgs(signers.deployer, ethers.parseEther('4'));
          await expect(tx).to.be.emit(virtualRewarder, 'NotifyReward').withArgs(ethers.parseEther('4'), currentEpoch);
          await expect(tx).to.be.emit(deployed.votingEscrow, 'Merge').withArgs(firstStrategy, 6, 1);
        });

        it('success merge all tokens to managedNfToken', async () => {
          await expect(deployed.votingEscrow.ownerOf(3)).to.be.revertedWith('ERC721: invalid token ID');
          await expect(deployed.votingEscrow.ownerOf(4)).to.be.revertedWith('ERC721: invalid token ID');
          await expect(deployed.votingEscrow.ownerOf(5)).to.be.revertedWith('ERC721: invalid token ID');
          await expect(deployed.votingEscrow.ownerOf(6)).to.be.revertedWith('ERC721: invalid token ID');

          expect(await deployed.votingEscrow.balanceOf(firstStrategy)).to.be.eq(1);
          expect(await deployed.votingEscrow.balanceOf(signers.otherUser2)).to.be.eq(0);
          expect(await deployed.votingEscrow.balanceOf(signers.fenixTeam)).to.be.eq(0);
          expect(await deployed.votingEscrow.ownerOf(1)).to.be.eq(firstStrategy);
          expect(await deployed.votingEscrow.ownerOf(2)).to.be.eq(signers.otherUser1);

          expect((await deployed.votingEscrow.getNftState(managedNftId)).locked.amount).to.be.eq(ethers.parseEther('11'));
        });

        it('check another states', async () => {
          expect(await firstStrategy.balanceOf(userNftId)).to.be.eq(ethers.parseEther('1'));
          expect(await firstStrategy.totalSupply()).to.be.eq(ethers.parseEther('1'));
        });

        it('success add rewards to epoch', async () => {
          let block = await tx.getBlock();
          let currentEpoch = Math.floor(block!.timestamp / (86400 * 7)) * (86400 * 7);
          expect(await virtualRewarder.rewardsPerEpoch(currentEpoch)).to.be.eq(ethers.parseEther('10'));
        });

        it('user success withdraw with rewards after one epoch', async () => {
          await time.increase(86400 * 7);

          let tx = await deployed.voter.connect(signers.otherUser1).dettachFromManagedNFT(userNftId);

          await expect(tx).to.be.emit(firstStrategy, 'OnDettach').withArgs(userNftId, ethers.parseEther('1'), ethers.parseEther('10'));

          await expect(tx)
            .to.be.emit(virtualRewarder, 'Harvest')
            .withArgs(userNftId, ethers.parseEther('10'), () => true);

          expect(await firstStrategy.balanceOf(userNftId)).to.be.eq(0);
          expect(await firstStrategy.totalSupply()).to.be.eq(0);

          expect((await deployed.votingEscrow.getNftState(managedNftId)).locked.amount).to.be.eq(0);

          expect((await deployed.votingEscrow.getNftState(userNftId)).locked.amount).to.be.eq(ethers.parseEther('11'));
        });
      });
    });
  });
  describe('#compoundVeNFTsAll', async () => {
    describe('Should fail if', async () => {
      it('user try call compound buy flag for public compound not setup', async () => {
        await expect(firstStrategy.connect(signers.otherUser1).compoundVeNFTsAll()).to.be.revertedWithCustomError(
          firstStrategy,
          'AccessDenied',
        );
      });
      it('cal with only managed nft id on balance', async () => {
        await expect(firstStrategy.connect(signers.deployer).compoundVeNFTsAll()).to.be.revertedWithCustomError(
          firstStrategy,
          'NotOtherVeNFTsAvailable',
        );
      });
    });

    describe('success compound all of avialbale veNFT to managed nft id', async () => {
      let tx: ContractTransactionResponse;

      beforeEach(async () => {
        // user1 attach to nest
        await deployed.voter.connect(signers.otherUser1).attachToManagedNFT(userNftId, managedNftId);

        await time.increase(86400 * 7);
        expect((await deployed.votingEscrow.getNftState(managedNftId)).locked.amount).to.be.eq(ethers.parseEther('1'));

        await deployed.fenix.approve(deployed.votingEscrow.target, ethers.parseEther('100'));

        await deployed.votingEscrow.createLockFor(ethers.parseEther('1'), 0, firstStrategy, false, true, 0);
        await deployed.votingEscrow.createLockFor(ethers.parseEther('2'), 0, firstStrategy, false, true, 0);
        await deployed.votingEscrow.createLockFor(ethers.parseEther('3'), 0, firstStrategy, false, true, 0);
        await deployed.votingEscrow.createLockFor(ethers.parseEther('4'), 0, signers.deployer, false, true, 0);

        await deployed.votingEscrow['safeTransferFrom(address,address,uint256)'](signers.deployer, firstStrategy, 6);

        expect(await deployed.votingEscrow.balanceOf(firstStrategy)).to.be.eq(5);
        expect(await deployed.votingEscrow.balanceOf(signers.otherUser2)).to.be.eq(0);
        expect(await deployed.votingEscrow.balanceOf(signers.fenixTeam)).to.be.eq(0);
        expect(await deployed.votingEscrow.ownerOf(1)).to.be.eq(firstStrategy);
        expect(await deployed.votingEscrow.ownerOf(2)).to.be.eq(signers.otherUser1);
        expect(await deployed.votingEscrow.ownerOf(3)).to.be.eq(firstStrategy);
        expect(await deployed.votingEscrow.ownerOf(4)).to.be.eq(firstStrategy);
        expect(await deployed.votingEscrow.ownerOf(5)).to.be.eq(firstStrategy);
        expect(await deployed.votingEscrow.ownerOf(6)).to.be.eq(firstStrategy);

        tx = await firstStrategy.compoundVeNFTsAll();
      });

      it('emit events', async () => {
        let block = await tx.getBlock();
        let currentEpoch = Math.floor(block!.timestamp / (86400 * 7)) * (86400 * 7);

        await expect(tx).to.be.emit(firstStrategy, 'Compound').withArgs(signers.deployer, ethers.parseEther('10'));
        await expect(tx).to.be.emit(virtualRewarder, 'NotifyReward').withArgs(ethers.parseEther('10'), currentEpoch);
        await expect(tx).to.be.emit(deployed.votingEscrow, 'Merge').withArgs(firstStrategy, 3, 1);
        await expect(tx).to.be.emit(deployed.votingEscrow, 'Merge').withArgs(firstStrategy, 4, 1);
        await expect(tx).to.be.emit(deployed.votingEscrow, 'Merge').withArgs(firstStrategy, 5, 1);
        await expect(tx).to.be.emit(deployed.votingEscrow, 'Merge').withArgs(firstStrategy, 6, 1);
      });

      it('success merge all tokens to managedNfToken', async () => {
        await expect(deployed.votingEscrow.ownerOf(3)).to.be.revertedWith('ERC721: invalid token ID');
        await expect(deployed.votingEscrow.ownerOf(4)).to.be.revertedWith('ERC721: invalid token ID');
        await expect(deployed.votingEscrow.ownerOf(5)).to.be.revertedWith('ERC721: invalid token ID');
        await expect(deployed.votingEscrow.ownerOf(6)).to.be.revertedWith('ERC721: invalid token ID');

        expect(await deployed.votingEscrow.balanceOf(firstStrategy)).to.be.eq(1);
        expect(await deployed.votingEscrow.balanceOf(signers.otherUser2)).to.be.eq(0);
        expect(await deployed.votingEscrow.balanceOf(signers.fenixTeam)).to.be.eq(0);
        expect(await deployed.votingEscrow.ownerOf(1)).to.be.eq(firstStrategy);
        expect(await deployed.votingEscrow.ownerOf(2)).to.be.eq(signers.otherUser1);

        expect((await deployed.votingEscrow.getNftState(managedNftId)).locked.amount).to.be.eq(ethers.parseEther('11'));
      });

      it('check another states', async () => {
        expect(await firstStrategy.balanceOf(userNftId)).to.be.eq(ethers.parseEther('1'));
        expect(await firstStrategy.totalSupply()).to.be.eq(ethers.parseEther('1'));
      });

      it('success add rewards to epoch', async () => {
        let block = await tx.getBlock();
        let currentEpoch = Math.floor(block!.timestamp / (86400 * 7)) * (86400 * 7);
        expect(await virtualRewarder.rewardsPerEpoch(currentEpoch)).to.be.eq(ethers.parseEther('10'));
      });

      it('user success withdraw with rewards after one epoch', async () => {
        await time.increase(86400 * 7);

        let tx = await deployed.voter.connect(signers.otherUser1).dettachFromManagedNFT(userNftId);

        await expect(tx).to.be.emit(firstStrategy, 'OnDettach').withArgs(userNftId, ethers.parseEther('1'), ethers.parseEther('10'));

        await expect(tx)
          .to.be.emit(virtualRewarder, 'Harvest')
          .withArgs(userNftId, ethers.parseEther('10'), () => true);

        expect(await firstStrategy.balanceOf(userNftId)).to.be.eq(0);
        expect(await firstStrategy.totalSupply()).to.be.eq(0);

        expect((await deployed.votingEscrow.getNftState(managedNftId)).locked.amount).to.be.eq(0);

        expect((await deployed.votingEscrow.getNftState(userNftId)).locked.amount).to.be.eq(ethers.parseEther('11'));
      });
    });
  });

  describe('#claimBribesWithERC20Recover', async () => {
    it('fails if caller not admin', async () => {
      await expect(
        firstStrategy.connect(signers.otherUser1).claimBribesWithERC20Recover([], [], signers.otherUser1.address, []),
      ).to.be.revertedWithCustomError(firstStrategy, 'AccessDenied');
    });
    it('fails if try recover fenix (strategy without flag for ignor this requirement)', async () => {
      await expect(
        firstStrategy.claimBribesWithERC20Recover([], [], signers.otherUser1.address, [deployed.fenix.target]),
      ).to.be.revertedWithCustomError(firstStrategy, 'IncorrectRecoverToken');
    });

    it('fails if try recover router allowed tokens (strategy without flag for ignor this requirement)', async () => {
      let token = await deployERC20MockToken(signers.deployer, 't', 't', 6);
      await routerV2PathProvider.setAllowedTokenInInputRouters(token.target, true);
      await expect(
        firstStrategy.claimBribesWithERC20Recover([], [], signers.otherUser1.address, [token.target]),
      ).to.be.revertedWithCustomError(firstStrategy, 'IncorrectRecoverToken');
    });

    it('success recover erc20 token', async () => {
      let token = await deployERC20MockToken(signers.deployer, 't', 't', 6);
      await token.mint(firstStrategy.target, 1e6);

      expect(await token.balanceOf(signers.otherUser2.address)).to.be.eq(ZERO);
      expect(await token.balanceOf(firstStrategy.target)).to.be.eq(1e6);

      await expect(firstStrategy.claimBribesWithERC20Recover([], [], signers.otherUser2.address, [token.target]))
        .to.be.emit(firstStrategy, 'Erc20Recover')
        .withArgs(signers.deployer.address, signers.otherUser2.address, token.target, 1e6);

      expect(await token.balanceOf(signers.otherUser2.address)).to.be.eq(1e6);
      expect(await token.balanceOf(firstStrategy)).to.be.eq(ZERO);
    });

    describe('Strategy has IGNORE_RESTRICTIONS_ON_RECOVER_TOKENS flag, success recover', async () => {
      it('FNX  token', async () => {
        await managedNFTManager.setStrategyFlags(firstStrategy, 1);
        expect(await managedNFTManager.getStrategyFlags(firstStrategy)).to.be.eq(1);
        await deployed.fenix.transfer(firstStrategy.target, ethers.parseEther('1'));
        expect(await deployed.fenix.balanceOf(signers.otherUser2.address)).to.be.eq(ZERO);
        expect(await deployed.fenix.balanceOf(firstStrategy.target)).to.be.eq(ethers.parseEther('1'));

        await expect(firstStrategy.claimBribesWithERC20Recover([], [], signers.otherUser2.address, [deployed.fenix.target]))
          .to.be.emit(firstStrategy, 'Erc20Recover')
          .withArgs(signers.deployer.address, signers.otherUser2.address, deployed.fenix.target, ethers.parseEther('1'));

        expect(await deployed.fenix.balanceOf(signers.otherUser2.address)).to.be.eq(ethers.parseEther('1'));
        expect(await deployed.fenix.balanceOf(firstStrategy)).to.be.eq(0);
      });
      it('router allowed tokens', async () => {
        await managedNFTManager.setStrategyFlags(firstStrategy, 1);
        expect(await managedNFTManager.getStrategyFlags(firstStrategy)).to.be.eq(1);

        let token = await deployERC20MockToken(signers.deployer, 't', 't', 6);
        await routerV2PathProvider.setAllowedTokenInInputRouters(token.target, true);

        await token.mint(firstStrategy.target, ethers.parseEther('1'));
        expect(await token.balanceOf(signers.otherUser2.address)).to.be.eq(ZERO);
        expect(await token.balanceOf(firstStrategy.target)).to.be.eq(ethers.parseEther('1'));

        await expect(firstStrategy.claimBribesWithERC20Recover([], [], signers.otherUser2.address, [token.target]))
          .to.be.emit(firstStrategy, 'Erc20Recover')
          .withArgs(signers.deployer.address, signers.otherUser2.address, token.target, ethers.parseEther('1'));

        expect(await token.balanceOf(signers.otherUser2.address)).to.be.eq(ethers.parseEther('1'));
        expect(await token.balanceOf(firstStrategy)).to.be.eq(0);
      });
    });
  });

  describe('#claimBribesWithTokensRecover', async () => {
    it('fails if caller not admin', async () => {
      await expect(
        firstStrategy.connect(signers.otherUser1).claimBribesWithTokensRecover([], [], signers.otherUser1.address, [], []),
      ).to.be.revertedWithCustomError(firstStrategy, 'AccessDenied');
    });

    it('fails if try recover fenix (strategy without flag for ignor this requirement)', async () => {
      await expect(
        firstStrategy.claimBribesWithTokensRecover([], [], signers.otherUser1.address, [deployed.fenix.target], []),
      ).to.be.revertedWithCustomError(firstStrategy, 'IncorrectRecoverToken');
    });

    it('fails if try recover veNFTS (strategy without flag for ignor this requirement)', async () => {
      await expect(firstStrategy.claimBribesWithTokensRecover([], [], signers.otherUser1.address, [], [2])).to.be.revertedWithCustomError(
        firstStrategy,
        'IncorrectRecoverToken',
      );
    });

    it('fails if try recover router allowed tokens (strategy without flag for ignor this requirement)', async () => {
      let token = await deployERC20MockToken(signers.deployer, 't', 't', 6);
      await routerV2PathProvider.setAllowedTokenInInputRouters(token.target, true);
      await expect(
        firstStrategy.claimBribesWithTokensRecover([], [], signers.otherUser1.address, [token.target], []),
      ).to.be.revertedWithCustomError(firstStrategy, 'IncorrectRecoverToken');
    });

    it('success recover erc20 token', async () => {
      let token = await deployERC20MockToken(signers.deployer, 't', 't', 6);
      await token.mint(firstStrategy.target, 1e6);

      expect(await token.balanceOf(signers.otherUser2.address)).to.be.eq(ZERO);
      expect(await token.balanceOf(firstStrategy.target)).to.be.eq(1e6);

      await expect(firstStrategy.claimBribesWithTokensRecover([], [], signers.otherUser2.address, [token.target], []))
        .to.be.emit(firstStrategy, 'Erc20Recover')
        .withArgs(signers.deployer.address, signers.otherUser2.address, token.target, 1e6);

      expect(await token.balanceOf(signers.otherUser2.address)).to.be.eq(1e6);
      expect(await token.balanceOf(firstStrategy)).to.be.eq(ZERO);
    });

    describe('Strategy has IGNORE_RESTRICTIONS_ON_RECOVER_NFT_TOKENS flag', async () => {
      beforeEach(async () => {
        await managedNFTManager.setStrategyFlags(firstStrategy, 2);
        expect(await managedNFTManager.getStrategyFlags(firstStrategy)).to.be.eq(2);

        await deployed.fenix.approve(deployed.votingEscrow.target, ethers.parseEther('3'));

        await deployed.votingEscrow.createLockFor(ethers.parseEther('1'), 0, firstStrategy, false, true, 0);
        await deployed.votingEscrow.createLockFor(ethers.parseEther('1'), 0, firstStrategy, false, true, 0);
        await deployed.votingEscrow.createLockFor(ethers.parseEther('1'), 0, firstStrategy, false, true, 0);

        expect(await deployed.votingEscrow.balanceOf(firstStrategy)).to.be.eq(4);
        expect(await deployed.votingEscrow.balanceOf(signers.otherUser2)).to.be.eq(0);
        expect(await deployed.votingEscrow.balanceOf(signers.fenixTeam)).to.be.eq(0);

        expect(await deployed.votingEscrow.ownerOf(1)).to.be.eq(firstStrategy);
        expect(managedNftId).to.be.eq(1);

        expect(await deployed.votingEscrow.ownerOf(2)).to.be.eq(signers.otherUser1);
        expect(userNftId).to.be.eq(2);

        expect(await deployed.votingEscrow.ownerOf(3)).to.be.eq(firstStrategy);
        expect(await deployed.votingEscrow.ownerOf(4)).to.be.eq(firstStrategy);
        expect(await deployed.votingEscrow.ownerOf(5)).to.be.eq(firstStrategy);
      });

      it('fail if try recover not own tokens', async () => {
        await expect(firstStrategy.claimBribesWithTokensRecover([], [], signers.otherUser2.address, [], [2])).to.be.revertedWith(
          'ERC721: caller is not token owner or approved',
        );
      });

      it('fail if try recover managed token id', async () => {
        await expect(
          firstStrategy.claimBribesWithTokensRecover([], [], signers.otherUser2.address, [], [managedNftId]),
        ).to.be.revertedWithCustomError(firstStrategy, 'NotAllowedActionWithManagedTokenId');
      });

      it('success recover veFNX  token', async () => {
        let tx = await firstStrategy.claimBribesWithTokensRecover([], [], signers.otherUser2.address, [], [3, 4]);
        await expect(tx)
          .to.be.emit(firstStrategy, 'Erc721Recover')
          .withArgs(signers.deployer.address, signers.otherUser2, deployed.votingEscrow.target, [3, 4]);

        await expect(tx).to.be.emit(deployed.votingEscrow, 'Transfer').withArgs(firstStrategy, signers.otherUser2, 3);
        await expect(tx).to.be.emit(deployed.votingEscrow, 'Transfer').withArgs(firstStrategy, signers.otherUser2, 4);

        expect(await deployed.votingEscrow.balanceOf(firstStrategy)).to.be.eq(2);
        expect(await deployed.votingEscrow.balanceOf(signers.otherUser2)).to.be.eq(2);
        expect(await deployed.votingEscrow.balanceOf(signers.fenixTeam)).to.be.eq(0);

        expect(await deployed.votingEscrow.ownerOf(1)).to.be.eq(firstStrategy);
        expect(await deployed.votingEscrow.ownerOf(2)).to.be.eq(signers.otherUser1);

        expect(await deployed.votingEscrow.ownerOf(3)).to.be.eq(signers.otherUser2);
        expect(await deployed.votingEscrow.ownerOf(4)).to.be.eq(signers.otherUser2);
        expect(await deployed.votingEscrow.ownerOf(5)).to.be.eq(firstStrategy);
      });
    });

    describe('Strategy has IGNORE_RESTRICTIONS_ON_RECOVER_TOKENS flag, success recover', async () => {
      it('FNX  token', async () => {
        await managedNFTManager.setStrategyFlags(firstStrategy, 1);
        expect(await managedNFTManager.getStrategyFlags(firstStrategy)).to.be.eq(1);
        await deployed.fenix.transfer(firstStrategy.target, ethers.parseEther('1'));
        expect(await deployed.fenix.balanceOf(signers.otherUser2.address)).to.be.eq(ZERO);
        expect(await deployed.fenix.balanceOf(firstStrategy.target)).to.be.eq(ethers.parseEther('1'));

        await expect(firstStrategy.claimBribesWithTokensRecover([], [], signers.otherUser2.address, [deployed.fenix.target], []))
          .to.be.emit(firstStrategy, 'Erc20Recover')
          .withArgs(signers.deployer.address, signers.otherUser2.address, deployed.fenix.target, ethers.parseEther('1'));

        expect(await deployed.fenix.balanceOf(signers.otherUser2.address)).to.be.eq(ethers.parseEther('1'));
        expect(await deployed.fenix.balanceOf(firstStrategy)).to.be.eq(0);
      });

      it('router allowed tokens', async () => {
        await managedNFTManager.setStrategyFlags(firstStrategy, 1);
        expect(await managedNFTManager.getStrategyFlags(firstStrategy)).to.be.eq(1);

        let token = await deployERC20MockToken(signers.deployer, 't', 't', 6);
        await routerV2PathProvider.setAllowedTokenInInputRouters(token.target, true);

        await token.mint(firstStrategy.target, ethers.parseEther('1'));
        expect(await token.balanceOf(signers.otherUser2.address)).to.be.eq(ZERO);
        expect(await token.balanceOf(firstStrategy.target)).to.be.eq(ethers.parseEther('1'));

        await expect(firstStrategy.claimBribesWithTokensRecover([], [], signers.otherUser2.address, [token.target], []))
          .to.be.emit(firstStrategy, 'Erc20Recover')
          .withArgs(signers.deployer.address, signers.otherUser2.address, token.target, ethers.parseEther('1'));

        expect(await token.balanceOf(signers.otherUser2.address)).to.be.eq(ethers.parseEther('1'));
        expect(await token.balanceOf(firstStrategy)).to.be.eq(0);
      });
    });
  });

  describe('#erc20Recover', async () => {
    it('fails if caller not admin', async () => {
      await expect(
        firstStrategy.connect(signers.otherUser1).erc20Recover(deployed.fenix.target, signers.otherUser1.address),
      ).to.be.revertedWithCustomError(firstStrategy, 'AccessDenied');
    });
    it('fails if try recover fenix', async () => {
      await expect(firstStrategy.erc20Recover(deployed.fenix.target, signers.otherUser1.address)).to.be.revertedWithCustomError(
        firstStrategy,
        'IncorrectRecoverToken',
      );
    });
    it('fails if try recover router allowed tokens', async () => {
      let token = await deployERC20MockToken(signers.deployer, 't', 't', 6);

      expect(await routerV2PathProvider.isAllowedTokenInInputRoutes(token.target)).to.be.false;

      await expect(firstStrategy.erc20Recover(token.target, signers.otherUser1.address)).to.be.not.reverted;

      await routerV2PathProvider.setAllowedTokenInInputRouters(token.target, true);
      expect(await routerV2PathProvider.isAllowedTokenInInputRoutes(token.target)).to.be.true;

      await expect(firstStrategy.erc20Recover(token.target, signers.otherUser1.address)).to.be.revertedWithCustomError(
        firstStrategy,
        'IncorrectRecoverToken',
      );
    });

    describe('Strategy has IGNORE_RESTRICTIONS_ON_RECOVER_TOKENS flag, success recover', async () => {
      it('FNX  token', async () => {
        await managedNFTManager.setStrategyFlags(firstStrategy, 1);
        expect(await managedNFTManager.getStrategyFlags(firstStrategy)).to.be.eq(1);
        await deployed.fenix.transfer(firstStrategy.target, ethers.parseEther('1'));
        expect(await deployed.fenix.balanceOf(signers.otherUser2.address)).to.be.eq(ZERO);
        expect(await deployed.fenix.balanceOf(firstStrategy.target)).to.be.eq(ethers.parseEther('1'));

        await expect(firstStrategy.erc20Recover(deployed.fenix.target, signers.otherUser2.address))
          .to.be.emit(firstStrategy, 'Erc20Recover')
          .withArgs(signers.deployer.address, signers.otherUser2.address, deployed.fenix.target, ethers.parseEther('1'));

        expect(await deployed.fenix.balanceOf(signers.otherUser2.address)).to.be.eq(ethers.parseEther('1'));
        expect(await deployed.fenix.balanceOf(firstStrategy)).to.be.eq(0);
      });

      it('router allowed tokens', async () => {
        await managedNFTManager.setStrategyFlags(firstStrategy, 1);
        expect(await managedNFTManager.getStrategyFlags(firstStrategy)).to.be.eq(1);

        let token = await deployERC20MockToken(signers.deployer, 't', 't', 6);
        await routerV2PathProvider.setAllowedTokenInInputRouters(token.target, true);

        await token.mint(firstStrategy.target, ethers.parseEther('1'));
        expect(await token.balanceOf(signers.otherUser2.address)).to.be.eq(ZERO);
        expect(await token.balanceOf(firstStrategy.target)).to.be.eq(ethers.parseEther('1'));

        await expect(firstStrategy.erc20Recover(token, signers.otherUser2.address))
          .to.be.emit(firstStrategy, 'Erc20Recover')
          .withArgs(signers.deployer.address, signers.otherUser2.address, token.target, ethers.parseEther('1'));

        expect(await token.balanceOf(signers.otherUser2.address)).to.be.eq(ethers.parseEther('1'));
        expect(await token.balanceOf(firstStrategy)).to.be.eq(0);
      });
    });

    it('success recover erc20 token', async () => {
      let token = await deployERC20MockToken(signers.deployer, 't', 't', 6);
      await token.mint(firstStrategy.target, 1e6);

      expect(await token.balanceOf(signers.otherUser2.address)).to.be.eq(ZERO);
      expect(await token.balanceOf(firstStrategy.target)).to.be.eq(1e6);

      await expect(firstStrategy.erc20Recover(token.target, signers.otherUser2.address))
        .to.be.emit(firstStrategy, 'Erc20Recover')
        .withArgs(signers.deployer.address, signers.otherUser2.address, token.target, 1e6);

      expect(await token.balanceOf(signers.otherUser2.address)).to.be.eq(1e6);
      expect(await token.balanceOf(firstStrategy)).to.be.eq(ZERO);
    });
  });

  describe('#erc721Recover', async () => {
    it('fails if caller not admin', async () => {
      await expect(
        firstStrategy.connect(signers.otherUser1).erc721Recover(deployed.votingEscrow, signers.fenixTeam, []),
      ).to.be.revertedWithCustomError(firstStrategy, 'AccessDenied');
    });

    it('fails if try recover votingEscrow nfts', async () => {
      await expect(firstStrategy.erc721Recover(deployed.votingEscrow, signers.fenixTeam, [])).to.be.revertedWithCustomError(
        firstStrategy,
        'IncorrectRecoverToken',
      );
    });

    it('fails if try recover managed nft token (allowed recover veNFTS by flags', async () => {
      await managedNFTManager.setStrategyFlags(firstStrategy, 2);
      await expect(firstStrategy.erc721Recover(deployed.votingEscrow, signers.fenixTeam, [managedNftId])).to.be.revertedWithCustomError(
        firstStrategy,
        'NotAllowedActionWithManagedTokenId',
      );
    });

    it('success recover singel erc721 token', async () => {
      let token = await deployERC721MockToken(signers.deployer, 't', 't');
      await token.mint(firstStrategy.target);

      expect(await token.balanceOf(firstStrategy)).to.be.eq(1);
      expect(await token.balanceOf(signers.fenixTeam)).to.be.eq(0);
      expect(await token.ownerOf(0)).to.be.eq(firstStrategy);
      let tx = await firstStrategy.erc721Recover(token.target, signers.fenixTeam.address, [0]);
      await expect(tx)
        .to.be.emit(firstStrategy, 'Erc721Recover')
        .withArgs(signers.deployer.address, signers.fenixTeam.address, token.target, [0]);

      await expect(tx).to.be.emit(token, 'Transfer').withArgs(firstStrategy, signers.fenixTeam.address, 0);

      expect(await token.balanceOf(firstStrategy)).to.be.eq(0);
      expect(await token.balanceOf(signers.fenixTeam)).to.be.eq(1);
      expect(await token.ownerOf(0)).to.be.eq(signers.fenixTeam);
    });

    it('success recover multi erc721 tokens', async () => {
      let token = await deployERC721MockToken(signers.deployer, 't', 't');
      await token.mint(firstStrategy.target);
      await token.mint(firstStrategy.target);
      await token.mint(firstStrategy.target);
      await token.mint(firstStrategy.target);
      await token.mint(firstStrategy.target);

      expect(await token.balanceOf(firstStrategy)).to.be.eq(5);
      expect(await token.balanceOf(signers.fenixTeam)).to.be.eq(0);
      expect(await token.ownerOf(0)).to.be.eq(firstStrategy);
      expect(await token.ownerOf(1)).to.be.eq(firstStrategy);
      expect(await token.ownerOf(2)).to.be.eq(firstStrategy);
      expect(await token.ownerOf(3)).to.be.eq(firstStrategy);
      expect(await token.ownerOf(4)).to.be.eq(firstStrategy);

      let tx = await firstStrategy.erc721Recover(token.target, signers.fenixTeam.address, [1, 2, 3]);
      await expect(tx)
        .to.be.emit(firstStrategy, 'Erc721Recover')
        .withArgs(signers.deployer.address, signers.fenixTeam.address, token.target, [1, 2, 3]);

      await expect(tx).to.be.emit(token, 'Transfer').withArgs(firstStrategy, signers.fenixTeam.address, 1);
      await expect(tx).to.be.emit(token, 'Transfer').withArgs(firstStrategy, signers.fenixTeam.address, 2);
      await expect(tx).to.be.emit(token, 'Transfer').withArgs(firstStrategy, signers.fenixTeam.address, 3);

      expect(await token.balanceOf(firstStrategy)).to.be.eq(2);
      expect(await token.balanceOf(signers.fenixTeam)).to.be.eq(3);
      expect(await token.ownerOf(0)).to.be.eq(firstStrategy);
      expect(await token.ownerOf(1)).to.be.eq(signers.fenixTeam);
      expect(await token.ownerOf(2)).to.be.eq(signers.fenixTeam);
      expect(await token.ownerOf(3)).to.be.eq(signers.fenixTeam);
      expect(await token.ownerOf(4)).to.be.eq(firstStrategy);
    });

    describe('Strategy has IGNORE_RESTRICTIONS_ON_RECOVER_VE_NFT_TOKENS flag, success recover veNFT', async () => {
      beforeEach(async () => {
        await managedNFTManager.setStrategyFlags(firstStrategy, 2);
        expect(await managedNFTManager.getStrategyFlags(firstStrategy)).to.be.eq(2);

        await deployed.fenix.approve(deployed.votingEscrow.target, ethers.parseEther('3'));

        await deployed.votingEscrow.createLockFor(ethers.parseEther('1'), 0, firstStrategy, false, true, 0);
        await deployed.votingEscrow.createLockFor(ethers.parseEther('1'), 0, firstStrategy, false, true, 0);
        await deployed.votingEscrow.createLockFor(ethers.parseEther('1'), 0, firstStrategy, false, true, 0);

        expect(await deployed.votingEscrow.balanceOf(firstStrategy)).to.be.eq(4);
        expect(await deployed.votingEscrow.balanceOf(signers.otherUser2)).to.be.eq(0);
        expect(await deployed.votingEscrow.balanceOf(signers.fenixTeam)).to.be.eq(0);

        expect(await deployed.votingEscrow.ownerOf(1)).to.be.eq(firstStrategy);
        expect(managedNftId).to.be.eq(1);

        expect(await deployed.votingEscrow.ownerOf(2)).to.be.eq(signers.otherUser1);
        expect(userNftId).to.be.eq(2);

        expect(await deployed.votingEscrow.ownerOf(3)).to.be.eq(firstStrategy);
        expect(await deployed.votingEscrow.ownerOf(4)).to.be.eq(firstStrategy);
        expect(await deployed.votingEscrow.ownerOf(5)).to.be.eq(firstStrategy);
      });

      it('fail if try recover not own tokens', async () => {
        await expect(firstStrategy.erc721Recover(deployed.votingEscrow, signers.otherUser2, [2])).to.be.revertedWith(
          'ERC721: caller is not token owner or approved',
        );
      });

      it('fail if try recover managed token id', async () => {
        await expect(firstStrategy.erc721Recover(deployed.votingEscrow, signers.otherUser2, [managedNftId])).to.be.revertedWithCustomError(
          firstStrategy,
          'NotAllowedActionWithManagedTokenId',
        );
      });

      it('success recover veFNX  token', async () => {
        let tx = await firstStrategy.erc721Recover(deployed.votingEscrow, signers.otherUser2, [3, 4]);
        await expect(tx)
          .to.be.emit(firstStrategy, 'Erc721Recover')
          .withArgs(signers.deployer.address, signers.otherUser2, deployed.votingEscrow.target, [3, 4]);

        await expect(tx).to.be.emit(deployed.votingEscrow, 'Transfer').withArgs(firstStrategy, signers.otherUser2, 3);
        await expect(tx).to.be.emit(deployed.votingEscrow, 'Transfer').withArgs(firstStrategy, signers.otherUser2, 4);

        expect(await deployed.votingEscrow.balanceOf(firstStrategy)).to.be.eq(2);
        expect(await deployed.votingEscrow.balanceOf(signers.otherUser2)).to.be.eq(2);
        expect(await deployed.votingEscrow.balanceOf(signers.fenixTeam)).to.be.eq(0);

        expect(await deployed.votingEscrow.ownerOf(1)).to.be.eq(firstStrategy);
        expect(await deployed.votingEscrow.ownerOf(2)).to.be.eq(signers.otherUser1);

        expect(await deployed.votingEscrow.ownerOf(3)).to.be.eq(signers.otherUser2);
        expect(await deployed.votingEscrow.ownerOf(4)).to.be.eq(signers.otherUser2);
        expect(await deployed.votingEscrow.ownerOf(5)).to.be.eq(firstStrategy);
      });
    });
  });
  describe('Buyback functionality', async () => {
    it('buyback target token should return fenix ', async () => {
      expect(await firstStrategy.getBuybackTargetToken()).to.be.eq(deployed.fenix.target);
    });
    describe('#buybackByV2', async () => {
      it('fails if caller not admin or authorized user', async () => {
        await expect(
          firstStrategy.connect(signers.otherUser1).buybackTokenByV2(signers.otherUser1.address, [], 1, 1),
        ).to.be.revertedWithCustomError(firstStrategy, 'AccessDenied');

        await managedNFTManager.setAuthorizedUser(managedNftId, signers.otherUser1.address);

        await expect(
          firstStrategy.connect(signers.otherUser1).buybackTokenByV2(signers.otherUser1.address, [], 1, 1),
        ).to.be.not.revertedWithCustomError(firstStrategy, 'AccessDenied');
      });
    });
  });
});
