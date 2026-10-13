import { Leaf, Sparkles, Tag } from 'lucide-react';
import { money } from '@/lib/client';
import type { MenuItem, MenuShowcase } from '@/lib/types';

export function CustomerShowcases({
  sections,
  menu,
}: {
  sections: MenuShowcase[];
  menu: MenuItem[];
}) {
  return (
    <div className="customer-showcases">
      {sections.map((section) => (
        <section
          key={section.slot}
          className="customer-showcase"
          aria-label={`${section.title} featured dishes`}
        >
          <div className="showcase-title">
            <span aria-hidden="true">
              {section.slot === 1 ? <Sparkles size={16} /> : <Tag size={16} />}
            </span>
            <h2>{section.title}</h2>
          </div>
          {section.description && <p className="showcase-message">{section.description}</p>}
          <div className="showcase-cards" tabIndex={0} aria-label={`${section.title} dishes`}>
            {section.item_ids
              .map((id) => menu.find((item) => item.id === id))
              .filter((item): item is MenuItem => !!item)
              .map((item) => (
                <article
                  key={item.id}
                  className={`showcase-card ${item.available ? '' : 'sold-out'}`}
                >
                  {item.image && <img src={item.image} alt={item.name} loading="lazy" />}
                  <div className="showcase-card-copy">
                    <div className="showcase-dish-title">
                      <h3>{item.name}</h3>
                      {!!item.vegetarian && <Leaf size={12} aria-label="Vegetarian" />}
                    </div>
                    {item.description && <p>{item.description}</p>}
                    <div className="showcase-card-price">
                      <strong className="dish-price">
                        <span className="dish-currency">Rs.</span> {money(item.price).slice(4)}
                      </strong>
                      {!item.available && <span className="sold-out-label">Sold out today</span>}
                    </div>
                  </div>
                </article>
              ))}
          </div>
        </section>
      ))}
    </div>
  );
}
