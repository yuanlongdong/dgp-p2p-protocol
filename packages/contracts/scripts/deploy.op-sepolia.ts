import { deployAll } from "./deploy.common";

async function main() {
  await deployAll();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
