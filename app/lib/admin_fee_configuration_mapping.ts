/**
 * admin_fee_configuration — data mapping bindings (#463).
 * Maps backend fee configuration payloads to form values.
 */

export interface FeeConfigResponse {
  fee_bps?: number | string | null;
  fee_recipient?: string | null;
  updated_at?: string | null;
}

export interface FeeConfigFormValues {
  feePercent: string;
  recipient: string;
  updatedAt: string | null;
}

export const FEE_CONFIG_ENDPOINT = "/api/admin/fee-configuration";

export const MOCK_FEE_CONFIG: FeeConfigResponse = {
  fee_bps: 250,
  fee_recipient: "GDEXAMPLEFEERECIPIENT",
  updated_at: "2025-01-01T00:00:00Z",
};

/** Map a backend payload (basis points) to form values (percent). */
export function mapFeeConfigResponse(data: FeeConfigResponse | null | undefined): FeeConfigFormValues {
  const bps = Number(data?.fee_bps);
  return {
    feePercent: Number.isFinite(bps) && bps >= 0 ? String(bps / 100) : "",
    recipient: data?.fee_recipient ?? "",
    updatedAt: data?.updated_at ?? null,
  };
}

/** Map form values back to a backend update payload. */
export function toFeeConfigPayload(values: Pick<FeeConfigFormValues, "feePercent" | "recipient">) {
  return {
    fee_bps: Math.round(Number(values.feePercent) * 100),
    fee_recipient: values.recipient,
  };
}

/** Load values via an injectable fetcher (defaults to the mock dataset). */
export async function loadFeeConfig(
  fetcher: (url: string) => Promise<FeeConfigResponse> = async () => MOCK_FEE_CONFIG,
): Promise<FeeConfigFormValues> {
  return mapFeeConfigResponse(await fetcher(FEE_CONFIG_ENDPOINT));
}
