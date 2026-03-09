import { deployAndSave } from "./deploy-and-save";

deployAndSave("opSepolia").catch((e) => {
  console.error(e);
  process.exit(1);
});
