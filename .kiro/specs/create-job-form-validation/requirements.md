# Requirements Document

## Introduction

The create job form in the escrow frontend currently provides no field-level validation feedback. When a user submits the form with invalid input, errors surface only after an attempted backend call (or as a generic submission banner), with no indication of which field is wrong or why.

This feature adds inline field error indicators and a submission-level alert message so users receive immediate, descriptive visual feedback for each validation failure before — and when — they attempt to submit the form. The scope is limited to client-side validation of the five existing fields: Freelancer Address, Arbiter Address, Token Contract Address, Response Deadline, and Milestones. No form layout changes, no new runtime libraries, and no backend changes are in scope.

---

## Glossary

- **Form**: The "Create New Job" form rendered by `app/create/page.tsx`.
- **Field Error**: A per-field validation message rendered directly beneath an input when its value is invalid.
- **Submission Alert**: The existing red banner displayed at the top of the form when submission fails; extended here to also surface a summary of field-level validation failures on submit.
- **Stellar Public Key**: A 56-character string starting with the letter `G`, followed by 55 characters from the uppercase Base32 alphabet (A–Z, 2–7), representing a Stellar account address.
- **Stellar Contract Address**: A 56-character string starting with the letter `C`, followed by 55 characters from the uppercase Base32 alphabet (A–Z, 2–7), representing a Stellar smart contract address.
- **Stroop**: The smallest unit of a Stellar token (1 XLM = 10,000,000 stroops). Milestone amounts are denominated in stroops and must be positive integers.
- **Validator**: The client-side validation logic that inspects form field values and produces Field Errors.
- **Response Deadline**: The number of days before the escrow auto-releases; represented as a positive integer between 1 and 365 inclusive.
- **Milestone**: A single payment stage in the escrow, defined by a stroop amount; the form supports a dynamic list of one or more milestones.
- **Error State**: The visual condition of a field whose current value fails validation — distinguished from its normal (valid or untouched) state.
- **Touched Field**: A field the user has interacted with (blurred or attempted to submit).
- **FieldName**: A string literal union type: `"freelancer" | "arbiter" | "token" | "autoReleaseDays" | "milestone"`.
- **FormValues**: An object type with keys matching each form field and string values for simple fields, plus an array of strings for milestones.
- **FormErrors**: An object type with the same keys as `FormValues`, mapping each to `string | null`.

---

## Requirements

### Requirement 1: Stellar Public Key Validation for Address Fields

**User Story:** As a client creating a job, I want to be told immediately when a Freelancer or Arbiter address is not a valid Stellar public key, so that I can correct it before wasting a transaction attempt.

#### Acceptance Criteria

1. WHEN the Freelancer Address field loses focus and its value does not start with `G`, is not exactly 56 characters long, or contains characters outside the uppercase Base32 alphabet (A–Z, 2–7), THE Validator SHALL display a Field Error beneath the Freelancer Address input reading: `"Must be a valid Stellar public key (starts with G, 56 characters)"`.
2. WHEN the Freelancer Address field loses focus and its value starts with `G`, is exactly 56 characters long, and contains only uppercase Base32 characters (A–Z, 2–7), THE Validator SHALL remove any existing Field Error beneath the Freelancer Address input.
3. WHEN the Arbiter Address field loses focus and its value does not start with `G`, is not exactly 56 characters long, or contains characters outside the uppercase Base32 alphabet (A–Z, 2–7), THE Validator SHALL display a Field Error beneath the Arbiter Address input reading: `"Must be a valid Stellar public key (starts with G, 56 characters)"`.
4. WHEN the Arbiter Address field loses focus and its value starts with `G`, is exactly 56 characters long, and contains only uppercase Base32 characters (A–Z, 2–7), THE Validator SHALL remove any existing Field Error beneath the Arbiter Address input.
5. WHILE a Freelancer or Arbiter Address field is in Error State, THE Form SHALL apply a visible error border style to that field's input element.
6. WHEN a Freelancer or Arbiter Address field transitions out of Error State, THE Form SHALL restore the default border style to that field's input element.
7. WHEN the Freelancer Address or Arbiter Address field loses focus and its value is empty, THE Validator SHALL NOT display a Field Error (empty is treated as untouched, not invalid, until submit).

