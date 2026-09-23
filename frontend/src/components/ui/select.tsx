"use client"

import * as React from "react"
import * as SelectPrimitive from "@radix-ui/react-select"
import { Check, ChevronDown, ChevronUp } from "lucide-react"

import { cn } from "@/lib/utils"

/**
 * Bọc Root để nuốt lần `onValueChange('')` giả của Radix.
 *
 * Khi Select nằm trong `<form>`, Radix gắn thêm một `<select>` ẩn để form đọc được giá trị, và
 * mỗi lần `value` đổi nó gán `select.value = value` rồi bắn sự kiện change. Nếu giá trị được đặt
 * bằng code (setValue/reset của react-hook-form) ngay khi danh sách vừa hiện — trước lúc các
 * `<option>` ẩn kịp đăng ký — thì gán không khớp option nào, `select.value` thành '' và Radix gọi
 * `onValueChange('')`, xoá sạch giá trị form vừa đặt. `SelectItem` không được phép có value ''
 * nên '' không bao giờ là lựa chọn thật của người dùng; bỏ qua là an toàn.
 */
/**
 * Nhãn của mọi `SelectItem` bên trong, gom lúc render để ô chọn tự rộng bằng mục dài nhất
 * (xem `SelectTrigger`). Không cần API mới: trang vẫn viết `Select > SelectTrigger + SelectContent`.
 */
const SelectLabelsContext = React.createContext<string[]>([])

function textOf(node: React.ReactNode): string {
  if (node == null || typeof node === 'boolean') return ''
  if (typeof node === 'string' || typeof node === 'number') return String(node)
  if (Array.isArray(node)) return node.map(textOf).join('')
  if (React.isValidElement<{ children?: React.ReactNode }>(node)) return textOf(node.props.children)
  return ''
}

function collectItemLabels(node: React.ReactNode, out: string[]) {
  React.Children.forEach(node, child => {
    if (!React.isValidElement<{ children?: React.ReactNode }>(child)) return
    if (child.type === SelectItem) {
      const t = textOf(child.props.children).trim()
      if (t) out.push(t)
      return
    }
    if (child.props.children) collectItemLabels(child.props.children, out)
  })
}

const Select = ({ onValueChange, children, ...props }: React.ComponentProps<typeof SelectPrimitive.Root>) => {
  const labels = React.useMemo(() => { const out: string[] = []; collectItemLabels(children, out); return out }, [children])
  return (
    <SelectLabelsContext.Provider value={labels}>
      <SelectPrimitive.Root
        {...props}
        onValueChange={onValueChange && ((value) => { if (value !== '') onValueChange(value) })}
      >
        {children}
      </SelectPrimitive.Root>
    </SelectLabelsContext.Provider>
  )
}

const SelectGroup = SelectPrimitive.Group

const SelectValue = SelectPrimitive.Value

const SelectTrigger = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Trigger>
>(({ className, children, ...props }, ref) => {
  const labels = React.useContext(SelectLabelsContext)
  return (
    <SelectPrimitive.Trigger
      ref={ref}
      className={cn(
        "flex h-9 w-full max-w-full items-center justify-between gap-2 rounded-control border border-[var(--color-input)] bg-[var(--color-card)] px-3 text-sm text-[var(--color-foreground)] transition-colors hover:border-[var(--color-border-strong)] data-[placeholder]:text-[var(--color-muted-foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--color-ring)] focus:ring-offset-0 focus:border-[var(--color-ring)] disabled:cursor-not-allowed disabled:opacity-50",
        className
      )}
      {...props}
    >
      {/*
        Ô giá trị và một "bóng" vô hình chứa MỌI nhãn xếp chồng lên nhau trong cùng một ô lưới:
        bề ngang của ô = nhãn dài nhất, nên ô chọn để `w-auto` sẽ rộng vừa mục dài nhất ngay từ
        đầu, không nhảy bề ngang khi đổi lựa chọn. Ô chọn có bề ngang cố định (`w-full`, `w-44`)
        thì cột lưới `minmax(0,1fr)` co lại và giá trị cắt "…" như trước.
      */}
      <span className="grid min-w-0 flex-1 grid-cols-[minmax(0,1fr)] overflow-hidden text-left [&>*]:[grid-area:1/1]">
        {/* flex chứ không phải inline: preflight đặt svg display:block, icon đứng trước SelectValue
            sẽ rớt xuống dòng riêng nếu bọc bằng span thường. */}
        <span className="flex min-w-0 items-center gap-2 [&>span]:truncate">{children}</span>
        {labels.length > 0 && (
          <span aria-hidden="true" className="invisible h-0 max-w-[20rem] overflow-hidden">
            {labels.map((l, i) => <span key={i} className="block whitespace-nowrap">{l}</span>)}
          </span>
        )}
      </span>
      <SelectPrimitive.Icon asChild>
        <ChevronDown className="h-4 w-4 shrink-0 text-[var(--color-muted-foreground)]" />
      </SelectPrimitive.Icon>
    </SelectPrimitive.Trigger>
  )
})
SelectTrigger.displayName = SelectPrimitive.Trigger.displayName

