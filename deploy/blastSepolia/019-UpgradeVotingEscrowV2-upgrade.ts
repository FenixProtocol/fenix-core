import {
  AliasDeployedContracts,
  deploy,
  deployNewImplementationAndUpgradeProxy,
  deployProxy,
  getBlastGovernorAddress,
  getDeployedContractsAddressList,
  getProxyAdminAddress,
  logTx,
} from '../../utils/Deploy';
import { ethers } from 'hardhat';
import { InstanceName } from '../../utils/Names';

async function main() {
  const [deployer] = await ethers.getSigners();
  const BlastGovernor = await getBlastGovernorAddress();
  const DeployedContracts = await getDeployedContractsAddressList();

  await deployNewImplementationAndUpgradeProxy({
    implementationName: InstanceName.VotingEscrowUpgradeable,
    deployer: deployer,
    implementationConstructorArguments: [BlastGovernor],
    implementationSaveAlias: AliasDeployedContracts.VotingEscrowUpgradeable_Implementation,
    proxyAddress: DeployedContracts[AliasDeployedContracts.VotingEscrowUpgradeable_Proxy],
    proxyAdmin: await getProxyAdminAddress(),
    verify: true,
  });
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