---

### Requirement 2: Stellar Contract Address Validation for Token Field

**User Story:** As a client creating a job, I want to be told when the Token Contract Address is not a valid Stellar contract address, so that I know exactly what format is expected.

#### Acceptance Criteria

1. WHEN the Token Contract Address field loses focus and its value does not start with `C`, is not exactly 56 characters long, or contains characters outside the uppercase Base32 alphabet (A–Z, 2–7), THE Validator SHALL display a Field Error beneath the Token Contract Address input reading: `"Must be a valid Stellar contract address (starts with C, 56 characters)"`.
2. WHEN the Token Contract Address field loses focus and its value starts with `C`, is exactly 56 characters long, and contains only uppercase Base32 characters (A–Z, 2–7), THE Validator SHALL remove any existing Field Error beneath the Token Contract Address input.
3. IF the Token Contract Address field is in Error State, THEN THE Form SHALL apply a visible error border style to that field's input element.
4. IF the Token Contract Address field is not in Error State, THEN THE Form SHALL apply the default border style to that field's input element.
5. WHEN the Token Contract Address field loses focus and its value is empty, THE Validator SHALL NOT display a Field Error (empty is treated as untouched, not invalid, until submit).

---

### Requirement 3: Response Deadline Validation

**User Story:** As a client creating a job, I want the form to validate that the response deadline is a usable number of days, so that I don't accidentally submit a zero or negative deadline.

#### Acceptance Criteria

1. WHEN the Response Deadline field loses focus and its value is empty, THE Validator SHALL display a Field Error beneath the Response Deadline input reading: `"Response deadline is required"`.
2. WHEN the Response Deadline field loses focus and its value is not a whole number, THE Validator SHALL display a Field Error beneath the Response Deadline input reading: `"Must be a whole number of days"`.
3. WHEN the Response Deadline field loses focus and its value is a whole number less than 1, THE Validator SHALL display a Field Error beneath the Response Deadline input reading: `"Must be at least 1 day"`.
4. WHEN the Response Deadline field loses focus and its value is a whole number greater than 365, THE Validator SHALL display a Field Error beneath the Response Deadline input reading: `"Must be at most 365 days"`.
5. WHEN the Response Deadline field loses focus and its value is a whole number between 1 and 365 inclusive, THE Validator SHALL remove any existing Field Error beneath the Response Deadline input.
6. WHILE the Response Deadline field is in Error State, THE Form SHALL apply a visible error border style to that field's input element.
7. WHEN the Response Deadline field transitions out of Error State, THE Form SHALL restore the default border style to that field's input element.

---

### Requirement 4: Milestone Amount Validation

**User Story:** As a client creating a job, I want each milestone amount to be validated as a positive integer stroop value, so that I catch bad values before they cause a transaction failure.

#### Acceptance Criteria

1. WHEN a Milestone amount input loses focus and its value is empty, THE Validator SHALL display a Field Error beneath that Milestone input reading: `"Amount is required"`.
2. WHEN a Milestone amount input loses focus and its value contains non-digit characters, a decimal point, a leading sign (`+` or `-`), or leading zeros followed by further digits, THE Validator SHALL display a Field Error beneath that Milestone input reading: `"Must be a positive whole number (stroops)"`.
3. WHEN a Milestone amount input loses focus and its value is a whole number less than or equal to 0, THE Validator SHALL display a Field Error beneath that Milestone input reading: `"Must be a positive whole number (stroops)"`.
4. WHEN a Milestone amount input loses focus and its value is a positive whole number between 1 and 9,007,199,254,740,991 (Number.MAX_SAFE_INTEGER) inclusive, THE Validator SHALL remove any existing Field Error for that Milestone input.
5. WHEN a Milestone amount input loses focus and its value is a whole number greater than 9,007,199,254,740,991, THE Validator SHALL display a Field Error beneath that Milestone input reading: `"Amount exceeds the maximum allowed stroop value"`.
6. WHILE a Milestone amount input is in Error State, THE Form SHALL apply a visible error border style to that Milestone's input element.
7. WHEN a Milestone amount input transitions out of Error State, THE Form SHALL restore the default border style to that Milestone's input element.

