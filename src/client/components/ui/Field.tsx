import React from 'react';
import { Eye, EyeSlash } from '@phosphor-icons/react';
import { cn } from '../../lib/cn';

/**
 * `Field` owns its control. It used to render only a label + slot, so every
 * caller retyped the same input classes — 23 copies of one string across 13
 * files, and none of them could guarantee `aria-invalid` / `aria-describedby`.
 * Owning the control is what makes the accessibility contract verifiable.
 *
 * `select` is a native `<select>` (rung 4: a platform feature, not a custom
 * listbox rebuilt worse). Ids follow the repo convention `<file-path>-field-<n>`.
 */
export type FieldControl =
  | 'text'
  | 'email'
  | 'tel'
  | 'password'
  | 'number'
  | 'date'
  | 'time'
  | 'datetime-local'
  | 'search'
  | 'file'
  | 'checkbox'
  | 'textarea'
  | 'select';

export interface FieldOption {
  value: string;
  label: string;
}

export interface FieldProps {
  /** Required. Follows `<file-path>-field-<n>`. */
  id: string;
  label: string;
  control: FieldControl;
  value: string;
  onChange: (value: string) => void;
  /** select: the choices. file: accept filter. textarea: rows. */
  options?: FieldOption[];
  accept?: string;
  rows?: number;
  error?: string;
  hint?: string;
  required?: boolean;
  autoComplete?: string;
  placeholder?: string;
  className?: string;
  /** Leading icon inset into the control, mirroring the repo's search/filter grammar. */
  leadingIcon?: React.ReactNode;
  /** Trailing affordance, e.g. a clear-search button. Must own its own aria-label. */
  trailing?: React.ReactNode;
  /** Native select only: hides the OS arrow so `trailing` can carry a chevron. */
  hideSelectArrow?: boolean;
  /** Native `<datalist>` suggestions for free-text fields (division, group, …). */
  suggestions?: string[];
  /** Control-level classes for genuine per-field needs (e.g. a monospace token). */
  controlClassName?: string;
  disabled?: boolean;
  /**
   * Set when the field sits on a dark ground (the login screen). The label,
   * hint, and error invert to light; the control paints its own paper
   * background, so it is unaffected.
   */
  onDark?: boolean;
}

/** One control surface for the whole app. Never stack a background or border override. */
const controlClass =
  'w-full min-h-[44px] rounded-chip border border-rule-strong bg-paper px-3 py-2 text-xs sm:py-2.5 sm:text-sm text-ink ' +
  'placeholder:text-ink-3 focus-visible:outline-none focus-visible:ring-2 ' +
  'focus-visible:ring-pen-500 focus-visible:ring-offset-2 focus-visible:ring-offset-paper ' +
  'transition-colors disabled:opacity-60';

const invalidClass = 'border-pen-deep';

