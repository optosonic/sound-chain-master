import React, { useState } from 'react';
import GenericChainStudio from '@/components/GenericChainStudio';

/**
 * ChainDemo — standalone preview of the generic serial + parallel chain.
 * Temporary page so the design can be reviewed / copied. Remove later.
 */
export default function ChainDemo() {
  const [items, setItems] = useState([
    { id: '1', type: 'cmp', enabled: true },
    { id: '2', type: 'sat', enabled: false },
    { id: '3', type: 'eq',  enabled: true },
    { id: '4', type: 'lim', enabled: true },
  ]);
  const [loopItems, setLoopItems] = useState([]);
  const [selectedId, setSelectedId] = useState('1');
  const [loopSelectedId, setLoopSelectedId] = useState(null);
  const [routingMode, setRoutingMode] = useState('serial');

  return (
    <div className="min-h-screen bg-[#0d0f11] p-6">
      <h1 className="mb-4 font-mono text-sm uppercase tracking-widest text-white/50">Generic Chain Studio — demo</h1>
      <GenericChainStudio
        items={items}
        onChange={setItems}
        loopItems={loopItems}
        onLoopChange={setLoopItems}
        selectedId={selectedId}
        onSelect={setSelectedId}
        loopSelectedId={loopSelectedId}
        onLoopSelect={setLoopSelectedId}
        routingMode={routingMode}
        onRoutingModeChange={setRoutingMode}
      />
      <div className="mt-4 font-mono text-[10px] text-white/40">
        Drag boxes to reorder · hold to toggle · double-click to remove · drag a serial box's bottom dot down to create a parallel send · drag a parallel box's bottom dot up to set the return.
      </div>
    </div>
  );
}