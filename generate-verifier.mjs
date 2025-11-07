import { UltraHonkBackend } from '@aztec/bb.js';
import { readFileSync, writeFileSync } from 'fs';

async function generateVerifier() {
  console.log('Loading circuit...');
  const circuit = JSON.parse(
    readFileSync('./wallet_proof/target/wallet_proof.json', 'utf8')
  );

  console.log('Creating backend...');
  const backend = new UltraHonkBackend(circuit.bytecode);

  console.log('Generating Solidity verifier contract...');
  const contract = await backend.getSolidityVerifier();

  console.log('Writing verifier contract...');
  writeFileSync('./contracts/UltraVerifier.sol', contract);

  console.log('✅ Verifier contract generated at: contracts/UltraVerifier.sol');
  console.log(`Contract size: ${contract.length} bytes`);
}

generateVerifier().catch(console.error);
