# Admin Page Flow Diagrams

## Overall Page Flow

```mermaid
flowchart TD
    Start([User visits /admin]) --> Connected{Wallet Connected?}
    
    Connected -->|No| ShowPrompt[Show: Connect your wallet]
    ShowPrompt --> End1([End])
    
    Connected -->|Yes| CheckingAdmin[Show: Verifying admin access...]
    CheckingAdmin --> QueryContract[Query contract for admin address]
    QueryContract --> CompareAddress{Address matches?}
    
    CompareAddress -->|No| ShowDenied[Show: Access Denied 🔒]
    ShowDenied --> End2([End])
    
    CompareAddress -->|Yes| LoadWhitelist[Fetch whitelisted tokens]
    LoadWhitelist --> ShowAdmin[Show admin interface]
    ShowAdmin --> UserAction{User Action}
    
    UserAction -->|Add Token| AddFlow[Add Token Flow]
    UserAction -->|Remove Token| RemoveFlow[Remove Token Flow]
    UserAction -->|View Only| End3([End])
    
    AddFlow --> RefreshList[Refresh whitelist]
    RemoveFlow --> RefreshList
    RefreshList --> ShowAdmin
    
    style ShowDenied fill:#fee
    style ShowAdmin fill:#efe
    style CheckingAdmin fill:#ffa
```

## Add Token Flow

```mermaid
sequenceDiagram
    actor Admin
    participant UI as Admin Page
    participant Form as Add Token Form
    participant Backend
    participant Wallet as Freighter
    participant Network as Stellar Network
    
    Admin->>Form: Enter token address
    Admin->>Form: Click "Add to Whitelist"
    Form->>UI: Validate input
    
    Note over UI: Phase: Building
    UI->>Backend: POST /api/jobs/build-tx
    Backend->>Backend: Create unsigned transaction
    Backend-->>UI: Return XDR
    
    Note over UI: Phase: Signing
    UI->>Wallet: Request signature
    Wallet->>Admin: Show transaction details
    Admin->>Wallet: Approve
    Wallet-->>UI: Return signed XDR
    
    Note over UI: Phase: Submitting
    UI->>Backend: POST /api/jobs/submit
    Backend->>Network: Submit transaction
    Network-->>Backend: Transaction hash
    Backend-->>UI: Success
    
    Note over UI: Phase: Success
    UI->>UI: Show success banner
    UI->>UI: Clear form
    UI->>Backend: Fetch updated whitelist
    Backend-->>UI: Updated token list
    UI->>Admin: Display updated whitelist
```

## Remove Token Flow

```mermaid
sequenceDiagram
    actor Admin
    participant UI as Admin Page
    participant Button as Remove Button
    participant Backend
    participant Wallet as Freighter
    participant Network as Stellar Network
    
    Admin->>Button: Click "Remove"
    Button->>UI: Trigger remove
    
    Note over UI: Phase: Building
    Note over Button: Disabled + spinner
    UI->>Backend: POST /api/jobs/build-tx
    Backend->>Backend: Create unsigned transaction
    Backend-->>UI: Return XDR
    
    Note over UI: Phase: Signing
    UI->>Wallet: Request signature
    Wallet->>Admin: Show transaction details
    Admin->>Wallet: Approve
    Wallet-->>UI: Return signed XDR
    
    Note over UI: Phase: Submitting
    UI->>Backend: POST /api/jobs/submit
    Backend->>Network: Submit transaction
    Network-->>Backend: Transaction hash
    Backend-->>UI: Success
    
    Note over UI: Phase: Success
    UI->>UI: Show success banner
    UI->>Backend: Fetch updated whitelist
    Backend-->>UI: Updated token list
    UI->>Admin: Token removed from list
    Note over Button: Re-enabled
```

## Admin Check Flow

```mermaid
flowchart LR
    A[useIsAdmin Hook] --> B{Address exists?}
    B -->|No| C[Set isAdminUser = false]
    B -->|Yes| D[Call fetchAdminAddress]
    
    D --> E[POST /api/jobs/query]
    E --> F[method: get_admin]
    F --> G{Query successful?}
    
    G -->|No| H[Return null]
    G -->|Yes| I[Parse admin address]
    
    I --> J{Valid address?}
    J -->|No| H
    J -->|Yes| K[Return admin address]
    
    H --> C
    K --> L{Address matches wallet?}
    L -->|Yes| M[Set isAdminUser = true]
    L -->|No| C
    
    C --> N[Return result]
    M --> N
    
    style M fill:#efe
    style C fill:#fee
```

## State Management

```mermaid
stateDiagram-v2
    [*] --> Idle
    
    Idle --> CheckingAdmin: Wallet connected
    CheckingAdmin --> NotAdmin: Not admin address
    CheckingAdmin --> LoadingWhitelist: Is admin
    
    NotAdmin --> [*]: Show access denied
    
    LoadingWhitelist --> ReadyIdle: Whitelist loaded
    LoadingWhitelist --> ReadyError: Load failed
    
    ReadyIdle --> Building: User action
    ReadyError --> Building: User action
    
    Building --> Signing: XDR received
    Building --> ActionError: Build failed
    
    Signing --> Submitting: Transaction signed
    Signing --> ActionError: User declined
    
    Submitting --> Success: TX confirmed
    Submitting --> ActionError: Submit failed
    
    Success --> RefreshingList: Refresh triggered
    ActionError --> ReadyIdle: Error displayed
    
    RefreshingList --> ReadyIdle: List updated
    RefreshingList --> ReadyError: Refresh failed
    
    ReadyIdle --> [*]: User leaves page
    
    note right of NotAdmin
        Shows access denied screen
        No further actions possible
    end note
    
    note right of Success
        Shows success banner
        Clears form (for add)
        Auto-refreshes whitelist
    end note
```

