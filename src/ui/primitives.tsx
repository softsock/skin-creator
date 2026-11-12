import clsx from 'clsx';
import type { LucideIcon } from 'lucide-react';
import { Slider as RadixSlider, Switch as RadixSwitch, ToggleGroup, Tooltip } from 'radix-ui';
import type { ButtonHTMLAttributes, ReactNode } from 'react';
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
          className="z-50 flex items-center gap-2 rounded-md border border-line-strong bg-raised px-2 py-1 text-[11px] text-fg shadow-lg shadow-black/40"
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
          'inline-flex size-7 shrink-0 items-center justify-center rounded-lg transition-colors',
          'focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent',
          'disabled:pointer-events-none disabled:opacity-35',
          active ? 'border-accent/50! bg-accent/20! text-accent' : 'text-muted hover:bg-hover hover:text-fg',
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
        'inline-flex h-7 items-center justify-center gap-1.5 rounded-lg px-2.5 text-xs font-medium transition-colors',
        'focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent',
        'disabled:pointer-events-none disabled:opacity-40',
        variant === 'primary' && 'bg-accent text-accent-fg hover:bg-accent/90',
        variant === 'outline' && 'border border-line-strong text-fg hover:bg-hover',
        variant === 'ghost' && 'text-muted hover:bg-hover hover:text-fg',
        className,
      )}
      {...props}
    />
  );
}

// compact single-choice control for modes such as view, model and paint target
export function Segmented<T extends string>({
  value,
  onChange,
  options,
  label,
  className,
}: {
  value: T;
  onChange: (value: T) => void;
  options: ReadonlyArray<{ value: T; label: string; icon?: LucideIcon; disabled?: boolean }>;
  label: string;
  className?: string;
}) {
  return (
    <ToggleGroup.Root
      type="single"
      value={value}
      aria-label={label}
      onValueChange={(next) => next && onChange(next as T)}
      className={clsx('inline-flex h-8 rounded-[10px] border border-line bg-app p-0.5', className)}
    >
      {options.map((option) => (
        <ToggleGroup.Item
          key={option.value}
          value={option.value}
          disabled={option.disabled}
          className={clsx(
            'inline-flex flex-auto items-center justify-center gap-1.5 rounded-lg px-2.5 text-xs font-medium whitespace-nowrap text-muted transition-colors',
            'hover:text-fg focus-visible:outline-2 focus-visible:outline-accent disabled:opacity-40',
            'data-[state=on]:bg-accent/20 data-[state=on]:text-fg data-[state=on]:shadow-[inset_0_0_0_1px_rgb(174_184_246/0.35)]',
          )}
        >
          {option.icon && <option.icon className="size-3.5" strokeWidth={1.75} />}
          {option.label}
        </ToggleGroup.Item>
      ))}
    </ToggleGroup.Root>
  );
}

// labelled slider with a numeric readout for tool and studio settings
export function SliderRow({
  label,
  value,
  min,
  max,
  step = 1,
  unit = '',
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  unit?: string;
  onChange: (value: number) => void;
}) {
  return (
    <label className="flex items-center gap-3 text-xs">
      <span className="w-20 shrink-0 text-muted">{label}</span>
      <RadixSlider.Root
        value={[value]}
        min={min}
        max={max}
        step={step}
        onValueChange={([next]) => next !== undefined && onChange(next)}
        className="relative flex h-5 flex-1 touch-none items-center"
      >
        <RadixSlider.Track className="relative h-1 flex-1 rounded-full bg-line-strong">
          <RadixSlider.Range className="absolute h-full rounded-full bg-accent/80" />
        </RadixSlider.Track>
        <RadixSlider.Thumb
          aria-label={label}
          className="block size-3 rounded-full bg-fg shadow focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        />
      </RadixSlider.Root>
      <span className="w-10 shrink-0 text-right tabular-nums text-fg">
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
        className="relative h-4 w-7 rounded-full bg-line-strong transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent data-[state=checked]:bg-accent"
      >
        <RadixSwitch.Thumb className="block size-3 translate-x-0.5 rounded-full bg-fg transition-transform data-[state=checked]:translate-x-3.5 data-[state=checked]:bg-accent-fg" />
      </RadixSwitch.Root>
    </label>
  );
}

// sidebar section with an optional title, giving every panel the same rhythm
export function Section({
  title,
  action,
  children,
}: {
  title?: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="border-b border-line px-3 py-3 last:border-b-0">
      {title && (
        <header className="mb-2.5 flex h-5 items-center justify-between">
          <h2 className="text-[11px] font-semibold tracking-wide text-muted uppercase">{title}</h2>
          {action}
        </header>
      )}
      <div className="flex flex-col gap-2">{children}</div>
    </section>
  );
}

// shared styling for dropdown menu surfaces
export const MENU_CLASS =
  'z-[1000] min-w-52 rounded-xl border border-line-strong bg-raised p-1 text-xs text-fg shadow-xl shadow-black/50';

// shared styling for one row of a dropdown menu
export const ITEM_CLASS =
  'flex h-7 cursor-default items-center justify-between gap-6 rounded-lg px-2 outline-none data-[disabled]:opacity-40 data-[highlighted]:bg-hover';
