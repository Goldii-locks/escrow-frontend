"use client";

import { useEffect, useState, type Dispatch, type SetStateAction } from "react";
import { useToast } from "@/app/context/ToastContext";
import { useWallet } from "@/app/context/WalletContext";
import { fetchAdminAddress } from "@/app/lib/admin";
import { getDefaultArbiter } from "@/app/lib/default_arbiter";
import { formatCreateEscrowError } from "@/app/lib/errors";
import { isMilestoneCapReached } from "@/app/lib/milestone_limits";
import { CONTRACT_ID, type TxPhase } from "@/app/lib/transactions";
import {
  clearCreateJobDraft,
  CREATE_JOB_DRAFT_DEBOUNCE_MS,
  type CreateJobDraft,
  EMPTY_CREATE_JOB_DRAFT,
  loadCreateJobDraft,
  saveCreateJobDraft,
} from "@/app/lib/create_job_draft";
import { submitCreateJob } from "./submit";
import { useTokenCheck } from "./useTokenCheck";
import {
  checkSubmission,
  hasTokenIssue,
  type Milestone,
  nonBlank,
  summarizeMilestones,
  validateAccountAddress,
  validateArbiterAddress,
  validateDeadline,
  validatePartyAddressCollisions,
  validateTokenAddress,
} from "./validation";

export type WizardSection = "details" | "milestones" | "review";

/** add / remove / update for a list held in state, without mutating it. */
function listActions<T>(setList: Dispatch<SetStateAction<T[]>>, blank: T) {
  return {
    add: () => setList((list) => [...list, blank]),
    remove: (index: number) => setList((list) => list.filter((_, i) => i !== index)),
    update: (index: number, value: T) =>
      setList((list) => list.map((item, i) => (i === index ? value : item))),
  };
}