const SelectScrollUpButton = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.ScrollUpButton>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.ScrollUpButton>
>(({ className, ...props }, ref) => (
  <SelectPrimitive.ScrollUpButton
    ref={ref}
    className={cn(
      "flex cursor-default items-center justify-center py-1 text-[var(--color-muted-foreground)]",
      className
    )}
    {...props}
  >
    <ChevronUp className="h-4 w-4" />
  </SelectPrimitive.ScrollUpButton>
))
SelectScrollUpButton.displayName = SelectPrimitive.ScrollUpButton.displayName

const SelectScrollDownButton = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.ScrollDownButton>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.ScrollDownButton>
>(({ className, ...props }, ref) => (
  <SelectPrimitive.ScrollDownButton
    ref={ref}
    className={cn(
      "flex cursor-default items-center justify-center py-1 text-[var(--color-muted-foreground)]",
      className
    )}
    {...props}
  >
    <ChevronDown className="h-4 w-4" />
  </SelectPrimitive.ScrollDownButton>
))
SelectScrollDownButton.displayName =
  SelectPrimitive.ScrollDownButton.displayName

const SelectContent = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Content>
>(({ className, children, position = "popper", ...props }, ref) => (
  <SelectPrimitive.Portal>
    <SelectPrimitive.Content
      ref={ref}
      // z-[1100] chứ không phải z-50: Dialog/Drawer của app nằm ở z-[1000], select mở trong
      // modal mà thấp hơn thì danh sách nằm sau lớp phủ, bấm không ăn — trông như "không mở được".
      className={cn(
        "relative z-[1100] max-h-96 min-w-[8rem] overflow-hidden rounded-card border border-[var(--color-border)] bg-[var(--color-popover)] text-[var(--color-popover-foreground)] shadow-md data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 motion-reduce:animate-none",
        position === "popper" &&
          "data-[side=bottom]:translate-y-1 data-[side=left]:-translate-x-1 data-[side=right]:translate-x-1 data-[side=top]:-translate-y-1",
        className
      )}
      position={position}
      {...props}
    >
      <SelectScrollUpButton />
      <SelectPrimitive.Viewport
        className={cn(
          "p-1",
          // Rộng ÍT NHẤT bằng ô chọn, nhưng được nở theo mục dài nhất (trần 28rem / mép màn hình):
          // ép bằng đúng bề ngang ô chọn thì mục dài bị bẻ dòng, đọc thành hai lựa chọn.
          position === "popper" &&
            "w-full min-w-[var(--radix-select-trigger-width)] max-w-[min(28rem,calc(100vw-2rem))] overflow-x-hidden"
        )}
      >
        {children}
      </SelectPrimitive.Viewport>
      <SelectScrollDownButton />
    </SelectPrimitive.Content>
  </SelectPrimitive.Portal>
))
SelectContent.displayName = SelectPrimitive.Content.displayName

const SelectLabel = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.Label>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Label>
>(({ className, ...props }, ref) => (
  <SelectPrimitive.Label
    ref={ref}
    className={cn("px-2 py-1.5 text-eyebrow", className)}
    {...props}
  />
))
SelectLabel.displayName = SelectPrimitive.Label.displayName

const SelectItem = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.Item>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Item> & { extra?: React.ReactNode }
>(({ className, children, extra, ...props }, ref) => (
  <SelectPrimitive.Item
    ref={ref}
    className={cn(
      "relative flex w-full cursor-pointer select-none items-center whitespace-nowrap rounded-sm py-1.5 pl-8 pr-2 text-sm outline-none focus:bg-[var(--color-muted)] data-[state=checked]:text-[var(--color-primary)] data-[state=checked]:font-medium data-[disabled]:pointer-events-none data-[disabled]:opacity-50",
      className
    )}
    {...props}
  >
    <span className="absolute left-2 flex h-3.5 w-3.5 items-center justify-center">
      <SelectPrimitive.ItemIndicator>
        <Check className="h-4 w-4 text-[var(--color-primary)]" />
      </SelectPrimitive.ItemIndicator>
    </span>

    {/* Only the text passed here gets cloned into the closed trigger's SelectValue —
        keep it to a single concise line. Pass `extra` for richer subtext that should
        only appear in the open dropdown list, not duplicated into the trigger. */}
    <SelectPrimitive.ItemText>{children}</SelectPrimitive.ItemText>
    {extra}
  </SelectPrimitive.Item>
))
SelectItem.displayName = SelectPrimitive.Item.displayName

const SelectSeparator = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.Separator>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Separator>
>(({ className, ...props }, ref) => (
  <SelectPrimitive.Separator
    ref={ref}
    className={cn("-mx-1 my-1 h-px bg-[var(--color-border)]", className)}
    {...props}
  />
))
SelectSeparator.displayName = SelectPrimitive.Separator.displayName

export {
  Select,
  SelectGroup,
  SelectValue,
  SelectTrigger,
  SelectContent,
  SelectLabel,
  SelectItem,
  SelectSeparator,
  SelectScrollUpButton,
  SelectScrollDownButton,
}
