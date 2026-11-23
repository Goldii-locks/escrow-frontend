/**
 * Plain-language summary of the escrow rules shown before the client signs.
 *
 * Keep this module as the single source of truth for the contract's
 * behavioural promises so it can be updated alongside the contract. The
 * create wizard's review step renders these lines in a "What you're agreeing
 * to" panel and requires an explicit checkbox before Create is enabled.
 */

/** A single rule bullet rendered in the agreement panel. */
export interface AgreementLine {
  /** Short label, e.g. "Auto-release". */
  label: string;
  /** Full sentence the user reads before signing. */
  text: string;
}

/** Input values used to generate the agreement summary. */
export interface AgreementInput {
  /** Auto-release window in days (the form's Response Deadline). */
  autoReleaseDays: string;
  /** Arbiter's Stellar address. */
  arbiter: string;
}

/**
 * Build the list of plain-language rule bullets from the form values and the
 * contract's fixed rules. The bullets cover the consequences the landing page
 * describes but the review step previously omitted.
 *
 * The platform-admin pause/release rule is fixed (it does not depend on the
 * form) and is included so the client is told about it in one place.
 */
export function agreementLines(input: AgreementInput): AgreementLine[] {
  const days = input.autoReleaseDays?.trim() || "7";
  const arbiter = input.arbiter?.trim() || "the arbiter";

  return [
    {
      label: "Funds locked",
      text: "The funds you deposit are locked in the escrow contract until a release or refund condition is met.",
    },
    {
      label: "Auto-release",
      text: `Each delivered milestone auto-releases to the freelancer ${days} ${days === "1" ? "day" : "days"} after delivery, unless you explicitly approve or dispute it.`,
    },
    {
      label: "Arbiter",
      text: `The arbiter at ${arbiter} can split or refund any disputed milestone.`,
    },
    {
      label: "Platform admin",
      text: "The platform admin can pause the escrow and force a release or refund of any milestone.",
    },
  ];
}
