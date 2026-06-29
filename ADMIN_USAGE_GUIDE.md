# Admin Page Usage Guide

## Quick Start

### For Contract Admin

1. **Connect Your Wallet**
   - Click "Connect Wallet" in the navbar
   - Approve Freighter connection
   - Ensure you're connected with the admin wallet

2. **Access Admin Page**
   - If you're the admin, an "Admin" link will appear in the navbar
   - Click "Admin" or navigate to `/admin`
   - Page will verify your admin status (takes ~1-2 seconds)

3. **View Whitelisted Tokens**
   - Current whitelist displays automatically
   - Each token shows its contract address
   - Empty state if no tokens yet

4. **Add a Token**
   - Enter the token contract address in the input field
   - Click "Add to Whitelist"
   - Approve the transaction in Freighter
   - Wait for confirmation (shows status: Preparing → Sign in wallet → Submitting)
   - Success message appears and token is added to the list

5. **Remove a Token**
   - Find the token in the whitelist
   - Click the red "Remove" button
   - Approve the transaction in Freighter
   - Wait for confirmation
   - Success message appears and token is removed from the list

### For Non-Admin Users

If you connect with a non-admin wallet:
1. The "Admin" link will NOT appear in the navbar
2. If you navigate directly to `/admin`, you'll see an "Access Denied" message
3. No admin functionality is accessible

## Common Scenarios

### Scenario 1: Initial Setup (No Tokens)
```
1. Connect admin wallet
2. Navigate to /admin
3. See "No whitelisted tokens found" message
4. Add first token via the form
5. Token appears in the list
```

### Scenario 2: Adding Multiple Tokens
```
1. Enter first token address → Add → Approve in Freighter
2. Wait for success message
3. Enter second token address → Add → Approve in Freighter
4. Repeat for each token
5. All tokens appear in the list
```

### Scenario 3: Updating Whitelist
```
1. View current tokens
2. Remove outdated token
3. Add new token
4. Whitelist is updated
```

## Token Address Format

Token addresses should:
- Start with `C` (for contract addresses on Stellar)
- Be 56 characters long
- Example: `CTOKEN123ABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890EXAMPLE`

## Transaction States

### Adding/Removing a Token

You'll see these states in order:

1. **Preparing...** (Building transaction)
   - Backend is creating the unsigned transaction
   - Usually takes 1-2 seconds

2. **Sign in wallet...** (Signing)
   - Freighter popup appears
   - Review and approve the transaction
   - If you decline, you'll see "You declined the transaction" error

3. **Submitting...** (Submitting to network)
   - Transaction is being submitted to Stellar
   - Usually takes 2-5 seconds

4. **Success** (Complete)
   - Green success banner appears
   - Whitelist refreshes automatically
   - Form resets (for add) or token disappears (for remove)

### Error States

If something goes wrong, you'll see:
- **"You declined the transaction in your wallet"** - Click the button again when ready
- **"Could not load whitelisted tokens"** - Check your network connection
- **"Could not connect to backend"** - Backend may be down, try again later
- **Contract errors** - The contract rejected the transaction (e.g., not authorized, invalid token)

## Tips

✅ **Do:**
- Wait for each transaction to complete before starting another
- Keep Freighter unlocked during operations
- Verify token addresses before adding
- Check the whitelist refreshes after operations

❌ **Don't:**
- Close Freighter while a transaction is pending
- Click add/remove multiple times rapidly
- Add duplicate tokens (contract may reject)
- Remove tokens that are currently in use by active jobs

## Troubleshooting

### "Admin link doesn't appear"
- Ensure you're connected with the correct wallet
- Refresh the page after connecting
- Check you're using the admin wallet (not client/freelancer)

### "Access Denied" screen
- You're not connected as the admin
- Switch to the admin wallet in Freighter
- Contact the contract deployer if you believe you should have access

### Transaction stuck on "Signing..."
- Freighter popup may be hidden behind your browser
- Look for Freighter notification icon
- Try closing and reopening Freighter

### "Could not load whitelisted tokens"
- Check your internet connection
- Verify backend is running (if local development)
- Try refreshing the page

### Transaction rejected
- You may not be the admin
- Token address may be invalid
- Contract state may not allow the operation
- Check browser console for detailed error

## Development Setup

For local development:

1. Ensure backend is running on `http://localhost:3001` (or set `NEXT_PUBLIC_BACKEND_URL`)
2. Set `NEXT_PUBLIC_CONTRACT_ID` in `.env.local`
3. Connect Freighter to Testnet
4. Fund your admin wallet with XLM for transaction fees

## API Endpoints Used

The admin page interacts with these backend endpoints:

- `GET /api/jobs/whitelisted-tokens?contractId={id}` - Fetch whitelist
- `POST /api/jobs/query` - Check admin address
- `POST /api/jobs/build-tx` - Build add/remove transaction
- `POST /api/jobs/submit` - Submit signed transaction

## Security Notes

🔒 **Important:**
- The frontend check is for UX only
- Backend MUST verify admin status before executing operations
- Smart contract MUST enforce admin-only access
- Never hardcode admin credentials
- All operations require wallet signature

## Support

If you encounter issues:
1. Check the browser console for errors
2. Verify you're using the latest version
3. Ensure all dependencies are up to date
4. File an issue with reproduction steps
