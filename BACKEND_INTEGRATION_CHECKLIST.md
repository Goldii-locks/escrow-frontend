# Backend Integration Checklist

This checklist helps backend developers integrate with the admin page implementation.

## Required Endpoints

### 1. Contract Query Endpoint ✓

**Purpose**: Query smart contract methods (specifically `get_admin`)

**Endpoint**: `POST /api/jobs/query`

**Request Body**:
```json
{
  "contractId": "CDD5WKK3WT3QVKXMXTJNDIXE4T73FK6GGXDSD6UTJAH6YYZU52SQ4MUH",
  "method": "get_admin",
  "args": []
}
```

**Response** (any of these formats work):
```json
"GADMINADDRESS123..."
```
or
```json
{
  "success": true,
  "data": "GADMINADDRESS123..."
}
```
or
```json
{
  "result": "GADMINADDRESS123..."
}
```

**Error Response**:
```json
{
  "error": "Query failed"
}
```

**Implementation Notes**:
- Must invoke `get_admin()` on the contract
- Return the admin's Stellar address (starts with G)
- Should be a read-only query (no transaction needed)
- Cache if possible (admin rarely changes)

---

### 2. Whitelist Fetch Endpoint ✓

**Purpose**: Get list of whitelisted token addresses

**Endpoint**: `GET /api/jobs/whitelisted-tokens?contractId={contractId}`

**Query Params**:
- `contractId` (required): The escrow contract ID

**Response** (either format works):
```json
{
  "success": true,
  "data": [
    "CTOKEN1ABC...",
    "CTOKEN2DEF...",
    "CTOKEN3GHI..."
  ]
}
```
or
```json
[
  "CTOKEN1ABC...",
  "CTOKEN2DEF...",
  "CTOKEN3GHI..."
]
```

**Error Response**:
```json
{
  "error": "Failed to fetch whitelist"
}
```