## Component Architecture

```mermaid
graph TB
    AdminPage[AdminPage Component]
    
    AdminPage --> Navbar[Navbar]
    AdminPage --> WalletContext[useWallet Hook]
    AdminPage --> IsAdminHook[useIsAdmin Hook]
    AdminPage --> ActionStates[useActionStates Hook]
    
    IsAdminHook --> AdminLib[admin.ts Library]
    AdminLib --> Backend1[Backend API]
    
    AdminPage --> AdminCheck{Admin Check}
    AdminCheck -->|Loading| Spinner1[Loading Spinner]
    AdminCheck -->|Not Admin| Denied[Access Denied Screen]
    AdminCheck -->|Is Admin| AdminUI[Admin Interface]
    
    AdminUI --> AddForm[Add Token Form]
    AdminUI --> TokenList[Whitelisted Tokens]
    
    AddForm --> Input[Token Address Input]
    AddForm --> AddButton[Add Button]
    AddForm --> AddBanner[TxStatusBanner]
    
    AddButton --> BuildTx[Build Transaction]
    BuildTx --> SignTx[Sign in Freighter]
    SignTx --> SubmitTx[Submit Transaction]
    SubmitTx --> Refresh[Refresh Whitelist]
    
    TokenList --> TokenItem[Token Item]
    TokenItem --> TokenAddress[Address Display]
    TokenItem --> RemoveButton[Remove Button]
    TokenItem --> RemoveBanner[TxStatusBanner]
    
    RemoveButton --> BuildTx
    
    WalletContext --> Freighter[Freighter Wallet]
    ActionStates --> TxLib[transactions.ts]
    TxLib --> Backend2[Backend API]
    
    style AdminCheck fill:#ffa
    style Denied fill:#fee
    style AdminUI fill:#efe
    style Freighter fill:#e6f3ff
```

## Data Flow

```mermaid
flowchart LR
    subgraph Frontend
        A[Admin Page] --> B[useIsAdmin]
        B --> C[Fetch Admin Address]
        A --> D[Fetch Whitelist]
        A --> E[Execute Transaction]
    end
    
    subgraph Backend API
        F[Query Endpoint]
        G[Whitelist Endpoint]
        H[Build TX Endpoint]
        I[Submit Endpoint]
    end
    
    subgraph Smart Contract
        J[get_admin Method]
        K[get_whitelist Method]
        L[add_whitelisted_token]
        M[remove_whitelisted_token]
    end
    
    C -->|POST /query| F
    F -->|Invoke| J
    J -->|Admin Address| F
    F -->|Response| C
    
    D -->|GET /whitelist| G
    G -->|Query| K
    K -->|Token List| G
    G -->|Response| D
    
    E -->|POST /build-tx| H
    H -->|Build| L
    H -->|Build| M
    H -->|Unsigned XDR| E
    
    E -->|POST /submit| I
    I -->|Submit| L
    I -->|Submit| M
    I -->|TX Hash| E
    
    style A fill:#e1f5ff
    style F fill:#fff4e6
    style G fill:#fff4e6
    style H fill:#fff4e6
    style I fill:#fff4e6
    style J fill:#f0f0f0
    style K fill:#f0f0f0
    style L fill:#f0f0f0
    style M fill:#f0f0f0
```

## Error Handling

```mermaid
flowchart TD
    Start[User Action] --> TryBuild[Try: Build TX]
    TryBuild -->|Success| TrySign[Try: Sign TX]
    TryBuild -->|Error| BuildError[Build Error]
    
    TrySign -->|Success| TrySubmit[Try: Submit TX]
    TrySign -->|User Declined| DeclineError[Wallet Rejected Error]
    TrySign -->|Error| SignError[Signing Error]
    
    TrySubmit -->|Success| Success[Show Success]
    TrySubmit -->|Error| SubmitError[Submit Error]
    
    BuildError --> DisplayError[Display Error Banner]
    DeclineError --> DisplayError
    SignError --> DisplayError
    SubmitError --> DisplayError
    
    Success --> RefreshList[Refresh Whitelist]
    DisplayError --> Recoverable{Recoverable?}
    
    Recoverable -->|Yes| Retry[User can retry]
    Recoverable -->|No| Manual[Requires manual fix]
    
    RefreshList --> Done[Action Complete]
    Retry --> Start
    Manual --> Done
    
    style Success fill:#efe
    style BuildError fill:#fee
    style DeclineError fill:#fee
    style SignError fill:#fee
    style SubmitError fill:#fee
    style DisplayError fill:#ffe
```

## Notes

- All diagrams use consistent color coding:
  - 🟢 Green: Success/Admin states
  - 🔴 Red: Error/Denied states
  - 🟡 Yellow: Loading/Processing states
  - 🔵 Blue: User interface elements
  - ⚪ Gray: Backend/Contract components

- Flows are designed to be fault-tolerant with proper error handling
- All state transitions are explicit and traceable
- User feedback is provided at every step
