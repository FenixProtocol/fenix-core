import { loadFixture } from '@nomicfoundation/hardhat-toolbox/network-helpers';
import { expect } from 'chai';
import { ethers } from 'hardhat';
import { ERC20Mock, GaugeFactoryUpgradeable, GaugeFactoryUpgradeable__factory, Solex } from '../../typechain-types';
import { ERRORS, ZERO_ADDRESS } from '../utils/constants';
import completeFixture, { CoreFixtureDeployed, SignersList, deployERC20MockToken } from '../utils/coreFixture';

describe('GaugeFactoryUpgradeable', function () {
  let deployed: CoreFixtureDeployed;
  let signers: SignersList;

  let factory: GaugeFactoryUpgradeable__factory;
  let gaugeFactory: GaugeFactoryUpgradeable;

  let fenix: Solex;
  let tokenTR6: ERC20Mock;
  let tokenTR18: ERC20Mock;

  beforeEach(async function () {
    deployed = await loadFixture(completeFixture);
    signers = deployed.signers;
    fenix = deployed.solex;

    tokenTR6 = await deployERC20MockToken(signers.deployer, 'TR6', 'TR6', 6);
    tokenTR18 = await deployERC20MockToken(signers.deployer, 'TR18', 'TR18', 18);

    factory = (await ethers.getContractFactory('GaugeFactoryUpgradeable')) as GaugeFactoryUpgradeable__factory;

    gaugeFactory = deployed.gaugeFactory;
  });

  describe('Deployment', function () {
    it('Should fail if try initialize on implementation', async function () {
      let t = await factory.deploy();
      await expect(
        t.initialize(deployed.modeSfs.target, deployed.sfsAssignTokenId, ZERO_ADDRESS, ZERO_ADDRESS, ZERO_ADDRESS),
      ).to.be.revertedWith(ERRORS.Initializable.Initialized);
    });
    it('Should fail if try second time to initialize', async function () {
      await expect(
        gaugeFactory.initialize(
          deployed.modeSfs.target,
          deployed.sfsAssignTokenId,
          deployed.voter.target,
          deployed.gaugeImplementation.target,
          deployed.merklGaugeMiddleman.target,
        ),
      ).to.be.revertedWith(ERRORS.Initializable.Initialized);
    });
    it('Should corect set initial parameters', async function () {
      expect(await gaugeFactory.last_gauge()).to.be.equal(ZERO_ADDRESS);
      expect(await gaugeFactory.gaugeOwner()).to.be.equal(signers.deployer.address);
      expect(await gaugeFactory.owner()).to.be.equal(signers.deployer.address);
      expect(await gaugeFactory.defaultSfsAssignTokenId()).to.be.equal(deployed.sfsAssignTokenId);
      expect(await gaugeFactory.defaultModeSfs()).to.be.equal(deployed.modeSfs.target);

      expect(await gaugeFactory.gaugeImplementation()).to.be.equal(deployed.gaugeImplementation.target);
      expect(await gaugeFactory.merklGaugeMiddleman()).to.be.equal(deployed.merklGaugeMiddleman.target);
    });
  });
  describe('#setDefaultModeSfs', async () => {
    it('fails if caller is not have owner', async () => {
      await expect(gaugeFactory.connect(signers.otherUser1).setDefaultModeSfs(signers.otherUser1.address)).to.be.revertedWith(
        ERRORS.Ownable.NotOwner,
      );
    });
    it('should corect set default mode sfs ', async () => {
      expect(await gaugeFactory.defaultModeSfs()).to.be.eq(deployed.modeSfs.target);
      await expect(gaugeFactory.setDefaultModeSfs(signers.otherUser1.address))
        .to.be.emit(gaugeFactory, 'DefaultModeSfs')
        .withArgs(signers.otherUser1.address);

      expect(await gaugeFactory.defaultModeSfs()).to.be.not.eq(deployed.modeSfs.target);
      expect(await gaugeFactory.defaultModeSfs()).to.be.eq(signers.otherUser1.address);
    });
  });
  describe('#setMerklGaugeMiddleman', async () => {
    it('fails if caller is not owner', async () => {
      await expect(gaugeFactory.connect(signers.otherUser1).setMerklGaugeMiddleman(signers.otherUser1.address)).to.be.revertedWith(
        ERRORS.Ownable.NotOwner,
      );
    });
    it('should corect set merkle gauge middleman ', async () => {
      expect(await gaugeFactory.merklGaugeMiddleman()).to.be.eq(deployed.merklGaugeMiddleman.target);

      await gaugeFactory.setMerklGaugeMiddleman(signers.otherUser1.address);

      expect(await gaugeFactory.merklGaugeMiddleman()).to.be.not.eq(deployed.merklGaugeMiddleman.target);
      expect(await gaugeFactory.merklGaugeMiddleman()).to.be.eq(signers.otherUser1.address);
    });
  });

  describe('#createGauge', async () => {
    it('fails if caller is not owner', async () => {
      await expect(
        gaugeFactory
          .connect(signers.otherUser1)
          .createGauge(ZERO_ADDRESS, ZERO_ADDRESS, ZERO_ADDRESS, ZERO_ADDRESS, ZERO_ADDRESS, ZERO_ADDRESS, false, ZERO_ADDRESS),
      ).to.be.revertedWith('only voter or owner');
    });
  });
});
