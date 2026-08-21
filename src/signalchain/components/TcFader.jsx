import React from 'react';
import { Slider } from './ui/slider';

/**
 * TcFader — a TC Native-style horizontal fader row: brushed-aluminum panel
 * label + LCD value readout, plus an inset dark groove with a cool-blue
 * illuminated fill and a metallic knurled cap carrying a blue LED.
 * Pure presentation over the shared shadcn Slider (see .tc-fader CSS).
 */
export default function TcFader({ label, value, min, max, step = 1, unit = '', defaultValue, format, onChange }) {
  const display = format ? format(value) : value;
  return (
    <div className="space-y-0.5">
      <div className="flex justify-between items-baseline">
        <span className="tc-label">{label}</span>
        <span className="tc-value text-[10px]">{display}{unit}</span>
      </div>
      <Slider
        value={[value]}
        onValueChange={([v]) => onChange(v)}
        defaultValue={defaultValue}
        min={min}
        max={max}
        step={step}
        className="tc-fader"
      />
    </div>
  );
}