export const Field: React.FC<FieldProps> = ({
  id,
  label,
  control,
  value,
  onChange,
  options,
  accept,
  rows,
  error,
  hint,
  required,
  autoComplete,
  placeholder,
  className,
  leadingIcon,
  trailing,
  suggestions,
  hideSelectArrow,
  controlClassName,
  disabled,
  onDark,
}) => {
  const [revealed, setRevealed] = React.useState(false);
  const describedBy =
    [error ? `${id}-error` : null, !error && hint ? `${id}-hint` : null]
      .filter(Boolean)
      .join(' ') || undefined;

  const a11y = {
    id,
    'aria-invalid': error ? true : undefined,
    'aria-describedby': describedBy,
  } as const;

  const state = { required, disabled };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    onChange(e.target.value);

  // Adornments inset into the control rather than floating beside it, so the
  // icon never sits between the label and the value it annotates.
  const insetLeft = leadingIcon ? 'pl-9' : undefined;
  const insetRight = trailing || (hideSelectArrow && control === 'select') ? 'pr-9' : undefined;
  const surface = cn(
    controlClass,
    error && invalidClass,
    controlClassName,
    insetLeft,
    insetRight,
    hideSelectArrow && control === 'select' && 'appearance-none'
  );

  let controlNode: React.ReactNode;
  if (control === 'select') {
    controlNode = (
      <select {...a11y} value={value} {...state} onChange={handleChange} className={surface} data-control="select">
        {options?.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    );
  } else if (control === 'textarea') {
    controlNode = (
      <textarea
        {...a11y}
        value={value}
        {...state}
        onChange={handleChange}
        rows={rows ?? 4}
        className={surface}
        placeholder={placeholder}
        data-control="textarea"
      />
    );
  } else if (control === 'checkbox') {
    // A checkbox is its own label target; a second <label htmlFor> would make
    // screen readers announce the text twice.
    controlNode = (
      <label className="flex min-h-[44px] cursor-pointer items-center gap-2.5 text-sm text-ink">
        <input
          type="checkbox"
          checked={value === 'true'}
          onChange={(e) => onChange(String(e.target.checked))}
          disabled={disabled}
          className="h-4 w-4 shrink-0 accent-pen-500"
          data-control="checkbox"
        />
        <span>{placeholder ?? ''}</span>
      </label>
    );
  } else if (control === 'file') {
    controlNode = (
      <input
        {...a11y}
        type="file"
        {...state}
        accept={accept}
        onChange={handleChange}
        className={surface}
        data-control="file"
      />
    );
  } else if (control === 'password') {
    controlNode = (
      <input
        {...a11y}
        type={revealed ? 'text' : 'password'}
        value={value}
        {...state}
        onChange={handleChange}
        autoComplete={autoComplete ?? 'current-password'}
        placeholder={placeholder}
        className={cn(surface, 'pr-11')}
        data-control="password"
      />
    );
  } else {
    // A native datalist, not a custom combobox: the platform already ships
    // keyboard, screen-reader, and mobile behaviour for this.
    const listId = `${id}-suggestions`;
    const hasSuggestions = Boolean(suggestions && suggestions.length > 0);
    controlNode = (
      <>
        <input
          {...a11y}
          type={control}
          value={value}
          {...state}
          onChange={handleChange}
          autoComplete={autoComplete}
          accept={accept}
          placeholder={placeholder}
          list={hasSuggestions ? listId : undefined}
          className={surface}
          data-control={control}
        />
        {hasSuggestions && (
          <datalist id={listId}>
            {suggestions!.map((s) => (
              <option key={s} value={s} />
            ))}
          </datalist>
        )}
      </>
    );
  }

  const needsReveal = control === 'password';
  const needsInset = Boolean(leadingIcon || trailing);

  const body = needsReveal ? (
    <div className="relative">
      {leadingIcon && (
        <span aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-2">
          {leadingIcon}
        </span>
      )}
      {controlNode}
      <button
        type="button"
        aria-label={revealed ? 'Sembunyikan kata sandi' : 'Tampilkan kata sandi'}
        aria-pressed={revealed}
        onClick={() => setRevealed((v) => !v)}
        className={cn(
          'absolute right-1 top-1/2 -translate-y-1/2 flex h-8 w-8 sm:h-9 sm:w-9 items-center justify-center rounded-chip text-ink-3',
          'hover:bg-paper-sunk hover:text-ink transition-colors',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pen-500',
          'focus-visible:ring-offset-2 focus-visible:ring-offset-paper'
        )}
      >
        {revealed ? <EyeSlash size={16} weight="bold" /> : <Eye size={16} weight="bold" />}
      </button>
    </div>
  ) : needsInset ? (
    <div className="relative">
      {leadingIcon && (
        <span aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-2">
          {leadingIcon}
        </span>
      )}
      {controlNode}
      {trailing && <span className="absolute right-1.5 top-1/2 -translate-y-1/2">{trailing}</span>}
    </div>
  ) : (
    controlNode
  );

  return (
    <div className={cn('space-y-1 sm:space-y-1.5', className)}>
      <label
        htmlFor={id}
        className={cn(
          'block text-[11px] font-semibold uppercase tracking-wide',
          onDark ? 'text-paper/80' : 'text-ink-2'
        )}
      >
        {label}
        {required && (
          <span className={cn('ml-1', onDark ? 'text-paper/70' : 'text-pen-600')} aria-hidden="true">
            *
          </span>
        )}
      </label>
      {body}
      {hint && !error && (
        <p id={`${id}-hint`} className={cn('text-[11px]', onDark ? 'text-paper/70' : 'text-ink-3')}>
          {hint}
        </p>
      )}
      {error && (
        <p id={`${id}-error`} role="alert" className="text-[11px] font-medium text-pen-deep">
          {error}
        </p>
      )}
    </div>
  );
};