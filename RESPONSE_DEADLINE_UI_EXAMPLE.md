# Response Deadline UI Examples

## Normal State (Valid Input)

```
Response Deadline (days)

┌─────────┐ ┌─────────┐ ┌──────────┐ ┌──────────┐
│ 3 days  │ │ 7 days  │ │ 14 days  │ │ 30 days  │  ← Quick preset buttons
└─────────┘ └─────────┘ └──────────┘ └──────────┘
     ↑ Active preset is highlighted with accent color

┌───────────────────────────────────────────────┐
│ 7                                             │  ← Input field
└───────────────────────────────────────────────┘

Freelancer can claim funds automatically after 7 days if you do not respond
↑ Human-readable preview message in muted text
```

## Error State (Invalid Input)

```
Response Deadline (days)

┌─────────┐ ┌─────────┐ ┌──────────┐ ┌──────────┐
│ 3 days  │ │ 7 days  │ │ 14 days  │ │ 30 days  │
└─────────┘ └─────────┘ └──────────┘ └──────────┘

┌───────────────────────────────────────────────┐
│ 500                                           │  ← Red border indicates error
└───────────────────────────────────────────────┘
  ↑ border-danger class applied

❌ Must be at most 365 days
   ↑ Error message in red text
```

## After Clicking 14-Day Preset

```
Response Deadline (days)

┌─────────┐ ┌─────────┐ ┌──────────┐ ┌──────────┐
│ 3 days  │ │ 7 days  │ │ 14 days  │ │ 30 days  │
└─────────┘ └─────────┘ └──────────┘ └──────────┘
                            ↑ Now highlighted

┌───────────────────────────────────────────────┐
│ 14                                            │  ← Value updated
└───────────────────────────────────────────────┘

Freelancer can claim funds automatically after 14 days if you do not respond
                                                 ↑ Preview updated
```

## Empty Field Error

```
Response Deadline (days)

┌─────────┐ ┌─────────┐ ┌──────────┐ ┌──────────┐
│ 3 days  │ │ 7 days  │ │ 14 days  │ │ 30 days  │
└─────────┘ └─────────┘ └──────────┘ └──────────┘

┌───────────────────────────────────────────────┐
│                                               │  ← Red border
└───────────────────────────────────────────────┘

❌ Response deadline is required
```

## 1 Day (Singular Grammar)

```
Response Deadline (days)

┌─────────┐ ┌─────────┐ ┌──────────┐ ┌──────────┐
│ 3 days  │ │ 7 days  │ │ 14 days  │ │ 30 days  │
└─────────┘ └─────────┘ └──────────┘ └──────────┘

┌───────────────────────────────────────────────┐
│ 1                                             │
└───────────────────────────────────────────────┘

Freelancer can claim funds automatically after 1 day if you do not respond
                                                  ↑ "day" not "days"
```

## All Validation Messages

| Condition                | Error Message                    |
| ------------------------ | -------------------------------- |
| Empty field              | Response deadline is required    |
| Non-integer (e.g., 3.5)  | Must be a whole number of days   |
| Less than 1 (e.g., 0)    | Must be at least 1 day           |
| Greater than 365         | Must be at most 365 days         |
| Valid (1-365)            | _(No error, preview shows)_      |

## Color Scheme (Design Tokens Used)

- **Active preset button**: `border-accent-soft`, `bg-accent/10`, `text-accent-soft`
- **Inactive preset button**: `border-border-subtle`, `bg-surface-field`, `text-text-secondary`
- **Hover state**: `hover:border-accent-soft`, `hover:text-text-primary`
- **Error border**: `border-danger`, `focus:border-danger`, `focus:ring-danger`
- **Error text**: `text-danger-soft`
- **Preview text**: `text-text-muted`
- **Label text**: `text-text-muted`

## Responsive Behavior

- Preset buttons use `flex` layout with `gap-2` for consistent spacing
- Buttons are `px-3 py-1.5 text-xs` for compact, tappable targets
- All buttons respect `disabled` state during form submission
- Input field is full width (`w-full` from `inputClassName`)
- Layout stacks naturally on narrow viewports

## Accessibility Features

1. **Label association**: `<label htmlFor="response-deadline">`
2. **Error announcement**: `role="alert"` on error message
3. **ARIA attributes**:
   - `aria-invalid={!!deadlineError}` on input
   - `aria-describedby` links to error or preview
4. **Semantic HTML**: Uses proper `<button>` elements with `type="button"`
5. **Focus management**: All interactive elements keyboard-accessible
6. **Disabled state**: Visual and functional disabled state during submission
