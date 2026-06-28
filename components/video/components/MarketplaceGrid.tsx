import React from 'react';
import {ProductTile} from './ProductTile';
import {ShopItem} from '../types';

export const MarketplaceGrid: React.FC<{items: ShopItem[]}> = ({items}) => (
  <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 26, width: 900}}>
    {items.slice(0, 4).map((it, i) => (
      <ProductTile key={i} idx={i} title={it.title} price={it.price} image={it.image} />
    ))}
  </div>
);
