import React from 'react';
import {ProductTile} from './ProductTile';
import {MerchItem} from '../types';

export const MerchGrid: React.FC<{items: MerchItem[]}> = ({items}) => (
  <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 26, width: 900}}>
    {items.slice(0, 4).map((it, i) => (
      <ProductTile key={i} idx={i} title={it.name} price={it.price} image={it.image} fan />
    ))}
  </div>
);