/** All state, derived values and handlers for the create-job wizard (#621). */
export function useCreateJobForm() {
  const { address, signTransaction, setSimulationResult } = useWallet();
  const { showToast } = useToast();
  const [activeSection, setActiveSection] = useState<WizardSection>("details");
  const [adminAddress, setAdminAddress] = useState<string | null>(null);
  const [adminAddressLoading, setAdminAddressLoading] = useState(!!CONTRACT_ID);

  const [freelancer, setFreelancer] = useState("");
  const [arbiter, setArbiter] = useState("");
  const [defaultArbiter] = useState(getDefaultArbiter);
  const [arbiterMode, setArbiterMode] = useState<"default" | "custom">(
    defaultArbiter ? "default" : "custom"
  );
  const effectiveArbiter = arbiterMode === "default" && defaultArbiter ? defaultArbiter : arbiter;
  const [token, setToken] = useState("");
  const [freelancerError, setFreelancerError] = useState("");
  const [arbiterError, setArbiterError] = useState("");
  const [tokenError, setTokenError] = useState("");
  const [autoReleaseDays, setAutoReleaseDays] = useState("7");
  const [deadlineError, setDeadlineError] = useState<string | null>(null);
  const [acceptedAssets, setAcceptedAssets] = useState<string[]>([]);
  const [requirements, setRequirements] = useState<string[]>([]);
  const [milestones, setMilestones] = useState<Milestone[]>([{ amount: "" }]);

  const [loading, setLoading] = useState(false);
  const [phase, setPhase] = useState<TxPhase>("idle");
  const [error, setError] = useState<string | null>(null);
  const [txHash, setTxHash] = useState<string | null>(null);
  // Required confirmation that the client has read the escrow rules before
  // the Create button is enabled (issue #669).
  const [agreed, setAgreed] = useState(false);

  const tokenCheck = useTokenCheck(token);

  useEffect(() => {
    if (!CONTRACT_ID) return;

    let active = true;
    void fetchAdminAddress(CONTRACT_ID).then((result) => {
      if (!active) return;
      setAdminAddress(result);
      setAdminAddressLoading(false);
    });

    return () => {
      active = false;
    };
  }, []);

  // ── Draft persistence ─────────────────────────────────────────────────────
  const [draftRestored, setDraftRestored] = useState(false);
  // Address whose draft has been restored; saving waits for it so the empty
  // initial state never overwrites a stored draft.
  const [draftAddress, setDraftAddress] = useState<string | null>(null);

  const applyDraft = (draft: CreateJobDraft) => {
    setFreelancer(draft.freelancer);
    setArbiter(draft.arbiter);
    setToken(draft.token);
    setAutoReleaseDays(draft.autoReleaseDays);
    setAcceptedAssets(draft.acceptedAssets);
    setRequirements(draft.requirements);
    setMilestones(draft.milestones);
  };

  useEffect(() => {
    if (!address) return;
    const draft = loadCreateJobDraft(address);
    if (draft) {
      // Restoring from sessionStorage is a one-off sync with external state.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      applyDraft(draft);
      setDraftRestored(true);
    }
    setDraftAddress(address);
  }, [address]);

  useEffect(() => {
    if (!address || draftAddress !== address || txHash) return;
    const timer = setTimeout(() => {
      saveCreateJobDraft(address, {
        freelancer,
        arbiter,
        token,
        autoReleaseDays,
        acceptedAssets,
        requirements,
        milestones,
      });
    }, CREATE_JOB_DRAFT_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [
    address,
    draftAddress,
    txHash,
    freelancer,
    arbiter,
    token,
    autoReleaseDays,
    acceptedAssets,
    requirements,
    milestones,
  ]);

  const discardDraft = () => {
    if (address) clearCreateJobDraft(address);
    applyDraft(EMPTY_CREATE_JOB_DRAFT);
    setDraftRestored(false);
  };

  // ── Field handlers ────────────────────────────────────────────────────────
  const changeFreelancer = (value: string) => {
    setFreelancer(value);
    setFreelancerError(validateAccountAddress(value));
    setArbiterError(validateArbiterAddress(effectiveArbiter));
  };
  const changeArbiter = (value: string) => {
    setArbiter(value);
    setArbiterError(validateArbiterAddress(value));
    setFreelancerError(validateAccountAddress(freelancer));
  };
  const chooseArbiterMode = (mode: "default" | "custom") => {
    setArbiterMode(mode);
    setArbiterError(mode === "default" ? "" : validateArbiterAddress(arbiter));
  };
  const changeToken = (value: string) => {
    setToken(value);
    setTokenError(validateTokenAddress(value));
  };
  const changeDeadline = (value: string) => {
    setAutoReleaseDays(value);
    // Clear the error on change; it's re-validated on blur.
    if (deadlineError) setDeadlineError(null);
  };

  const assets = listActions<string>(setAcceptedAssets, "");
  const reqs = listActions<string>(setRequirements, "");
  const milestoneList = listActions<Milestone>(setMilestones, { amount: "" });
  const addMilestone = () => {
    if (isMilestoneCapReached(milestones.length)) return;
    milestoneList.add();
  };

  // ── Derived state ─────────────────────────────────────────────────────────
  const milestoneSummary = summarizeMilestones(milestones);
  const { hasNoMilestones, hasPartialMilestones } = milestoneSummary;
  const partyAddressErrors = validatePartyAddressCollisions({
    client: address ?? "",
    freelancer,
    arbiter: effectiveArbiter,
    adminAddress,
  });
  const hasValidationErrors =
    !!freelancerError ||
    !!arbiterError ||
    !!partyAddressErrors.clientError ||
    !!partyAddressErrors.freelancerError ||
    !!partyAddressErrors.arbiterError ||
    !!tokenError;
  const isSubmitDisabled =
    loading ||
    adminAddressLoading ||
    !address ||
    hasNoMilestones ||
    hasPartialMilestones ||
    hasValidationErrors ||
    hasTokenIssue(tokenCheck.status, tokenCheck.factoryConfigured) ||
    !agreed;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!address) return;
    if (adminAddressLoading) {
      setError("Checking the platform admin address. Please wait.");
      return;
    }

    const { listed, status, factoryConfigured } = tokenCheck;
    const check = checkSubmission({
      client: address,
      freelancer,
      arbiter: effectiveArbiter,
      adminAddress,
      autoReleaseDays,
      milestones: milestoneSummary,
      token: { ...status, listed },
      factoryConfigured,
    });
    if (!check.ok) {
      if (check.deadlineError) setDeadlineError(check.deadlineError);
      if (check.freelancerError !== undefined) {
        setFreelancerError(freelancer ? validateAccountAddress(freelancer) : check.freelancerError);
      }
      if (check.arbiterError !== undefined) {
        setArbiterError(
          effectiveArbiter ? validateArbiterAddress(effectiveArbiter) : check.arbiterError
        );
      }
      setError(check.message);
      return;
    }
    setFreelancerError("");
    setArbiterError("");

    setLoading(true);
    setError(null);
    setTxHash(null);
    setPhase("building");

    try {
      const hash = await submitCreateJob(
        {
          client: address,
          freelancer,
          arbiter: effectiveArbiter,
          token,
          autoReleaseDays,
          milestones: milestoneSummary.milestones,
        },
        { signTransaction, onPhase: setPhase, setSimulationResult }
      );
      setPhase("success");
      clearCreateJobDraft(address);
      setTxHash(hash);
      showToast("Job created successfully!", "success");
    } catch (err: unknown) {
      setPhase("error");
      setError(formatCreateEscrowError(err));
    } finally {
      setLoading(false);
    }
  };

  return {
    address,
    activeSection,
    setActiveSection,
    loading,
    phase,
    error,
    txHash,
    draftRestored,
    discardDraft,
    details: {
      clientError: partyAddressErrors.clientError,
      freelancer,
      freelancerError: partyAddressErrors.freelancerError || freelancerError,
      changeFreelancer,
      blurFreelancer: (value: string) => setFreelancerError(validateAccountAddress(value)),
      arbiter,
      arbiterError: partyAddressErrors.arbiterError || arbiterError,
      changeArbiter,
      blurArbiter: (value: string) => setArbiterError(validateArbiterAddress(value)),
      defaultArbiter,
      arbiterMode,
      chooseArbiterMode,
      token,
      changeToken,
      blurToken: (value: string) => setTokenError(validateTokenAddress(value)),
      selectToken: setToken,
      tokenCheck,
      autoReleaseDays,
      deadlineError,
      changeDeadline,
      blurDeadline: () => setDeadlineError(validateDeadline(autoReleaseDays)),
    },
    scope: {
      acceptedAssets,
      addAcceptedAsset: assets.add,
      removeAcceptedAsset: assets.remove,
      updateAcceptedAsset: assets.update,
      requirements,
      addRequirement: reqs.add,
      removeRequirement: reqs.remove,
      updateRequirement: reqs.update,
      milestones: milestoneSummary.milestones,
      milestoneCount: milestones.length,
      hasNoMilestones,
      hasPartialMilestones,
      addMilestone,
      removeMilestone: milestoneList.remove,
      updateMilestone: (index: number, amount: string) => milestoneList.update(index, { amount }),
    },
    review: {
      assetCount: nonBlank(acceptedAssets).length,
      requirementCount: nonBlank(requirements).length,
      milestoneCount: milestoneSummary.milestones.length,
      autoReleaseDays,
      arbiter,
      agreed,
      setAgreed,
    },
    hasValidationErrors,
    isSubmitDisabled,
    handleSubmit,
  };
}

export type CreateJobForm = ReturnType<typeof useCreateJobForm>;
