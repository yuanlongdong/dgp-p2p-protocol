#!/usr/bin/env node

/**
 * Separation-of-duties check for security/release workflow.
 * Fails when the same identity appears in conflicting roles.
 */

function norm(v) {
  return (v || "").trim().toLowerCase();
}

const actor = norm(process.env.GITHUB_ACTOR);
const developer = norm(process.env.SECURITY_CHANGE_AUTHOR || actor);
const reviewer = norm(process.env.SECURITY_REVIEWER);
const approver = norm(process.env.SECURITY_APPROVER);
const strict = (process.env.COI_STRICT || "1") === "1";

const issues = [];
const warnings = [];

if (!developer) warnings.push("SECURITY_CHANGE_AUTHOR/GITHUB_ACTOR is empty");
if (!reviewer) warnings.push("SECURITY_REVIEWER is empty");
if (!approver) warnings.push("SECURITY_APPROVER is empty");

if (developer && reviewer && developer === reviewer) {
  issues.push("利益冲突：变更开发者与安全复核人不能为同一人");
}
if (developer && approver && developer === approver) {
  issues.push("利益冲突：变更开发者与发布审批人不能为同一人");
}
if (reviewer && approver && reviewer === approver) {
  issues.push("职责冲突：安全复核人与发布审批人应相互独立");
}

console.log("[coi-check] roles");
console.log(`- developer=${developer || "<empty>"}`);
console.log(`- reviewer=${reviewer || "<empty>"}`);
console.log(`- approver=${approver || "<empty>"}`);

if (warnings.length > 0) {
  console.log("[coi-check] warnings:");
  for (const w of warnings) console.log(`- ${w}`);
}

if (issues.length > 0) {
  console.error("[coi-check] failed:");
  for (const e of issues) console.error(`- ${e}`);
  process.exit(1);
}

if (strict && warnings.length > 0) {
  console.error("[coi-check] strict mode failed due to missing role configuration");
  process.exit(1);
}

console.log("[coi-check] passed");
