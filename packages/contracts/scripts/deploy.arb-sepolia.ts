import { deployAndSave } from "./deploy-and-save";

deployAndSave("arbSepolia").catch((e) => {
  console.error(e);
  process.exit(1);
});
