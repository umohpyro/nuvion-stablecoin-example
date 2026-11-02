/** UK bank details for the GBP Faster Payments rail. Returns the cleaned value, or null when invalid. */
export const sortCode = (input: string): string | null => {
  const s = input.replace(/[\s-]/g, "");
  return /^\d{6}$/.test(s) ? s : null;
};

export const ukAccountNumber = (input: string): string | null => {
  const s = input.replace(/\s/g, "");
  return /^\d{8}$/.test(s) ? s : null;
};

/** Below this the sandbox rejected bank payouts (error_validation_value_out_of_range), so the app asks for at least 5.00 up front. */
export const MIN_PAYOUT_MINOR = 500;
