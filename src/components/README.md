# Presentation rules

Use these rules on public pages and organiser screens alike.
The meaning of a control determines its appearance, not the page that contains it.

| Meaning                                                   | Shared treatment                                                                                         |
| --------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| Content group                                             | `Card`: unframed on public pages; retain borders for dialogs and administrative tools                    |
| Card contents                                             | `--card-inset`: zero on public pages, otherwise 20px horizontally and 16px on small screens              |
| Navigation, suggestions, opening a new or existing editor | `action-link`: plain text; colour and underline on hover; visible keyboard focus                         |
| Submit, save, retry, register, destructive operation      | `Button` / `button`: bordered control; blue for the primary action                                       |
| Filter or view selection                                  | `FilterPills`: links or buttons; one scrolling row with edge arrows; selected choice stays visible       |
| Descriptive metadata                                      | `tag`: subtle background, no border; links retain hover/focus feedback                                   |
| State                                                     | `tag tag-status` or `tag status-control`: compact neutral badge; `tag-upcoming` supplies accent emphasis |
| Input                                                     | Visible border, label and focus state                                                                    |
| Photo caption                                             | Plain inherited text; accent on hover, focus around the linked album                                     |

Keep separators between repeated list entries, distinct card sections, and form actions.
Do not add a box around each metadata value or nest bordered containers for spacing alone.
Align headings, filters, search fields and rows to the same content edge, including zero-padding card bodies.
Public layouts separate columns and sections with a 48px gap rather than enclosing each section in a box.
Use gaps to distinguish filter groups and metadata values.
Keep inline prose links recognisable as links; do not remove their underline globally.

Collection toolbars own a single 12px gap between filters and search.
Do not add padding or margins to filters nested inside `TableToolbar`.
Page layout owns spacing around standalone toolbars; list rows own spacing below card toolbars.

Descriptions and their topics form one group, with an 8px gap in series introductions.
People sections use 24px of separation and at least 220px per column, collapsing naturally on small screens.
Statistics wrap as a compact group with 40px between values; never distribute small totals across the entire card.

Feedback uses `Alert`, with `FormMessage` adapting form errors and success messages.
Alerts own their icon, body and heading typography; container selectors must not restyle their descendants.
Use amber for restrictions, red for failures and the accent colour for success.
Layout gaps own spacing between feedback and controls; avoid combining a gap with an extra alert margin.
A newsletter Test mode notice appears only for subscribed members; blocked requests explain the restriction inline after submission.

Survey sections own a single divider and 20px of top padding.
Short background questions share a row; explanatory copy belongs below its control.
Residence and citizenship use two columns where space permits.
Interest groups retain their ordering across desktop columns and mobile rows.

Photo playback controls are quiet 36px icon targets with hover and keyboard focus feedback, without a surrounding box or internal dividers.

Photo viewers use quiet Close/Previous/Next controls and compact chrome; the image itself separates the header and footer. Confirmation dialogs retain a distinct primary decision button.

Sharing and playback are quiet utilities: use the shared low-emphasis treatment, including Copy link, rather than a nested matrix of outlined buttons.
