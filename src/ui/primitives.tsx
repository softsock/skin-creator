import clsx from 'clsx';
import { ChevronDown, type LucideIcon } from 'lucide-react';
import { Slider as RadixSlider, Switch as RadixSwitch, ToggleGroup, Tooltip } from 'radix-ui';
import { useState, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { formatShortcut } from './shortcuts';

// tooltip with an optional shortcut hint, used on every icon-only control
export function Tip({
  label,
  shortcut,
  side = 'bottom',
  children,
}: {
  label: string;
  shortcut?: string;
  side?: 'top' | 'right' | 'bottom' | 'left';
  children: ReactNode;
}) {
  return (
    <Tooltip.Root>
      <Tooltip.Trigger asChild>{children}</Tooltip.Trigger>
      <Tooltip.Portal>
        <Tooltip.Content
          side={side}
          sideOffset={6}
          className="z-50 flex max-w-64 items-center gap-2 rounded-md border border-line bg-raised px-2 py-1 text-[11px] text-fg shadow-lg shadow-black/40"
        >
          {label}
          {shortcut && <kbd className="font-sans text-[10px] text-faint">{formatShortcut(shortcut)}</kbd>}
        </Tooltip.Content>
      </Tooltip.Portal>
    </Tooltip.Root>
  );
}

// square icon button with consistent hover, active and disabled states
export function IconButton({
  label,
  shortcut,
  icon: Icon,
  active,
  tipSide,
  className,
  ...props
}: {
  label: string;
  shortcut?: string;
  icon: LucideIcon;
  active?: boolean;
  tipSide?: 'top' | 'right' | 'bottom' | 'left';
} & ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <Tip label={label} shortcut={shortcut} side={tipSide}>
      <button
        type="button"
        aria-label={label}
        aria-pressed={active}
        className={clsx(
          'inline-flex size-7 shrink-0 items-center justify-center rounded-md transition-colors',
          'focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent',
          'disabled:pointer-events-none disabled:opacity-35',
          active ? 'bg-accent text-accent-fg' : 'text-muted hover:bg-hover hover:text-fg',
          className,
        )}
        {...props}
      >
        <Icon className="size-4" strokeWidth={1.75} />
      </button>
    </Tip>
  );
}

// text button in the three emphasis levels used across the app
export function Button({
  variant = 'ghost',
  className,
  ...props
}: { variant?: 'primary' | 'outline' | 'ghost' } & ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      className={clsx(
        'inline-flex h-7 items-center justify-center gap-1.5 rounded-md px-2.5 text-xs font-medium transition-colors',
        'focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent',
        'disabled:pointer-events-none disabled:opacity-40',
        variant === 'primary' && 'bg-accent text-accent-fg hover:bg-accent/90',
        variant === 'outline' && 'bg-hover text-fg hover:bg-selected',
        variant === 'ghost' && 'text-muted hover:bg-hover hover:text-fg',
        className,
      )}
      {...props}
    />
  );
}

// single-choice control, boxed for settings and underlined tabs for the mode selector
export function Segmented<T extends string>({
  value,
  onChange,
  options,
  label,
  variant = 'boxed',
  iconOnly,
  className,
}: {
  value: T;
  onChange: (value: T) => void;
  options: ReadonlyArray<{ value: T; label: string; icon?: LucideIcon; disabled?: boolean }>;
  label: string;
  variant?: 'boxed' | 'tabs';
  iconOnly?: boolean;
  className?: string;
}) {
  return (
    <ToggleGroup.Root
      type="single"
      value={value}
      aria-label={label}
      onValueChange={(next) => next && onChange(next as T)}
      className={clsx(
        'inline-flex',
        variant === 'boxed' ? 'h-7 gap-px rounded-md bg-back p-0.5' : 'h-full items-stretch',
        className,
      )}
    >
      {options.map((option) => (
        <ToggleGroup.Item
          key={option.value}
          value={option.value}
          disabled={option.disabled}
          aria-label={iconOnly ? option.label : undefined}
          title={iconOnly ? option.label : undefined}
          className={clsx(
            'inline-flex flex-auto items-center justify-center gap-1.5 whitespace-nowrap text-muted transition-colors',
            'hover:text-fg focus-visible:outline-2 focus-visible:outline-accent disabled:opacity-40',
            variant === 'boxed'
              ? 'rounded-sm px-2.5 text-xs font-medium data-[state=on]:bg-selected data-[state=on]:text-fg'
              : 'border-b-2 border-transparent px-4 text-[13px] hover:bg-hover data-[state=on]:border-accent data-[state=on]:bg-panel data-[state=on]:text-fg',
            iconOnly && 'px-2',
          )}
        >
          {option.icon && <option.icon className="size-3.5" strokeWidth={1.75} />}
          {!iconOnly && option.label}
        </ToggleGroup.Item>
      ))}
    </ToggleGroup.Root>
  );
}

