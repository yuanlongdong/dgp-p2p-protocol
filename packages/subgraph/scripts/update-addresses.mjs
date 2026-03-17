import fs from 'fs';
import path from 'path';

const root = process.cwd();
const network = process.argv[2] || 'arbSepolia';
const deploymentPath = path.join(root, '..', 'contracts', 'deployments', `${network}.json`);
const manifestPath = path.join(root, 'subgraph.yaml');

if (!fs.existsSync(deploymentPath)) {
  console.error(`Deployment file not found: ${deploymentPath}`);
  process.exit(1);
}

const deployment = JSON.parse(fs.readFileSync(deploymentPath, 'utf8'));
let yaml = fs.readFileSync(manifestPath, 'utf8');

yaml = yaml.replace(
  /(name: EscrowFactory[\s\S]*?address:\s*")[0xA-Fa-f0-9]{40}(")/,
  `$1${deployment.escrowFactory}$2`
);
yaml = yaml.replace(
  /(name: DisputeModule[\s\S]*?address:\s*")[0xA-Fa-f0-9]{40}(")/,
  `$1${deployment.disputeModule}$2`
);
yaml = yaml.replace(
  /(name: DGPGovernorLite[\s\S]*?address:\s*")[0xA-Fa-f0-9]{40}(")/,
  `$1${deployment.dgpGovernor}$2`
);
yaml = yaml.replace(
  /(name: ComplianceRegistry[\s\S]*?address:\s*")[0xA-Fa-f0-9]{40}(")/,
  `$1${deployment.complianceRegistry}$2`
);

const net = deployment.network === 'opSepolia' ? 'optimism-sepolia' : 'arbitrum-sepolia';
yaml = yaml.replace(/network:\s*arbitrum-sepolia/g, `network: ${net}`);
yaml = yaml.replace(/network:\s*optimism-sepolia/g, `network: ${net}`);

fs.writeFileSync(manifestPath, yaml);
console.log(`Updated subgraph manifest from ${deploymentPath}`);
