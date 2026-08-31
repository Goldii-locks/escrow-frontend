# PR Title

feat: Add gas estimation warning banners to network_sync_checker

# PR Description

## Summary

This PR implements gas estimation error warning banners in the `network_sync_checker` module, enabling users to see simulation errors and high fee warnings during network sync operations.

## Changes

### Core Module (`app/lib/network_sync_checker.ts`)

Added comprehensive gas estimation warning support:
- **New Types**: `NetworkSyncSimulationResult` and `NetworkSyncGasWarningState` interfaces
- **New Constant**: `HIGH_FEE_THRESHOLD_STROOPS = 1_000_000` (0.1 XLM)
- **New Functions**:
  - `checkSimulationFeeWarning()` - Inspects simulation results and returns warning state
  - `warnOnSimulationFee()` - Logs warnings to console with optional transaction ID
  - `warnOnNetworkSyncSimulation()` - Displays toast warnings to users

### Banner Component (`app/components/NetworkSyncGasWarningBanner.tsx`)

New React component that:
- Displays warnings when simulation results exceed fee thresholds or contain errors
- Follows existing banner component patterns (Freighter, Ledger, Albedo)
- Includes accessibility attributes (`role="alert"`)
- Uses consistent warning theme styling

### Test Coverage

- **Unit Tests** (`__tests__/network_sync_checker_gas.test.ts`): 10 test cases covering all warning scenarios
- **Component Tests** (`__tests__/NetworkSyncGasWarningBanner.test.tsx`): 7 test cases for banner rendering and behavior

## Implementation Details

The implementation mirrors the established pattern from `freighter_connector` and `ledger_usb_bridge`:
- Same interface structure for simulation results
- Same warning state derivation logic
- Same threshold value (1M stroops / 0.1 XLM)
- Consistent error message formatting

## Usage Example

```typescript
import {
  warnOnNetworkSyncSimulation,
  type NetworkSyncSimulationResult,
} from "@/app/lib/network_sync_checker";

// During network sync operations
const simulation: NetworkSyncSimulationResult = {
  fee: 1500000,
  error: null,
};

const warningState = warnOnNetworkSyncSimulation(simulation, showToast);

if (warningState.hasWarning) {
  // Handle warning appropriately
}
```

## Testing

All tests follow the existing test patterns and conventions:
- Uses Vitest and React Testing Library
- Includes comprehensive edge case coverage
- Tests both success and error scenarios

## Documentation

Added comprehensive implementation documentation in `GAS_ESTIMATION_WARNING_IMPLEMENTATION.md` including:
- Overview of changes
- API documentation
- Usage examples
- Design patterns
- Integration points

## Files Changed

- Modified: `app/lib/network_sync_checker.ts`
- Added: `app/components/NetworkSyncGasWarningBanner.tsx`
- Added: `__tests__/network_sync_checker_gas.test.ts`
- Added: `__tests__/NetworkSyncGasWarningBanner.test.tsx`
- Added: `GAS_ESTIMATION_WARNING_IMPLEMENTATION.md` (documentation)

Closes #160