// labelled slider with a numeric readout, compact when placed inside a toolbar
export function SliderRow({
  label,
  value,
  min,
  max,
  step = 1,
  unit = '',
  compact,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  unit?: string;
  compact?: boolean;
  onChange: (value: number) => void;
}) {
  return (
    <label className={clsx('flex items-center text-xs', compact ? 'gap-2' : 'gap-3')}>
      <span className={clsx('shrink-0 text-muted', !compact && 'w-20')}>{label}</span>
      <RadixSlider.Root
        value={[value]}
        min={min}
        max={max}
        step={step}
        onValueChange={([next]) => next !== undefined && onChange(next)}
        className={clsx('relative flex h-5 touch-none items-center', compact ? 'w-20' : 'flex-1')}
      >
        <RadixSlider.Track className="relative h-1 flex-1 rounded-full bg-back">
          <RadixSlider.Range className="absolute h-full rounded-full bg-accent" />
        </RadixSlider.Track>
        <RadixSlider.Thumb
          aria-label={label}
          className="block size-3 rounded-full bg-fg shadow focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        />
      </RadixSlider.Root>
      <span className={clsx('shrink-0 text-right tabular-nums text-fg', compact ? 'w-7' : 'w-10')}>
        {value}
        {unit}
      </span>
    </label>
  );
}

// labelled on/off switch for boolean settings
export function SwitchRow({
  label,
  checked,
  onChange,
  disabled,
}: {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <label className={clsx('flex h-6 items-center justify-between text-xs', disabled && 'opacity-40')}>
      <span className="text-muted">{label}</span>
      <RadixSwitch.Root
        checked={checked}
        disabled={disabled}
        onCheckedChange={onChange}
        className="relative h-4 w-7 rounded-full bg-back transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent data-[state=checked]:bg-accent"
      >
        <RadixSwitch.Thumb className="block size-3 translate-x-0.5 rounded-full bg-muted transition-transform data-[state=checked]:translate-x-3.5 data-[state=checked]:bg-accent-fg" />
      </RadixSwitch.Root>
    </label>
  );
}

// docked sidebar panel with a title handle that folds its content away
export function Section({
  title,
  action,
  flush,
  children,
}: {
  title: string;
  action?: ReactNode;
  flush?: boolean;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(true);
  return (
    <section className="border-b border-line">
      <header className="flex h-7 items-center gap-0.5 bg-back pr-1.5 pl-1">
        <button
          type="button"
          aria-expanded={open}
          aria-label={`${open ? 'Fold' : 'Unfold'} ${title} panel`}
          onClick={() => setOpen(!open)}
          className="flex size-5 shrink-0 items-center justify-center rounded-sm text-faint transition-colors hover:text-fg focus-visible:outline-2 focus-visible:outline-accent"
        >
          <ChevronDown className={clsx('size-3.5 transition-transform', !open && '-rotate-90')} />
        </button>
        <h2 className="min-w-0 flex-1 truncate text-xs font-medium text-muted">{title}</h2>
        {action}
      </header>
      {open && <div className={flush ? undefined : 'flex flex-col gap-2 px-2.5 py-2.5'}>{children}</div>}
    </section>
  );
}
