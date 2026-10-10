'use client';

import { useState } from 'react';
import { ArrowLeftRight, ArrowUpRight, QrCode } from 'lucide-react';
import type { PublicMenu } from '@/lib/types';

export function MenuPromotions() {
  return (
    <aside className="menu-promotions" aria-label="Our projects">
      <a className="menu-project" href="/" target="_blank" rel="noopener noreferrer">
        <QrCode size={19} aria-hidden="true" />
        <div>
          <strong>resQR</strong>
          <small>For your café</small>
        </div>
        <ArrowUpRight size={13} aria-hidden="true" />
      </a>
      <div className="menu-project">
        <ArrowLeftRight size={19} aria-hidden="true" />
        <div>
          <strong>Splitr</strong>
          <small>Coming soon</small>
        </div>
      </div>
    </aside>
  );
}

export function MenuAdvertisement({ restaurant }: { restaurant: PublicMenu['restaurant'] }) {
  const [failedImage, setFailedImage] = useState('');
  const image = restaurant.ad_image;
  const hasCreative = !!image && failedImage !== image;

  return (
    <aside className="menu-advertisement" aria-label="Advertisement">
      <span className="advertisement-label">Advertisement</span>
      <div className="menu-ad-space">
        {hasCreative && (
          <>
            <img
              src={image}
              alt={restaurant.ad_title || 'Advertisement'}
              loading="lazy"
              onError={() => setFailedImage(image)}
            />
            <div>
              {restaurant.ad_title && <strong>{restaurant.ad_title}</strong>}
              {restaurant.ad_url && (
                <a href={restaurant.ad_url} target="_blank" rel="sponsored noopener noreferrer">
                  Discover more <ArrowUpRight size={13} aria-hidden="true" />
                </a>
              )}
            </div>
          </>
        )}
      </div>
    </aside>
  );
}
