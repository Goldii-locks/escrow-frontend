# Gas Estimation Warning Banner Implementation

## Overview

This document describes the implementation of gas estimation error warning banners in `network_sync_checker` module as requested in issue #160.

## Changes Made

### 1. Core Module Updates (`app/lib/network_sync_checker.ts`)

Added gas estimation warning support with the following new exports:

#### Types

- **`NetworkSyncSimulationResult`**: Interface for simulation results from Soroban RPC
  - `fee`: Estimated fee in stroops (1 XLM = 10_000_000 stroops)
  - `error`: Optional error string from simulation response
  - `simulationError`: Raw simulation error object when RPC reports failure

- **`NetworkSyncGasWarningState`**: Warning state derived from simulation results
  - `hasWarning`: Whether any warning condition is present
  - `highFee`: Whether fee exceeds threshold
  - `simulationError`: Whether simulation reported an error
  - `warningMessage`: User-facing warning message (null if no warning)

#### Constants

- **`HIGH_FEE_THRESHOLD_STROOPS = 1_000_000`**: Fee ceiling (0.1 XLM) above which high-fee warnings are emitted

#### Functions

- **`checkSimulationFeeWarning(result: NetworkSyncSimulationResult): NetworkSyncGasWarningState`**
  - Inspects simulation results for warnings
  - Prioritizes simulation errors over high-fee warnings
  - Returns comprehensive warning state

- **`warnOnSimulationFee(result: NetworkSyncSimulationResult, options?: { txId?: string }): NetworkSyncGasWarningState`**
  - Logs warnings to console when detected
  - Includes transaction ID in logs when provided
  - Returns warning state for caller consumption

- **`warnOnNetworkSyncSimulation(result: NetworkSyncSimulationResult, showToast: SyncToastHandler): NetworkSyncGasWarningState`**
  - Displays toast warnings to users during network sync operations
  - Integrates with existing toast system
  - Returns warning state

### 2. Warning Banner Component (`app/components/NetworkSyncGasWarningBanner.tsx`)

New client-side React component that:
- Accepts `simulation` prop (nullable `NetworkSyncSimulationResult`)
- Renders warning banner when simulation contains errors or high fees
- Uses consistent warning theme with other banner components
- Includes accessibility attributes (`role="alert"`)
- Supports custom className for styling flexibility

### 3. Test Coverage

#### Unit Tests (`__tests__/network_sync_checker_gas.test.ts`)

Comprehensive tests covering:
- Normal fee scenarios (no warning)
- High-fee detection and messaging
- Simulation error string handling
- Simulation error object handling
- Priority handling (simulation errors over high fees)
- Console logging functionality
- Toast notification integration

#### Component Tests (`__tests__/NetworkSyncGasWarningBanner.test.tsx`)

Component behavior tests covering:
- Null simulation handling
- Normal fee rendering (no banner)
- High-fee warning display
- Simulation error display
- Custom className application
- Theme class verification
- Accessibility attributes

## Usage Examples

### Basic Usage in Network Sync Operations

```typescript
import {
  checkSimulationFeeWarning,
  warnOnNetworkSyncSimulation,
  type NetworkSyncSimulationResult,
} from "@/app/lib/network_sync_checker";
import { useToast } from "@/app/context/ToastContext";

function MyComponent() {
  const { showToast } = useToast();

  async function performNetworkSync() {
    // Get simulation result from Soroban RPC
    const simulation: NetworkSyncSimulationResult = {
      fee: 1500000, // 0.15 XLM
      error: null,
    };

    // Check and display warnings
    const warningState = warnOnNetworkSyncSimulation(simulation, showToast);

    if (warningState.hasWarning) {
      console.log("Warning detected:", warningState.warningMessage);
      // Handle warning appropriately
    }
  }
}
```

### Using the Banner Component

```tsx
import NetworkSyncGasWarningBanner from "@/app/components/NetworkSyncGasWarningBanner";
import type { NetworkSyncSimulationResult } from "@/app/lib/network_sync_checker";

function TransactionPage() {
  const [simulation, setSimulation] = useState<NetworkSyncSimulationResult | null>(null);

  // After getting simulation result from RPC
  useEffect(() => {
    async function simulate() {
      const result = await sorobanRpc.simulateTransaction(tx);
      setSimulation({
        fee: result.minResourceFee,
        error: result.error,
        simulationError: result.simulationError,
      });
    }
    simulate();
  }, [tx]);

  return (
    <div>
      <NetworkSyncGasWarningBanner simulation={simulation} />
      {/* Rest of your component */}
    </div>
  );
}
```

### Programmatic Warning Checks

```typescript
import { checkSimulationFeeWarning } from "@/app/lib/network_sync_checker";

// Check without side effects
const simulation = { fee: 2000000 };
const state = checkSimulationFeeWarning(simulation);

if (state.highFee) {
  console.warn("High fee detected:", state.warningMessage);
}

if (state.simulationError) {
  console.error("Simulation failed:", state.warningMessage);
}
```

## Design Patterns

The implementation follows established patterns from existing wallet connectors:

1. **Consistent Interface**: Mirrors `FreighterSimulationResult` and `LedgerSimulationResult` interfaces
2. **Warning State Pattern**: Uses same structure as `checkSimulationFeeWarning` in other modules
3. **Banner Component Pattern**: Follows same design as `FreighterGasWarningBanner` and `LedgerGasWarningBanner`
4. **Theme Consistency**: Uses warning theme colors (`bg-warning/40`, `text-warning-soft`, etc.)

## Integration Points

The new functionality integrates with:

- **Toast System**: Via `SyncToastHandler` type from `ToastContext`
- **Stellar SDK**: Uses existing imports from `@stellar/stellar-sdk`
- **Warning Theme**: Follows Tailwind CSS warning color conventions
- **Test Infrastructure**: Uses Vitest and React Testing Library

## Files Modified

1. `app/lib/network_sync_checker.ts` - Added gas estimation warning functions
2. `app/components/NetworkSyncGasWarningBanner.tsx` - New banner component (created)
3. `__tests__/network_sync_checker_gas.test.ts` - Unit tests (created)
4. `__tests__/NetworkSyncGasWarningBanner.test.tsx` - Component tests (created)

## Compliance

- **TypeScript**: All code is fully typed with no `any` types
- **Accessibility**: Banner includes `role="alert"` for screen readers
- **Code Style**: Follows existing codebase conventions
- **Documentation**: JSDoc comments on all exported functions and types
- **Testing**: Comprehensive test coverage matching existing test patterns
