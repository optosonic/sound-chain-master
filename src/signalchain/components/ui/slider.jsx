import * as React from "react";
import * as SliderPrimitive from "@radix-ui/react-slider";
import { cn } from "../lib/utils";

const Slider = React.forwardRef(({ className, defaultValue, onValueChange, value, min = 0, max = 100, ...props }, ref) => (
  // Option-click (Alt) resets every thumb to its neutral position: a caller-
  // supplied defaultValue, otherwise 0 when 0 sits inside the range, or the
  // bottom of the range. Capture-phase + stopPropagation blocks Radix's own
  // pointer handler so the thumb doesn't also jump under the cursor.
  <div
    className="w-full"
    onPointerDownCapture={(e) => {
      if (!e.altKey) return;
      e.preventDefault();
      e.stopPropagation();
      const reset = defaultValue != null ? defaultValue : (0 >= min && 0 <= max ? 0 : min);
      onValueChange?.(Array.isArray(value) ? value.map(() => reset) : [reset]);
    }}
  >
    <SliderPrimitive.Root
      ref={ref}
      className={cn("relative flex w-full touch-none select-none items-center", className)}
      value={value}
      onValueChange={onValueChange}
      min={min}
      max={max}
      {...props}
    >
      <SliderPrimitive.Track className="relative h-1.5 w-full grow overflow-hidden rounded-full bg-primary">
        <SliderPrimitive.Range className="absolute h-full bg-primary" />
      </SliderPrimitive.Track>
      {value?.map((_, i) => (
        <SliderPrimitive.Thumb
          key={i}
          className="block h-4 w-4 rounded-full border border-primary bg-background shadow transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50"
        />
      ))}
    </SliderPrimitive.Root>
  </div>
));
Slider.displayName = SliderPrimitive.Root.displayName;

export { Slider };