**Implementation Notes**:
- Query contract's storage or call a getter method
- Return array of token contract addresses
- Empty array if no tokens whitelisted
- Can cache with short TTL (tokens don't change often)

---

### 3. Build Transaction Endpoint ✓

**Purpose**: Build unsigned transaction for contract methods

**Endpoint**: `POST /api/jobs/build-tx`

**Request Body** (Add Token):
```json
{
  "contractId": "CDD5WKK3WT3QVKXMXTJNDIXE4T73FK6GGXDSD6UTJAH6YYZU52SQ4MUH",
  "method": "add_whitelisted_token",
  "args": [
    {
      "type": "address",
      "value": "GADMINADDRESS123..."
    },
    {
      "type": "address",
      "value": "CTOKENADDRESS456..."
    }
  ],
  "sourceAddress": "GADMINADDRESS123..."
}
```

**Request Body** (Remove Token):
```json
{
  "contractId": "CDD5WKK3WT3QVKXMXTJNDIXE4T73FK6GGXDSD6UTJAH6YYZU52SQ4MUH",
  "method": "remove_whitelisted_token",
  "args": [
    {
      "type": "address",
      "value": "GADMINADDRESS123..."
    },
    {
      "type": "address",
      "value": "CTOKENADDRESS456..."
    }
  ],
  "sourceAddress": "GADMINADDRESS123..."
}
```

**Response**:
```json
{
  "xdr": "AAAAAgAAAABXk3..."
}
```

**Error Response**:
```json
{
  "error": "Failed to build transaction"
}
```

**Implementation Notes**:
- Build a Soroban contract invocation transaction
- Use provided sourceAddress as transaction source
- Set appropriate fee (recommend BASE_FEE or higher)
- Set timeout (30-60 seconds)
- Call `prepareTransaction` to simulate
- Return the XDR string
- **Important**: Validate args format and types

---

### 4. Submit Transaction Endpoint ✓

**Purpose**: Submit signed transaction to Stellar network

**Endpoint**: `POST /api/jobs/submit`

**Request Body**:
```json
{
  "signedXdr": "AAAAAgAAAABXk3..."
}
```

**Response** (any field name works):
```json
{
  "hash": "abc123def456...",
  "txHash": "abc123def456...",
  "transactionHash": "abc123def456..."
}
```

**Error Response**:
```json
{
  "error": "Transaction failed",
  "message": "Detailed error from network"
}
```

**Implementation Notes**:
- Submit the signed XDR to Stellar network
- Wait for transaction to complete
- Return transaction hash on success
- Parse and return meaningful errors on failure
- Log transaction for debugging

---

## Smart Contract Requirements

### Required Contract Methods

#### 1. `get_admin() -> Address`

Returns the admin address.

```rust
pub fn get_admin(env: Env) -> Address {
    // Return stored admin address
}
```

#### 2. `add_whitelisted_token(admin: Address, token: Address)`

Adds a token to the whitelist.

```rust
pub fn add_whitelisted_token(env: Env, admin: Address, token: Address) {
    admin.require_auth();
    // Verify admin
    // Add token to storage
    // Emit event
}
```

**Requirements**:
- Must verify `admin` is the contract admin
- Must check token address is valid
- Should prevent duplicates
- Should emit event

#### 3. `remove_whitelisted_token(admin: Address, token: Address)`

Removes a token from the whitelist.

```rust
pub fn remove_whitelisted_token(env: Env, admin: Address, token: Address) {
    admin.require_auth();
    // Verify admin
    // Remove token from storage
    // Emit event
}
```

**Requirements**:
- Must verify `admin` is the contract admin
- Should handle non-existent token gracefully
- Should emit event

---

## Testing the Integration

### 1. Test Admin Query
```bash
curl -X POST http://localhost:3001/api/jobs/query \
  -H "Content-Type: application/json" \
  -d '{
    "contractId": "CDD5WKK3WT3QVKXMXTJNDIXE4T73FK6GGXDSD6UTJAH6YYZU52SQ4MUH",
    "method": "get_admin",
    "args": []
  }'
```

Expected: Admin address returned

### 2. Test Whitelist Fetch
```bash
curl http://localhost:3001/api/jobs/whitelisted-tokens?contractId=CDD5WKK3WT3QVKXMXTJNDIXE4T73FK6GGXDSD6UTJAH6YYZU52SQ4MUH
```

Expected: Array of token addresses

### 3. Test Build Transaction
```bash
curl -X POST http://localhost:3001/api/jobs/build-tx \
  -H "Content-Type: application/json" \
  -d '{
    "contractId": "CDD5WKK3WT3QVKXMXTJNDIXE4T73FK6GGXDSD6UTJAH6YYZU52SQ4MUH",
    "method": "add_whitelisted_token",
    "args": [
      {"type": "address", "value": "GADMIN..."},
      {"type": "address", "value": "CTOKEN..."}
    ],
    "sourceAddress": "GADMIN..."
  }'
```

Expected: XDR string returned

### 4. Test Submit
(Requires signed XDR from Freighter)

---

## Security Checklist

- [ ] Backend verifies admin status before executing add/remove
- [ ] Smart contract enforces admin-only access
- [ ] Input validation on all endpoints
- [ ] Rate limiting on transaction endpoints
- [ ] Proper error messages (not exposing internals)
- [ ] Logging of admin actions
- [ ] No hardcoded admin credentials

---

## Error Scenarios to Handle

### Backend Should Handle:
1. Invalid contract ID
2. Contract method not found
3. Invalid argument types
4. Network connectivity issues
5. Stellar RPC failures
6. Invalid XDR
7. Transaction simulation failures
8. Insufficient balance for fees

### Contract Should Handle:
1. Non-admin caller
2. Invalid token address
3. Duplicate token (add)
4. Non-existent token (remove)
5. Invalid parameters

---

## Environment Variables

Backend may need:
```env
STELLAR_NETWORK=TESTNET
STELLAR_RPC_URL=https://soroban-testnet.stellar.org
CONTRACT_ID=CDD5WKK3WT3QVKXMXTJNDIXE4T73FK6GGXDSD6UTJAH6YYZU52SQ4MUH
```

Frontend needs:
```env
NEXT_PUBLIC_BACKEND_URL=http://localhost:3001
NEXT_PUBLIC_CONTRACT_ID=CDD5WKK3WT3QVKXMXTJNDIXE4T73FK6GGXDSD6UTJAH6YYZU52SQ4MUH
```

---

## Deployment Checklist

- [ ] All 4 endpoints implemented
- [ ] Contract methods deployed
- [ ] Environment variables set
- [ ] Error handling tested
- [ ] Admin can query their status
- [ ] Admin can fetch whitelist
- [ ] Admin can add tokens
- [ ] Admin can remove tokens
- [ ] Non-admin is rejected by contract
- [ ] Frontend tests pass
- [ ] Integration tests pass
- [ ] Logging configured
- [ ] Monitoring set up

---

## Common Issues

### "Admin address not found"
- Check contract has `get_admin` method
- Verify method returns Address type
- Check response format matches expectations

### "Could not load whitelisted tokens"
- Verify whitelist endpoint exists
- Check contract storage structure
- Ensure response is array format

### "Transaction simulation failed"
- Verify contract method signatures match
- Check argument types are correct
- Ensure admin has proper permissions
- Verify contract is deployed

### "Backend returns 500"
- Check Stellar RPC connectivity
- Verify contract ID is correct
- Check logs for detailed error
- Ensure proper error handling

---

## Support

For questions or issues:
1. Check technical docs: `ADMIN_PAGE_IMPLEMENTATION.md`
2. Review flow diagrams: `docs/admin-flow-diagram.md`
3. Check frontend code: `app/admin/page.tsx`
4. Review tests: `__tests__/admin-*.test.*`

---

**Status**: Ready for backend implementation
**Priority**: Required for admin functionality
**Estimated Backend Work**: 2-4 hours
