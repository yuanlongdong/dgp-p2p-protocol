import { expect } from "chai";

export async function expectRevertMessage(
  action: Promise<unknown>,
  expectedMessage: string
) {
  try {
    await action;
    expect.fail(`Expected revert containing \"${expectedMessage}\"`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    expect(message).to.include(expectedMessage);
  }
}

export async function expectCustomError(
  action: Promise<unknown>,
  errorName: string
) {
  try {
    await action;
    expect.fail(`Expected custom error \"${errorName}\"`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    expect(message).to.include(errorName);
  }
}
