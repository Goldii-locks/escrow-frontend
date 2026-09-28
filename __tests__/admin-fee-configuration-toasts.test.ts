import { describe, expect, it } from "vitest";
import { getFeeToast, getPreSubmitFeeToast } from "@/app/lib/admin_fee_configuration_toasts";

describe("admin_fee_configuration toasts", () => {
  it("maps events to toast types", () => {
    expect(getFeeToast("update_success").type).toBe("success");
    expect(getFeeToast("update_failure", "timeout").message).toContain("timeout");
    expect(getFeeToast("update_failure").type).toBe("error");
    expect(getFeeToast("unauthorized").type).toBe("error");
    expect(getFeeToast("high_fee_warning").type).toBe("warning");
  });

  it("warns before submit for invalid or high fees", () => {
    expect(getPreSubmitFeeToast(-5)?.type).toBe("warning");
    expect(getPreSubmitFeeToast(1.2)?.type).toBe("warning");
    expect(getPreSubmitFeeToast(5000)?.message).toMatch(/high/);
    expect(getPreSubmitFeeToast(250)).toBeNull();
  });
});