---

### Requirement 5: Submit-Time Validation Gate

**User Story:** As a client creating a job, I want all fields to be validated when I click "Create Job", so that I see all problems at once if I never interacted with a field individually.

#### Acceptance Criteria

1. WHEN the user submits the Form and one or more fields are invalid, THE Validator SHALL mark all fields as touched and display Field Errors for every invalid field simultaneously.
2. WHEN the user submits the Form and one or more fields are invalid, THE Form SHALL display the Submission Alert at the top of the Form reading: `"Please fix the errors above before submitting"`.
3. WHEN the user submits the Form and one or more fields are invalid, THE Form SHALL NOT initiate a network request to the backend.
4. WHEN the user submits the Form and all fields are valid, THE Form SHALL clear all Field Errors, clear any Submission Alert, and initiate a network request to the backend.

---

### Requirement 6: Field Error Display Style

**User Story:** As a client, I want Field Errors to be visually consistent with the existing dark-theme design, so that they look like a natural part of the UI.

#### Acceptance Criteria

1. THE Form SHALL render each Field Error as a `<p>` element with Tailwind classes `text-sm text-red-400 mt-1` applied directly to the error `<p>` element.
2. THE Form SHALL render Field Errors immediately beneath their associated input element in DOM order.
3. WHEN no Field Error exists for a field, THE Form SHALL NOT render any DOM element reserved for that field's error message.
4. WHILE a field is in Error State, THE Form SHALL apply the Tailwind class `border-red-500` to that field's input element in place of `border-gray-700`.

---

### Requirement 7: Validation Logic Purity and Testability

**User Story:** As a developer maintaining this codebase, I want the validation rules extracted into a pure function, so that they can be unit-tested independently of the React component.

#### Acceptance Criteria

1. THE Validator SHALL expose a pure function `validateField(field: FieldName, value: string): string | null` where `FieldName` is `"freelancer" | "arbiter" | "token" | "autoReleaseDays" | "milestone"`, returning an error message string when the value is invalid, or `null` when valid.
2. THE Validator SHALL expose a pure function `validateForm(values: FormValues): FormErrors` that delegates to `validateField` for each named field and returns a `FormErrors` record mapping each field to its error string or `null`; milestone errors are represented as `string[]` parallel to the milestones array.
3. IF a string starts with `G`, is exactly 56 characters, and contains only characters in `[A-Z2-7]`, THEN `validateField("freelancer", value)` SHALL return `null`.
4. IF a string does not start with `G`, is not exactly 56 characters, or contains characters outside `[A-Z2-7]`, THEN `validateField("freelancer", value)` SHALL return a non-null error string.
5. IF a string starts with `C`, is exactly 56 characters, and contains only characters in `[A-Z2-7]`, THEN `validateField("token", value)` SHALL return `null`.
6. IF a string does not start with `C`, is not exactly 56 characters, or contains characters outside `[A-Z2-7]`, THEN `validateField("token", value)` SHALL return a non-null error string.
7. IF a string represents a positive whole number between 1 and 9,007,199,254,740,991 inclusive (no decimal, no sign prefix, no leading zeros except "0" itself), THEN `validateField("milestone", value)` SHALL return `null`.
8. IF a string is empty, contains a decimal point, contains a sign character, contains non-digit characters, or represents a number ≤ 0 or > 9,007,199,254,740,991, THEN `validateField("milestone", value)` SHALL return a non-null error string.
9. IF the value passed to `validateField("arbiter", value)` satisfies the same conditions as a valid Stellar public key, THEN it SHALL return `null`; otherwise it SHALL return the same error string as `validateField("freelancer", value)` for the same input.
